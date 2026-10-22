import type {FormalCity,FormalCommand,FormalWorld} from '../formal/model';
import {awarenessPool} from '../formal/modernAwareness';
import {UNIT_CATALOG} from '../formal/unitCatalog';
export function AwarenessPanel({world,city,issue,busy}:{world:FormalWorld;city:FormalCity;issue:(p:FormalCommand)=>void;busy:boolean}){
 const f=world.factions.find(f=>f.id===city.ownerFactionId)!,p=awarenessPool(world,f.id),limit=p.value>=80?2:p.value>=60?1:0;
 return <details className="army-training"><summary>現代軍事認知 · {p.value}／100</summary><section className="card"><p>{f.empireId?'使用帝國共用認知池；個人池凍結保存':'使用個人認知池'}。完整現代資格：{f.modernQualification==='full'?'已取得':'尚未取得'}</p><p>20 情報辨識 · 40 正確反制 ×0.50 · 60／80 各選一線逆向工程 · 100 緊急現代化申請</p><p>已選兵種線：{f.reverseEngineering?.map(id=>UNIT_CATALOG[id].name).join('、')||'無'}。可選名額：{limit}</p>{p.encountered.map(id=><p key={id}>{UNIT_CATALOG[id].name} <button disabled={busy||f.modernQualification==='full'||(f.reverseEngineering?.length??0)>=limit||f.reverseEngineering?.includes(id)} onClick={()=>issue({type:'modern.reverse',cityId:city.id,unitId:id})}>選擇逆向工程</button></p>)}{!p.encountered.length&&<p>尚無實際交戰遭遇的現代作戰兵種。</p>}</section></details>;
}
