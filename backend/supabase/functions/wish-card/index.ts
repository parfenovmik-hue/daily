import {productURL,extractProduct,readPublicPage} from '../_shared/product.mjs';

const cors={
 'Access-Control-Allow-Origin':'https://parfenovmik-hue.github.io',
 'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info',
 'Access-Control-Allow-Methods':'POST,OPTIONS',
 'Vary':'Origin'
};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const base=Deno.env.get('SUPABASE_URL')!;
const publicKey=Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
async function rpc(name:string,body:unknown,token:string){
 const response=await fetch(base+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:token==='Bearer '+serviceKey?serviceKey:publicKey,Authorization:token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error(response.status===429?'Достигнут лимит запросов. Попробуй завтра.':'Не удалось получить данные. Проверь вход в Daily и попробуй позже.');
 return response.json();
}
async function resolve(host:string){
 const results=await Promise.allSettled([Deno.resolveDns(host,'A'),Deno.resolveDns(host,'AAAA')]);
 return results.flatMap(result=>result.status==='fulfilled'?result.value:[]);
}
Deno.serve(async request=>{
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(request.method!=='POST')return reply({ok:false,error:'Используй POST.'},405);
 try{
  const token=request.headers.get('authorization')||'';
  if(!/^Bearer \S+$/.test(token))return reply({ok:false,error:'Войди по почте в настройках Daily.'},401);
  const identity=await fetch(base+'/auth/v1/user',{headers:{apikey:publicKey,Authorization:token},signal:AbortSignal.timeout(10000)});
  if(!identity.ok)return reply({ok:false,error:'Войди по почте в настройках Daily.'},401);
  const user=await identity.json();
  const raw=await request.text();if(raw.length>10000)return reply({ok:false,error:'Ссылка слишком длинная.'},400);
  const body=JSON.parse(raw),url=productURL(body.url);
  if(!url)return reply({ok:false,error:'Нужна публичная HTTPS-ссылка на товар или услугу.'},400);
  const access=await rpc('daily_wish_reserve',{p_url:url},token);
  if(access.cached)return reply({ok:true,card:access.cached});
  if(!access.allowed)return reply({ok:false,error:'На сегодня достигнут лимит: 20 карточек. Попробуй завтра.'},429);
  const page=await readPublicPage(url,{resolve});
  if(!/text\/html|application\/xhtml/i.test(page.type))throw Error('По ссылке нужна страница товара или услуги.');
  const card=extractProduct(new TextDecoder().decode(page.bytes),page.url);
  if(card.image){
   try{
    const image=await readPublicPage(card.image,{resolve,limit:5000000,accept:'image/*'});
    if(!/^image\/(jpeg|png|webp|gif|avif)(?:;|$)/i.test(image.type))card.image='';
   }catch{card.image='';}
  }
  if(!card.productTitle&&!card.image&&!card.price)throw Error('Данные по ссылке не найдены. Запись сохранена — её можно дополнить вручную.');
  await rpc('daily_wish_cache_store',{p_owner:user.id,p_url:url,p_card:card},'Bearer '+serviceKey);
  return reply({ok:true,card});
 }catch(error){return reply({ok:false,error:error instanceof Error?error.message:'Не удалось получить данные. Ссылка сохранена.'},400);}
});
