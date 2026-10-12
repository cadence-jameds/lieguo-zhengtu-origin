import 'fake-indexeddb/auto';
import {it,expect} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
import {B5LabSession,B5_LAB_SUFFIX,defaultLabConfig,labActiveTarget} from './B5Lab';
import {liveBattleView} from '../formal/battleView';
it('real lab event stepping, live battle, reload and export/import preserve all 12 siege rounds and final failure',async()=>{
 const s=new B5LabSession(B5_LAB_SUFFIX+'-v91-'+crypto.randomUUID());try{
  await s.open({...defaultLabConfig(4321,'civ_zhongguo'),enemyUnits:{},playerUnits:{militia:1,ram:1},wallLevel:15});let w=s.world!;const target=labActiveTarget(w)!,owner=target.ownerFactionId;
  await s.order({type:'army.dispatch',cityId:w.cities[0].id,mission:'conquest',target:{kind:'city',cityId:target.id},units:{militia:1,ram:1}});await s.advance();w=s.world!;const id=w.combat!.battles[0].id;expect(liveBattleView(w,id)).toMatchObject({phase:'siege',siegeRound:1,remainingSiegeRounds:11});expect((await s.store.readReportPage(w)).count).toBe(0);
  await s.advance();const partial=structuredClone(s.world!.combat!.battles[0]);await s.reload();expect(s.world!.combat!.battles[0]).toEqual(partial);const exported=await s.export();await s.import(exported);expect(s.world!.combat!.battles[0]).toEqual(partial);
  for(let round=3;round<=12;round++){await s.advance();if(round<12){expect(s.world!.combat!.battles[0]).toMatchObject({id,siegeRound:round});expect((await s.store.readReportPage(s.world!)).count).toBe(0);}}
  w=s.world!;expect(w.combat!.battles).toHaveLength(0);expect(labActiveTarget(w)!.ownerFactionId).toBe(owner);expect(labActiveTarget(w)!.wallLevel).toBe(11);const report=(await s.store.readReportPage(w)).rows[0];expect(report.battle!).toMatchObject({battleId:id,siegeRounds:12,conquestReason:'siege-timeout'});expect(w.armies[0].status).toBe('returning');mkdirSync('docs/b5-v91',{recursive:true});writeFileSync('docs/b5-v91/lab-evidence.json',JSON.stringify({partial,final:report},null,2));
 }finally{await s.store.db.delete();}
},30000);
