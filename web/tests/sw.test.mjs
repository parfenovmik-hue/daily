import{test}from'node:test';import assert from'node:assert/strict';import vm from'node:vm';import fs from'node:fs';
test('Published Pages worker restores the app and imported modules offline under /daily/ without intercepting cloud requests',async()=>{
 const handlers={},entries=new Map(),deleted=[];let claimed=false;
 const cache={addAll:async requests=>{for(const request of requests)entries.set(request.url,new Response(request.url.endsWith('/daily/')?'Daily shell':'cached module'));},match:async value=>entries.get(typeof value==='string'?value:value.url)};
 const context={URL,Response,Request,self:{location:{href:'https://daily.test/daily/sw.js?account=test-user',origin:'https://daily.test'},addEventListener:(name,fn)=>handlers[name]=fn,skipWaiting:async()=>{},clients:{claim:async()=>{claimed=true}}},caches:{open:async()=>cache,keys:async()=>['daily-pages-obsolete','unrelated-cache'],delete:async key=>deleted.push(key)},fetch:async()=>{throw Error('offline')}};
 vm.runInNewContext(fs.readFileSync('pages/sw.js','utf8'),context);let work;
 handlers.install({waitUntil:p=>work=p});await work;handlers.activate({waitUntil:p=>work=p});await work;assert.ok(claimed);assert.deepEqual(deleted,['daily-pages-obsolete']);
 let response;handlers.fetch({request:{url:'https://daily.test/daily/',method:'GET',mode:'navigate'},respondWith:p=>response=p});assert.equal(await(await response).text(),'Daily shell');
 for(const name of ['daily.js','store.js','cloud.js','wish-input.js','ui-view.js','persistence.js']){handlers.fetch({request:{url:'https://daily.test/daily/'+name+'?v=test',method:'GET'},respondWith:p=>response=p});assert.equal(await(await response).text(),'cached module');}
 for(const request of [{url:'https://script.google.com/macros/s/test/exec',method:'POST'},{url:'https://external.example/file',method:'GET'},{url:'https://daily.test/daily/sync',method:'POST'}]){let intercepted=false;handlers.fetch({request,respondWith:()=>intercepted=true});assert.equal(intercepted,false);}
});
