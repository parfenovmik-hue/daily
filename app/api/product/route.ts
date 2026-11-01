import {getChatGPTUser} from '../../chatgpt-auth';
import {extractProduct,publicURL} from '../../../lib/product';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 if(!await getChatGPTUser())return Response.json({error:'Требуется вход'},{status:401});
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'Недопустимый источник'},{status:403});
 try{
  const body=await request.json() as {url?:unknown};let url=publicURL(String(body.url||'')),response:Response|null=null;
  for(let i=0;i<4;i++){response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(8000),headers:{Accept:'text/html'}});if(response.status>=300&&response.status<400){url=publicURL(new URL(response.headers.get('location')||'',url).href);continue;}break;}
  if(!response?.ok||!response.headers.get('content-type')?.includes('text/html'))return Response.json({error:'Магазин не отдал карточку. Можно заполнить данные вручную.'},{status:422});
  const reader=response.body?.getReader();if(!reader)throw new Error();let size=0;const chunks:Uint8Array[]=[];
  while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>2000000){await reader.cancel();break;}chunks.push(r.value);}
  const bytes=new Uint8Array(chunks.reduce((n,c)=>n+c.length,0));let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
  const product=extractProduct(new TextDecoder().decode(bytes),url.href);
  if(!product.productTitle&&!product.image)return Response.json({error:'Не удалось прочитать товар. Заполни карточку вручную.'},{status:422});
  return Response.json(product,{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Не удалось загрузить товар. Ссылка сохранится; данные можно добавить вручную.'},{status:422});}
}
