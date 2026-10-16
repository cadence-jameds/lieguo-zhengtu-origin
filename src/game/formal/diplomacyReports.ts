import type {FormalReport,FormalWorld} from './model';
import {reportId,sequenceKey} from './ids';
import {empireOf,legionOf,politicalScope} from './politics';

/** Only public political data affecting the player; never project foreign military data. */
export function diplomacySnapshot(w:FormalWorld){
 const me=w.playerFactionId,scope=politicalScope(w,me),l=legionOf(w,me),e=empireOf(w,me);
 return structuredClone({legion:l??null,empire:e??null,
  requests:w.politics?.requests.filter(r=>r.from===me||r.to===me)??[],
  relations:w.politics?.relations.filter(r=>r.a===scope||r.b===scope)??[]});
}
export function diplomacyChanges(w:FormalWorld,before:ReturnType<typeof diplomacySnapshot>):FormalReport[]{
 const after=diplomacySnapshot(w),lines:string[]=[],name=(id:string)=>w.factions.find(f=>f.id===id)?.name??id;
 const a=before.legion,b=after.legion;
 if(a?.id!==b?.id){if(a)lines.push(`已離開／解散軍團「${a.name}」。`);if(b)lines.push(`加入／成立軍團「${b.name}」。`);}
 else if(a&&b){
  if(a.name!==b.name||a.description!==b.description)lines.push(`軍團資料更新：「${b.name}」。`);
  if(a.leader!==b.leader)lines.push(`軍團長變更：${name(a.leader)} → ${name(b.leader)}。`);
  for(const id of b.members.filter(id=>!a.members.includes(id)))lines.push(`${name(id)}加入軍團。`);
  for(const id of a.members.filter(id=>!b.members.includes(id)))lines.push(`${name(id)}離開軍團。`);
 }
 const x=before.empire,y=after.empire;
 if(x?.id!==y?.id){if(x)lines.push(`離開／解散帝國「${x.name}」。`);if(y)lines.push(`加入／成立帝國「${y.name}」。`);}
 else if(x&&y){if(x.leader!==y.leader)lines.push(`帝國領袖變更：${name(y.leader)}。`);if(JSON.stringify(x.legions)!==JSON.stringify(y.legions))lines.push(`帝國「${y.name}」所屬軍團變更。`);}
 const kinds={application:'入團申請',invitation:'軍團邀請',empire:'帝國提議',friendly:'友好提議'};
 for(const r of after.requests.filter(r=>!before.requests.some(p=>p.id===r.id)))lines.push(`${name(r.from)} → ${name(r.to)}：${kinds[r.kind]}已送達。`);
 for(const r of before.requests.filter(r=>!after.requests.some(p=>p.id===r.id)))lines.push(`${kinds[r.kind]}已處理／失效（${name(r.from)} → ${name(r.to)}）。`);
 const scopeName=(id:string)=>w.politics?.empires.find(e=>e.id===id)?.name??w.politics?.legions.find(l=>l.id===id)?.name??name(id);
 for(const r of after.relations){const prior=before.relations.find(p=>p.a===r.a&&p.b===r.b);if(JSON.stringify(prior)!==JSON.stringify(r))lines.push(`${scopeName(r.a)}／${scopeName(r.b)}：${r.state==='war'?'宣戰':r.endsAt?'友好解除已排定，六世界小時後生效':'友好成立'}。`);}
 for(const r of before.relations.filter(r=>!after.relations.some(p=>p.a===r.a&&p.b===r.b)))lines.push(`${scopeName(r.a)}／${scopeName(r.b)}：${r.state==='war'?'停戰':'友好結束'}／政治範圍已變更。`);
 if(!lines.length)return[];
 const sequence=w.sequences.report++;
 return[{id:reportId(sequenceKey(sequence)),sequence,campaignId:w.campaignId,ownerFactionId:w.playerFactionId,at:w.time,category:'diplomacy',title:'外交記事 · '+(b?.name??y?.name??'獨立領主'),text:lines.join('\n').slice(0,2000)}];
}
