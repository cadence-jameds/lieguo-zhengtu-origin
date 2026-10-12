import type {FormalWorld} from '../formal/model';
import type {MissionArmy} from '../formal/combatModel';
import {isMissionArmy} from '../formal/combatModel';
import {armyPosition} from '../formal/armyPosition';
import {diplomaticRelation} from '../formal/politics';
import {project,type Point} from './mapGeometry';
export type RouteGeometry={points:Point[];path?:Path2D;minX:number;minY:number;maxX:number;maxY:number;key:string};
export class ArmyRouteCache {
 private entries=new Map<string,RouteGeometry>();private fingerprints=new WeakMap<Point[],string>();hits=0;misses=0;
 get(id:string,path:Point[],start:number,end:number){let fingerprint=this.fingerprints.get(path);if(!fingerprint){fingerprint=path.map(p=>p.x+','+p.y).join(';');this.fingerprints.set(path,fingerprint);}const key=[start,end,fingerprint].join('/');const old=this.entries.get(id);if(old?.key===key){this.hits++;return old;}const points=path.map(project),geometry:RouteGeometry={key,points,minX:Math.min(...points.map(p=>p.x)),minY:Math.min(...points.map(p=>p.y)),maxX:Math.max(...points.map(p=>p.x)),maxY:Math.max(...points.map(p=>p.y))};if(typeof Path2D!=='undefined'){geometry.path=new Path2D();points.forEach((p,i)=>i?geometry.path!.lineTo(p.x,p.y):geometry.path!.moveTo(p.x,p.y));}this.entries.set(id,geometry);this.misses++;return geometry;}
 prune(ids:Set<string>){for(const id of this.entries.keys())if(!ids.has(id))this.entries.delete(id);}
 get size(){return this.entries.size;}
}
export function routeVisible(r:RouteGeometry,cam:{x:number;y:number;z:number},w:number,h:number){return r.maxX>=cam.x-(w/2+24)/cam.z&&r.minX<=cam.x+(w/2+24)/cam.z&&r.maxY>=cam.y-(h/2+48)/cam.z&&r.minY<=cam.y+(h/2+48)/cam.z;}
export function armyColor(w:FormalWorld,a:MissionArmy){if(a.ownerFactionId===w.playerFactionId)return'#f4e5b5';return {own:'#f4e5b5',friendly:'#69cb7e',war:'#f0786d',neutral:'#bec1b7'}[diplomaticRelation(w,w.playerFactionId,a.ownerFactionId)];}
export function battleMarkers(w:FormalWorld){const cities=new Map(w.cities.map(c=>[c.id,c])),targets=new Set<string>();return(w.combat?.battles??[]).flatMap(b=>{const city=cities.get(b.cityId);if(!city||targets.has(b.cityId))return[];targets.add(b.cityId);return[{battleId:b.id,point:{x:city.x,y:city.y},phase:b.phase??'combat'}];});}
export function paintBattleMarker(ctx:CanvasRenderingContext2D,p:Point,zoom:number,clock:number,reduced:boolean,terminal=false){const scale=Math.max(.45,Math.min(.9,zoom*.85)),height=Math.max(19,Math.max(7,20*zoom)*2.5+11*scale),swing=reduced?0:Math.sin(clock/145)*.23;
 ctx.save();ctx.translate(p.x,p.y-height);ctx.scale(scale,scale);ctx.fillStyle='#15251fe8';ctx.strokeStyle='#e2be73';ctx.lineWidth=1.5;if(!terminal){ctx.beginPath();ctx.arc(0,0,16,0,Math.PI*2);ctx.fill();ctx.stroke();}
 for(const side of [-1,1]){ctx.save();ctx.rotate(side*(.7+swing));ctx.strokeStyle='#edf0e2';ctx.lineWidth=3;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(0,6);ctx.lineTo(0,-12);ctx.stroke();ctx.fillStyle='#edf0e2';ctx.beginPath();ctx.moveTo(-2,-10);ctx.lineTo(0,-15);ctx.lineTo(2,-10);ctx.closePath();ctx.fill();ctx.strokeStyle='#f4c675';ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(-5,6);ctx.lineTo(5,6);ctx.moveTo(0,6);ctx.lineTo(0,11);ctx.stroke();ctx.restore();}
 if(!reduced){const spark=(Math.sin(clock/145)+1)/2;ctx.globalAlpha=.4+.6*spark;ctx.strokeStyle='#fff2af';ctx.lineWidth=1.4;for(let i=0;i<4;i++){const angle=i*Math.PI/2+Math.PI/4;ctx.beginPath();ctx.moveTo(Math.cos(angle)*4,Math.sin(angle)*4);ctx.lineTo(Math.cos(angle)*(7+spark*3),Math.sin(angle)*(7+spark*3));ctx.stroke();}}ctx.restore();
}
export function paintArmies(ctx:CanvasRenderingContext2D,w:FormalWorld,time:number,cam:{x:number;y:number;z:number},width:number,height:number,screen:(p:Point)=>Point,cache:ArmyRouteCache,reduced:boolean,clock:number){let routes=0,markers=0,animated=false;const ids=new Set<string>(),buckets=new Map<string,number>();
 for(const a of w.armies){if(!isMissionArmy(a)||!['outbound','returning','engaged'].includes(a.status))continue;ids.add(a.id);const r=cache.get(a.id,a.path,a.departedAt,a.arrivalAt);if(!routeVisible(r,cam,width,height))continue;
  if(a.status!=='engaged'&&time<a.arrivalAt)animated=true;
  if(a.status!=='engaged'){ctx.save();ctx.translate(width/2-cam.x*cam.z,height/2-cam.y*cam.z);ctx.scale(cam.z,cam.z);ctx.strokeStyle=armyColor(w,a)+'88';ctx.lineWidth=1.5/cam.z;ctx.setLineDash([5/cam.z,5/cam.z]);if(r.path)ctx.stroke(r.path);else{ctx.beginPath();r.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();}ctx.restore();routes++;}
  const p=screen(armyPosition(a,time)!);if(p.x< -18||p.x>width+18||p.y< -18||p.y>height+18)continue;const bucket=Math.floor(p.x/12)+','+Math.floor(p.y/12),count=buckets.get(bucket)??0;buckets.set(bucket,count+1);if(cam.z<.25&&count>0)continue;
  const size=Math.max(3,Math.min(7,cam.z*7+3));ctx.save();ctx.translate(p.x,p.y);ctx.rotate(armyHeading(a,time));ctx.fillStyle=armyColor(w,a);ctx.beginPath();ctx.moveTo(0,-size);ctx.lineTo(size*.85,size*.7);ctx.lineTo(-size*.85,size*.7);ctx.closePath();ctx.fill();ctx.restore();markers++;if(a.status==='engaged'){ctx.strokeStyle='#ffb783';ctx.beginPath();ctx.arc(p.x,p.y,10+(reduced?0:Math.sin(clock/220)*3),0,Math.PI*2);ctx.stroke();if(!reduced)animated=true;}else if(time<a.arrivalAt)animated=true;
 }cache.prune(ids);return{routes,markers,animated,cacheSize:cache.size,hits:cache.hits,misses:cache.misses};}

/** Binary search of formal segment times; projection is the same45° map transform, with no route search. */
export function armyHeading(a:MissionArmy,time:number){if(a.path.length<2)return 0;const elapsed=Math.max(0,time-a.departedAt);let lo=1,hi=a.segmentTimes.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(a.segmentTimes[mid]<elapsed)lo=mid+1;else hi=mid;}const i=Math.min(a.path.length-1,lo),p=project(a.path[i-1]),q=project(a.path[i]);return Math.atan2(q.x-p.x,p.y-q.y);}
/** B5 wild/city Raid is instantaneous. Final BattleId drives a short terminal impact, never an ongoing battle badge. Hydration/Recovery do not replay historical impacts. */
export class BattleImpacts {
 private receipts:unknown;
 private count=0;private campaign='';private time=-1;private seen=new Set<string>();private live:{id:string;point:Point;until:number}[]=[];
 update(w:FormalWorld,now:number,reduced:boolean){const receipts=w.combat?.receipts??[];if(this.campaign!==w.campaignId||w.time<this.time||receipts.length<this.count){this.campaign=w.campaignId;this.seen=new Set(receipts.slice(-128).map(r=>r.resolutionId));this.live=[];this.receipts=receipts;this.time=w.time;this.count=receipts.length;return[];}
  if(this.receipts!==receipts){for(const r of receipts.slice(-128)){if(this.seen.has(r.resolutionId))continue;this.seen.add(r.resolutionId);if(!reduced&&r.kind==='final'&&r.mission==='raid'&&r.targetPoint&&r.outcome!=='no-target'&&w.time-r.at<=Math.max(1000,w.speed*10000))this.live.push({id:r.battleId,point:{...r.targetPoint},until:now+900});}this.receipts=receipts;this.time=w.time;this.count=receipts.length;if(this.seen.size>1024)this.seen=new Set(receipts.slice(-256).map(r=>r.resolutionId));}
  if(reduced)this.live=[];this.live=this.live.filter(x=>x.until>now).slice(-32);const occupied=new Set(battleMarkers(w).map(b=>b.point.x+','+b.point.y)),points=new Set<string>();return this.live.filter(x=>{const key=x.point.x+','+x.point.y;if(occupied.has(key)||points.has(key))return false;points.add(key);return true;});
 }
}
