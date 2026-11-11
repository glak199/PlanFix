const {JSDOM}=require('jsdom');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const esbuild=require('esbuild');
const production=fs.readFileSync('dist/app.js','utf8');
const source=fs.readFileSync('src/app.js','utf8');
assert.doesNotMatch(source,/signInAnonymously|guestModal|Continue as Guest|device.preview/i);
const tick=()=>new Promise(r=>setTimeout(r,30));
function setup(code,{user=null,google=true,database=true,policy=true,storage={},url='https://planfix.test/',getUserError=null}={}){
 const dom=new JSDOM('<div id="app"></div><dialog id="modal"></dialog><div id="toast"></div>',{url,runScripts:'outside-only',pretendToBeVisual:true});const w=dom.window;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
 w.PLANFIX_CONFIG={supabaseUrl:'https://test.supabase.co',supabasePublishableKey:'public-test'};
 w.fetch=async url=>({ok:url.includes('/settings')||url.includes('auth_mode')&&policy,json:async()=>url.includes('/settings')?{external:{google,anonymous_users:false}}:url.includes('auth_mode')?(policy?'google_only':{}):database?{code:'42501',message:'permission denied for function dashboard'}:{code:'PGRST202'}});
 const calls=[],data={plans:[],groups:[]};let listener;let current=user;
 w.__authClient={auth:{getSession:async()=>({data:{session:current?{user:current}:null},error:null}),getUser:async()=>({data:{user:current},error:getUserError}),onAuthStateChange:fn=>{listener=fn;return{data:{subscription:{unsubscribe(){}}}}},signInWithOAuth:async args=>{calls.push(['oauth',args]);return{error:null}},signOut:async()=>{current=null;listener?.('SIGNED_OUT');return{error:null}},updateUser:async()=>({error:null})},rpc:async(fn,args)=>{calls.push([fn,args]);if(fn==='dashboard')return{data:structuredClone(data),error:null};if(fn==='create_plan'){data.plans.push({id:'p1',title:args.title,date:args.plan_date,time:args.plan_time,location:args.location,category:args.category,options:args.choices.map((label,i)=>({id:'o'+i,label,votes:0,selected:false})),owner:true,members:1,status:'voting',invite_token:'a'.repeat(64)});return{data:'p1',error:null}}if(fn==='cast_vote'){data.plans[0].options.forEach(o=>{o.selected=o.id===args.option_id&&!o.selected;o.votes=o.selected?1:0})}if(fn==='confirm_plan')data.plans[0].status='confirmed';if(fn==='join_invite')return{data:{kind:'plan',id:'p1'},error:null};return{data:null,error:null}}};
 for(const[k,v]of Object.entries(storage))w.localStorage.setItem(k,JSON.stringify(v));w.eval(code);return{w,calls,data,expire:()=>{current=null;listener?.('SIGNED_OUT')}};
}
(async()=>{
 const built=await esbuild.build({entryPoints:['src/entry.js'],bundle:true,write:false,format:'iife',plugins:[{name:'test-auth',setup(b){b.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:'mock',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const createClient=()=>window.__authClient;',loader:'js'}))}}]});const code=built.outputFiles[0].text;
 const {supportMailto}=await import('../src/landing.mjs');
 const encoded=new URL(supportMailto('Sign-in\r\nBcc:other@example.test','A & B? #test'));assert.doesNotMatch(encoded.searchParams.get('subject'),/[\r\n]/);assert.match(encoded.searchParams.get('body'),/A & B\? #test/);
 const googleUser={id:'google-user',is_anonymous:false,identities:[{provider:'google'}],email:'casey@example.test',user_metadata:{name:'Casey'}};
 for(const user of [null,{id:'old-guest',is_anonymous:true,identities:[]},{id:'email-user',is_anonymous:false,identities:[{provider:'email'}]}]){
  const{w,calls}=setup(code,{user,storage:{'planfix.guest':{id:'local',name:'Old user'},'planfix.plans':[{title:'Private old local plan'}]}});await tick();const d=w.document;
  assert.ok(d.querySelector('.signin-card'));assert.equal(d.querySelector('.shell'),null);
  assert.ok(d.querySelector('#features'));assert.equal(d.querySelectorAll('.planning-steps li').length,4);
  assert.ok(d.querySelector('#support-form'));assert.equal(d.querySelector('.founder-credit').textContent,'The Startup is Made by Yashvir Paul');
  assert.doesNotMatch(d.body.textContent,/Join your people|back-and-forth|Your kind of people/i);
  assert.equal(d.querySelector('.welcome-actions [data-intent=join]'),null);
  if(user===null){
   const support=d.querySelector('#support-form'),draft=d.querySelector('#support-draft');let opened=false;draft.click=()=>{opened=true};
   support.querySelector('[name=topic]').value='Google sign-in';support.querySelector('[name=message]').value='Sign-in fails & returns me to the homepage.';
   support.dispatchEvent(new w.SubmitEvent('submit',{bubbles:true,cancelable:true,submitter:support.querySelector('[type=submit]')}));
   assert.equal(opened,true);const email=new URL(draft.href);assert.equal(email.pathname,'useplanfix@gmail.com');assert.match(email.searchParams.get('subject'),/Google sign-in/);assert.match(email.searchParams.get('body'),/Sign-in fails & returns/);
   assert.match(d.querySelector('#support-status').textContent,/email app/);assert.equal(calls.length,0);
  }
assert.doesNotMatch(d.body.textContent,/Continue as Guest|device preview|Private old local plan/i);assert.equal(calls.filter(c=>c[0]==='dashboard').length,0);
  const injected=d.createElement('button');injected.dataset.action='create';d.body.append(injected);injected.click();assert.equal(d.querySelector('#plan-form'),null);
  d.querySelector('.signin-card [data-action=google]').click();await tick();assert.equal(calls.filter(c=>c[0]==='oauth').length,1);w.close();
 }
 // Disabled OAuth, backend policy missing, and an unverified stored Google-shaped user never unlock the app.
 for(const settings of [{google:false},{user:googleUser,policy:false},{user:googleUser,getUserError:new Error('Expired token')}]){const{w,calls}=setup(code,settings);await tick();assert.equal(w.document.querySelector('.shell'),null);assert.equal(calls.filter(c=>c[0]==='dashboard').length,0);if(!settings.user){w.document.querySelector('.signin-card [data-action=google]').click();await tick();assert.match(w.document.querySelector('#login-status').textContent,/being connected/);assert.equal(calls.length,0)}w.close()}
 const{w,calls,expire}=setup(code,{user:googleUser});await tick();const d=w.document;const click=s=>{const e=d.querySelector(s);assert.ok(e,s);e.click()};const submit=async s=>{const f=d.querySelector(s);f.dispatchEvent(new w.SubmitEvent('submit',{bubbles:true,cancelable:true,submitter:f.querySelector('[type=submit]')}));await tick()};
 assert.match(d.body.textContent,/Hey, Casey/);click('[data-action=create]');d.querySelector('[name=title]').value='Dinner <Friday>';d.querySelector('[name=options]').value='Pizza\nTacos';await submit('#plan-form');assert.match(d.querySelector('dialog').textContent,/Dinner <Friday>/);assert.equal(d.querySelector('Friday'),null);
 click('[data-action=vote]');await tick();assert.equal(d.querySelectorAll('.poll-option.selected').length,1);click('[data-action=confirm]');await tick();assert.match(d.querySelector('dialog').textContent,/Voting is closed/);click('[data-action=share]');assert.match(d.querySelector('dialog').textContent,/sign in with Google/);
 expire();assert.equal(d.querySelector('.shell'),null);assert.equal(d.querySelector('dialog').open,false);assert.ok(d.querySelector('.signin-card'));w.close();
 const invite='b'.repeat(64);const signedOut=setup(code,{url:'https://planfix.test/?invite='+invite});await tick();assert.equal(signedOut.w.sessionStorage.getItem('planfix.pendingInvite'),invite);assert.equal(signedOut.calls.length,0);signedOut.w.close();
 // Production bundle, no configuration: the real entrypoint must display only the sign-in landing page.
 const real=new JSDOM('<div id="app"></div><dialog id="modal"></dialog><div id="toast"></div>',{url:'https://planfix.test/',runScripts:'outside-only'});real.window.eval(production);await tick();assert.ok(real.window.document.querySelector('.signin-card'));assert.equal(real.window.document.querySelector('.shell'),null);real.window.close();
 console.log('UI: Google-only landing, blocked legacy/local/anonymous sessions, OAuth gating, verified account dashboard, plan/vote/share flows, escaped content, sign-out lock invitation preservation, expanded PlanFix content and support email drafts passed.');
})().catch(e=>{console.error(e);process.exit(1)});
