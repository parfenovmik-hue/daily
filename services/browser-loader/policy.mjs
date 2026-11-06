import dns from 'node:dns/promises';
import net from 'node:net';
export function targetURL(value){
 if(typeof value!=='string'||value.length>3000)throw Error('Нужна публичная HTTPS-ссылка длиной до 3000 символов.');
 let u;try{u=new URL(value);}catch{throw Error('Некорректная ссылка.');}
 const h=u.hostname.toLowerCase();
 if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443')||net.isIP(h.replace(/^\[|\]$/g,''))||!h.includes('.')||/(^|\.)(localhost|local|internal|test|invalid)$/.test(h))throw Error('Разрешены только публичные HTTPS-сайты без пароля и нестандартного порта.');
 u.hash='';return u.href;
}
export function publicAddress(address){
 if(net.isIP(address)===4){const a=address.split('.').map(Number);return !(a[0]===0||a[0]===10||a[0]===127||a[0]>=224||a[0]===169&&a[1]===254||a[0]===172&&a[1]>=16&&a[1]<=31||a[0]===192&&(a[1]===168||a[1]===0)||a[0]===100&&a[1]>=64&&a[1]<=127||a[0]===198&&(a[1]===18||a[1]===19||a[1]===51)||a[0]===203&&a[1]===0&&a[2]===113);}
 return net.isIP(address)===6&&/^[23][0-9a-f]{3}:/i.test(address)&&!/^2001:db8:/i.test(address);
}
export function publicResolver(lookup=dns.lookup,{proxyDomains=[]}={}){const cache=new Map();return async value=>{const url=targetURL(value),host=new URL(url).hostname;let hit=cache.get(host);if(!hit||hit.until<Date.now()){const rows=await lookup(host,{all:true,verbatim:true});if(!rows.length||rows.some(r=>!publicAddress(r.address)&&!(proxyDomains.some(d=>host===d||host.endsWith('.'+d))&&net.isIP(r.address)===4&&Number(r.address.split('.')[0])>=240)))throw Error('Домен указывает на локальный или служебный адрес.');hit={until:Date.now()+30000};cache.set(host,hit);}return url;};}
