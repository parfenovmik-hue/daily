// Capture personal text separately from externally sourced product metadata.
export function parseWishInput(value){const text=String(value||'').trim();if(!text)throw Error('Добавь текст или ссылку.');if(text.length>12000)throw Error('Сократи запись до 12 000 символов.');const match=text.match(/https?:\/\/[^\s<>]+/i);let url='',rest=text;if(match){url=match[0].replace(/[),.;!?]+$/,'');const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password)throw Error('Для товара нужна HTTPS-ссылка без пароля.');rest=text.replace(match[0],'').trim();}const lines=rest.split('\n').map(x=>x.trim()).filter(Boolean);return{title:lines.shift()||'',url,notes:lines.join('\n')};}

export function wishMetadataPatch(before,current,card,overwrite=false){
 if(!current||current.deleted||current.url!==before.url||!card||typeof card!=='object')return null;
 const patch={};
 for(const field of ['productTitle','image','price','currency']){
  const value=card[field];if(!value||current[field]!==before[field]||(!overwrite&&current[field]&&field!=='currency'))continue;
  if(field==='price'&&(typeof value!=='number'||!Number.isFinite(value)||value<0))continue;
  if(field==='currency'&&current.price!==before.price)continue;
  if(field==='currency'&&!overwrite&&before.price)continue;
  if(field==='currency'&&!['RUB','EUR','USD','RSD'].includes(value))continue;
  if(['productTitle','image'].includes(field)&&(typeof value!=='string'||value.length>3000))continue;
  if(field==='image'){try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)continue;}catch{continue;}}
  patch[field]=value;
 }
 return patch;
}

export function wishDisplayTitle(w){if(w.title||w.productTitle)return w.title||w.productTitle;try{const u=new URL(w.url),sku=/\/p\/([a-z0-9]+)/i.exec(u.pathname)?.[1];return u.hostname.replace(/^www\./,'')+(sku?' · '+sku.toUpperCase():'');}catch{return 'Хочу';}}
