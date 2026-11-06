import test from 'node:test';import assert from 'node:assert/strict';import{settings,launchOptions}from'./config.mjs';
test('Linux refuses root and local proxy DNS; keeps sandbox and explicit state',()=>{
 assert.throws(()=>settings({},'linux',0),/unprivileged/);
 assert.throws(()=>settings({DAILY_READER_PROXY_DNS:'1'},'linux',1000),/forbidden/);
 const s=settings({DAILY_READER_STATE_DIR:'/var/lib/daily-browser'},'linux',1000);
 assert.equal(s.channel,'chromium');assert.equal(s.headless,true);assert.equal(s.port,8841);assert.equal(s.connection,'/var/lib/daily-browser/browser-loader-connection.json');assert.equal(launchOptions(s).chromiumSandbox,true);
 assert.throws(()=>settings({DAILY_READER_PORT:'80'},'linux',1000),/Invalid/);
 assert.equal(settings({},'darwin',501).channel,'chrome');
});
