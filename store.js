import {mergeFields,unpack,validRecord} from './model.js';
let dbPromise;
function database(){return dbPromise ||= new Promise((resolve,reject)=>{const r=indexedDB.open('daily-independent-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('accounts');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function read(account){const db=await database();return new Promise((resolve,reject)=>{const r=db.transaction('accounts').objectStore('accounts').get(account);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function write(account,value){const db=await database();return new Promise((resolve,reject)=>{const t=db.transaction('accounts','readwrite');t.objectStore('accounts').put(value,account);t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error);});}
export class DailyStore{
 constructor(account,adapter={read,write}){this.account=account;this.adapter=adapter;this.records={};this.dirty={};this.actor=crypto.randomUUID();this.clock=Date.now();this.sequence=0;this.queue=Promise.resolve();}
 async load(){const saved=await this.adapter.read(this.account);if(saved){this.actor=saved.actor||this.actor;this.sequence=saved.sequence||0;this.clock=Math.max(this.clock,saved.clock||0);this.dirty=saved.dirty||{};for(const r of Object.values(saved.records||{}))if(validRecord(r))this.records[r.id]=r;}for(const r of Object.values(this.records))for(const f of Object.values(r.fields))this.clock=Math.max(this.clock,f.clock);return this;}
 entities(kind,includeDeleted=false){return Object.values(this.records).map(unpack).filter(e=>(!kind||e.kind===kind)&&(includeDeleted||!e.deleted));}
 get(id){return this.records[id]?unpack(this.records[id]):null;}
 patch(id,kind,changes){const old=this.records[id];if(old&&old.kind!==kind)throw Error('Invalid record kind');const fields={...(old?.fields||{})};for(const[k,value]of Object.entries(changes)){this.clock=Math.max(Date.now(),this.clock+1);fields[k]={value,clock:this.clock,actor:this.actor};}const r={id,kind,fields};if(!validRecord(r))throw Error('Не удалось сохранить: некорректное поле');this.records[id]=r;this.dirty[id]=++this.sequence;return id;}
 create(kind,changes){const id=kind+'_'+crypto.randomUUID();this.patch(id,kind,{createdAt:Date.now(),deleted:false,...changes});return id;}
 merge(records){for(const incoming of records){if(!validRecord(incoming))continue;const old=this.records[incoming.id];if(old&&old.kind!==incoming.kind)continue;this.records[incoming.id]={id:incoming.id,kind:incoming.kind,fields:mergeFields(old?.fields,incoming.fields)};for(const f of Object.values(incoming.fields))this.clock=Math.max(this.clock,f.clock);}}
 persist(){const snapshot=structuredClone({actor:this.actor,clock:this.clock,sequence:this.sequence,records:this.records,dirty:this.dirty});this.queue=this.queue.catch(()=>{}).then(()=>this.adapter.write(this.account,snapshot));return this.queue;}
}
