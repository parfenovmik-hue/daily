// Presentation-only projections; records and sync fields are never modified.
export const ACCENTS=[{value:'#3a7771',label:'Петроль'},{value:'#4a7088',label:'Синий'},{value:'#527b63',label:'Шалфей'},{value:'#52616a',label:'Графит'}];
const text=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function taskScheduleDate(task,byId){if(task.date)return task.date;const block=byId.get(task.goalId);return block&&!block.deleted&&!block.closed?block.date||'':'';}
export function taskCounts(entities){const byId=new Map(entities.map(e=>[e.id,e])),out={};for(const task of entities){if(task.kind!=='task'||task.deleted||task.done)continue;const date=taskScheduleDate(task,byId);if(date)out[date]=(out[date]||0)+1;}return out;}
// A view projection: membership follows the existing date/project contracts.
// Timed steps are extracted once; importance never splits a project's context.
export const compareProjects=(a,b)=>(a.order??Infinity)-(b.order??Infinity)||(a.createdAt||0)-(b.createdAt||0)||(a.title||'').localeCompare(b.title||'','ru')||a.id.localeCompare(b.id);
export function groupDayPlan(entities,day){
 const live=entities.filter(e=>!e.deleted),byId=new Map(live.map(e=>[e.id,e]));
 const compare=(a,b)=>(a.order??Infinity)-(b.order??Infinity)||(a.createdAt||0)-(b.createdAt||0)||a.id.localeCompare(b.id);
 const projects=live.filter(e=>e.kind==='project').sort(compareProjects),projectIds=new Set(projects.map(p=>p.id));
 const projectId=e=>{const id=e.projectId||byId.get(e.goalId)?.projectId||'';return projectIds.has(id)?id:'';};
 const blocks=live.filter(e=>e.kind==='goal'&&!e.closed&&e.date===day),blockIds=new Set(blocks.map(g=>g.id));
 const tasks=live.filter(e=>e.kind==='task'&&!e.done&&taskScheduleDate(e,byId)===day);
 const timed=tasks.filter(t=>t.time).sort((a,b)=>a.time.localeCompare(b.time)||compare(a,b));
 const children=new Map(blocks.map(g=>[g.id,[]])),timedCounts=new Map();
 const groups=new Map([...projects.map(p=>[p.id,{key:p.id,title:p.title,projectId:p.id,items:[],count:0}]),['',{key:'unassigned',title:'Без проекта',projectId:'',items:[],count:0}]]);
 for(const task of tasks){
  if(task.time){if(blockIds.has(task.goalId))timedCounts.set(task.goalId,(timedCounts.get(task.goalId)||0)+1);continue;}
  // Inconsistent legacy links stay visible in their effective project instead
  // of silently being placed under another project's block.
  if(blockIds.has(task.goalId)&&projectId(task)===projectId(byId.get(task.goalId)))children.get(task.goalId).push(task);
  else{const group=groups.get(projectId(task));group.items.push({entity:task});group.count++;}
 }
 for(const block of blocks){const steps=children.get(block.id).sort(compare),group=groups.get(projectId(block));group.items.push({entity:block,children:steps,timedCount:timedCounts.get(block.id)||0});group.count+=steps.length;}
 for(const group of groups.values())group.items.sort((a,b)=>compare(a.entity,b.entity));
 return [...(timed.length?[{key:'timed',title:'По времени',projectId:null,items:timed.map(entity=>({entity})),count:timed.length}]:[]),...[...groups.values()].filter(g=>g.items.length)];
}
export function readableText(value){let out='',last=0;const source=String(value||''),re=/https:\/\/[^\s<>]+/g;for(const match of source.matchAll(re)){let url=match[0],tail='';while(/[.,!?;:)]$/.test(url)){tail=url.slice(-1)+tail;url=url.slice(0,-1);}out+=text(source.slice(last,match.index));try{const parsed=new URL(url);out+=parsed.protocol==='https:'&&!parsed.username&&!parsed.password?`<a href="${text(url)}" target="_blank" rel="noopener noreferrer">${text(url)}</a>`:text(url);}catch{out+=text(url);}out+=text(tail);last=match.index+match[0].length;}return out+text(source.slice(last));}
const normalize=value=>String(value||'').normalize('NFKC').toLocaleLowerCase('ru-RU').replace(/ё/g,'е');
export function searchContents(entities,query,scope='all'){const words=normalize(query).trim().split(/\s+/).filter(Boolean);if(!words.length)return[];const live=entities.filter(e=>!e.deleted),byId=new Map(live.map(e=>[e.id,e]));return live.filter(e=>{if(scope!=='all'&&e.kind!==scope)return false;const g=byId.get(e.goalId),p=byId.get(e.projectId||g?.projectId);return words.every(w=>normalize([e.title,e.productTitle,e.notes,e.info,g?.title,p?.title].filter(Boolean).join(' ')).includes(w));}).sort((a,b)=>Number(!!a.done)-Number(!!b.done)||(b.createdAt||0)-(a.createdAt||0)||a.id.localeCompare(b.id));}
