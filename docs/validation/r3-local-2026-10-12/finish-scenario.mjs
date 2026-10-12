import fs from 'node:fs/promises';
import path from 'node:path';
export default async function(page,outDir){
 const input=await fs.readFile(path.join(outDir,'controlled-100-siege.realm-save'),'utf8');
 const result=await page.evaluate(async text=>{
   const {decodeSave,encodeSave}=await import('/src/game/formal/saveCodec.ts');
   const {advanceFormal}=await import('/src/game/formal/reducer.ts');
   let w=(await decodeSave(JSON.parse(text))).world;
   const id=w.combat.battles[0].id,rounds=[];
   for(let i=0;i<30;i++){
     const b=w.combat.battles.find(b=>b.id===id);if(!b)break;
     rounds.push({time:w.time,battleId:b.id,phase:b.phase,siegeRound:b.siegeRound,nextAt:b.nextRoundAt});
     w=advanceFormal(w,b.nextRoundAt).world;
   }
   if(w.combat.battles.some(b=>b.id===id))throw Error('Target siege did not finish');
   return {save:JSON.stringify(await encodeSave(w)),meta:{time:w.time,battleId:id,rounds,remainingBattles:w.combat.battles.map(b=>b.id),finalReceipt:w.combat.receipts.find(r=>r.battleId===id&&r.kind==='final')}};
 },input);
 await fs.writeFile(path.join(outDir,'controlled-final.realm-save'),result.save);
 await fs.writeFile(path.join(outDir,'siege-final-metadata.json'),JSON.stringify(result.meta,null,2));
 return result.meta;
}
