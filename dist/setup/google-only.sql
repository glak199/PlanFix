-- Upgrade an installed PlanFix database to Google-only access.
-- Idempotent and non-destructive: existing plans, votes, memberships, and users remain.
begin;
create or replace function planfix_private.google_account() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
   select 1 from auth.users u join auth.identities i on i.user_id=u.id
   where u.id=auth.uid() and u.is_anonymous=false and i.provider='google'
 ) and not exists(select 1 from planfix_private.identity_links where guest_id=auth.uid())
$$;
create or replace function planfix_private.actor() returns uuid language plpgsql stable security definer set search_path='' as $$
begin
 if not planfix_private.google_account() then
  raise exception 'Sign in with Google to use PlanFix.' using errcode='42501';
 end if;
 return auth.uid();
end $$;
create or replace function planfix_private.owns(identity_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select planfix_private.google_account() and planfix_private.canonical(identity_id)=auth.uid()
$$;
revoke all on function planfix_private.google_account() from public,anon,authenticated;
-- Retain legacy records and existing account links; stop creating new guest upgrade tickets.
revoke all on function public.prepare_guest_upgrade() from public,anon,authenticated;
-- Public capability marker. Contains no user or application data.
create or replace function public.planfix_auth_mode() returns text language sql immutable set search_path='' as $$select 'google_only'::text$$;
revoke all on function public.planfix_auth_mode() from public;
grant execute on function public.planfix_auth_mode() to anon,authenticated;
commit;
