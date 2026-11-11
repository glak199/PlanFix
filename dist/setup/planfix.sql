-- PlanFix Google-only installation. Run once in a fresh project.
-- Google OAuth must be enabled in Auth settings. Keep Anonymous Sign-Ins disabled.
begin;
create schema if not exists planfix_private;
revoke all on schema planfix_private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id),
  nickname text not null check(length(nickname) between 2 and 30)
);
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check(length(btrim(name)) between 1 and 50),
  emoji text not null default '✌️' check(length(emoji)<=12),
  owner_id uuid not null references auth.users(id),
  invite_token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text,'-',''),
  created_at timestamptz not null default now()
);
create table public.group_members (
  group_id uuid references public.groups(id), user_id uuid references auth.users(id),
  joined_at timestamptz not null default now(), primary key(group_id,user_id)
);
create table public.plans (
  id uuid primary key default gen_random_uuid(), title text not null check(length(btrim(title)) between 1 and 80),
  date date not null, time time, location text check(length(location)<=120),
  category text not null check(category in ('dinner','mountains','concert')),
  status text not null default 'voting' check(status in ('voting','confirmed')),
  owner_id uuid not null references auth.users(id), group_id uuid references public.groups(id),
  invite_token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text,'-',''),
  created_at timestamptz not null default now()
);
create table public.plan_members (
  plan_id uuid references public.plans(id), user_id uuid references auth.users(id),
  joined_at timestamptz not null default now(), primary key(plan_id,user_id)
);
create table public.options (
  id uuid primary key default gen_random_uuid(), plan_id uuid not null references public.plans(id),
  label text not null check(length(btrim(label)) between 1 and 100), position integer not null,
  unique(plan_id,label), unique(plan_id,id)
);
-- One active choice per original identity. Keep original records when accounts merge.
create table public.votes (
  plan_id uuid references public.plans(id), user_id uuid references auth.users(id),
  option_id uuid not null, active boolean not null default true, updated_at timestamptz not null default now(),
  primary key(plan_id,user_id), foreign key(plan_id,option_id) references public.options(plan_id,id)
);
create table planfix_private.identity_links (
  guest_id uuid primary key references auth.users(id), account_id uuid not null references auth.users(id),
  linked_at timestamptz not null default now(), check(guest_id<>account_id)
);
create table planfix_private.upgrade_tickets (
  hash text primary key, guest_id uuid not null references auth.users(id),
  expires_at timestamptz not null, consumed_by uuid references auth.users(id)
);
create index on public.plans(group_id);
create index on public.group_members(user_id);
create index on public.plan_members(user_id);
create index on planfix_private.identity_links(account_id);

create function planfix_private.actor() returns uuid language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
  if actor is null or exists(select 1 from planfix_private.identity_links where guest_id=actor) then
    raise exception 'Please start a new guest session or sign in again.' using errcode='42501';
  end if;
  return actor;
end $$;
create function planfix_private.canonical(identity_id uuid) returns uuid language sql stable security definer set search_path='' as $$
  select coalesce((select account_id from planfix_private.identity_links where guest_id=identity_id),identity_id)
$$;
create function planfix_private.owns(identity_id uuid) returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and planfix_private.canonical(identity_id)=auth.uid()
    and not exists(select 1 from planfix_private.identity_links where guest_id=auth.uid())
$$;
create function planfix_private.in_group(gid uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.group_members where group_id=gid and planfix_private.owns(user_id))
$$;
create function planfix_private.in_plan(pid uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.plans p where p.id=pid and (
    planfix_private.owns(p.owner_id) or planfix_private.in_group(p.group_id)
    or exists(select 1 from public.plan_members m where m.plan_id=pid and planfix_private.owns(m.user_id))))
$$;

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.plans enable row level security;
alter table public.plan_members enable row level security;
alter table public.options enable row level security;
alter table public.votes enable row level security;
alter table planfix_private.identity_links enable row level security;
alter table planfix_private.upgrade_tickets enable row level security;
-- Reads are protected; all mutations go through validated RPCs.
create policy own_profile on public.profiles for select to authenticated using(planfix_private.owns(id));
create policy member_group on public.groups for select to authenticated using(planfix_private.in_group(id));
create policy member_group_members on public.group_members for select to authenticated using(planfix_private.in_group(group_id));
create policy member_plan on public.plans for select to authenticated using(planfix_private.in_plan(id));
create policy member_plan_members on public.plan_members for select to authenticated using(planfix_private.in_plan(plan_id));
create policy member_options on public.options for select to authenticated using(planfix_private.in_plan(plan_id));
create policy member_votes on public.votes for select to authenticated using(planfix_private.in_plan(plan_id));
revoke all on public.profiles,public.groups,public.group_members,public.plans,public.plan_members,public.options,public.votes from anon,authenticated;
grant select on public.profiles,public.groups,public.group_members,public.plans,public.plan_members,public.options,public.votes to authenticated;

create function public.set_nickname(nickname text) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=planfix_private.actor();
begin
  insert into public.profiles(id,nickname) values(actor,btrim(nickname))
  on conflict(id) do update set nickname=excluded.nickname;
end $$;
create function public.create_group(group_name text,emoji text default '✌️') returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=planfix_private.actor(); gid uuid;
begin
  insert into public.groups(name,emoji,owner_id) values(btrim(group_name),emoji,actor) returning id into gid;
  insert into public.group_members(group_id,user_id) values(gid,actor);
  return gid;
end $$;
create function public.create_plan(title text,plan_date date,plan_time time,location text,category text,group_id uuid,choices text[])
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=planfix_private.actor(); pid uuid; choice text; n integer:=0;
begin
  if group_id is not null and not planfix_private.in_group(group_id) then raise exception 'Join this group before creating a plan.' using errcode='42501'; end if;
  if coalesce(array_length(choices,1),0) not between 2 and 6 then raise exception 'Add 2–6 voting options.'; end if;
  insert into public.plans(title,date,time,location,category,group_id,owner_id)
  values(btrim(title),plan_date,plan_time,location,category,group_id,actor) returning id into pid;
  insert into public.plan_members(plan_id,user_id) values(pid,actor);
  foreach choice in array choices loop
    insert into public.options(plan_id,label,position) values(pid,btrim(choice),n); n:=n+1;
  end loop;
  return pid;
end $$;
create function public.join_invite(token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=planfix_private.actor(); pid uuid; gid uuid;
begin
  if length(token)<>64 then raise exception 'This invitation is not valid.'; end if;
  select id into pid from public.plans where invite_token=token;
  if pid is not null then
    if not planfix_private.in_plan(pid) then insert into public.plan_members(plan_id,user_id) values(pid,actor) on conflict do nothing; end if;
    return jsonb_build_object('kind','plan','id',pid);
  end if;
  select id into gid from public.groups where invite_token=token;
  if gid is not null then
    if not planfix_private.in_group(gid) then insert into public.group_members(group_id,user_id) values(gid,actor) on conflict do nothing; end if;
    return jsonb_build_object('kind','group','id',gid);
  end if;
  raise exception 'This invitation is not valid. Ask your friend for a new link.';
end $$;
create function public.cast_vote(plan_id uuid,option_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=planfix_private.actor(); plan_status text; previous uuid;
begin
  if not planfix_private.in_plan(plan_id) then raise exception 'Join this plan before voting.' using errcode='42501'; end if;
  -- The plan row lock serializes voting with confirmation.
  select status into plan_status from public.plans where id=plan_id for update;
  if plan_status<>'voting' then raise exception 'This plan is confirmed. Voting is closed.'; end if;
  if not exists(select 1 from public.options o where o.id=option_id and o.plan_id=cast_vote.plan_id) then raise exception 'Invalid voting option.'; end if;
  select v.option_id into previous from public.votes v where v.plan_id=cast_vote.plan_id and planfix_private.owns(v.user_id) and v.active order by v.updated_at desc,v.user_id limit 1;
  -- Preserve historical rows. Exactly one effective active vote after changing a vote.
  update public.votes v set active=false where v.plan_id=cast_vote.plan_id and planfix_private.owns(v.user_id);
  if previous is distinct from option_id then
    insert into public.votes as v(plan_id,user_id,option_id) values(plan_id,actor,option_id)
    on conflict on constraint votes_pkey do update set option_id=excluded.option_id,active=true,updated_at=clock_timestamp();
  end if;
end $$;
create function public.confirm_plan(plan_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  perform planfix_private.actor();
  update public.plans p set status='confirmed' where p.id=plan_id and planfix_private.owns(p.owner_id);
  if not found then raise exception 'Only the plan’s creator can confirm it.' using errcode='42501'; end if;
end $$;

create function public.prepare_guest_upgrade() returns text language plpgsql security definer set search_path='' as $$
declare actor uuid:=planfix_private.actor(); token text:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
begin
  if not exists(select 1 from auth.users where id=actor and is_anonymous) then raise exception 'Only guest sessions can prepare an upgrade.'; end if;
  insert into planfix_private.upgrade_tickets(hash,guest_id,expires_at) values(encode(sha256(convert_to(token,'UTF8')),'hex'),actor,now()+interval '1 hour');
  return token;
end $$;
create function public.complete_guest_upgrade(token text) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=planfix_private.actor(); ticket planfix_private.upgrade_tickets; existing uuid;
begin
  if not exists(select 1 from auth.users u where u.id=actor and not u.is_anonymous)
    or not exists(select 1 from auth.identities i where i.user_id=actor and i.provider='google') then
    raise exception 'Sign in with Google to save your guest plans.' using errcode='42501';
  end if;
  select * into ticket from planfix_private.upgrade_tickets where hash=encode(sha256(convert_to(token,'UTF8')),'hex') for update;
  if not found then raise exception 'This account upgrade could not be verified.' using errcode='42501'; end if;
  if ticket.consumed_by=actor then return; end if;
  if ticket.consumed_by is not null or ticket.expires_at<now() then raise exception 'This upgrade link has expired or was already used.' using errcode='42501'; end if;
  -- Serialize all upgrade tickets for a guest. Only an anonymous source may migrate.
  perform 1 from auth.users where id=ticket.guest_id and is_anonymous for update;
  if not found then raise exception 'The guest session has already been upgraded.'; end if;
  select account_id into existing from planfix_private.identity_links where guest_id=ticket.guest_id;
  if existing is not null and existing<>actor then raise exception 'This guest session already belongs to another account.' using errcode='42501'; end if;
  if ticket.guest_id=actor then raise exception 'Already using this identity.'; end if;
  insert into planfix_private.identity_links(guest_id,account_id) values(ticket.guest_id,actor) on conflict(guest_id) do nothing;
  update planfix_private.upgrade_tickets set consumed_by=actor where hash=ticket.hash;
  -- Deliberately retain all plans, memberships, and vote rows. Authorization follows the alias.
end $$;

create function public.dashboard() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=planfix_private.actor(); result jsonb;
begin
  select jsonb_build_object(
    'groups',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'emoji',g.emoji,'invite_token',g.invite_token,
      'members',(select count(distinct planfix_private.canonical(m.user_id)) from public.group_members m where m.group_id=g.id)) order by g.created_at)
      from public.groups g where planfix_private.in_group(g.id)),'[]'::jsonb),
    'plans',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'title',p.title,'date',p.date,'time',p.time,'location',p.location,
      'category',p.category,'status',p.status,'group_id',p.group_id,'group_name',coalesce(g.name,'Your people'),'invite_token',p.invite_token,
      'owner',planfix_private.owns(p.owner_id),'members',(select count(distinct planfix_private.canonical(m.user_id)) from (
        select user_id from public.plan_members where plan_id=p.id union all select user_id from public.group_members where group_id=p.group_id) m),
      'options',(select jsonb_agg(jsonb_build_object('id',o.id,'label',o.label,
        'votes',(select count(*) from (select distinct on(planfix_private.canonical(v.user_id)) v.option_id from public.votes v
          where v.plan_id=p.id and v.active order by planfix_private.canonical(v.user_id),v.updated_at desc,v.user_id) effective where effective.option_id=o.id),
        'selected',o.id=(select v.option_id from public.votes v where v.plan_id=p.id and planfix_private.owns(v.user_id) and v.active order by v.updated_at desc,v.user_id limit 1)
      ) order by o.position) from public.options o where o.plan_id=p.id)) order by p.created_at desc)
      from public.plans p left join public.groups g on g.id=p.group_id where planfix_private.in_plan(p.id)),'[]'::jsonb)) into result;
  return result;
end $$;

-- PostgreSQL grants function execution to PUBLIC by default. Revoke it explicitly.
revoke all on all functions in schema planfix_private from public,anon,authenticated;
grant usage on schema planfix_private to authenticated;
grant execute on function planfix_private.owns(uuid),planfix_private.in_group(uuid),planfix_private.in_plan(uuid) to authenticated;
revoke all on function public.set_nickname(text),public.create_group(text,text),public.create_plan(text,date,time,text,text,uuid,text[]),
  public.join_invite(text),public.cast_vote(uuid,uuid),public.confirm_plan(uuid),public.prepare_guest_upgrade(),public.complete_guest_upgrade(text),public.dashboard() from public,anon;
grant execute on function public.set_nickname(text),public.create_group(text,text),public.create_plan(text,date,time,text,text,uuid,text[]),
  public.join_invite(text),public.cast_vote(uuid,uuid),public.confirm_plan(uuid),public.prepare_guest_upgrade(),public.complete_guest_upgrade(text),public.dashboard() to authenticated;
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
