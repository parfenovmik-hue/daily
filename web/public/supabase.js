import {createClient} from '@supabase/supabase-js';
import {SUPABASE_URL,SUPABASE_PUBLIC_KEY} from './supabase-config.js';
import {validRecord} from './model.js';
export const AUTH_STORAGE_KEY='daily-supabase-auth-v1';
let instance;
export function authClient(){return instance ||= createClient(SUPABASE_URL,SUPABASE_PUBLIC_KEY,{auth:{storageKey:AUTH_STORAGE_KEY,autoRefreshToken:true,persistSession:true,detectSessionInUrl:false,flowType:'implicit'}});}
export function authError(error){if(error?.status===429||/rate limit/i.test(error?.message||''))return 'Слишком много запросов. Подожди немного и попробуй снова.';if(/not authorized|email address not authorized/i.test(error?.message||''))return 'Отправка на эту почту пока недоступна. Обратись к владельцу Daily.';return 'Не удалось отправить письмо. Попробуй позже.';}
export async function passwordLogin(email,password,client=authClient()){
 const {data,error}=await client.auth.signInWithPassword({email,password});if(error||!data?.session)throw Error('Не удалось войти. Проверь почту и пароль.');return data.session;
}
export async function sendPasswordReset(email,client=authClient()){
 const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:new URL('./',location.href).href});if(error)throw Error(authError(error));
}
export async function updatePassword(password,client=authClient()){
 if(password.length<8)throw Error('Используй не меньше 8 символов.');const {error}=await client.auth.updateUser({password});if(error)throw Error('Не удалось сохранить пароль. Открой свежую ссылку из письма и попробуй снова.');
}
export async function consumeAuthRedirect(client=authClient(),loc=location,hist=history){
 const params=new URLSearchParams(loc.hash.slice(1));if(!params.has('access_token')&&!params.has('error'))return false;
 const access_token=params.get('access_token'),refresh_token=params.get('refresh_token');hist.replaceState(null,'',loc.pathname+loc.search);
 if(!access_token||!refresh_token)throw Error('Ссылка входа недействительна или устарела. Войди по почте или запроси новую ссылку.');
 const {data,error}=await client.auth.setSession({access_token,refresh_token});if(error||!data.session)throw Error('Ссылка входа недействительна или устарела. Войди по почте или запроси новую ссылку.');return params.get('type')||'magiclink';
}
export class SupabaseCloud{
 constructor(userId,client=authClient(),transport=fetch){if(!/^[a-f0-9-]{36}$/.test(userId))throw Error('Некорректный аккаунт');this.userId=userId;this.client=client;this.provider='supabase';this.transport=transport;}
 async request(action,changes=[]){
  if(!['hello','sync'].includes(action))throw Error('Для другого устройства используй вход по почте.');
  const {data:auth,error:sessionError}=await this.client.auth.getSession();
  if(sessionError||!auth?.session||auth.session.user.id!==this.userId){const error=Error('Войди по почте, чтобы продолжить синхронизацию. Записи остаются на устройстве.');error.code='AUTH';throw error;}
  // Bind the captured token to this request; another tab may change the SDK session.
  let response;try{const transport=this.transport;response=await transport(SUPABASE_URL+'/rest/v1/rpc/daily_sync',{method:'POST',credentials:'omit',headers:{apikey:SUPABASE_PUBLIC_KEY,Authorization:'Bearer '+auth.session.access_token,'Content-Type':'application/json'},body:JSON.stringify({changes:action==='sync'?changes:[]}),signal:AbortSignal.timeout(35000)});}catch{throw Error('Нет связи с сервером. Изменения остаются на устройстве.');}
  if(!response.ok){const error=Error(response.status===401||response.status===403?'Войди по почте или обратись к владельцу Daily. Записи остаются на устройстве.':'Не удалось синхронизировать. Изменения остаются на устройстве.');if(response.status===401||response.status===403)error.code='AUTH';throw error;}
  let data;try{data=await response.json();}catch{throw Error('Некорректный ответ синхронизации');}
  if(!data?.ok||data.protocol!==1||data.user?.id!==this.userId||!Array.isArray(data.records)||!data.records.every(validRecord)||!Array.isArray(data.accepted)||!Array.isArray(data.purged)||!data.purged.every(id=>/^(task|goal|project|shopping|wish)_[a-zA-Z0-9_-]{1,90}$/.test(id)))throw Error('Некорректный ответ синхронизации');
  return data;
 }
}
