import assert from 'node:assert/strict';
import {chromium} from '../../../services/browser-loader/node_modules/playwright/index.mjs';
const browser=await chromium.launch({channel:'chrome'});
try{
 const context=await browser.newContext({viewport:{width:440,height:956},timezoneId:'Europe/Moscow'});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8813/');
 await page.evaluate(async()=>{
  const {DailyStore}=await import('/store.js'),{dayKey}=await import('/model.js');
  const account='progress_qa_'+crypto.randomUUID();localStorage.setItem('daily-local-account',account);
  const store=await new DailyStore(account).load(),date=dayKey();
  store.patch('project_work','project',{title:'Daily',color:'petrol'});
  store.patch('task_plain','task',{title:'Проверять поступления и обновлять информацию',date,projectId:'project_work',createdAt:1});
  store.patch('task_timed','task',{title:'Созвон',date,time:'11:00',inProgress:true,createdAt:1});
  store.patch('task_done','task',{title:'Уже сделано',date,done:true,completedDate:date,inProgress:true,createdAt:1});
  await store.persist();
 });
 await page.reload();await page.locator('[data-row=task_plain]').waitFor();
 assert.equal(await page.locator('[data-row=task_timed] .task-progress').count(),0);
 assert.equal(await page.locator('[data-row=task_done] .task-progress').count(),0);
 assert.match(await page.locator('[data-row=task_timed] .task-schedule').textContent(),/11:00/);
 await page.locator('[data-row=task_plain] .task-progress').click();
 await page.waitForFunction(()=>document.querySelector('[data-row=task_plain] .task-progress')?.getAttribute('aria-pressed')==='true');
 assert.equal(await page.locator('.sheet').count(),0);
 await page.reload();await page.locator('[data-row=task_plain] .task-progress[aria-pressed=true]').waitFor();
 for(const width of [320,440,768,1440]){
  await page.setViewportSize({width,height:956});
  const geometry=await page.locator('[data-row=task_plain]').evaluate(row=>{
   const button=row.querySelector('.task-progress').getBoundingClientRect(),check=row.querySelector('.check-hit').getBoundingClientRect(),card=row.getBoundingClientRect();
   return {aligned:Math.abs((button.left+button.right-check.left-check.right)/2)<1,
    below:button.top>=check.bottom-1,inside:button.bottom<=card.bottom+1,
    overflow:document.documentElement.scrollWidth>innerWidth};
  });
  assert.ok(geometry.aligned&&geometry.below&&geometry.inside&&!geometry.overflow,JSON.stringify({width,geometry}));
 }
 await page.setViewportSize({width:440,height:956});
 await page.screenshot({path:'output/playwright/task-progress-440.png',fullPage:true});
 await page.locator('[data-row=task_plain] .task-title').click();
 assert.equal(await page.locator('.reader-work-state').getAttribute('aria-pressed'),'true');
 await page.locator('button[data-action=sheet-cancel]').click();
 await page.locator('[data-check=task_plain]').check();
 await page.locator('[data-row=task_plain].done').waitFor();
 assert.equal(await page.locator('[data-row=task_plain] .task-progress').count(),0);
 await page.locator('.toast [data-action=undo]').click();
 await page.locator('[data-row=task_plain] .task-progress[aria-pressed=true]').waitFor();
 // The shared row keeps the state and its action in a project, too.
 await page.locator('nav [data-action=projects]').click();
 await page.locator('[data-action=project][data-id=project_work]').click();
 await page.locator('[data-row=task_plain] .task-progress[aria-pressed=true]').waitFor();
 await page.locator('[data-row=task_plain] .task-progress').click();
 await page.locator('[data-row=task_plain] .task-progress[aria-pressed=false]').waitFor();
 assert.deepEqual(errors,[]);
 console.log('PASS: start/stop, reload, timed/done exclusions, complete/undo, project view, 320/440/768/1440px.');
 await context.close();
}finally{await browser.close();}
