import type {FormalArmy} from './model';
import {isMissionArmy} from './combatModel';
/** Position is a projection of durable path/timing snapshots, not a renderer-owned march. */
export function armyPosition(a:FormalArmy,time:number){if(!isMissionArmy(a))return undefined;if(!['outbound','returning'].includes(a.status))return a.position;const elapsed=Math.max(0,time-a.departedAt);let lo=1,hi=a.segmentTimes.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(a.segmentTimes[mid]<elapsed)lo=mid+1;else hi=mid;}const i=lo;if(i<a.path.length&&elapsed<=a.segmentTimes[i]){const fraction=Math.min(1,(elapsed-a.segmentTimes[i-1])/Math.max(1,a.segmentTimes[i]-a.segmentTimes[i-1])),p=a.path[i-1],q=a.path[i];return{x:p.x+(q.x-p.x)*fraction,y:p.y+(q.y-p.y)*fraction};}return a.path.at(-1)??a.position;}
