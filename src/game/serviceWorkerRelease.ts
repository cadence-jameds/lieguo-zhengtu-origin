/** The build emits this small classic-SW import before Workbox's listeners.
 * Explicitly extend both message and activate event lifetimes: an unobserved
 * clients.claim()/skipWaiting() promise is not protected by an ExtendableEvent.
 * No automatic skipWaiting: only the page's post-save update request triggers it.
 */
export function serviceWorkerReleaseSource(identity:{version:string;contentSha:string}){
 return `const APP_RELEASE=${JSON.stringify(identity)};
self.addEventListener('message',event=>{
 if(event.data?.type==='GET_APP_RELEASE'){event.ports[0]?.postMessage(APP_RELEASE);return;}
 if(event.data?.type!=='SKIP_WAITING')return;
 event.stopImmediatePropagation();
 event.waitUntil((async()=>{
  await self.skipWaiting();
  // A retried update can find the target already active while this page still
  // has its old controller. Re-claim is safe and does not touch persisted data.
  if(self.registration.active?.state==='activated')await self.clients.claim();
 })());
});
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));`;
}
