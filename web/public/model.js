export const VERSION='1.8.0';
export const KINDS=['task','project','goal','shopping','wish'];
export function dayKey(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export function addDays(s,n){const[y,m,d]=s.split('-').map(Number);return dayKey(new Date(y,m-1,d+n));}
export function weekStart(s){const[y,m,d]=s.split('-').map(Number);return addDays(s,-((new Date(y,m-1,d).getDay()+6)%7));}
export function mergeFields(a={},b={}){const out={...a};for(const[k,v]of Object.entries(b)){const old=out[k];if(!old||v.clock>old.clock||(v.clock===old.clock&&v.actor>old.actor))out[k]=v;}return out;}
export function unpack(r){return{id:r.id,kind:r.kind,...Object.fromEntries(Object.entries(r.fields).map(([k,v])=>[k,v.value]))};}
export function sameFields(a,b){return JSON.stringify(Object.entries(a).sort())===JSON.stringify(Object.entries(b).sort());}
export function effectiveProject(t,entities){return t.projectId||entities.find(e=>e.id===t.goalId&&!e.deleted)?.projectId||'';}
export function dayView(tasks,day,today=dayKey()){return{
 open:tasks.filter(t=>!t.deleted&&!t.done&&t.date===day),
 carried:day===today?tasks.filter(t=>!t.deleted&&!t.done&&t.date&&t.date<today):[],
 done:tasks.filter(t=>!t.deleted&&t.done&&(t.completedDate===day||(t.date===day&&t.completedDate&&t.completedDate<t.date))).sort((a,b)=>(b.completedAt||0)-(a.completedAt||0)),
 queue:tasks.filter(t=>!t.deleted&&!t.done&&!t.date)
};}
export function goalProgress(goal,tasks){const list=tasks.filter(t=>!t.deleted&&t.goalId===goal.id),done=list.filter(t=>t.done).length;return{done,total:list.length,ready:list.length>0&&done===list.length&&!goal.closed};}
export function periodRange(period,day){if(period==='day')return{start:day,end:day,previousStart:addDays(day,-1),previousEnd:addDays(day,-1)};if(period==='week'){const start=weekStart(day);return{start,end:addDays(start,6),previousStart:addDays(start,-7),previousEnd:addDays(start,-1)};}const[y,m]=day.split('-').map(Number);return{start:dayKey(new Date(y,m-1,1)),end:dayKey(new Date(y,m,0)),previousStart:dayKey(new Date(y,m-2,1)),previousEnd:dayKey(new Date(y,m-1,0))};}
export function statistics(tasks,goals,range,entities){const inside=(date,start,end)=>date&&date>=start&&date<=end;const done=tasks.filter(t=>!t.deleted&&t.done&&inside(t.completedDate,range.start,range.end)),previous=tasks.filter(t=>!t.deleted&&t.done&&inside(t.completedDate,range.previousStart,range.previousEnd)).length,distribution={};done.forEach(t=>{const p=effectiveProject(t,entities);distribution[p]=(distribution[p]||0)+1;});return{done,previous,distribution,closed:goals.filter(g=>!g.deleted&&g.closed&&inside(g.closedDate,range.start,range.end))};}
const fields={task:['flag','order','title','projectId','goalId','date','time','important','done','completedAt','completedDate'],project:['order','title','info','symbol','color'],goal:['order','date','title','projectId','closed','closedAt','closedDate'],shopping:['title','category','done','completedAt'],wish:['notes','title','productTitle','url','image','price','currency','extra','estimated','done','completedAt','status']};
export function validRecord(r){
 if(!r||!KINDS.includes(r.kind)||typeof r.id!=='string'||!new RegExp('^'+r.kind+'_[a-zA-Z0-9_-]{1,90}$').test(r.id)||!r.fields||typeof r.fields!=='object'||Array.isArray(r.fields))return false;
 const allowed=new Set(['createdAt','deleted',...fields[r.kind]]);if(Object.keys(r.fields).length>24)return false;
 for(const[k,c]of Object.entries(r.fields)){
  if(!allowed.has(k)||!c||!Number.isSafeInteger(c.clock)||c.clock<0||typeof c.actor!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(c.actor))return false;const v=c.value;
  if(['deleted','important','done','closed','estimated'].includes(k)){if(typeof v!=='boolean')return false;}
  else if(['createdAt','completedAt','closedAt','price','extra','order'].includes(k)){if(typeof v!=='number'||!Number.isFinite(v)||v<0)return false;}
  else if(typeof v!=='string'||v.length>(k==='info'?50000:['title','notes'].includes(k)?12000:3000))return false;
  if(['date','completedDate','closedDate'].includes(k)&&v){if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const[y,m,d]=v.split('-').map(Number);if(dayKey(new Date(y,m-1,d))!==v)return false;}
  if(k==='time'&&v&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(v))return false;
  if(k==='flag'&&!['','diamond','star','flagmark'].includes(v))return false;
  if(['url','image'].includes(k)&&v){try{const u=new URL(v);if(u.protocol!=='https:'||u.username||u.password)return false;}catch{return false;}}
 }return true;
}

export function dayPlan(tasks,goals,day){const blocks=goals.filter(g=>!g.deleted&&!g.closed&&g.date===day),blockIds=new Set(blocks.map(g=>g.id));const standalone=tasks.filter(t=>!t.deleted&&!t.done&&t.date===day&&(!blockIds.has(t.goalId)||t.time||t.important));const group=e=>e.kind==='goal'?2:e.time?0:e.important?1:3;const base=[...standalone,...blocks].sort((a,b)=>group(a)-group(b)||(a.time&&b.time?a.time.localeCompare(b.time):0)||(a.createdAt||0)-(b.createdAt||0)||a.id.localeCompare(b.id));if(!base.some(e=>typeof e.order==='number'))return base;return base.map((e,i)=>({e,i})).sort((a,b)=>(a.e.order??1e12+a.i)-(b.e.order??1e12+b.i)||a.i-b.i).map(x=>x.e);}

// Legacy important=true has no explicit symbol and continues to display a diamond.
export function taskFlag(task){return task?.important?(['diamond','star','flagmark'].includes(task.flag)?task.flag:'diamond'):'';}
export function flagPatch(value){if(!['','diamond','star','flagmark'].includes(value))throw Error('Некорректное обозначение');return{important:!!value,flag:value};}
