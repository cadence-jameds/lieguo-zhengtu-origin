/** The build emits this small classic-SW import before Workbox's listeners.
 * Explicitly extend both message and activate event lifetimes: an unobserved
 * clients.claim()/skipWaiting() promise is not protected by an ExtendableEvent.
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
 event.waitUntil((async()=>{
  mark('skipWaiting:start');await self.skipWaiting();mark('skipWaiting:resolved');
  // A retried update can find the target already active while this page still
  // has its old controller. Re-claim is safe and does not touch persisted data.
  if(self.registration.active?.state==='activated')await claim();
 })());
});
self.addEventListener('activate',event=>{mark('activate');event.waitUntil(claim());});`;
}
