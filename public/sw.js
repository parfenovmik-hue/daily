const ACCOUNT=new URL(self.location.href).searchParams.get('account')||'';
const CACHE='daily-0.1.0-r2-'+encodeURIComponent(ACCOUNT);
const SHELL=['/daily.js','/store.js','/model.js','/icons.js','/daily.css','/offline.html','/manifest.webmanifest','/icon.svg','/apple-touch-icon.png','/icon-192.png','/icon-512.png'];
self.addEventListener('install',e=>e.waitUntil((async()=>{const c=await caches.open(CACHE);await c.addAll(SHELL.map(url=>new Request(url,{cache:'reload'})));const response=await c.match('/offline.html');const html=(await response.text()).replace('__DAILY_ACCOUNT__',encodeURIComponent(ACCOUNT));await c.put('/offline.html',new Response(html,{headers:{'Content-Type':'text/html;charset=utf-8'}}));await self.skipWaiting();})()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('daily-')&&key!==CACHE)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('fetch',e=>{const url=new URL(e.request.url);if(url.origin!==self.location.origin||e.request.method!=='GET'||url.pathname.startsWith('/api/')||/\/signin|\/signout|\/callback/.test(url.pathname))return;
 if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).catch(async()=>{const c=await caches.open(CACHE);return await c.match('/offline.html');}));return;}
 if(SHELL.includes(url.pathname)){e.respondWith(caches.open(CACHE).then(async c=>await c.match(url.pathname,{ignoreVary:true,ignoreSearch:true})||await fetch(e.request)));}
});
