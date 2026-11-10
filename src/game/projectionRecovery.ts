import type {PresentationStore} from './presentationStore';
/** Bounded display-only recovery. Never cancels/replays Inbox commands. A good
 * patch resets the budget; snapshots alone cannot sustain an anomaly storm. */
export class ProjectionRecovery {
 private attempts=0;private timer?:ReturnType<typeof setTimeout>;
 private authority?:{campaignId:string;revision:number};private frameTimer?:ReturnType<typeof setTimeout>;
 constructor(private store:PresentationStore,private request:()=>void,private deadline=3000){}
 /** An Ack can outlive the last world frame (especially at extinction/end).
  * Coalesce the highest authority revision without postponing the first deadline. */
 observeAuthorityRevision(campaignId:string,revision:number){
  const world=this.store.getWorld();if(!world||world.campaignId!==campaignId||!Number.isSafeInteger(revision)||revision<=world.revision)return;
  this.authority={campaignId,revision:Math.max(revision,this.authority?.campaignId===campaignId?this.authority.revision:0)};
  if(!this.frameTimer)this.frameTimer=setTimeout(()=>{this.frameTimer=undefined;if(this.authority)this.recover();},250);
 }
 receive(value:unknown){
  const header=value as {campaignId?:unknown;nextRevision?:unknown;kind?:string};
  if(this.authority&&header?.campaignId===this.authority.campaignId&&typeof header.nextRevision==='number'&&header.nextRevision<this.authority.revision){this.recover();return {accepted:false,reason:'畫面尚未包含已確認的正式結果。'};}
  const result=this.store.receive(value);if(result.accepted){clearTimeout(this.timer);this.timer=undefined;if(header.kind==='patch')this.attempts=0;const world=this.store.getWorld();if(this.authority&&(!world||world.campaignId!==this.authority.campaignId||world.revision>=this.authority.revision)){this.authority=undefined;clearTimeout(this.frameTimer);this.frameTimer=undefined;}}else this.recover();return result;
 }
 recover(){if(this.timer)return;this.store.recovering('正在重新取得一致的畫面快照。');if(this.attempts>=3){this.store.block('畫面同步失敗；正式命令與存檔保留，請重新同步或重新載入。');return;}this.attempts++;this.timer=setTimeout(()=>{this.timer=undefined;this.recover();},this.deadline);this.request();}
 retry(){clearTimeout(this.timer);this.timer=undefined;this.attempts=0;this.recover();}
 dispose(){clearTimeout(this.timer);this.timer=undefined;clearTimeout(this.frameTimer);this.frameTimer=undefined;this.authority=undefined;}
}
