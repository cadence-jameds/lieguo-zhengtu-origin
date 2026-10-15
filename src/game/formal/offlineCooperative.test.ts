import {expect,it,vi} from 'vitest';
import {createFormalFixture} from './fixture';
import {eventId,sequenceKey} from './ids';
import {advanceFormal,advanceFormalCooperative} from './reducer';
import {advanceOffline,advanceOfflineCooperative} from './offline';

function busyFixture(){
 const w=createFormalFixture({speed:6});
 // Equal timestamps exercise scheduler ordering without splitting an event batch.
 for(let i=0;i<96;i++){
  w.events.push({type:'fixture.marker',marker:'yield-'+i,id:eventId(sequenceKey(w.sequences.event++)),at:Math.floor(i/3)*60_000});
 }
 return w;
}

it('cooperative replay matches atomic synchronous replay exactly, even across same-time events',async()=>{
 const w=busyFixture(),before=structuredClone(w),target=2*60*60*1000;
 const expected=advanceFormal(w,target),progress:{at:number;target:number;processed:number}[]=[];
 let clock=0;
 const spy=vi.spyOn(performance,'now').mockImplementation(()=>clock+=55);
 try{
  const actual=await advanceFormalCooperative(w,target,(at,to,processed)=>progress.push({at,target:to,processed}));
  expect(actual).toEqual(expected);
  expect(progress.some(p=>p.processed===16)).toBe(true);
  expect(progress.at(-1)).toEqual({at:target,target,processed:96});
  expect(progress.every((p,i)=>!i||p.at>=progress[i-1].at)).toBe(true);
  expect(w).toEqual(before);
 }finally{spy.mockRestore();}
});

it('worker offline catch-up preserves summary, reports and final world without modifying the input',async()=>{
 const w=busyFixture(),before=structuredClone(w),savedAt=100_000,now=savedAt+20*60_000,seen:number[]=[];
 const expected=advanceOffline(w,savedAt,now);
 const actual=await advanceOfflineCooperative(w,savedAt,now,(fraction)=>seen.push(fraction));
 expect(actual).toEqual(expected);
 expect(seen.at(-1)).toBe(1);
 expect(w).toEqual(before);
});

it('a cooperative replay error never publishes partial mutations to the original save',async()=>{
 const w=busyFixture(),before=structuredClone(w);
 await expect(advanceFormalCooperative(w,120*60_000,()=>{throw new Error('interrupted');})).rejects.toThrow('interrupted');
 expect(w).toEqual(before);
});
