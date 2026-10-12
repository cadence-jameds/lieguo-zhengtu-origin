import type {EventId} from './ids';
import type {FormalEvent} from './model';
export const EVENT_PRIORITY: Readonly<Record<FormalEvent['type'],number>> = Object.freeze({'politics.end-friendly':25,'army.depart':38,'craftsman.arrive':39,'age.complete':9,'military.train':30,'settlement.ready':35,'settlement.arrive':36,'army.arrive':40,'army.return':41,'combat.round':50,'wild.respawn':55,'economy.settle':0,'construction.complete':5,'city.promote.complete':6,'logistics.arrive':20,'logistics.return':21,'research.complete':10,'fixture.marker':90});
/** Code-point ordering is locale independent. EventId is the final deterministic tie-break. */
export function compareEvents(a:FormalEvent,b:FormalEvent):number {
  return a.at-b.at || EVENT_PRIORITY[a.type]-EVENT_PRIORITY[b.type] || (a.id<b.id?-1:a.id>b.id?1:0);
}
export class EventScheduler {
  private heap:FormalEvent[]=[];
  private ids=new Set<EventId>();
  constructor(events:readonly FormalEvent[]=[]) { for(const e of events)this.push(e); }
  get size(){return this.heap.length;}
  peek(){return this.heap[0];}
  push(event:FormalEvent){
    if(!Number.isSafeInteger(event.at)||event.at<0||!Object.hasOwn(EVENT_PRIORITY,event.type))throw new Error('Invalid event');
    if(this.ids.has(event.id))throw new Error('Duplicate EventId');
    this.ids.add(event.id);const e=structuredClone(event);let i=this.heap.length;this.heap.push(e);
    while(i>0){const p=(i-1)>>1;if(compareEvents(this.heap[p],e)<=0)break;this.heap[i]=this.heap[p];i=p;}this.heap[i]=e;
  }
  pop():FormalEvent|undefined {
    const first=this.heap[0];if(!first)return undefined;
    this.ids.delete(first.id);const last=this.heap.pop()!;
    if(this.heap.length){let i=0;while(i*2+1<this.heap.length){let c=i*2+1;if(c+1<this.heap.length&&compareEvents(this.heap[c+1],this.heap[c])<0)c++;
      if(compareEvents(last,this.heap[c])<=0)break;this.heap[i]=this.heap[c];i=c;}this.heap[i]=last;}return first;
  }
  /** Canonical wire order, independent of heap layout or insertion order. Runtime pop never sorts/shifts. */
  snapshot():FormalEvent[]{return this.heap.map(e=>structuredClone(e)).sort(compareEvents);}
}
