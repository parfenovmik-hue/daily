import{test}from'node:test';import assert from'node:assert/strict';import{dayPlan,rescheduleBlockTasks,taskTransferChanges}from'../public/model.js';import{groupDayPlan}from'../public/ui-view.js';import{parseWishInput}from'../public/wish-input.js';
const day='2026-11-02',task=(id,extra={})=>({id,kind:'task',date:day,createdAt:1,...extra});
test('Default plan puts timed then important tasks, blocks, and regular tasks; manual order overrides it',()=>{const tasks=[task('regular'),task('important',{important:true}),task('late',{time:'18:00'}),task('early',{time:'09:00'})],goals=[{id:'block',kind:'goal',date:day,createdAt:1}];assert.deepEqual(dayPlan(tasks,goals,day).map(x=>x.id),['early','late','important','block','regular']);for(const t of tasks)t.order={regular:0,important:2,late:4,early:3}[t.id];goals[0].order=1;assert.deepEqual(dayPlan(tasks,goals,day).map(x=>x.id),['regular','block','important','early','late']);});
test('A scheduled block owns its ordinary steps but timed or important steps remain in top-level priorities',()=>{const g={id:'g',kind:'goal',date:day};const tasks=[task('child',{goalId:'g'}),task('timed',{goalId:'g',time:'10:00'}),task('urgent',{goalId:'g',important:true}),task('otherday',{date:'2026-11-03'})];assert.deepEqual(dayPlan(tasks,[g],day).map(x=>x.id),['timed','urgent','g']);});
test('Quick wish capture preserves heading, link and notes without claiming product metadata',()=>{assert.deepEqual(parseWishInput('Маме на ДР\nhttps://example.com/product\nНужен белый цвет'),{title:'Маме на ДР',url:'https://example.com/product',notes:'Нужен белый цвет'});assert.equal(parseWishInput('https://example.com/x').title,'');assert.equal(parseWishInput('Книга').title,'Книга');assert.throws(()=>parseWishInput('  '));assert.throws(()=>parseWishInput('https://user:pass@example.com/'));assert.throws(()=>parseWishInput('http://example.com/'));});

test('Moving a dated block takes all unfinished steps to the new day and preserves their times',()=>{
 const next='2026-11-03',block={id:'g',kind:'goal',date:day};
 const tasks=[
  task('inherited',{goalId:'g',date:''}),
  task('dated',{goalId:'g'}),
  task('timed',{goalId:'g',date:'2026-11-04',time:'10:00'}),
  task('done',{goalId:'g',done:true,completedDate:day}),
  task('deleted',{goalId:'g',deleted:true}),
  task('unrelated')
 ];
 const changes=rescheduleBlockTasks(block,tasks,next);
 assert.deepEqual(changes,['dated','timed'].map(id=>({id,kind:'task',patch:{date:next}})));
 const moved=[{...block,date:next},...tasks.map(t=>({...t,...changes.find(c=>c.id===t.id)?.patch}))];
 const [timed,project]=groupDayPlan(moved,next);
 assert.equal(timed.items[0].entity.time,'10:00');
 assert.deepEqual(project.items[0].children.map(t=>t.id),['dated','inherited']);
 assert.deepEqual(groupDayPlan(moved,day).flatMap(g=>g.items.map(i=>i.entity.id)),['unrelated']);
 assert.deepEqual(rescheduleBlockTasks(block,tasks,''),['dated','timed'].map(id=>({id,kind:'task',patch:{date:'',time:''}})));
 assert.deepEqual(rescheduleBlockTasks(block,tasks,day),[]);
 assert.deepEqual(rescheduleBlockTasks({...block,date:''},tasks,next),[]);
});

test('Bulk transfer preserves times, deduplicates no records and detaches only queue moves from dated blocks',()=>{
 const block={id:'goal_g',kind:'goal',date:day,projectId:'project_p'};
 const tasks=[task('task_a',{goalId:block.id,date:'',time:'10:00'}),task('task_b'),task('task_done',{done:true}),task('task_deleted',{deleted:true})];
 const next=taskTransferChanges(tasks,[block,...tasks],'2026-11-04');
 assert.deepEqual(next.map(c=>c.id),['task_a','task_b']);
 assert.deepEqual(next[0].patch,{date:'2026-11-04',time:'10:00'});
 const queue=taskTransferChanges(tasks,[block,...tasks],'');
 assert.deepEqual(queue[0].patch,{date:'',time:'',goalId:'',projectId:'project_p'});
 assert.deepEqual(queue[1].patch,{date:'',time:''});
 assert.equal(tasks[0].time,'10:00');
});
