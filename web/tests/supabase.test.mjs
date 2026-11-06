import test from 'node:test';import assert from 'node:assert/strict';
import {SupabaseCloud,consumeAuthRedirect} from '../public/supabase.js';
const uid='11111111-1111-4111-8111-111111111111';
const response={ok:true,protocol:1,user:{id:uid,name:'QA'},records:[],accepted:[],purged:[]};
const client=(id=uid)=>({auth:{getSession:async()=>({data:{session:{access_token:'bound-token',user:{id}}}})}});
const transport=(data=response)=>async(_url,options)=>{assert.equal(options.headers.Authorization,'Bearer bound-token');return {ok:true,json:async()=>data};};
test('Supabase transport binds identity and rejects malformed records before merge',async()=>{
 assert.equal((await new SupabaseCloud(uid,client(),transport()).request('sync')).user.id,uid);
 await assert.rejects(new SupabaseCloud(uid,client('22222222-2222-4222-8222-222222222222'),transport()).request('sync'),e=>e.code==='AUTH');
 await assert.rejects(new SupabaseCloud(uid,client(),transport({...response,records:[{id:'task_invalid'}]})).request('sync'),/Некорректный/);
});
test('Auth callback clears URL tokens even on failure and only accepts a verified SDK session',async()=>{
 let cleared='';const loc={hash:'#access_token=test&refresh_token=refresh',pathname:'/daily/',search:''},hist={replaceState:(_a,_b,url)=>cleared=url};
 assert.equal(await consumeAuthRedirect({auth:{setSession:async()=>({data:{session:{user:{id:uid}}}})}},loc,hist),'magiclink');assert.equal(cleared,'/daily/');
 await assert.rejects(consumeAuthRedirect({auth:{setSession:async()=>({error:Error('bad token')})}},loc,hist),/недействительна/);
});

import {SUPABASE_PUBLIC_KEY} from '../public/supabase-config.js';
test('Only a publishable or anonymous key is shipped in the frontend',()=>{
 assert.equal(SUPABASE_PUBLIC_KEY.startsWith('sb_secret_'),false);
 if(!SUPABASE_PUBLIC_KEY.startsWith('sb_publishable_'))assert.equal(JSON.parse(Buffer.from(SUPABASE_PUBLIC_KEY.split('.')[1],'base64url')).role,'anon');
});
