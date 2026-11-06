import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';

test('isolated HTTP service protects extraction, bounds requests, rejects overlap and shuts down cleanly',{timeout:10000},async()=>{
 const state=await fs.mkdtemp(path.join(os.tmpdir(),'daily-reader-test-'));
 const token='a'.repeat(64),tokenFile=path.join(state,'token');await fs.writeFile(tokenFile,token,{mode:0o600});
 const reservation=net.createServer();await new Promise(r=>reservation.listen(0,'127.0.0.1',r));const port=reservation.address().port;await new Promise(r=>reservation.close(r));
 const child=spawn(process.execPath,[new URL('server.mjs',import.meta.url).pathname],{env:{...process.env,DAILY_READER_STATE_DIR:state,DAILY_READER_PORT:String(port),DAILY_READER_TOKEN_FILE:tokenFile,DAILY_READER_PROXY_DNS:'0'},stdio:['ignore','pipe','pipe']});
 let output='';child.stderr.on('data',d=>output+=d);const ended=once(child,'exit');
 try{
  const url='http://127.0.0.1:'+port;
  let ready=false;for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error(output);try{if((await fetch(url+'/health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,30));}assert.equal(ready,true);
  const config=JSON.parse(await fs.readFile(path.join(state,'browser-loader-connection.json')));assert.equal(config.token,token);assert.equal((await fs.stat(path.join(state,'browser-loader-connection.json'))).mode&0o077,0);
  const request=(body,headers={})=>fetch(url+'/extract',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...headers},body});
  assert.equal((await request('{}',{Authorization:''})).status,401);
  assert.equal((await request('{}',{Origin:'https://evil.example'})).status,403);
  assert.equal((await request('{}',{'Content-Type':'text/plain'})).status,415);
  assert.equal((await request('{')).status,400);
  for(const target of ['https://127.0.0.1/','https://[::1]/','https://169.254.169.254/','file:///etc/passwd'])assert.equal((await request(JSON.stringify({url:target}))).status,400);
  assert.equal((await request('x'.repeat(9000))).status,413);
  const pending=http.request(url+'/extract',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'} });
  const completed=new Promise((resolve,reject)=>{pending.on('response',r=>{r.resume();r.on('end',()=>resolve(r.statusCode));});pending.on('error',reject);});pending.write('{');
  for(let i=0;i<30;i++){if((await fetch(url+'/health').then(r=>r.json())).busy)break;await new Promise(r=>setTimeout(r,10));}
  assert.equal((await request('{}')).status,429);pending.end('}');assert.equal(await completed,400);
  child.kill('SIGTERM');await ended;assert.equal(child.exitCode,0);await assert.rejects(fs.access(path.join(state,'browser-loader-connection.json')));
 }finally{if(child.exitCode===null){child.kill('SIGKILL');await ended;}await fs.rm(state,{recursive:true,force:true});}
});
