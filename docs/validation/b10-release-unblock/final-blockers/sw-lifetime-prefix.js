// Validation-only observer. Preserve original native Promise and event argument.
(()=>{let sequence=0;const pending=new Map(),events=[];
const mark=(type,details={})=>{events.push({type,at:Date.now(),...details});if(events.length>256)events.shift();};
const observe=(promise,details)=>{const id=++sequence;pending.set(id,{id,at:Date.now(),...details});Promise.resolve(promise).then(()=>{mark('resolved',{...pending.get(id)});pending.delete(id);},error=>{mark('rejected',{...pending.get(id),error:String(error)});pending.delete(id);});};
const wait=ExtendableEvent.prototype.waitUntil;ExtendableEvent.prototype.waitUntil=function(p){observe(p,{kind:'waitUntil',event:this.type,message:this.data?.type,url:this.request?.url,stack:new Error().stack});return wait.call(this,p);};
const respond=FetchEvent.prototype.respondWith;FetchEvent.prototype.respondWith=function(p){observe(p,{kind:'respondWith',url:this.request.url});return respond.call(this,p);};
const skip=self.skipWaiting.bind(self);self.skipWaiting=function(){const p=skip();observe(p,{kind:'skipWaiting'});return p;};
const claim=self.clients.claim.bind(self.clients);self.clients.claim=function(){const p=claim();observe(p,{kind:'claim'});return p;};
for(const type of ['install','activate','message'])self.addEventListener(type,e=>{if(e.data?.type==='GET_DIAG'){e.stopImmediatePropagation();e.ports[0]?.postMessage({pending:[...pending.values()],events});return;}mark(type,{message:e.data?.type});});
})();
