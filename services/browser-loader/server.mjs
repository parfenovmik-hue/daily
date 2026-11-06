import http from 'node:http';import fs from 'node:fs/promises';import crypto from 'node:crypto';import path from 'node:path';
import {chromium}from'playwright';import{targetURL,publicResolver}from'./policy.mjs';import{extractPage}from'./extract.mjs';
const port=Number(process.env.DAILY_READER_PORT||8841);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid port');
const root=new URL('../../',import.meta.url),privateDir=new URL('private/browser-loader/',root);await fs.mkdir(privateDir,{recursive:true,mode:0o700});
const connection=new URL('private/browser-loader-connection.json',root),token=crypto.randomBytes(32).toString('hex'),check=publicResolver(undefined,{proxyDomains:process.env.DAILY_READER_PROXY_DNS==='1'?['books.toscrape.com','example.com','lamoda.ru','lmcdn.ru','yandex.ru','yandex.net','yastatic.net','ozon.ru','ozonusercontent.com','wildberries.ru','wbstatic.net','wbbasket.ru']:[]});
let browser,busy=false,idle,stopping=false;
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
async function closeBrowser(){clearTimeout(idle);const old=browser;browser=null;if(old)await old.close().catch(()=>{});}
async function readPage(url){
 clearTimeout(idle);const started=Date.now(),id=crypto.randomUUID();let context;
 try{
  if(browser&&!browser.isConnected())browser=null;
  browser ||= await chromium.launch({headless:process.env.DAILY_READER_HEADED!=='1',chromiumSandbox:true,channel:process.env.DAILY_READER_CHANNEL||(process.platform==='darwin'?'chrome':'chromium')});
  context=await browser.newContext({locale:'ru-RU',timezoneId:'Europe/Moscow',viewport:{width:1280,height:1000},acceptDownloads:false,serviceWorkers:'block'});
  await context.route('**/*',async route=>{const req=route.request();if(['font','media'].includes(req.resourceType()))return route.abort();try{await check(req.url());await route.continue();}catch{await route.abort();}});
  await context.routeWebSocket('**/*',socket=>socket.close());
  const page=await context.newPage();let navigationError='',status=0;
  try{const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:25000});status=response?.status()||0;await page.waitForLoadState('networkidle',{timeout:5000}).catch(()=>{});}catch(e){navigationError=e.message.slice(0,250);}
  const result=await page.evaluate(extractPage).catch(()=>({status:'unavailable',product:null,url:page.url()}));
  if([403,429,451].includes(status)){result.status='blocked';result.product=null;result.reason='HTTP '+status+': сайт ограничил доступ браузеру.';}
  if(status>=400&&result.status!=='blocked'){result.status='unavailable';result.product=null;result.reason='HTTP '+status;}
  if(navigationError&&!status&&result.status!=='blocked'){result.status='unavailable';result.product=null;}
  const screenshot=new URL(id+'.png',privateDir);await page.screenshot({path:screenshot.pathname,fullPage:false,timeout:5000}).catch(()=>{});
  const shots=(await fs.readdir(privateDir)).filter(name=>/^[a-f0-9-]+\.png$/.test(name));if(shots.length>20){const ranked=await Promise.all(shots.map(async name=>({name,at:(await fs.stat(new URL(name,privateDir))).mtimeMs})));ranked.sort((a,b)=>b.at-a.at);await Promise.all(ranked.slice(20).map(x=>fs.unlink(new URL(x.name,privateDir))));}
  return{...result,httpStatus:status,navigationError,elapsedMs:Date.now()-started,screenshot:screenshot.pathname};
 }finally{await context?.close().catch(()=>{});idle=setTimeout(closeBrowser,60000);idle.unref();}
}
const server=http.createServer(async(req,res)=>{
 const origin=req.headers.origin;if(origin&&origin!==`http://127.0.0.1:${port}`){json(res,403,{error:'Cross-origin access disabled'});return;}
 if(req.method==='GET'&&req.url==='/health'){json(res,200,{ok:true,service:'daily-browser-loader',mode:'local-only',busy,pid:process.pid,browserRunning:!!browser,memoryRssMiB:Math.round(process.memoryUsage().rss/1048576)});return;}
 if(req.headers.authorization!=='Bearer '+token){json(res,401,{error:'Local token required'});return;}
 if(req.method==='POST'&&req.url==='/shutdown'){json(res,200,{ok:true});setImmediate(shutdown);return;}
 if(req.method!=='POST'||req.url!=='/extract'){json(res,404,{error:'Not found'});return;}
 if(busy){json(res,429,{error:'Уже читаем страницу. Повтори после завершения.'});return;}
 if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||'')){json(res,415,{error:'JSON required'});return;}
 busy=true;let raw='';try{for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>8192){json(res,413,{error:'Request too large'});return;}}const body=JSON.parse(raw);const url=await check(targetURL(body.url));json(res,200,{ok:true,result:await readPage(url)});}catch(e){json(res,400,{ok:false,error:e.message});}finally{busy=false;}
});
server.requestTimeout=45000;server.headersTimeout=10000;
async function shutdown(){if(stopping)return;stopping=true;await closeBrowser();server.close();const current=JSON.parse(await fs.readFile(connection,'utf8').catch(()=>'{}'));if(current.pid===process.pid)await fs.unlink(connection).catch(()=>{});process.exit(0);}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
server.listen(port,'127.0.0.1',async()=>{await fs.writeFile(connection,JSON.stringify({url:`http://127.0.0.1:${port}`,token,pid:process.pid,startedAt:new Date().toISOString()}),{mode:0o600});console.log(`Daily browser loader: http://127.0.0.1:${port}/health · pid ${process.pid} · local-only · one page at a time`);});
server.on('error',e=>{console.error(e.message);process.exitCode=1;});
