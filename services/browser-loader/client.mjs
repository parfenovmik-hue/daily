import fs from'node:fs/promises';
import {settings} from './config.mjs';
const config=JSON.parse(await fs.readFile(settings().connection,'utf8'));
const action=process.argv[2];if(!['read','stop'].includes(action))throw Error('Use read HTTPS_URL or stop');
const response=await fetch(config.url+(action==='stop'?'/shutdown':'/extract'),{method:'POST',headers:{Authorization:'Bearer '+config.token,'Content-Type':'application/json'},body:JSON.stringify({url:process.argv[3]}),signal:AbortSignal.timeout(45000)});const result=await response.json();console.log(JSON.stringify(result,null,2));if(!response.ok||['unavailable','blocked','unrecognized'].includes(result.result?.status))process.exitCode=1;
