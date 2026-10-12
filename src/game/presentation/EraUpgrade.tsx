import type {FormalCity,FormalCommand,FormalWorld} from '../formal/model';
import {resourceKeys} from '../formal/model';
import {AGE_CATALOG} from '../formal/research';
import {buildingLevel} from '../formal/catalogB3';
import {AGE_NAMES} from './artMap';
import {Cost,fmt,realTime} from './UI';
import {Countdown,LiveProgress} from './LiveValues';
export function EraUpgrade({world,city,issue,busy}:{world:FormalWorld;city:FormalCity;issue:(p:FormalCommand)=>void;busy:boolean}){
 const f=world.factions.find(f=>f.id===city.ownerFactionId)!,age=AGE_CATALOG.find(a=>a.targetAge===(f.age??0)+1);
 if(f.ageQueue)return <section className="card city-era-upgrade"><h3>時代晉升中</h3><LiveProgress world={world} start={f.ageQueue.startedAt} duration={f.ageQueue.durationMs} label="時代晉升進度"/><p>{AGE_NAMES[f.ageQueue.targetAge]} · 剩餘 <Countdown at={f.ageQueue.startedAt+f.ageQueue.durationMs} world={world}/></p></section>;
 if(!age)return <p className="city-era-upgrade">已達帝王時代。</p>;
 const reasons=[];if(city.population<age.population)reasons.push('人口至少 '+fmt(age.population));if(buildingLevel(city,'center')<age.center)reasons.push('城市中心 Lv'+age.center);if(resourceKeys.some(r=>city.stock[r]<age.cost[r]))reasons.push('資源不足');
 return <section className="card city-era-upgrade"><h3>晉升{AGE_NAMES[age.targetAge]}時代</h3><ul className="building-requirements"><li>{city.population>=age.population?'✓':'未達'} 人口 {fmt(city.population)} / {fmt(age.population)}</li><li>{buildingLevel(city,'center')>=age.center?'✓':'未達'} 城市中心 Lv{buildingLevel(city,'center')} / Lv{age.center}</li></ul><Cost cost={{...age.cost}} stock={city.stock}/><p>晉升時間 {realTime(age.durationMs,world)}</p><p>{reasons.join('、')||'符合晉升條件'}</p><div className="dialog-actions"><button className="primary" disabled={busy||reasons.length>0} onClick={()=>issue({type:'age.start',cityId:city.id})}>晉升{AGE_NAMES[age.targetAge]}時代</button></div></section>;
}
