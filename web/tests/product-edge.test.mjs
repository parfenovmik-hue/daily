import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
test('Wishlist function checks Auth and quota, extracts a card and caches only for the verified owner',async()=>{
 const {outputFiles}=await build({entryPoints:[new URL('../../backend/supabase/functions/wish-card/index.ts',import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'neutral'});
 const beforeFetch=globalThis.fetch,beforeDeno=globalThis.Deno;
 let handler,quota=true,cache=null,pageReads=0,stored=null;
 const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
 globalThis.Deno={env:{get:key=>({SUPABASE_URL:'https://daily.example',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'private'})[key]},serve:fn=>handler=fn,resolveDns:async(_host,type)=>type==='A'?['93.184.216.34']:[]};
 globalThis.fetch=async(url,options={})=>{
  if(url==='https://daily.example/auth/v1/user')return options.headers.Authorization==='Bearer valid'?json({id:'verified-owner'}):json({},401);
  if(url==='https://daily.example/rest/v1/rpc/daily_wish_reserve')return json({allowed:quota,cached:cache});
  if(url==='https://daily.example/rest/v1/rpc/daily_wish_cache_store'){
   assert.equal(options.headers.apikey,'private');assert.equal(options.headers.Authorization,'Bearer private');
   stored=JSON.parse(options.body);return json(null);
  }
  if(url==='https://shop.example/item'){pageReads++;return new Response('<meta property="og:title" content="Exact item"><meta property="og:image" content="/image.png"><meta property="product:price:amount" content="12300"><meta property="product:price:currency" content="RUB">',{headers:{'content-type':'text/html'}});}
  if(url==='https://shop.example/image.png')return new Response(new Uint8Array([137,80,78,71]),{headers:{'content-type':'image/png'}});
  throw Error('Unexpected request '+url);
 };
 try{
  await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));
  const request=token=>new Request('https://edge.example/',{method:'POST',headers:{Authorization:token,'content-type':'application/json'},body:JSON.stringify({url:'https://shop.example/item',owner:'attacker'})});
  assert.equal((await handler(request('Bearer invalid'))).status,401);
  let response=await handler(request('Bearer valid'));assert.equal(response.status,200);
  assert.deepEqual((await response.json()).card,{productTitle:'Exact item',image:'https://shop.example/image.png',price:12300,currency:'RUB'});
  assert.equal(stored.p_owner,'verified-owner');
  cache=stored.p_card;await handler(request('Bearer valid'));assert.equal(pageReads,1);
  cache=null;quota=false;assert.equal((await handler(request('Bearer valid'))).status,429);assert.equal(pageReads,1);
 }finally{globalThis.fetch=beforeFetch;if(beforeDeno===undefined)delete globalThis.Deno;else globalThis.Deno=beforeDeno;}
});
