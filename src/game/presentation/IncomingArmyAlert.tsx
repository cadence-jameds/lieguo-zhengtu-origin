import type { WorldRead } from '../presentationModel';
import { UNIT_CATALOG } from '../formal/unitCatalog';
import { useState } from 'react';
import type { FormalCity } from '../formal/model';
import { playerIncoming, type IncomingHints, type PlayerIncomingAlert } from '../incomingIntelligence';
import { useDisplayTime } from './liveClock';

const sizes={small:'小型',medium:'中型',large:'大型','very-large':'超大型'};
const tendencies={infantry:'步兵',ranged:'遠程',cavalry:'騎兵'};
export function incomingHintText(a: IncomingHints) {
 return [a.size&&sizes[a.size],a.tendency&&('偏向'+tendencies[a.tendency]),a.possibleSiege&&'疑似攜帶攻城器',a.possibleJoint&&'疑似聯軍'].filter(Boolean).join('、');
}
export function ownedIncoming(w: WorldRead) {
 const grouped = new Map<string, {cityId: FormalCity['id']; name: string; count: number; arrivalAt: number; composition?: string[]; details?: PlayerIncomingAlert[]}>();
 for (const a of playerIncoming(w)) {
  if (a.ownerFactionId !== w.playerFactionId) continue;
  const city = w.cities.find(c => c.id === a.cityId);
  if (!city) continue;
  const row = grouped.get(a.cityId) ?? {cityId: a.cityId, name: city.name, count: 0, arrivalAt: a.arrivalAt};
  row.count++;
  for (const id of a.composition ?? []) {
   const known = row.composition ??= [];
   if (!known.includes(id)) known.push(id);
  }
  if (incomingHintText(a)) (row.details ??= []).push(a);
  row.arrivalAt = Math.min(row.arrivalAt, a.arrivalAt);
  grouped.set(a.cityId, row);
 }
 return [...grouped.values()].sort((a,b)=>a.arrivalAt-b.arrivalAt||a.cityId.localeCompare(b.cityId));
}
export function IncomingArmyAlert({world,onCity}:{world:WorldRead;onCity:(id:FormalCity['id'])=>void}){
 const [open,setOpen]=useState(false),time=useDisplayTime(world),rows=ownedIncoming(world);
 if(!rows.length)return null;
 const eta=(at:number)=>{const seconds=Math.max(0,Math.ceil((at-time)/1000));return `${Math.floor(seconds/60)}分${seconds%60}秒`;};
 return <section className="global-incoming"><button aria-expanded={open} onClick={()=>setOpen(!open)}>敵軍來襲 {rows.reduce((n,r)=>n+r.count,0)} 支｜最近抵達 {eta(rows[0].arrivalAt)}</button>{open&&<ul>{rows.map(r=><li key={r.cityId}><button onClick={()=>{onCity(r.cityId);setOpen(false);}}>{r.name} · {r.count} 支 · {eta(r.arrivalAt)}{r.composition&&r.composition.length>0&&' · 主要／次要：'+r.composition.map(id=>UNIT_CATALOG[id]?.name??'').filter(Boolean).join('／')}</button>{r.details&&r.details.length>0&&<ul aria-label={r.name+'來襲情報'}>{[...r.details].sort((a,b)=>a.arrivalAt-b.arrivalAt||a.armyId.localeCompare(b.armyId)).map(a=><li key={a.armyId}>{eta(a.arrivalAt)} · {incomingHintText(a)}</li>)}</ul>}</li>)}</ul>}</section>;
}
