// Evaluated only in a fixed-source diagnostic Worker. Never imported by Production.
export function installNativeReadTrace(){
 if(globalThis.__c4NativeReads)return;const rows=globalThis.__c4NativeReads=[],tracked=new WeakMap(),stamp=()=>performance.timeOrigin+performance.now();
 for(const op of ['get','getAll','getAllKeys','openCursor']){
  const original=IDBObjectStore.prototype[op];IDBObjectStore.prototype[op]=function(...args){const r=original.apply(this,args);if(args[0]!==-Infinity)tracked.set(r,{store:this.name,op,...(args[0]==='current'||args[0]==='authority'?{key:args[0]}:{})});return r;};
 }
 const descriptor=Object.getOwnPropertyDescriptor(IDBRequest.prototype,'result');
 Object.defineProperty(IDBRequest.prototype,'result',{...descriptor,get(){
  const meta=tracked.get(this);if(!meta)return descriptor.get.call(this);const start=stamp(),value=descriptor.get.call(this),end=stamp(),snapshot=value?.data?.snapshot;
  rows.push({...meta,start,end,ms:end-start,...(snapshot?{world:{cities:snapshot.cities.length,armies:snapshot.armies.length,events:snapshot.events.length,receipts:snapshot.commandReceipts.length}}:{}),...(value?.kind==='authority'?{authorityReceiptCount:value.campaigns.reduce((n,c)=>n+c.receipts.length,0)}:{})});
  if(rows.length>5000)rows.splice(0,1000);return value;
 }});
}
