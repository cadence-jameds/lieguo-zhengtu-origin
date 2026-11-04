/** The build emits this small classic-SW import before Workbox's listeners.
 * clients.claim() must extend activate (or an already-active retry) lifetime.
 * skipWaiting requests a registration transition; do not hold its waiting
 * worker's message event open until that same transition has finished.
 * No automatic skipWaiting: only the page's post-save update request triggers it.
 */
export function serviceWorkerReleaseSource(identity:{version:string;contentSha:string}){
 return `const APP_RELEASE=${JSON.stringify(identity)},SW_LIFECYCLE=[];
const mark=(type,details={})=>{SW_LIFECYCLE.push({type,at:Date.now(),...details});if(SW_LIFECYCLE.length>64)SW_LIFECYCLE.shift();};
const claim=async()=>{mark('claim:start');try{await self.clients.claim();mark('claim:resolved');}catch(error){mark('claim:rejected',{name:error?.name});throw error;}};
self.addEventListener('install',()=>mark('install'));
self.addEventListener('message',event=>{
 if(event.data?.type==='GET_SW_LIFECYCLE'){event.waitUntil((async()=>{const clients=await self.clients.matchAll({includeUncontrolled:true});event.ports[0]?.postMessage({release:APP_RELEASE,scope:self.registration.scope,clients:clients.length,events:SW_LIFECYCLE.slice()});})());return;}
 if(event.data?.type==='GET_APP_RELEASE'){event.ports[0]?.postMessage(APP_RELEASE);return;}
 if(event.data?.type!=='SKIP_WAITING')return;
 event.stopImmediatePropagation();mark('skipWaiting:received');
 mark('skipWaiting:start');
 self.skipWaiting().then(()=>mark('skipWaiting:resolved'),error=>mark('skipWaiting:rejected',{name:error?.name}));
 // The registration owns the requested transition. Holding this message on
 // its completion can stall native activation after a failed installation.
 // Only an already-active target reclaims here; a waiting target claims from
 // its activate event, whose lifetime is explicitly protected below.
 if(!self.registration.waiting&&self.registration.active?.state==='activated')event.waitUntil(claim());
});
self.addEventListener('activate',event=>{mark('activate');event.waitUntil(claim());});`;
}
