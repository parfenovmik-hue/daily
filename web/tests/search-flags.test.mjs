import {test} from 'node:test';
import assert from 'node:assert/strict';
import {searchTasks} from '../public/search.js';
import {taskFlag,flagPatch,dayPlan,validRecord,mergeFields,unpack} from '../public/model.js';
const cell=(value,clock=1)=>({value,clock,actor:'test'});
test('Old important tasks stay diamonds; all three marks retain priority, can be cleared and survive independent offline edits',()=>{
 assert.equal(taskFlag({important:true}),'diamond');assert.equal(taskFlag({important:false,flag:'star'}),'');assert.throws(()=>flagPatch('unknown'));
 for(const flag of ['diamond','star','flagmark']){
  const fields=Object.fromEntries(Object.entries(flagPatch(flag)).map(([k,v])=>[k,cell(v)])),record={id:'task_marked',kind:'task',fields};
  assert.ok(validRecord(record));const task={...unpack(record),date:'2026-11-02'};assert.equal(taskFlag(task),flag);
  assert.equal(dayPlan([{id:'task_plain',kind:'task',date:task.date,createdAt:0},task],[],task.date)[0].id,task.id);
  const merged=mergeFields(fields,{title:cell('Changed on another device',2)});assert.equal(taskFlag(unpack({...record,fields:merged})),flag);
 }
 assert.deepEqual(flagPatch(''),{important:false,flag:''});assert.equal(validRecord({id:'task_invalid',kind:'task',fields:{flag:cell('bogus')}}),false);
});
test('Search spans dates, queue and completed tasks, inherits project through block, ignores case/ё and never returns deleted data',()=>{
 const entities=[{id:'project_p',kind:'project',title:'Возвраты'},{id:'goal_g',kind:'goal',title:'Запуск тарифа',projectId:'project_p'}];
 const tasks=[{id:'task_a',title:'Созвон с Артёмом',goalId:'goal_g',date:'2026-11-02',createdAt:1},{id:'task_b',title:'Созвон с Артемом',done:true,date:'2026-11-03',createdAt:2},{id:'task_c',title:'Созвон в очереди',date:'',createdAt:3},{id:'task_d',title:'Созвон скрытый',deleted:true}];
 assert.deepEqual(searchTasks(tasks,entities,'  СОЗВОН  ').map(t=>t.id),['task_c','task_a','task_b']);
 assert.deepEqual(searchTasks(tasks,entities,'возвраты запуск артем').map(t=>t.id),['task_a']);
 assert.deepEqual(searchTasks(tasks,entities,' '),[]);assert.deepEqual(searchTasks(tasks,entities,'несуществующее'),[]);
 assert.equal(tasks[0].id,'task_a');assert.equal(searchTasks(tasks,[...entities.map(e=>({...e,deleted:true}))],'возвраты').length,0);
});
