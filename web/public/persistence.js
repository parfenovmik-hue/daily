// Serialize local transactions and sync commits; failed writes restore visible state.
const transactions=new WeakMap();
function snapshot(store){return structuredClone({records:store.records,dirty:store.dirty,undo:store.undo,erased:[...store.erased],clock:store.clock,sequence:store.sequence});}
function restore(store,before){store.records=before.records;store.dirty=before.dirty;store.undo.splice(0,store.undo.length,...before.undo);store.erased=new Set(before.erased);store.clock=Math.max(store.clock,before.clock);store.sequence=Math.max(store.sequence,before.sequence);}
export function atomicStoreMutation(store,mutate){
 const previous=transactions.get(store)||Promise.resolve();
 const transaction=previous.catch(()=>{}).then(async()=>{const before=snapshot(store);try{const result=mutate();await store.persist();return result;}catch(error){restore(store,before);throw error;}});
 const settled=transaction.catch(()=>{});transactions.set(store,settled);
 settled.then(()=>{if(transactions.get(store)===settled)transactions.delete(store);});
 return transaction;
}
export async function waitForStoreMutations(store){while(transactions.has(store))await transactions.get(store);}
