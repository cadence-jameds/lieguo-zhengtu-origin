import type {PresentationStore} from './presentationStore';
/** Bounded display-only recovery. Never cancels/replays Inbox commands. A good
 * patch resets the budget; snapshots alone cannot sustain an anomaly storm. */
export class ProjectionRecovery {
 private attempts=0;private timer?:ReturnType<typeof setTimeout>;
 constructor(private store:PresentationStore,private request:()=>void,private deadline=3000){}
 receive(value:unknown){const result=this.store.receive(value);if(result.accepted){clearTimeout(this.timer);this.timer=undefined;if((value as {kind?:string}).kind==='patch')this.attempts=0;}else this.recover();return result;}
 recover(){if(this.timer)return;this.store.recovering('正在重新取得一致的畫面快照。');if(this.attempts>=3){this.store.block('畫面同步失敗；正式命令與存檔保留，請重新同步或重新載入。');return;}this.attempts++;this.timer=setTimeout(()=>{this.timer=undefined;this.recover();},this.deadline);this.request();}
 retry(){clearTimeout(this.timer);this.timer=undefined;this.attempts=0;this.recover();}
 dispose(){clearTimeout(this.timer);this.timer=undefined;}
}
