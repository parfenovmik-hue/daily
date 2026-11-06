// Synthetic-only isolated browser QA. Start local preview on 8812 first.
import {chromium} from '../../../services/browser-loader/node_modules/playwright/index.mjs';
const browser=await chromium.launch({channel:'chrome'});
const uid='11111111-1111-4111-8111-111111111111';
const enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
const token=enc({alg:'HS256',typ:'JWT'})+'.'+enc({sub:uid,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000)})+'.'+Buffer.from('synthetic-signature').toString('base64url');
const user={id:uid,email:'qa@example.test',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{},created_at:new Date().toISOString()};
const session={access_token:token,refresh_token:'synthetic-refresh-token',token_type:'bearer',expires_in:3600,user};
const records=new Map();let rpcCalls=0,loginCalls=0;
const merge=(old={},next={})=>{const out={...old};for(const[k,v]of Object.entries(next)){const prev=out[k];if(!prev||v.clock>prev.clock||v.clock===prev.clock&&v.actor>prev.actor)out[k]=v;}return out;};
try{
 const context=await browser.newContext({viewport:{width:440,height:956},timezoneId:'Europe/Moscow'});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.origin==='http://127.0.0.1:8812'){
   if(url.pathname==='/'){const res=await route.fetch();return route.fulfill({response:res,headers:{...res.headers(),'content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://xvowdgupwymfukhuzkqm.supabase.co; img-src 'self' data: blob:"}});}return route.continue();
  }
  if(url.origin!=='https://xvowdgupwymfukhuzkqm.supabase.co')return route.abort();
  const headers={'content-type':'application/json','access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PUT,OPTIONS'};
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
  let result;
  if(url.pathname==='/auth/v1/token'){loginCalls++;result=session;}
  else if(url.pathname==='/auth/v1/user')result=user;
  else if(url.pathname==='/rest/v1/rpc/daily_sync'){
   rpcCalls++;const changes=req.postDataJSON().changes;
   for(const r of changes){const old=records.get(r.id);records.set(r.id,{id:r.id,kind:r.kind,fields:merge(old?.fields,r.fields)});}
   result={ok:true,protocol:1,user:{id:uid,name:'QA'},records:[...records.values()],accepted:changes.map(r=>r.id),purged:[]};
  }else return route.abort();
  return route.fulfill({status:200,headers,body:JSON.stringify(result)});
 });
 await page.goto('http://127.0.0.1:8812/');await page.locator('nav').waitFor();
 const today=await page.evaluate(async()=>{const m=await import('/model.js');return m.dayKey();});const cell=value=>({value,clock:1,actor:'fixture'});
 records.set('task_qa',{id:'task_qa',kind:'task',fields:{title:cell('Synthetic Supabase task'),date:cell(today),deleted:cell(false),done:cell(false),createdAt:cell(1)}});
 await page.locator('[data-action=more]').click();await page.locator('[data-action=settings]').click();await page.locator('[data-action=cloud-connect]').click();
 for(const width of [320,440,1440]){await page.setViewportSize({width,height:956});if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Login overflow '+width);}
 await page.setViewportSize({width:440,height:956});await page.waitForTimeout(300);await page.screenshot({path:'/tmp/daily-email-login.png'});
 await page.locator('#supabase-login [name=email]').fill('qa@example.test');await page.locator('#supabase-login [name=password]').fill('synthetic-password');await page.locator('#supabase-login [type=submit]').click();
 await page.locator('[data-action=cloud-apply]').waitFor();await page.locator('[data-action=cloud-apply]').click();await page.locator('[data-action=day]').click();await page.locator('[data-row=task_qa]').waitFor();
 await context.setOffline(true);await page.locator('nav [data-action=add]').click();await page.locator('#entry-form [name=title]').fill('Offline synthetic task');await page.locator('#entry-form [type=submit]').click();await page.getByText('Offline synthetic task',{exact:true}).waitFor();
 await context.setOffline(false);await page.waitForFunction(()=>!document.querySelector('#sync')?.textContent.includes('На устройстве'),null,{timeout:10000});
 await page.waitForTimeout(1000);if(![...records.values()].some(r=>r.fields.title?.value==='Offline synthetic task'))throw Error('Offline edit not uploaded');
 await page.reload();await page.locator('[data-row=task_qa]').waitFor();await page.getByText('Offline synthetic task',{exact:true}).waitFor();
 await page.goto('http://127.0.0.1:8812/#access_token='+token+'&refresh_token=synthetic-refresh-token&type=recovery');await page.locator('#supabase-password').waitFor();if(new URL(page.url()).hash)throw Error('Auth tokens remained in URL');await page.locator('#supabase-password [name=password]').fill('new-synthetic-password');await page.locator('#supabase-password [type=submit]').click();await page.locator('[data-action=cloud-apply]').waitFor();await page.locator('[data-action=cloud-apply]').click();await page.waitForTimeout(500);
 const before=rpcCalls;await page.evaluate(()=>{const key='daily-supabase-auth-v1';const s=JSON.parse(localStorage.getItem(key));s.user.id='22222222-2222-4222-8222-222222222222';localStorage.setItem(key,JSON.stringify(s));});await page.reload();await page.waitForTimeout(1200);if(rpcCalls!==before)throw Error('Other account received old profile RPC');
 if(errors.length)throw Error(errors.join('; '));console.log(JSON.stringify({passed:true,widths:[320,440,1440],loginCalls,rpcCalls,offlineUpload:true,reload:true,identityGuard:true,passwordRecovery:true,syntheticOnly:true}));await context.close();
}finally{await browser.close();}
