import {useState} from 'react';
import type {FormalWorld,FormalCommand} from '../formal/model';
import {legionOf,empireOf,politicalLeader} from '../formal/politics';
import {Dialog} from './UI';
export function politicalContext(w:FormalWorld){const l=legionOf(w,w.playerFactionId),e=empireOf(w,w.playerFactionId);return JSON.stringify([w.campaignId,w.playerFactionId,l?.id,l?.leader,l?.members,e?.id,e?.leader,e?.legions,politicalLeader(w,w.playerFactionId)]);}
/** Organizational changes invalidate an open confirmation, ordinary clock ticks do not. */
export function usePoliticalAction(world:FormalWorld,issue:(p:FormalCommand)=>void,busy:boolean){
 const [pending,setPending]=useState<{title:string;command:FormalCommand;base:string}|null>(null);
 const confirm=(title:string,command:FormalCommand)=>setPending({title,command,base:politicalContext(world)});
 const changed=pending&&pending.base!==politicalContext(world);
 return {confirm,dialog:pending&&<Dialog title={pending.title} onClose={()=>setPending(null)}><p>確認執行「{pending.title}」？此操作會變更政治共同體與權限。</p>{changed&&<p role="alert">組織狀態已變更，請關閉後重新選擇。</p>}<div className="dialog-actions"><button onClick={()=>setPending(null)}>取消</button><button className="primary" disabled={busy||!!changed||!world.cities.some(c=>c.id===pending.command.cityId&&c.ownerFactionId===world.playerFactionId)} onClick={()=>{issue(pending.command);setPending(null);}}>確認執行</button></div></Dialog>};
}
