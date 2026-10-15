import type {EventId} from './ids';
import type {FormalEvent} from './model';
export const EVENT_PRIORITY: Readonly<Record<FormalEvent['type'],number>> = Object.freeze({'governance.decide':71,'ai.decide':70,'politics.end-friendly':25,'army.depart':38,'craftsman.arrive':39,'age.complete':9,'military.train':30,'settlement.ready':35,'settlement.arrive':36,'army.arrive':40,'army.return':41,'combat.round':50,'wild.respawn':55,'economy.settle':0,'construction.complete':5,'city.promote.complete':6,'logistics.arrive':20,'logistics.return':21,'research.complete':10,'fixture.marker':90});
/** Code-point ordering is locale independent. EventId is the final deterministic tie-break. */
export function compareEvents(a:FormalEvent,b:FormalEvent):number {
  return a.at-b.at || EVENT_PRIORITY[a.type]-EVENT_PRIORITY[b.type] || (a.id<b.id?-1:a.id>b.id?1:0);
}
/** Replay events are native-cloned input or engine literals. Preserve native cloning for any other shape. */
function cloneReplayEvent(event:FormalEvent):FormalEvent {
  if(Object.getPrototypeOf(event)!==Object.prototype)return structuredClone(event);
  for(const key of Reflect.ownKeys(event)){
    if(typeof key!=='string')return structuredClone(event);
    const descriptor=Object.getOwnPropertyDescriptor(event,key)!;
    if(!descriptor.enumerable||!descriptor.configurable||!descriptor.writable||!Object.hasOwn(descriptor,'value'))return structuredClone(event);
    const value=descriptor.value;
    if(value!==null&&typeof value==='object'||typeof value==='function'||typeof value==='symbol')return structuredClone(event);
  }
  return {...event};
}
export class EventScheduler {
  private heap:FormalEvent[]=[];
  private ids=new Set<EventId>();
  private cloneEvent=(event:FormalEvent)=>structuredClone(event);
  constructor(events:readonly FormalEvent[]=[]) { this.replace(events); }
  /** Internal replay only: the outer native world clone has already rejected proxies and non-cloneable input. */
  static forReplay(events:readonly FormalEvent[]=[]){const scheduler=new EventScheduler();scheduler.cloneEvent=cloneReplayEvent;scheduler.replace(events);return scheduler;}
  /** Validate once, clone once and heapify in O(n). A failed replacement leaves the live queue untouched. */
  replace(events:readonly FormalEvent[]){
    const next:FormalEvent[]=[],ids=new Set<EventId>();
    for(const event of events){
      if(!Number.isSafeInteger(event.at)||event.at<0||!Object.hasOwn(EVENT_PRIORITY,event.type))throw new Error('Invalid event');
      if(ids.has(event.id))throw new Error('Duplicate EventId');
      ids.add(event.id);next.push(this.cloneEvent(event));
    }
    for(let i=Math.floor(next.length/2)-1;i>=0;i--){
      const item=next[i];let at=i;
      while(at*2+1<next.length){
        let child=at*2+1;
        if(child+1<next.length&&compareEvents(next[child+1],next[child])<0)child++;
        if(compareEvents(item,next[child])<=0)break;
        next[at]=next[child];at=child;
      }
      next[at]=item;
    }
    this.heap=next;this.ids=ids;
  }
  /** Remove cancelled future events without draining and reinserting the entire heap. */
  discard(ids:ReadonlySet<string>){
    if(ids.size)this.replace(this.heap.filter(e=>!ids.has(e.id)));
  }
  get size(){return this.heap.length;}
  peek(){return this.heap[0];}
  push(event:FormalEvent){
    if(!Number.isSafeInteger(event.at)||event.at<0||!Object.hasOwn(EVENT_PRIORITY,event.type))throw new Error('Invalid event');
    if(this.ids.has(event.id))throw new Error('Duplicate EventId');
    const e=this.cloneEvent(event);this.ids.add(event.id);let i=this.heap.length;this.heap.push(e);
    while(i>0){const p=(i-1)>>1;if(compareEvents(this.heap[p],e)<=0)break;this.heap[i]=this.heap[p];i=p;}this.heap[i]=e;
  }
  pop():FormalEvent|undefined {
    const first=this.heap[0];if(!first)return undefined;
    this.ids.delete(first.id);const last=this.heap.pop()!;
    if(this.heap.length){let i=0;while(i*2+1<this.heap.length){let c=i*2+1;if(c+1<this.heap.length&&compareEvents(this.heap[c+1],this.heap[c])<0)c++;
      if(compareEvents(last,this.heap[c])<=0)break;this.heap[i]=this.heap[c];i=c;}this.heap[i]=last;}return first;
  }
  /** Canonical wire order, independent of heap layout or insertion order. Runtime pop never sorts/shifts. */
  snapshot():FormalEvent[]{return this.heap.map(e=>this.cloneEvent(e)).sort(compareEvents);}
}
