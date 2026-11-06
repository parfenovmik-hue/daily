import fs from 'node:fs/promises';
import {settings} from './config.mjs';
const {connection}=settings(),config=JSON.parse(await fs.readFile(connection,'utf8'));
const target=process.argv[2]||'https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html';
const health=await fetch(config.url+'/health').then(r=>r.json());if(!health.ok)throw Error('Health failed');
const response=await fetch(config.url+'/extract',{method:'POST',headers:{Authorization:'Bearer '+config.token,'Content-Type':'application/json'},body:JSON.stringify({url:target}),signal:AbortSignal.timeout(45000)});
const data=await response.json(),r=data.result;
console.log(JSON.stringify({http:response.status,status:r?.status,siteHttp:r?.httpStatus,elapsedMs:r?.elapsedMs,title:!!r?.product?.title,image:!!r?.product?.image,price:r?.product?.price??null,currency:r?.product?.currency||''}));
if(!response.ok||r?.status!=='extracted'||!r.product?.title||!r.product?.image||r.product?.price==null)process.exitCode=1;
