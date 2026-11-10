import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create schema auth;
create table auth.users(id uuid primary key,is_anonymous boolean not null);
create table auth.identities(user_id uuid references auth.users,provider text);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
await db.exec(await fs.readFile('supabase/schema.sql','utf8'));
const ids={a:'00000000-0000-4000-8000-000000000001',b:'00000000-0000-4000-8000-000000000002',guest:'00000000-0000-4000-8000-000000000003',email:'00000000-0000-4000-8000-000000000004'};
for(const [name,id]of Object.entries(ids)){await db.query('insert into auth.users values($1,$2)',[id,name==='guest']);if(name!=='guest')await db.query('insert into auth.identities values($1,$2)',[id,name==='email'?'email':'google'])}
const actor=async who=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ids[who]||'']);await db.exec('set role authenticated')};
const rpc=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
const fails=async(fn,pattern)=>assert.rejects(fn,pattern);
await actor('a');await rpc("select public.set_nickname('Planner A')");
const group=await rpc("select public.create_group('Friends','🌿')");
const plan=await rpc("select public.create_plan('Dinner','2026-12-01','19:00','Town','dinner',$1,ARRAY['Pizza','Tacos'])",[group]);
let dash=await rpc('select public.dashboard()');assert.equal(dash.plans.length,1);
const options=dash.plans[0].options,invite=dash.plans[0].invite_token;
await rpc('select public.cast_vote($1,$2)',[plan,options[0].id]);
await actor('b');assert.equal((await rpc('select public.dashboard()')).plans.length,0);assert.equal((await db.query('select * from public.plans')).rows.length,0);
await fails(()=>rpc('select public.cast_vote($1,$2)',[plan,options[0].id]),/Join this plan/);
await fails(()=>rpc('select public.confirm_plan($1)',[plan]),/Only the plan/);
await fails(()=>db.query('insert into public.plan_members values($1,$2,now())',[plan,ids.b]),/permission denied/);
await rpc('select public.join_invite($1)',[invite]);await rpc('select public.cast_vote($1,$2)',[plan,options[1].id]);
assert.equal((await rpc('select public.dashboard()')).plans[0].members,2);
// An anonymous Supabase session and an email-only account are both denied every protected operation.
for(const who of ['guest','email']){
 await actor(who);
 for(const [sql,args] of [
  ['select public.dashboard()',[]],['select public.set_nickname($1)',['Blocked']],
  ['select public.create_group($1,$2)',['Blocked','x']],
  ["select public.create_plan('Blocked','2026-12-01',null,'Town','dinner',null,ARRAY['A','B'])",[]],
  ['select public.join_invite($1)',[invite]],['select public.cast_vote($1,$2)',[plan,options[0].id]],['select public.confirm_plan($1)',[plan]],
  ['select public.complete_guest_upgrade($1)',['invalid']]
 ])await fails(()=>rpc(sql,args),/Sign in with Google/);
 await fails(()=>rpc('select public.prepare_guest_upgrade()'),/permission denied/);
 assert.equal((await db.query('select * from public.plans')).rows.length,0);
}
// Retained records owned by an older anonymous user must also be inaccessible to that identity.
await db.exec('reset role');
const legacy=(await db.query("insert into public.plans(title,date,category,owner_id) values('Retained old plan','2026-12-01','dinner',$1) returning id",[ids.guest])).rows[0].id;
await db.query('insert into public.plan_members(plan_id,user_id) values($1,$2)',[legacy,ids.guest]);
await actor('guest');assert.equal((await db.query('select * from public.plans')).rows.length,0);
await db.exec('reset role');
const before=await db.query('select * from public.plans order by id');
await db.exec(await fs.readFile('supabase/google-only.sql','utf8'));await db.exec(await fs.readFile('supabase/google-only.sql','utf8'));
assert.deepEqual((await db.query('select * from public.plans order by id')).rows,before.rows);
// Existing historical links continue to authorize the Google owner, without copying records.
await db.query('insert into planfix_private.identity_links(guest_id,account_id) values($1,$2)',[ids.guest,ids.a]);
await actor('a');assert.ok((await rpc('select public.dashboard()')).plans.find(p=>p.id===legacy));
await rpc('select public.confirm_plan($1)',[plan]);await actor('b');await fails(()=>rpc('select public.cast_vote($1,$2)',[plan,options[0].id]),/Voting is closed/);
await db.exec('reset role;set role anon');await fails(()=>rpc('select public.dashboard()'),/permission denied/);assert.equal(await rpc('select public.planfix_auth_mode()'),'google_only');
console.log('Database: Google-only RPC and RLS enforcement, blocked anonymous/email accounts, member isolation, invitations, votes, owner permissions, idempotent migration and retained data passed.');await db.close();
