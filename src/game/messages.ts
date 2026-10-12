import {HOUR,type Game,type Report} from './legacyTypes';
type ReportClock={gameTime:number;realTime:number;speed:number};
const reportClocks=new WeakMap<Game,ReportClock>();
// The worker provides the real-time anchor; simulation and saved world state stay deterministic.
export function setReportClock(g:Game,clock:ReportClock|null){if(clock)reportClocks.set(g,clock);else reportClocks.delete(g);}
export const reportRealAt=(g:Game)=>{const clock=reportClocks.get(g);return clock?Math.max(0,Math.floor(clock.realTime+(g.time-clock.gameTime)/clock.speed)):undefined;};
export function importantMessage(r:Pick<Report,'title'|'important'>){return r.important===true||/國土盡失|復國|失守|攻陷|佔領成功|建立帝國|霸權達成|征服河谷|戰役勝利|戰役結束/.test(r.title);}
export function messageBucket(r:Pick<Report,'kind'>){return ['battle','scout'].includes(r.kind)?'battle':r.kind==='diplomacy'?'diplomacy':'chronicle';}
type MessageIndex={array:Report[];length:number;groups:Map<string,Report>;buckets:Map<string,Report[]>};
const indexes=new WeakMap<Game,MessageIndex>();
const groupKey=(owner:string,hour:number)=>JSON.stringify([owner,hour]);
const bucketKey=(owner:string,bucket:string)=>owner+'\u0000'+bucket;
function indexFor(g:Game){
 let index=indexes.get(g);
 if(index?.array===g.reports&&index.length===g.reports.length)return index;
 index={array:g.reports,length:g.reports.length,groups:new Map(),buckets:new Map()};
 for(const item of g.reports){
  // Older saves grouped by individual city and retain a node. Keep those reports intact.
  if(item.groupHour!==undefined&&!item.node){const key=groupKey(item.owner,item.groupHour);if(!index.groups.has(key))index.groups.set(key,item);}
  if(!importantMessage(item)){const key=bucketKey(item.owner,messageBucket(item));const bucket=index.buckets.get(key)??[];bucket.push(item);index.buckets.set(key,bucket);}
 }
 indexes.set(g,index);return index;
}
export function appendMessage(g:Game,r:Omit<Report,'id'|'at'>){
 // NPC-only activity updates the world and battle counters without retaining
 // individual NPC correspondence. Allied reports stay complete.
 if(r.owner!==g.player){const p=g.factions.find(f=>f.id===g.player),f=g.factions.find(f=>f.id===r.owner);const target=g.nodes.find(n=>n.id===r.node);const directlyInvolved=target?.owner===g.player||g.marches.some(m=>m.to===r.node&&m.owner===g.player&&(m.status==='battle'||m.at===g.time));if(!p||!f||!(directlyInvolved||p.league&&(f.league===p.league||f.id===p.league)||p.empire&&(f.vassal===g.player||p.vassal===f.id||f.id===p.league)))return;}
 const important=importantMessage(r),hour=Math.floor(g.time/HOUR),realAt=r.realAt??reportRealAt(g),trade=!!r.node&&r.kind==='economy'&&r.title.startsWith('商隊抵達 '),summary=!!r.node&&(/^(工程完成|募兵完成|總督安排|總督募兵)/.test(r.title)||trade);
 const index=indexFor(g),bucket=summary?'chronicle':messageBucket(r),bucketId=bucketKey(r.owner,bucket),same=index.buckets.get(bucketId)??[];
 if(summary){let entry=index.groups.get(groupKey(r.owner,hour));if(!entry){entry={id:g.next++,at:g.time,realAt,owner:r.owner,kind:'economy',title:'第 '+hour+' 小時 · 全城城務與商隊',text:'',read:false,groupHour:hour,entries:[]};g.reports.push(entry);index.groups.set(groupKey(r.owner,hour),entry);same.push(entry);if(r.owner===g.player)g.reportUnread=(g.reportUnread??0)+1;}else if(entry.read===true&&r.owner===g.player){g.reportUnread=(g.reportUnread??0)+1;entry.read=false;}if(realAt!==undefined)entry.realAt=realAt;
  const city=g.nodes.find(n=>n.id===r.node)?.name??'城市',cargo=trade&&r.loot?(['food','wood','stone','gold'] as const).map((key,i)=>r.loot![key]>0?['糧','木','石','金'][i]+' '+r.loot![key].toLocaleString():null).filter(Boolean).join('／'):'',label=trade?`商隊抵達：${cargo||'無物資入庫'}；${r.text}`:r.title.split(' · ')[0]+'：'+r.text;
  const detail=entry.entries!.find(x=>x.city===city&&x.text===label&&(!trade||x.at===g.time));if(detail){detail.count++;if(realAt!==undefined)detail.realAt=realAt;}else if(entry.entries!.length<299)entry.entries!.push({text:label,count:1,city,at:g.time,realAt,category:trade?'trade':'city'});else{const tail=entry.entries!.find(x=>x.text==='其他城務或商隊');if(tail)tail.count++;else entry.entries!.push({text:'其他城務或商隊',count:1,city:'其他'});}
  entry.read=false;const cities=new Set(entry.entries!.map(x=>x.city).filter(Boolean)).size,trades=entry.entries!.filter(x=>x.category==='trade').reduce((s,x)=>s+x.count,0);entry.text='本小時 '+cities+' 座城市，城務與商隊共 '+entry.entries!.reduce((s,x)=>s+x.count,0)+' 項'+(trades?'（商隊 '+trades+' 趟）':'')+'。展開依城市查看。';}
 else{const entry={...r,important,read:false,id:g.next++,at:g.time,realAt};g.reports.push(entry);if(r.owner===g.player){g.reportUnread=(g.reportUnread??0)+1;if(importantMessage(entry)||['battle','scout','diplomacy'].includes(entry.kind)||/敵軍|來襲|警報/.test(entry.title))g.reportAlerts=(g.reportAlerts??0)+1;}if(!important)same.push(entry);}
 for(let i=same.length-1;i>=0;i--)if(importantMessage(same[i]))same.splice(i,1);
 index.buckets.set(bucketId,same);
 index.length=g.reports.length;
}
export const unreadAlerts=(g:Game)=>g.reportAlerts??g.reports.filter(r=>r.owner===g.player&&r.read===false&&(importantMessage(r)||['battle','scout','diplomacy'].includes(r.kind)||/敵軍|來襲|警報/.test(r.title))).length;
