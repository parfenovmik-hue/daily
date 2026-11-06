import {icon} from './icons.js';

let pickerSequence=0;

const dateLabel=date=>new Date(date+'T12:00:00').toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
const taskWord=count=>count%10===1&&count%100!==11?'задача':count%10>=2&&count%10<=4&&(count%100<12||count%100>14)?'задачи':'задач';
function localDay(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}

// Navigation remains mounted while dates change, so month changes retain focus.
export function mountDateCalendar(body,{value='',counts={},onSelect}){
 let cursor=new Date((value||localDay(new Date()))+'T12:00:00');if(isNaN(cursor))cursor=new Date();cursor.setDate(1);
 const button=(text,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=fn;return b;};
 const nav=document.createElement('div');nav.className='picker-month';
 const name=document.createElement('span');name.setAttribute('aria-live','polite');name.setAttribute('aria-atomic','true');
 const changeMonth=(offset,target)=>{cursor.setMonth(cursor.getMonth()+offset);draw();target.focus({preventScroll:true});};
 const previous=button('‹',()=>changeMonth(-1,previous)),next=button('›',()=>changeMonth(1,next));
 previous.setAttribute('aria-label','Предыдущий месяц');next.setAttribute('aria-label','Следующий месяц');nav.append(previous,name,next);
 const grid=document.createElement('div');grid.className='picker-calendar';body.replaceChildren(nav,grid);
 function draw(){
  name.textContent=cursor.toLocaleDateString('ru-RU',{month:'long',year:'numeric'});grid.replaceChildren();
  grid.style.setProperty('--week-rows',Math.ceil(((cursor.getDay()+6)%7+new Date(cursor.getFullYear(),cursor.getMonth()+1,0).getDate())/7));
  for(const label of ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']){const s=document.createElement('span');s.textContent=label;grid.append(s);}
  for(let i=0;i<(cursor.getDay()+6)%7;i++)grid.append(document.createElement('span'));
  const today=localDay(new Date());
  for(let n=1;n<=new Date(cursor.getFullYear(),cursor.getMonth()+1,0).getDate();n++){
   const d=localDay(new Date(cursor.getFullYear(),cursor.getMonth(),n)),count=Number(counts[d])||0,b=button(String(n),()=>onSelect(d));
   b.dataset.date=d;b.setAttribute('aria-label',`${dateLabel(d)}${d===today?', сегодня':''} · ${count} ${taskWord(count)}`);b.setAttribute('aria-pressed',String(d===value));
   if(d===value)b.classList.add('selected');if(d===today){b.classList.add('today');b.setAttribute('aria-current','date');}
   const small=document.createElement('small');small.textContent=count||'';small.setAttribute('aria-hidden','true');b.append(small);grid.append(b);
  }
 }
 draw();
}

// App-owned pickers keep the compact date/time geometry and never open native selectors.
export function openPicker(root,{kind,value='',items=[],counts={},height,allowUndated=false,onSelect,onClose=()=>{}}){
 const previous=document.activeElement,bodyLocked=document.body.classList.contains('sheet-open'),htmlLocked=document.documentElement.classList.contains('sheet-open');
 document.body.classList.add('sheet-open');document.documentElement.classList.add('sheet-open');previous?.blur();
 const overlay=document.createElement('div');overlay.className='picker-overlay';
 overlay.innerHTML='<section class="picker-panel" role="dialog" aria-modal="true"><div class="picker-head"><h2></h2><button type="button" aria-label="Закрыть">Закрыть</button></div><div class="picker-content"></div></section>';
 root.append(overlay);
 // A nested picker temporarily isolates both the page and the editor behind it.
 const isolated=[...root.children].filter(el=>el!==overlay&&!el.inert);for(const el of isolated)el.inert=true;
 const panel=overlay.firstElementChild;panel.dataset.pickerKind=kind;const body=overlay.querySelector('.picker-content'),closeButton=overlay.querySelector('.picker-head button');
 if(height){panel.classList.add('composer-picker');panel.style.height=Math.max(height,kind==='date'?460:0)+'px';}
 let closed=false,timeKeys=null,timePaste=null,initialFocus=closeButton;
 const close=()=>{
  if(closed)return;closed=true;document.removeEventListener('keydown',keys,true);document.removeEventListener('paste',paste,true);overlay.remove();
  for(const el of isolated)if(el.isConnected)el.inert=false;
  if(!bodyLocked)document.body.classList.remove('sheet-open');if(!htmlLocked)document.documentElement.classList.remove('sheet-open');
  onClose();if(previous?.isConnected&&typeof previous.focus==='function'&&!previous.closest('[inert]'))previous.focus({preventScroll:true});
 };
 const focusable=()=>[...panel.querySelectorAll('button:not([disabled]),input:not([disabled]),[tabindex="0"]')].filter(el=>!el.hidden&&el.getClientRects().length&&!el.closest('[hidden],[inert]'));
 const keys=e=>{
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();return;}
  if(e.key==='Tab'){
   const focus=focusable(),first=focus[0],last=focus.at(-1);if(!first){e.preventDefault();return;}
   if(!panel.contains(document.activeElement)){e.preventDefault();(e.shiftKey?last:first).focus({preventScroll:true});}
   else if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus({preventScroll:true});}
   else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus({preventScroll:true});}
   return;
  }
  if(panel.contains(document.activeElement))timeKeys?.(e);
 };
 const paste=e=>{if(panel.contains(document.activeElement))timePaste?.(e);};
 document.addEventListener('keydown',keys,true);document.addEventListener('paste',paste,true);
 // A picker owns its keyboard; app shortcuts and the outer sheet trap stay inactive.
 panel.addEventListener('keydown',e=>e.stopPropagation());
 const finish=v=>{onSelect(v);close();};closeButton.onclick=close;overlay.onclick=e=>{if(e.target===overlay)close();};
 const button=(text,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=fn;return b;};
 const title={date:'Выбрать дату',time:'Выбрать время',projectId:'Проект',goalId:'Блок',flag:'Обозначение',steps:'Все шаги'}[kind]||'Выбрать значение';
 overlay.querySelector('h2').textContent=title;panel.setAttribute('aria-label',title);
 if(kind==='date'){
  body.classList.add('date-content');mountDateCalendar(body,{value,counts,onSelect:finish});
  if(allowUndated)body.append(button('Без даты, в очередь',()=>finish('')));
  initialFocus=body.querySelector('[aria-pressed="true"]')||body.querySelector('[aria-current="date"]')||closeButton;
 }else if(kind==='time'){
  body.classList.add('time-content');let digits=(value||'1200').replace(':',''),fresh=true;
  const display=button('',()=>{fresh=true;digits='';draw();});display.className='time-display';
  display.title='Набери четыре цифры или вставь время ЧЧ:ММ. Enter — выбрать время.';
  const error=document.createElement('p');error.className='sheet-error';error.id='picker-time-error-'+(++pickerSequence);error.setAttribute('role','alert');display.setAttribute('aria-describedby',error.id);
  const clearError=()=>{error.textContent='';display.removeAttribute('aria-invalid');};
  const draw=()=>{const text=digits.padEnd(4,'–');display.textContent=text.slice(0,2)+':'+text.slice(2);display.setAttribute('aria-label',`Время ${display.textContent}. Набери четыре цифры, Enter — выбрать. Нажми, чтобы ввести заново.`);};
  const enter=key=>{clearError();if(key==='⌫'){digits=digits.slice(0,-1);fresh=false;}else{if(fresh){digits='';fresh=false;}digits=(digits+key).slice(0,4);}draw();};
  const choose=()=>{if(digits.length!==4||+digits.slice(0,2)>23||+digits.slice(2)>59){error.textContent='Введи время от 00:00 до 23:59';display.setAttribute('aria-invalid','true');display.focus({preventScroll:true});return;}finish(digits.slice(0,2)+':'+digits.slice(2));};
  draw();
  const quick=document.createElement('div');quick.className='picker-shortcuts';
  for(const t of ['09:00','12:00','15:00','18:00'])quick.append(button(t,()=>{clearError();digits=t.replace(':','');fresh=true;draw();}));
  const keypad=document.createElement('div');keypad.className='time-keypad';
  for(const key of ['1','2','3','4','5','6','7','8','9','00','0','⌫']){const b=button(key,()=>enter(key));if(key==='⌫')b.setAttribute('aria-label','Удалить цифру');keypad.append(b);}
  const save=button('Выбрать время',choose);save.className='primary';
  const actions=document.createElement('div');actions.className='time-actions';actions.append(button('Убрать время',()=>finish('')),save);body.append(display,quick,keypad,error,actions);initialFocus=display;
  timeKeys=e=>{if(e.ctrlKey||e.metaKey||e.altKey)return;if(/^\d$/.test(e.key)){e.preventDefault();e.stopImmediatePropagation();enter(e.key);}else if(e.key==='Backspace'){e.preventDefault();e.stopImmediatePropagation();enter('⌫');}else if(e.key==='Enter'&&document.activeElement===display){e.preventDefault();e.stopImmediatePropagation();choose();}};
  timePaste=e=>{const text=(e.clipboardData?.getData('text')||'').trim(),match=text.match(/^(\d{1,2}):(\d{2})$/),next=match?match[1].padStart(2,'0')+match[2]:text;
   e.preventDefault();if(!/^\d{4}$/.test(next)){error.textContent='Вставь время в формате ЧЧ:ММ, например 09:30';display.setAttribute('aria-invalid','true');return;}clearError();digits=next;fresh=false;draw();display.focus({preventScroll:true});
  };
 }else if(kind==='flag'){
  body.classList.add('flag-content');const help=document.createElement('p');help.className='picker-help';help.textContent='Ромб, звезда и флажок одинаково отмечают важное. Выбери удобный знак.';body.append(help);
  for(const item of items){const b=button('',()=>finish(item.value));b.className=item.value?'flag-option':'flag-remove';if(item.value)b.innerHTML=icon(item.value,25);const text=document.createElement('span');text.textContent=item.label;b.append(text);b.setAttribute('aria-label',item.value?`${item.label} — важно`:item.label);b.setAttribute('aria-pressed',String(item.value===value));body.append(b);}
  initialFocus=body.querySelector('[aria-pressed="true"]')||closeButton;
 }else{
  const list=document.createElement('div');list.className='picker-options';let search=null;
  const empty=document.createElement('p');empty.className='picker-empty';empty.setAttribute('role','status');empty.hidden=true;
  const normalize=text=>String(text).toLocaleLowerCase('ru-RU').replaceAll('ё','е').trim();
  const draw=()=>{const query=normalize(search?.value||''),matches=items.filter(item=>!query||normalize(item.label).includes(query));list.replaceChildren();for(const item of matches){const b=button(item.label,()=>finish(item.value));b.setAttribute('aria-pressed',String(item.value===value));list.append(b);}empty.hidden=matches.length>0;empty.textContent=matches.length?'':'Ничего не найдено. Попробуй другое название.';};
  if(items.length>7){search=document.createElement('input');search.type='search';search.className='picker-search';search.placeholder=kind==='projectId'?'Найти проект':'Найти блок';search.setAttribute('aria-label',search.placeholder);search.autocomplete='off';search.maxLength=200;search.oninput=draw;body.append(search);}
  body.append(list,empty);draw();initialFocus=list.querySelector('[aria-pressed="true"]')||closeButton;
  panel.addEventListener('keydown',e=>{const options=[...list.querySelectorAll('button')],index=options.indexOf(document.activeElement);let next;
   if(e.key==='ArrowDown'&&(index>=0||document.activeElement===search))next=options[Math.min(index+1,options.length-1)];
   else if(e.key==='ArrowUp'&&index>=0)next=options[Math.max(0,index-1)];
   else if(e.key==='Home'&&index>=0)next=options[0];else if(e.key==='End'&&index>=0)next=options.at(-1);
   if(next){e.preventDefault();next.focus({preventScroll:true});next.scrollIntoView({block:'nearest'});}
  });
 }
 initialFocus.focus({preventScroll:true});if(initialFocus!==closeButton&&kind!=='time'&&kind!=='date')initialFocus.scrollIntoView({block:'nearest'});
}
