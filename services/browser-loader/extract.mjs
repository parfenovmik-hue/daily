// Runs inside the isolated browser. No Node imports, credentials or account storage.
export function extractPage(){
 const meta=key=>document.querySelector(`meta[property="${key}"],meta[name="${key}"]`)?.content||'';
 const text=(document.body?.innerText||'').slice(0,20000),title=document.title||'';
 const blocked=/^\s*ой[! .]?\s*$/i.test(title)||/captcha|access denied|запрос отклон|доступ ограничен|verify you are human|just a moment|robot check/i.test(title)||/\/(showcaptcha|checkcaptcha)([/?]|$)/i.test(location.href)||/подтвердите[, ]+что вы не робот|подтвердите[, ]+что запросы отправляли вы/i.test(text.slice(0,3000));
 if(blocked)return {status:'blocked',pageTitle:title,url:location.href,product:null,reason:'Сайт показал проверку доступа. Она не проходилась автоматически.'};
 const products=[];const walk=(v,n=0)=>{if(!v||n>12)return;if(Array.isArray(v)){v.slice(0,40).forEach(x=>walk(x,n+1));return;}if(typeof v!=='object')return;if([].concat(v['@type']||[]).includes('Product'))products.push(v);if(v['@graph'])walk(v['@graph'],n+1);if(v.mainEntity)walk(v.mainEntity,n+1);};
 for(const el of document.querySelectorAll('script[type="application/ld+json"]'))try{walk(JSON.parse(el.textContent));}catch{}
 const canonical=document.querySelector('link[rel="canonical"]')?.href||location.href;
 const normalize=u=>{try{const parsed=new URL(u,location.href);return parsed.origin+parsed.pathname.replace(/\/$/,'');}catch{return '';}};
 const product=products.find(p=>p.url&&normalize(p.url)===normalize(canonical))||(products.length===1?products[0]:null);
 const main=document.querySelector('main,[itemtype*="schema.org/Product"]')||document.body;
 const heading=main.querySelector('h1')?.innerText?.trim()||document.querySelector('h1')?.innerText?.trim()||'';
 const offers=product?[].concat(product.offers||[]):[];const offer=offers.length===1?offers[0]:null;
 const amount=offer?.price??meta('product:price:amount')??null;
 const explicit=main.querySelector('[itemprop="price"],.product_main .price_color,[data-testid="product-price"],[data-testid="price-current"]');const raw=amount||explicit?.getAttribute('content')||explicit?.textContent||'';
 const amounts=String(raw).match(/\d[\d\s\u00a0\u202f]*(?:[.,]\d{1,2})?/g)||[];
 const number=amounts.length===1?Number(amounts[0].replace(/[\s\u00a0\u202f]/g,'').replace(',','.')):NaN;
 const currency=String(offer?.priceCurrency||meta('product:price:currency')||main.querySelector('[itemprop="priceCurrency"]')?.getAttribute('content')||(/GBP|£/.test(String(raw))?'GBP':/EUR|€/.test(String(raw))?'EUR':/RUB|₽|руб/i.test(String(raw))?'RUB':'')).trim().toUpperCase();
 const images=[];const add=(value,source,alt='')=>{if(value&&typeof value==='object')value=value.url||value.contentUrl;try{const u=new URL(value,location.href);if(!value||u.protocol!=='https:'||u.username||u.password||/yastatic\.net$/.test(u.hostname)||images.some(x=>x.url===u.href)||images.length>=12)return;images.push({url:u.href,source,alt:String(alt).slice(0,200)});}catch{}};
 if(product)[].concat(product.image||[]).forEach(i=>add(i,'json-ld'));
 add(meta('og:image'),'open-graph');add(meta('twitter:image'),'twitter');
 for(const img of main.querySelectorAll('img')){if(img.closest('header,nav,footer')||img.naturalWidth<150||img.naturalHeight<150||/logo|banner|avatar|pixel|badge/i.test(img.alt+' '+img.src))continue;add(img.currentSrc||img.src,'visible-gallery',img.alt);}
 const name=String(product?.name||heading||meta('og:title')||'').trim().slice(0,500);
 return {status:name?'extracted':'unrecognized',pageTitle:title,url:location.href,canonical,product:{title:name,image:images[0]?.url||'',price:Number.isFinite(number)&&number>0&&/^[A-Z]{3}$/.test(currency)?number:null,currency:/^[A-Z]{3}$/.test(currency)?currency:'',images},evidence:{structuredProducts:products.length,description:String(product?.description||meta('og:description')||meta('description')||'').slice(0,3000),text:text.slice(0,12000)}};
}
