export function publicURL(raw:string){const u=new URL(raw),h=u.hostname.toLowerCase();if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443')||h==='localhost'||h.endsWith('.local')||h.endsWith('.internal')||!h.includes('.')||/[\[\]:]/.test(h)||/^\d+(\.\d+){3}$/.test(h))throw new Error('Используй публичную HTTPS-ссылку');return u;}
function decode(s:string){return s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/<[^>]*>/g,'').trim();}
export function extractProduct(html:string,base:string){
 const meta:Record<string,string>={};for(const m of html.matchAll(/<meta\s+[^>]*>/gi)){const attrs:Record<string,string>={};for(const a of m[0].matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g))attrs[a[1].toLowerCase()]=decode(a[2]);if(attrs.property||attrs.name)meta[attrs.property||attrs.name]=attrs.content||'';}
 let product:any=null;const search=(v:any):any=>{if(!v||typeof v!=='object')return null;if(Array.isArray(v))return v.map(search).find(Boolean);if([v['@type']].flat().includes('Product'))return v;if(v['@graph'])return search(v['@graph']);return null;};
 for(const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{product=search(JSON.parse(m[1]));if(product)break;}catch{}}
 const title=decode(product?.name||meta['og:title']||html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'');
 if(/captcha|access denied|доступ ограничен|подтвердите|проверка браузера|just a moment/i.test(title))return{productTitle:'',image:'',price:0,currency:'RUB'};
 const offer=Array.isArray(product?.offers)?product.offers[0]:product?.offers;
 let image=Array.isArray(product?.image)?product.image[0]:product?.image;image=typeof image==='object'?image?.url:image;image=image||meta['og:image']||'';try{image=image?publicURL(new URL(image,base).href).href:'';}catch{image='';}
 const price=String(offer?.price||offer?.lowPrice||meta['product:price:amount']||meta['og:price:amount']||'').replace(/\s/g,'').replace(',','.');
 return{productTitle:title.slice(0,500),image,price:Number(price)||0,currency:offer?.priceCurrency||meta['product:price:currency']||'RUB'};
}
