// Keep an already-open PWA current without discarding an open edit.
if('serviceWorker' in navigator){
 let pending=false,reloading=false,registration;
 document.addEventListener('input',e=>{if(e.target.form)e.target.form.dataset.updateDirty='yes';});
 const busy=()=>!!document.querySelector('.sheet,.picker-overlay,form[data-update-dirty]')||/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName||'');
 function apply(){if(!pending||reloading||document.visibilityState!=='visible'||busy())return;reloading=true;location.reload();}
 navigator.serviceWorker.addEventListener('controllerchange',()=>{pending=true;apply();});
 async function check(){if(!navigator.onLine)return;try{registration ||= await navigator.serviceWorker.getRegistration();await registration?.update();}catch{}apply();}
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check();});
 window.addEventListener('online',check);
 document.addEventListener('focusout',()=>setTimeout(apply,100));
 new MutationObserver(apply).observe(document.getElementById('daily'),{childList:true,subtree:true});
 check();
 setInterval(()=>{if(document.visibilityState==='visible')check();},120000);
}
