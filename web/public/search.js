const normalize=value=>String(value||'').normalize('NFKC').toLocaleLowerCase('ru-RU').replace(/ё/g,'е');
// Search local data only, including completed tasks and their project/block names.
export function searchTasks(tasks,entities,query){
 const words=normalize(query).trim().split(/\s+/).filter(Boolean);if(!words.length)return[];
 const byId=new Map(entities.filter(e=>!e.deleted).map(e=>[e.id,e]));
 return tasks.filter(t=>{
  if(t.deleted)return false;const block=byId.get(t.goalId),project=byId.get(t.projectId||block?.projectId);
  const text=normalize([t.title,block?.title,project?.title].filter(Boolean).join(' '));
  return words.every(word=>text.includes(word));
 }).sort((a,b)=>Number(!!a.done)-Number(!!b.done)||(b.createdAt||0)-(a.createdAt||0)||a.id.localeCompare(b.id));
}
