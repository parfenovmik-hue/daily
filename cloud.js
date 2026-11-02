import {SYNC_ENDPOINT} from './server-config.js';
export const connectionKey=account=>'daily-cloud-'+account;
export function validEndpoint(value){try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='script.google.com'&&/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(u.pathname)&&!u.search&&!u.hash;}catch{return false;}}
export function parseConnection(value){
 let c;if(typeof value==='object'&&value)c=value;else{const text=String(value||'').trim();if(text.startsWith('daily-connect:')){try{const encoded=text.slice(14).replace(/-/g,'+').replace(/_/g,'/');c=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(encoded),x=>x.charCodeAt(0))));}catch{throw Error('Не удалось прочитать код подключения');}}else c={v:1,endpoint:SYNC_ENDPOINT,key:text};}
 if(c.v!==1||(SYNC_ENDPOINT&&c.endpoint!==SYNC_ENDPOINT)||!validEndpoint(c.endpoint)||!/^daily1\.[a-f0-9]{32}\.[a-f0-9]{64}$/.test(c.key||''))throw Error('Проверь код подключения Daily');return{v:1,endpoint:c.endpoint,key:c.key};
}
export function formatConnection(c){return 'daily-connect:'+btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify({v:1,endpoint:c.endpoint,key:c.key})))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
export function loadConnection(account){try{return parseConnection(JSON.parse(localStorage.getItem(connectionKey(account))));}catch{return null;}}
export class CloudSync{
 constructor(config,transport=fetch){this.config=parseConnection(config);this.transport=transport;}
 async request(action,changes=[]){let response;const transport=this.transport;try{response=await transport(this.config.endpoint,{method:'POST',mode:'cors',credentials:'omit',redirect:'follow',cache:'no-store',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({protocol:1,key:this.config.key,action,changes}),signal:AbortSignal.timeout(35000)});}catch{throw Error('Нет связи с сервером. Изменения остаются на устройстве.');}if(!response.ok)throw Error('Сервер временно недоступен. Повторим автоматически.');let data;try{data=await response.json();}catch{throw Error('Сервер вернул неверный ответ. Проверь развёртывание Apps Script.');}if(!data.ok){const e=Error(data.error||'Не удалось синхронизировать');e.code=data.code;throw e;}if(data.protocol!==1||!data.user?.id)throw Error('Неверная версия сервера');if(action==='sync'&&(!Array.isArray(data.records)||!Array.isArray(data.accepted)))throw Error('Некорректный ответ синхронизации');return data;}
}
