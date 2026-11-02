import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
test('PWA update reloads once and waits for an open editor or hidden app',()=>{
 const events={},docEvents={};let busy=true,reloads=0,mutation;
 const document={visibilityState:'visible',activeElement:{tagName:'BUTTON'},querySelector:()=>busy?{}:null,getElementById:()=>({}),addEventListener:(n,f)=>docEvents[n]=f};
 const navigator={onLine:true,serviceWorker:{addEventListener:(n,f)=>events[n]=f,getRegistration:async()=>null}};
 vm.runInNewContext(fs.readFileSync('public/updater.js','utf8'),{document,navigator,window:{addEventListener(){}},location:{reload(){reloads++;}},MutationObserver:class{constructor(f){mutation=f;}observe(){}},setTimeout:()=>{},setInterval:()=>{}});
 events.controllerchange();assert.equal(reloads,0);busy=false;document.visibilityState='hidden';mutation();assert.equal(reloads,0);document.visibilityState='visible';mutation();assert.equal(reloads,1);events.controllerchange();assert.equal(reloads,1);
});
