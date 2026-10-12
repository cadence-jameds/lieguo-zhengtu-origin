/** Bound lock acquisition, never steal a lock held by another game tab. */
export async function withSaveLock(locks:LockManager, signal:AbortSignal, acquired:()=>Promise<void>, timedOut:()=>void){
  const pending=new AbortController();let entered=false,expired=false;
  const abort=()=>pending.abort();signal.addEventListener('abort',abort,{once:true});
  if(signal.aborted)pending.abort();
  const timer=setTimeout(()=>{if(!entered&&!signal.aborted){expired=true;timedOut();pending.abort();}},8000);
  try{
    await locks.request('guozhan-river-valley-v020-writer',{signal:pending.signal},async()=>{
      // Some engines deliver a late callback even after cancellation.
      if(expired||signal.aborted)return;
      entered=true;clearTimeout(timer);await acquired();
    });
  }catch(e){if(!expired&&!signal.aborted)throw e;}
  finally{clearTimeout(timer);signal.removeEventListener('abort',abort);}
}
