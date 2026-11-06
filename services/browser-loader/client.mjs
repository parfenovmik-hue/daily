import fs from'node:fs/promises';
const config=JSON.parse(await fs.readFile(new URL('../../private/browser-loader-connection.json',import.meta.url),'utf8'));
const action=process.argv[2];if(!['read','stop'].includes(action))throw Error('Use read HTTPS_URL or stop');
const response=await fetch(config.url+(action==='stop'?'/shutdown':'/extract'),{method:'POST',headers:{Authorization:'Bearer '+config.token,'Content-Type':'application/json'},body:JSON.stringify({url:process.argv[3]}),signal:AbortSignal.timeout(45000)});const result=await response.json();console.log(JSON.stringify(result,null,2));if(!response.ok||result.result?.status==='unavailable')process.exitCode=1;
