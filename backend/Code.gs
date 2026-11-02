/** Daily sync. A private sheet per user; credentials live in Script Properties. */
const DAILY_HEADERS = ['id','kind','title','date','done','deleted','updatedAt','data1','data2','data3'];
function doGet() { return dailyJSON_({ok:true,service:'daily-sync',protocol:1}); }
function doPost(e) {
  let body;
  try { const raw=e&&e.postData&&e.postData.contents||'';if(raw.length>1500000)throw Error('Запрос слишком большой');body=JSON.parse(raw); }
  catch (_) { return dailyJSON_({ok:false,code:'BAD_REQUEST',error:'Некорректный запрос'}); }
  try {
    if(body.protocol!==1)throw Error('Обнови приложение Daily');
    if(body.action==='pair-redeem')return dailyJSON_(dailyRedeem_(body.code));
    const user=dailyAuth_(body.key);
    if(!user)return dailyJSON_({ok:false,code:'AUTH',error:'Код подключения не найден или отозван'});
    if(body.action==='pair-create')return dailyJSON_(dailyPair_(user,body.key));
    if(body.action==='hello')return dailyJSON_({ok:true,user:{id:user.id,name:user.name},protocol:1});
    const changes=body.changes||[];
    if(!Array.isArray(changes)||changes.length>100||!changes.every(dailyValidRecord_))throw Error('Некорректные записи');
    const lock=LockService.getScriptLock();if(!lock.tryLock(15000))return dailyJSON_({ok:false,code:'BUSY',error:'Сервер занят. Повторим синхронизацию.'});
    try {
      const sheet=dailySheet_(user),records=dailyReadRecords_(sheet),before=JSON.stringify(Array.from(records.values())),accepted=[],now=Date.now();
      for(const r of changes){const old=records.get(r.id);if(old&&old.kind!==r.kind)throw Error('Конфликт типа записи');accepted.push(r.id);if(old&&old.erasedAt)continue;const merged={id:r.id,kind:r.kind,fields:dailyMerge_(old&&old.fields||{},r.fields)};if(old&&old.retiredAt&&old.fields.deleted&&old.fields.deleted.value&&merged.fields.deleted&&merged.fields.deleted.value)merged.retiredAt=old.retiredAt;records.set(r.id,merged);}
      for(const [id,r] of records)records.set(id,dailyApplyRetention_(r,now));
      const output=Array.from(records.values());if(before!==JSON.stringify(output))dailyWriteRecords_(sheet,output);
      return dailyJSON_({ok:true,protocol:1,user:{id:user.id,name:user.name},records:output.filter(r=>!r.erasedAt),purged:output.filter(r=>r.erasedAt).map(r=>r.id),accepted});
    }finally{lock.releaseLock();}
  }catch(error){return dailyJSON_({ok:false,code:'SYNC',error:error.message||'Не удалось синхронизировать'});}
}
function dailyJSON_(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}
function dailyHash_(value){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,value,Utilities.Charset.UTF_8).map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');}
function dailyAuth_(key){const m=/^daily1\.([a-f0-9]{32})\.([a-f0-9]{64})$/.exec(String(key||''));if(!m)return null;const raw=PropertiesService.getScriptProperties().getProperty('daily.user.'+m[1]);if(!raw)return null;const user=JSON.parse(raw);if(user.revoked)return null;const hash=dailyHash_(user.salt+':'+key);let diff=hash.length^user.hash.length;for(let i=0;i<hash.length;i++)diff|=hash.charCodeAt(i)^user.hash.charCodeAt(i);return diff===0?user:null;}
function dailySheet_(user){const id=PropertiesService.getScriptProperties().getProperty('daily.spreadsheet');if(!id)throw Error('Сервер Daily ещё не настроен');const sheet=SpreadsheetApp.openById(id).getSheetById(user.sheetId);if(!sheet)throw Error('Лист пользователя не найден');const headers=sheet.getRange(1,1,1,10).getValues()[0];if(JSON.stringify(headers)!==JSON.stringify(DAILY_HEADERS))throw Error('Заголовки листа изменены. Запись остановлена.');return sheet;}
function dailyRow_(r){const data=JSON.stringify(r);if(data.length>120000)throw Error('Запись слишком большая');const v=k=>r.fields[k]&&r.fields[k].value;const text=x=>String(x==null?'':x);return[r.id,r.kind,dailyCellText_(v('title')),text(v('date')),text(v('done')||v('closed')||false),text(v('deleted')||false),String(Math.max.apply(null,Object.values(r.fields).map(f=>f.clock))),data.slice(0,40000),data.slice(40000,80000),data.slice(80000)];}
function dailyMerge_(a,b){const out=Object.assign({},a);Object.keys(b).forEach(k=>{const v=b[k],old=out[k];if(!old||v.clock>old.clock||(v.clock===old.clock&&v.actor>old.actor))out[k]=v;});return out;}
function dailyCreateUser_(config){
  const props=PropertiesService.getScriptProperties(),target=config.spreadsheetId||props.getProperty('daily.spreadsheet'),ss=target?SpreadsheetApp.openById(target):SpreadsheetApp.getActiveSpreadsheet();if(!ss)throw Error('Открой скрипт из таблицы «Приложение Daily»');
  const existing=props.getProperty('daily.user.'+config.id);if(existing)return {id:config.id,name:JSON.parse(existing).name,alreadyExists:true};
  if(props.getProperty('daily.spreadsheet')&&props.getProperty('daily.spreadsheet')!==ss.getId())throw Error('Таблица не совпадает');
  props.setProperty('daily.spreadsheet',ss.getId());
  let name=config.name.replace(/[\[\]*?:/\\]/g,' ').trim().slice(0,70)||'Пользователь';if(ss.getSheetByName(name))name+=' '+config.id.slice(0,6);
  const first=ss.getSheets()[0],sheet=ss.getSheets().length===1&&first.getLastRow()===0?first.setName(name):ss.insertSheet(name);
  sheet.getRange(1,1,1,10).setValues([DAILY_HEADERS]).setFontWeight('bold').setBackground('#197971').setFontColor('#ffffff');sheet.setFrozenRows(1);sheet.getRange('A:J').setNumberFormat('@');sheet.setColumnWidth(1,190);sheet.setColumnWidth(2,90);sheet.setColumnWidth(3,360);sheet.setColumnWidth(4,110);sheet.hideColumns(8,3);
  const user={id:config.id,name:config.name,sheetId:sheet.getSheetId(),salt:config.salt,hash:config.hash,createdAt:Date.now()};props.setProperty('daily.user.'+config.id,JSON.stringify(user));return{id:user.id,name:user.name,sheetId:user.sheetId};
}
function onOpen(){SpreadsheetApp.getUi().createMenu('Daily').addItem('Добавить пользователя','inviteDailyUser').addToUi();}
function inviteDailyUser(){const ui=SpreadsheetApp.getUi(),answer=ui.prompt('Новый пользователь Daily','Название листа и имя пользователя',ui.ButtonSet.OK_CANCEL);if(answer.getSelectedButton()!==ui.Button.OK)return;const name=answer.getResponseText().trim();if(!name)return;const id=Utilities.getUuid().replace(/-/g,''),key='daily1.'+id+'.'+Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,''),salt=Utilities.getUuid();dailyCreateUser_({id,name,salt,hash:dailyHash_(salt+':'+key)});const connection='daily-connect:'+Utilities.base64EncodeWebSafe(JSON.stringify({v:1,endpoint:ScriptApp.getService().getUrl(),key}));ui.alert('Личный код подключения для '+name,connection,ui.ButtonSet.OK);}

function dailyDate_(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
const fields={task:['flag','order','title','projectId','goalId','date','time','important','done','completedAt','completedDate'],project:['title','info','symbol','color'],goal:['order','date','title','projectId','closed','closedAt','closedDate'],shopping:['title','category','done','completedAt'],wish:['notes','title','productTitle','url','image','price','currency','extra','estimated','done','completedAt','status']};
function dailyValidRecord_(r){
 if(!r||!['task','project','goal','shopping','wish'].includes(r.kind)||typeof r.id!=='string'||!new RegExp('^'+r.kind+'_[a-zA-Z0-9_-]{1,90}$').test(r.id)||!r.fields||typeof r.fields!=='object'||Array.isArray(r.fields))return false;
 const allowed=new Set(['createdAt','deleted',...fields[r.kind]]);if(Object.keys(r.fields).length>24)return false;
 for(const[k,c]of Object.entries(r.fields)){
  if(!allowed.has(k)||!c||!Number.isSafeInteger(c.clock)||c.clock<0||typeof c.actor!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(c.actor))return false;const v=c.value;
  if(['deleted','important','done','closed','estimated'].includes(k)){if(typeof v!=='boolean')return false;}
  else if(['createdAt','completedAt','closedAt','price','extra','order'].includes(k)){if(typeof v!=='number'||!Number.isFinite(v)||v<0)return false;}
  else if(typeof v!=='string'||v.length>(k==='info'?50000:['title','notes'].includes(k)?12000:3000))return false;
  if(['date','completedDate','closedDate'].includes(k)&&v){if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const[y,m,d]=v.split('-').map(Number);if(dailyDate_(new Date(y,m-1,d))!==v)return false;}
  if(k==='time'&&v&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(v))return false;
  if(k==='flag'&&!['','diamond','star','flagmark'].includes(v))return false;
  if(['url','image'].includes(k)&&v&&!/^https:\/\/[^\s/@?#:]+(?::[0-9]{1,5})?(?:[/?#][^\s]*)?$/.test(v))return false;
 }return true;
}

function dailyCellText_(value){const s=String(value==null?'':value);return /^[=+@-]/.test(s)?"'"+s:s;}

function dailyPair_(user,key){
 const props=PropertiesService.getScriptProperties(),lock=LockService.getScriptLock();if(!lock.tryLock(15000))throw Error('Попробуй ещё раз');
 try{const now=Date.now(),all=props.getProperties();for(const k of Object.keys(all)){if(k.indexOf('daily.pair.')===0){const p=JSON.parse(all[k]);if(p.expiresAt<now||p.userId===user.id)props.deleteProperty(k);}}
 let code;do{code=Utilities.getUuid().replace(/-/g,'').slice(0,12).toUpperCase();}while(props.getProperty('daily.pair.'+dailyHash_(code)));
 const expiresAt=now+600000;props.setProperty('daily.pair.'+dailyHash_(code),JSON.stringify({key,userId:user.id,expiresAt}));return{ok:true,protocol:1,user:{id:user.id,name:user.name},code:code.match(/.{4}/g).join('-'),expiresAt};
 }finally{lock.releaseLock();}
}
function dailyRedeem_(value){
 const code=String(value||'').replace(/[\s-]/g,'').toUpperCase();if(!/^[A-F0-9]{12}$/.test(code))return{ok:false,code:'PAIR',error:'Проверь код подключения'};
 const props=PropertiesService.getScriptProperties(),lock=LockService.getScriptLock();if(!lock.tryLock(15000))throw Error('Попробуй ещё раз');
 try{const now=Date.now(),minute=Math.floor(now/60000),rate=JSON.parse(props.getProperty('daily.pairRate')||'{}'),count=rate.minute===minute?rate.count+1:1;props.setProperty('daily.pairRate',JSON.stringify({minute,count}));if(count>30)return{ok:false,code:'PAIR',error:'Слишком много попыток. Подожди минуту.'};
 const k='daily.pair.'+dailyHash_(code),raw=props.getProperty(k);if(!raw)return{ok:false,code:'PAIR',error:'Код не найден или уже использован'};const pair=JSON.parse(raw);props.deleteProperty(k);const user=dailyAuth_(pair.key);if(pair.expiresAt<now||!user)return{ok:false,code:'PAIR',error:'Код истёк. Получи новый на первом устройстве.'};return{ok:true,protocol:1,user:{id:user.id,name:user.name},key:pair.key};
 }finally{lock.releaseLock();}
}

const DAILY_RETENTION_MS=48*60*60*1000;
function dailyReadRecords_(sheet){const rows=sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,10).getValues():[],records=new Map();for(const row of rows){if(!row[0])continue;let r;try{r=JSON.parse(String(row[7]||'')+String(row[8]||'')+String(row[9]||''));}catch(_){throw Error('Повреждённая запись в таблице. Запись остановлена.');}if(!dailyValidRecord_(r)||r.id!==row[0]||records.has(r.id))throw Error('Некорректная или повторная запись в таблице');records.set(r.id,r);}return records;}
function dailyWriteRecords_(sheet,records){const rows=records.map(dailyRow_),previous=sheet.getLastRow()-1;if(rows.length){if(sheet.getMaxRows()<rows.length+1)sheet.insertRowsAfter(sheet.getMaxRows(),rows.length+1-sheet.getMaxRows());sheet.getRange(2,1,rows.length,10).setNumberFormat('@').setValues(rows);}if(previous>rows.length)sheet.getRange(rows.length+2,1,previous-rows.length,10).clearContent();SpreadsheetApp.flush();}
function dailyApplyRetention_(r,now){if(r.erasedAt)return r;if(!(r.fields.deleted&&r.fields.deleted.value)){if(!r.retiredAt)return r;return{id:r.id,kind:r.kind,fields:r.fields};}const retiredAt=r.retiredAt||now;if(now-retiredAt>=DAILY_RETENTION_MS)return{id:r.id,kind:r.kind,erasedAt:now,fields:{deleted:r.fields.deleted}};return Object.assign({},r,{retiredAt});}
// Owner-only scheduled execution in Apps Script; never exposed as a web action.
function purgeDailyDeleted(){const lock=LockService.getScriptLock();if(!lock.tryLock(15000))return;try{const props=PropertiesService.getScriptProperties().getProperties();let changed=0;for(const k of Object.keys(props)){if(k.indexOf('daily.user.')!==0)continue;const user=JSON.parse(props[k]),sheet=dailySheet_(user),records=Array.from(dailyReadRecords_(sheet).values()),next=records.map(r=>dailyApplyRetention_(r,Date.now()));if(JSON.stringify(records)!==JSON.stringify(next)){dailyWriteRecords_(sheet,next);changed++;}}return{changedUsers:changed};}finally{lock.releaseLock();}}
