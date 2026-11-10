import {checkConnection} from './connection.mjs';
async function check(){const button=document.querySelector('#check');button.disabled=true;const result=await checkConnection(window.PLANFIX_CONFIG);document.querySelector('#status').textContent=result.state==='unreachable'?'The project could not be reached. Check your connection and try again.':[
 `${result.databaseReady?'✓':'○'} PlanFix database: ${result.databaseReady?'installed':'installation required'}`,
 `${result.googleOnlyPolicy?'✓':'○'} Google-only permissions: ${result.googleOnlyPolicy?'installed':'apply the current setup SQL or upgrade SQL'}`,
 `${result.googleEnabled?'✓':'○'} Google provider: ${result.googleEnabled?'enabled — complete an actual sign-in to verify redirects':'enable in Supabase'}`,
 `${result.anonymousEnabled?'○':'✓'} Anonymous Sign-Ins: ${result.anonymousEnabled?'disable in Supabase':'disabled'}`,
 result.ready?'Configuration checks pass. Open PlanFix and test Google sign-in.':'PlanFix remains at the Google sign-in page. There is no anonymous or device-preview access.'
].join('\n');button.disabled=false}
document.querySelector('#check').addEventListener('click',check);check();
