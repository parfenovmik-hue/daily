// Page content is parsed as data only. No scripts, page instructions or AI calls.
export function productURL(value,base){
 try{
  const u=new URL(value,base),host=u.hostname.toLowerCase();
  if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443')||u.href.length>3000||
     !host.includes('.')||/^[\d.]+$/.test(host)||host.includes(':')||
     /(^|\.)(localhost|local|internal|test|invalid|onion)$/.test(host))return '';
  u.hash='';return u.href;
 }catch{return '';}
}
export function publicAddress(ip){
 if(ip.includes(':')){
  const value=ip.toLowerCase();
  // Fail closed for mapped, transition and non-global IPv6 ranges.
  return /^2[0-9a-f]{3}:/.test(value)&&!/^2001:(?:0:|db8:|0000:|0db8:)/.test(value)&&!value.startsWith('2002:');
 }
 const parts=ip.split('.').map(Number);
 if(parts.length!==4||parts.some(n=>!Number.isInteger(n)||n<0||n>255))return false;
 const [a,b]=parts;
 return a!==0&&a!==10&&a!==127&&a<224&&!(a===169&&b===254)&&!(a===172&&b>=16&&b<=31)&&
  !(a===192&&(b===168||b===0||b===2))&&!(a===198&&(b===18||b===19||b===51))&&
  !(a===203&&b===0)&&!(a===100&&b>=64&&b<=127);
}
const decode=value=>String(value||'').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Math.min(0x10ffff,Number(n))));
const clean=value=>decode(value).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,300);
const attrs=tag=>{
 const out={};
 for(const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g))out[match[1].toLowerCase()]=decode(match[2]??match[3]??match[4]);
 return out;
};
const normalized=value=>{try{const u=new URL(value);return u.origin+u.pathname.replace(/\/$/,'');}catch{return '';}};
export function extractProduct(html,url){
 const title=clean(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]);
 if(/captcha|access denied|доступ ограничен|запрос отклон|just a moment|robot check/i.test(title)||
    /подтвердите[, ]+что вы не робот|подтвердите[, ]+что запросы отправляли вы/i.test(html.slice(0,20000)))throw Error('Сайт ограничивает автоматическое чтение. Ссылка сохранена — данные можно дополнить вручную.');
 const meta={};for(const match of html.matchAll(/<meta\b[^>]*>/gi)){
  const a=attrs(match[0]),key=(a.property||a.name||'').toLowerCase();
  if(a.content&&!meta[key])meta[key]=a.content;
 }
 const products=[];
 const walk=(v,depth=0)=>{
  if(!v||depth>12)return;
  if(Array.isArray(v)){v.slice(0,40).forEach(x=>walk(x,depth+1));return;}
  if(typeof v!=='object')return;
  if([].concat(v['@type']||[]).some(type=>['Product','Service'].includes(type)))products.push(v);
  if(v['@graph'])walk(v['@graph'],depth+1);
  if(v.mainEntity)walk(v.mainEntity,depth+1);
 };
 for(const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  try{walk(JSON.parse(match[1]));}catch{}
 }
 const exact=products.find(p=>normalized(p.url||p['@id'])===normalized(url));
 // Multiple recommendations are not evidence for which product the URL selects.
 const product=exact||(products.length===1?products[0]:null);
 const offerList=[].concat(product?.offers||[]),offers=offerList.filter(o=>o&&typeof o==='object');
 const prices=offers.map(o=>({price:Number(o.price),currency:o.priceCurrency})).filter(o=>o.price>0&&Number.isFinite(o.price));
 const samePrice=prices.length>0&&prices.every(o=>o.price===prices[0].price&&o.currency===prices[0].currency);
 const priceString=meta['product:price:amount']||meta['og:price:amount']||'',metaPrice=Number(priceString.replace(/\s/g,'').replace(',','.'));
 const price=samePrice?prices[0].price:offers.length>1?0:metaPrice;
 const currency=String(samePrice?prices[0].currency:meta['product:price:currency']||meta['og:price:currency']||'').toUpperCase();
 const images=[].concat(product?.image||[]).map(i=>typeof i==='object'?i.url||i.contentUrl:i);
 images.push(meta['og:image'],meta['twitter:image']);
 const image=images.map(i=>i?productURL(i,url):'').find(Boolean)||'';
 return {
  productTitle:clean(product?.name||meta['og:title']||title),
  image,
  price:Number.isFinite(price)&&price>0&&price<1e10&&['RUB','EUR','USD','RSD'].includes(currency)?price:0,
  currency:['RUB','EUR','USD','RSD'].includes(currency)?currency:''
 };
}
export async function readPublicPage(value,{transport=fetch,resolve,limit=1000000,redirects=4,accept='text/html,application/xhtml+xml'}={}){
 let url=productURL(value);
 for(let hop=0;hop<=redirects;hop++){
  if(!url)throw Error('Нужна публичная HTTPS-ссылка.');
  const host=new URL(url).hostname;
  const addresses=await resolve(host);
  if(!addresses.length||!addresses.every(publicAddress))throw Error('Этот адрес недоступен для получения данных.');
  const response=await transport(url,{redirect:'manual',credentials:'omit',headers:{'User-Agent':'DailyProductPreview/2.0',Accept:accept},signal:AbortSignal.timeout(10000)});
  if(response.status>=300&&response.status<400){
   url=productURL(response.headers.get('location'),url);await response.body?.cancel();continue;
  }
  if(!response.ok){await response.body?.cancel();throw Error('Сайт ограничивает автоматическое чтение или временно недоступен. Ссылка сохранена.');}
  const type=response.headers.get('content-type')||'';
  if(!/text\/html|application\/xhtml|image\/(jpeg|png|webp|gif|avif)/i.test(type)){await response.body?.cancel();throw Error('По ссылке не найдена страница товара или услуги.');}
  const reader=response.body?.getReader();if(!reader)throw Error('Пустой ответ сайта.');
  const chunks=[];let size=0;
  try{
   for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit)throw Error('Страница слишком большая. Ссылка сохранена.');chunks.push(value);}
  }finally{await reader.cancel().catch(()=>{});}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return {url,type,bytes};
 }
 throw Error('Слишком много перенаправлений.');
}
