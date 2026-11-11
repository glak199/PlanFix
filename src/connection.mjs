export async function checkConnection(config,fetcher=globalThis.fetch){
 if(!config?.supabaseUrl||!config?.supabasePublishableKey)return {ready:false,state:'unconfigured',googleEnabled:false};
 const base=config.supabaseUrl.replace(/\/$/,''),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
 try{
  const headers={apikey:config.supabasePublishableKey};
  const [auth,database,policy]=await Promise.all([
   fetcher(base+'/auth/v1/settings',{headers,signal:controller.signal}),
   fetcher(base+'/rest/v1/rpc/dashboard',{headers,signal:controller.signal}),
   fetcher(base+'/rest/v1/rpc/planfix_auth_mode',{headers,signal:controller.signal})
  ]);
  const [settings,result,mode]=await Promise.all([auth.json(),database.json(),policy.json()]);
  const databaseReady=result.code==='42501'&&/permission denied for function dashboard/i.test(result.message||'');
  const googleEnabled=auth.ok&&settings.external?.google===true;
  const googleOnlyPolicy=policy.ok&&mode==='google_only';
  const ready=databaseReady&&googleOnlyPolicy&&googleEnabled;
  return {ready,state:ready?'ready':'setup-pending',databaseReady,googleEnabled,googleOnlyPolicy,anonymousEnabled:auth.ok&&settings.external?.anonymous_users===true};
 }catch{return {ready:false,state:'unreachable',googleEnabled:false}}finally{clearTimeout(timer)}
}
