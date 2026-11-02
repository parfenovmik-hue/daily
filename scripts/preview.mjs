import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../pages/',import.meta.url));
const args=process.argv.slice(2),port=Number(args[args.indexOf('--port')+1]||8801);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Use --port 1024…65535');
const allowed=new Set((await fs.readdir(root)).filter(name=>!name.startsWith('.')&&!name.startsWith('__')));
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
http.createServer(async(req,res)=>{
 try{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const name=pathname==='/'?'index.html':decodeURIComponent(pathname.slice(1));
  if(!['GET','HEAD'].includes(req.method)||!allowed.has(name)){res.writeHead(404);res.end();return;}
  const data=await fs.readFile(path.join(root,name));
  res.writeHead(200,{'Content-Type':(types[path.extname(name)]||'application/octet-stream')+'; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'"});
  res.end(req.method==='HEAD'?undefined:data);
 }catch{res.writeHead(404);res.end();}
}).listen(port,'127.0.0.1',()=>console.log(`Daily local-only preview: http://127.0.0.1:${port} (external sync blocked)`));
