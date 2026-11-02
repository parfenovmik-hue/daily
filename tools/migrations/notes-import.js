import {dayKey} from '../../web/public/model.js';
export const IMPORT_DAY='2026-11-02';
// Source is only read. No connection secrets or unrelated Notes data are kept.
export async function readNotesOnDevice(){
 if(!indexedDB.databases)throw Error('Выбери резервную копию Notes ниже.');
 const databases=await indexedDB.databases();if(!databases.some(d=>d.name==='notespanel'))throw Error('В этом браузере данных Notes нет. Выбери JSON-копию из Notes.');
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('notespanel');r.onupgradeneeded=()=>r.transaction.abort();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 try{return await new Promise((resolve,reject)=>{const r=db.transaction('kv','readonly').objectStore('kv').get('state');r.onsuccess=()=>resolve({tasks:r.result?.tasks});r.onerror=()=>reject(r.error);});}finally{db.close();}
}
export function selectNotesTasks(source,day=IMPORT_DAY){
 if(!source||!Array.isArray(source.tasks))throw Error('Это не резервная копия Notes с задачами.');
 const seen=new Set(),today=[],queue=[];
 for(const t of source.tasks){if(!t||t.deleted||typeof t.id!=='string'||seen.has(t.id))continue;seen.add(t.id);if(t.date===day)today.push(t);else if(!t.done&&/^\d{4}-\d{2}-\d{2}$/.test(t.date||'')&&t.date<day)queue.push(t);}
 return{today,queue};
}
export async function planNotesImport(source,existing=[],day=IMPORT_DAY){
 const selected=selectNotesTasks(source,day),changes=[];let skipped=0;
 for(const [group,tasks]of Object.entries(selected))for(const t of tasks){
  const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('notespanel:'+t.id))),id='task_notes_'+Array.from(hash.slice(0,20),b=>b.toString(16).padStart(2,'0')).join('');
  if(existing.some(e=>e.id===id)){skipped++;continue;}
  const title=[t.title,t.note].filter(v=>typeof v==='string'&&v.trim()).map(v=>v.trim()).join('\n');if(!title||title.length>12000)throw Error('У одной из задач пустой или слишком длинный текст. Перенос остановлен без изменений.');
  const done=group==='today'&&!!t.done,completedAt=done?(Number(t.doneAt)||Date.parse(day+'T12:00:00')):0;
  changes.push({id,kind:'task',patch:{title,date:group==='today'?day:'',time:'',projectId:'',goalId:'',important:false,done,completedAt,completedDate:done?dayKey(new Date(completedAt)):'',createdAt:Number.isFinite(Number(t.createdAt))&&Number(t.createdAt)>0?Number(t.createdAt):Date.now(),deleted:false}});
 }
 return{changes,skipped,today:selected.today.length,queue:selected.queue.length};
}
