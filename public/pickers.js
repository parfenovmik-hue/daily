// Daily-owned pickers. Values are returned to the existing form without rebuilding it.
export function openPicker(root,{kind,value='',items=[],onSelect}){
 const previous=document.activeElement,overlay=document.createElement('div');overlay.className='picker-overlay';
 overlay.innerHTML='<section class="picker-panel" role="dialog" aria-modal="true"><div class="picker-head"><h3></h3><button type="button" aria-label="Назад">←</button></div><div class="picker-content"></div></section>';
 root.append(overlay);const panel=overlay.firstElementChild,body=overlay.querySelector('.picker-content');
 const close=()=>{document.removeEventListener('keydown',keys,true);overlay.remove();previous?.focus({preventScroll:true});};
 const keys=e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();}if(e.key==='Tab'){const focus=[...panel.querySelectorAll('button,input')].filter(x=>!x.disabled);if(e.shiftKey&&document.activeElement===focus[0]){e.preventDefault();focus.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===focus.at(-1)){e.preventDefault();focus[0]?.focus();}}};
 document.addEventListener('keydown',keys,true);const cleanup=close;
 // Use the same capture phase when removing the listener.
 const finish=v=>{onSelect(v);cleanup();};
 overlay.querySelector('.picker-head button').onclick=close;overlay.onclick=e=>{if(e.target===overlay)close();};
 const button=(text,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=fn;return b;};
 const title={date:'Выбрать дату',time:'Выбрать время',projectId:'Проект',goalId:'Блок'}[kind];overlay.querySelector('h3').textContent=title;panel.setAttribute('aria-label',title);
 if(kind==='date'){
  let cursor=new Date((value||new Date().toLocaleDateString('en-CA'))+'T12:00:00');if(isNaN(cursor))cursor=new Date();cursor.setDate(1);
  const key=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  function draw(){body.replaceChildren();const nav=document.createElement('div');nav.className='picker-month';const name=document.createElement('span');name.textContent=cursor.toLocaleDateString('ru',{month:'long',year:'numeric'});nav.append(button('←',()=>{cursor.setMonth(cursor.getMonth()-1);draw();}),name,button('→',()=>{cursor.setMonth(cursor.getMonth()+1);draw();}));body.append(nav);const grid=document.createElement('div');grid.className='picker-calendar';for(const label of ['ПН','ВТ','СР','ЧТ','ПТ','СБ','ВС']){const s=document.createElement('span');s.textContent=label;grid.append(s);}for(let i=0;i<(cursor.getDay()+6)%7;i++)grid.append(document.createElement('span'));for(let n=1;n<=new Date(cursor.getFullYear(),cursor.getMonth()+1,0).getDate();n++){const d=key(new Date(cursor.getFullYear(),cursor.getMonth(),n)),b=button(String(n),()=>finish(d));if(d===value){b.className='selected';b.setAttribute('aria-pressed','true');}grid.append(b);}body.append(grid,button('В очередь',()=>finish('')));}draw();
 }else if(kind==='time'){
  const row=document.createElement('div');row.className='picker-time';const [hour='12',minute='00']=value?value.split(':'):[];
  const input=(label,val)=>{const i=document.createElement('input');i.type='text';i.inputMode='numeric';i.maxLength=2;i.value=val;i.setAttribute('aria-label',label);return i;};const h=input('Часы',hour),m=input('Минуты',minute),colon=document.createElement('span');colon.textContent=':';row.append(h,colon,m);const quick=document.createElement('div');quick.className='picker-shortcuts';for(const t of ['09:00','12:00','15:00','18:00'])quick.append(button(t,()=>{[h.value,m.value]=t.split(':');}));const error=document.createElement('p');error.className='sheet-error';error.setAttribute('role','alert');const save=button('Выбрать время',()=>{if(!/^\d{1,2}$/.test(h.value)||!/^\d{1,2}$/.test(m.value)||+h.value>23||+m.value>59){error.textContent='Часы: 0–23, минуты: 0–59';return;}finish(`${h.value.padStart(2,'0')}:${m.value.padStart(2,'0')}`);});save.className='primary';body.append(row,quick,error,save,button('Убрать время',()=>finish('')));
 }else{const list=document.createElement('div');list.className='picker-options';for(const item of items){const b=button(item.label,()=>finish(item.value));b.setAttribute('aria-pressed',String(item.value===value));list.append(b);}body.append(list);}
 overlay.querySelector('button').focus({preventScroll:true});
}
