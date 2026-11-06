import test from 'node:test';
import assert from 'node:assert/strict';
import {taskCounts,taskScheduleDate,readableText,searchContents,groupDayPlan,ACCENTS} from '../public/ui-view.js';
test('one calendar count includes inherited steps once and respects explicit dates, closed/deleted/done',()=>{const entities=[{id:'g',kind:'goal',date:'2026-11-06'},{id:'closed',kind:'goal',date:'2026-11-06',closed:true},{id:'del',kind:'goal',date:'2026-11-06',deleted:true},{id:'a',kind:'task',date:'2026-11-06',time:'10:00'},{id:'b',kind:'task',goalId:'g',date:''},{id:'c',kind:'task',goalId:'g',date:'2026-11-06',important:true},{id:'d',kind:'task',goalId:'g',date:'2026-11-07'},{id:'e',kind:'task',goalId:'g',date:'',done:true},{id:'f',kind:'task',goalId:'closed',date:''},{id:'h',kind:'task',goalId:'del',date:''},{id:'i',kind:'task',date:'2026-11-06',deleted:true}];assert.deepEqual(taskCounts(entities),{'2026-11-06':3,'2026-11-07':1});assert.equal(taskScheduleDate(entities[5],new Map(entities.map(e=>[e.id,e]))),'2026-11-06');});
test('reader safely opens HTTPS links, preserves paragraphs and never emits injected markup',()=>{const html=readableText('<img src=x onerror=alert(1)>\n\nhttps://example.com/path?q="x".');assert.ok(html.includes('&lt;img'));assert.ok(html.includes('\n\n'));assert.ok(html.includes('rel="noopener noreferrer"'));assert.ok(!html.includes('<img'));assert.ok(!readableText('javascript:alert(1)').includes('<a'));assert.ok(!readableText('https://user:secret@example.com').includes('<a'));});
test('global search respects type scopes and finds personal notes without deleted content',()=>{const rows=[{id:'p',kind:'project',title:'Работа',info:'документы'},{id:'g',kind:'goal',title:'Поездка',projectId:'p'},{id:'t',kind:'task',title:'Проверить билеты',goalId:'g'},{id:'w',kind:'wish',title:'Для мамы',notes:'Зелёный телефон'},{id:'s',kind:'shopping',title:'Молоко'},{id:'x',kind:'wish',title:'Для мамы',deleted:true}];assert.deepEqual(searchContents(rows,'зеленый телефон','wish').map(e=>e.id),['w']);assert.deepEqual(searchContents(rows,'поездка работа','task').map(e=>e.id),['t']);assert.equal(searchContents(rows,'молоко','task').length,0);assert.deepEqual(searchContents(rows,'документы','project').map(e=>e.id),['p']);});
test('every offered accent keeps white normal text contrast at least 4.5:1',()=>{const lum=h=>h.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0);for(const accent of ACCENTS)assert.ok(1.05/(lum(accent.value)+.05)>=4.5,accent.value);});

const day='2026-11-06',p=(id,extra={})=>({id,kind:'project',title:id,...extra}),g=(id,extra={})=>({id,kind:'goal',date:day,...extra}),t=(id,extra={})=>({id,kind:'task',date:day,...extra});
const shown=groups=>groups.flatMap(g=>g.items.flatMap(i=>i.entity.kind==='task'?[i.entity.id]:(i.children||[]).map(t=>t.id)));
test('day groups extract timed steps once, keep important steps in blocks, and match the calendar total',()=>{
 const entities=[p('MOST'),g('block',{projectId:'MOST'}),t('plain',{projectId:'MOST'}),t('inherited',{goalId:'block',date:''}),t('important',{goalId:'block',important:true}),t('timed',{goalId:'block',time:'14:00'}),t('personal')],before=JSON.stringify(entities),groups=groupDayPlan(entities,day);
 assert.deepEqual(groups.map(g=>g.title),['По времени','MOST','Без проекта']);assert.equal(groups[0].items[0].entity.id,'timed');const block=groups[1].items.find(i=>i.entity.id==='block');assert.deepEqual(block.children.map(t=>t.id).sort(),['important','inherited']);assert.equal(block.timedCount,1);assert.equal(new Set(shown(groups)).size,5);assert.equal(shown(groups).length,5);assert.equal(groups.reduce((n,g)=>n+g.count,0),taskCounts(entities)[day]);assert.equal(JSON.stringify(entities),before);
});
test('day timeline remains chronological despite manual order, while project and local item orders remain stable',()=>{
 const groups=groupDayPlan([p('Z',{order:1}),p('A',{order:2}),t('late',{time:'18:00',order:0}),t('early',{time:'09:00',order:99}),t('z2',{projectId:'Z',order:2}),t('z1',{projectId:'Z',order:1}),t('a',{projectId:'A'}),t('personal')],day);
 assert.deepEqual(groups.map(g=>g.title),['По времени','Z','A','Без проекта']);assert.deepEqual(groups[0].items.map(i=>i.entity.id),['early','late']);assert.deepEqual(groups[1].items.map(i=>i.entity.id),['z1','z2']);
});
test('day groups retain dated orphans, exclude deleted/done/other-day content, and keep scheduled empty blocks accessible',()=>{
 const entities=[p('gone',{deleted:true}),p('unused'),g('empty'),g('closed',{closed:true}),g('deleted',{deleted:true}),t('deletedTask',{deleted:true}),t('done',{done:true}),t('future',{date:'2026-11-07'}),t('queue',{date:''}),t('closedChild',{goalId:'closed',date:''}),t('deletedChild',{goalId:'deleted',date:''}),t('orphan',{projectId:'gone'}),t('datedClosedChild',{goalId:'closed'})];
 const groups=groupDayPlan(entities,day);assert.deepEqual(groups.map(g=>g.title),['Без проекта']);assert.deepEqual(shown(groups).sort(),['datedClosedChild','orphan']);assert.ok(groups[0].items.some(i=>i.entity.id==='empty'));assert.deepEqual(groupDayPlan([],day),[]);
});
test('legacy cross-project task links stay visible once under their effective project',()=>{
 const groups=groupDayPlan([p('A'),p('B'),g('block',{projectId:'A'}),t('legacy',{goalId:'block',projectId:'B'}),t('inheritedTimed',{goalId:'block',date:'',time:'10:00'})],day);
 assert.deepEqual(shown(groups).sort(),['inheritedTimed','legacy']);assert.equal(groups.find(g=>g.title==='B').count,1);assert.equal(groups.find(g=>g.title==='A').items[0].timedCount,1);
});

 test('project ordering is identical in project list and day groups, including legacy and new projects',async()=>{
 const {compareProjects}=await import('../public/ui-view.js');
 const projects=[{id:'project_a',kind:'project',title:'MOST',createdAt:1},{id:'project_b',kind:'project',title:'VZVRT',createdAt:2},{id:'project_c',kind:'project',title:'daily',createdAt:3}];
 const entities=[...projects,...projects.map((p,i)=>({id:'task_'+i,kind:'task',projectId:p.id,date:'2026-11-06'}))];
 assert.deepEqual(groupDayPlan(entities,'2026-11-06').map(g=>g.key),projects.toSorted(compareProjects).map(p=>p.id));
 projects[1].order=1;projects[2].order=2;projects[0].order=3;
 assert.deepEqual(groupDayPlan(entities,'2026-11-06').map(g=>g.key),['project_b','project_c','project_a']);
 assert.deepEqual(projects.toSorted(compareProjects).map(p=>p.id),['project_b','project_c','project_a']);
 });
