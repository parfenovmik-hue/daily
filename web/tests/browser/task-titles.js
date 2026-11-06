async page=>{
 // Playwright CLI run-code --filename; run only against the isolated preview.
 if(!['localhost','127.0.0.1'].includes(new URL(page.url()).hostname))throw Error('Local preview required');
 await page.goto(new URL('/',page.url()).href);
 await page.evaluate(async()=>{const {DailyStore}=await import('/store.js');const {dayKey}=await import('/model.js');const account='text_regression_'+crypto.randomUUID();localStorage.setItem('daily-local-account',account);const s=await new DailyStore(account).load();const p=s.create('project',{title:'MOST',color:'lime'});const g=s.create('goal',{title:'Срочное по MOST',projectId:p,date:dayKey()});for(let i=0;i<10;i++)s.create('task',{title:['Короткая задача','Длинное название задачи для проверки двух строк и обтекания подписи проекта в нижнем правом углу карточки','СловаБезПробелов'.repeat(12)][i%3],projectId:i%4!==0?p:'',goalId:i%3===0?g:'',date:dayKey(),time:i===2?'14:00':'',order:i});await s.persist();});await page.reload();await page.waitForTimeout(300);
 const checks=[];
 for(const width of [320,375,440,768,1440])for(const scale of [1,1.25,2]){
 await page.setViewportSize({width,height:956});await page.evaluate(scale=>{document.documentElement.style.fontSize=(16*scale)+'px'},scale);await page.waitForTimeout(100);
 const rows=await page.locator('.task-row').evaluateAll(es=>es.map(row=>{const e=row.querySelector('.task-preview'),r=e.getBoundingClientRect(),range=document.createRange();range.selectNode(e.lastChild);const rects=[...range.getClientRects()];const visible=rects.filter(a=>a.top>=r.top-1&&a.bottom<=r.bottom+1&&a.width>0);return{visible:visible.length>0,first:visible[0]?.top-r.top,height:r.height,max:parseFloat(getComputedStyle(e).lineHeight)*2,marked:e.classList.contains('is-truncated'),overflows:e.scrollHeight>e.clientHeight+1,full:!!e.textContent,card:row.getBoundingClientRect().height}}));
 checks.push({width,scale,pass:rows.every(r=>r.visible&&r.first<r.max/2&&r.height<=r.max+1&&r.marked===r.overflows&&r.full)&&await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),rows});
 }
 await page.evaluate(()=>document.documentElement.style.fontSize='16px');await page.setViewportSize({width:440,height:956});
 const text=await page.locator('.task-title').first().getAttribute('aria-label');await page.locator('.task-title').first().click();checks.push({reader:true,pass:(await page.locator('.reader-text').textContent())===text});
 if(checks.some(c=>!c.pass))throw Error(JSON.stringify(checks.filter(c=>!c.pass)));
 return {passed:checks.filter(x=>x.pass).length,total:checks.length,checks};
}
