import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {mergeFields,sameFields,validRecord} from '../../../public/model.js';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return json({error:'Требуется вход'},401);
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'Недопустимый источник'},403);
 if(!env.DB)return json({error:'Хранилище пока недоступно'},503);
 let changes:any[];try{const raw=await request.text();if(raw.length>1500000)return json({error:'Слишком много данных'},413);changes=JSON.parse(raw).changes||[];}catch{return json({error:'Некорректный запрос'},400);}
 if(!Array.isArray(changes)||changes.length>100||!changes.every(validRecord))return json({error:'Некорректные записи'},400);
 try{
  const accepted:string[]=[];
  for(const r of changes){let saved=false;
   for(let attempt=0;attempt<6&&!saved;attempt++){
    const old=await env.DB.prepare('SELECT kind,fields,revision FROM daily_records WHERE owner=? AND id=?').bind(user.userId,r.id).first<{kind:string;fields:string;revision:number}>();
    if(old&&old.kind!==r.kind)return json({error:'Конфликт типа записи'},409);
    const previous=old?JSON.parse(old.fields):{},fields=mergeFields(previous,r.fields);
    if(old&&sameFields(previous,fields)){saved=true;break;}
    const result=old?await env.DB.prepare('UPDATE daily_records SET fields=?,revision=revision+1 WHERE owner=? AND id=? AND revision=?').bind(JSON.stringify(fields),user.userId,r.id,old.revision).run():await env.DB.prepare('INSERT OR IGNORE INTO daily_records(owner,id,kind,fields,revision) VALUES(?,?,?,?,1)').bind(user.userId,r.id,r.kind,JSON.stringify(fields)).run();
    saved=!!result.meta.changes;
   }
   if(!saved)return json({error:'Конфликт синхронизации. Повторим автоматически.'},409);accepted.push(r.id);
  }
  const result=await env.DB.prepare('SELECT id,kind,fields FROM daily_records WHERE owner=?').bind(user.userId).all<{id:string;kind:string;fields:string}>();
  return json({accepted,records:result.results.map(r=>({id:r.id,kind:r.kind,fields:JSON.parse(r.fields)}))});
 }catch{return json({error:'Не удалось синхронизировать. Изменения сохранены на устройстве.'},503);}
}
