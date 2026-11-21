import {expect,it,vi} from 'vitest';
import * as governance from './governance';
import {setClockMode} from './campaignTime';
import {canonicalJSON} from './canonical';
import {build,order} from './developmentTestSupport';
import {createFormalWorld} from './generator';
import {advanceFormal,submitFormalOrder} from './reducer';
import {EventScheduler,compareEvents} from './scheduler';

it('serializes the accepted offline command scheduler once and preserves its full ordered queue',()=>{
 const base=createFormalWorld({campaign:'offline-command-scheduler',seed:12012});
 build(base.cities[0],'townhall',1);
 const input=submitFormalOrder(base,order(base,{type:'governance.set',cityId:base.cities[0].id,enabled:true,policy:'economy',budget:2400,reserve:0},'governor')).world;
 const live=structuredClone(input),offline=structuredClone(input);setClockMode(offline,'offline');
 const before=canonicalJSON(offline),original=governance.handleGovernance;
 const snapshot=vi.spyOn(EventScheduler.prototype,'snapshot'),snapshots:number[]=[];
 const governor=vi.spyOn(governance,'handleGovernance').mockImplementation((draft,event,scheduler,submit)=>original(draft,event,scheduler,(w,o)=>{
  const from=snapshot.mock.calls.length,transition=submit(w,o);
  expect(transition.ack?.status,transition.ack?.reason).toBe('committed');
  snapshots.push(snapshot.mock.calls.length-from);
  expect(transition.world.events).toEqual([...transition.world.events].sort(compareEvents));
  return transition;
 }));
 try {
  const foreground=advanceFormal(live,0),replayed=advanceFormal(offline,0);
  expect(snapshots).toEqual([2,1]);
  expect(replayed).toEqual({world:{...foreground.world,clockMode:'offline'},reports:foreground.reports});
  expect(canonicalJSON(offline)).toBe(before);
 } finally {governor.mockRestore();snapshot.mockRestore();}
});
