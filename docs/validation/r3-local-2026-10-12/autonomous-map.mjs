import fs from 'node:fs/promises';
import path from 'node:path';
export default async function(page,outDir){
 const anchor=await page.evaluate(async()=>{
  const {FormalDatabase}=await import('/src/game/persistence.ts');const db=new FormalDatabase();const row=await db.saves.get('current');db.close();
  const w=row.data.snapshot,a=w.armies.find(a=>a.status==='outbound'&&a.ownerFactionId!==w.playerFactionId);
  if(!a)throw Error('No autonomous AI army');
  const {armyPosition}=await import('/src/game/formal/armyPosition.ts');
  const {displayClock}=await import('/src/game/presentation/liveClock.ts');
  const t=displayClock.projectTime(w.campaignId,w.time),p=armyPosition(a,t);
  window.__r3ObservedArmy={army:a,campaignId:w.campaignId,time:w.time};
  return {id:a.id,owner:a.ownerFactionId,mission:a.mission,point:p,time:t};
 });
 await page.locator('nav[aria-label="遊戲主要功能"] button').filter({hasText:'世界地圖'}).click();
 await page.getByRole('button',{name:'展開地圖工具',exact:true}).click();
 await page.getByRole('button',{name:/XY.*定位/}).click();
 await page.getByLabel('X 座標').fill(String(Math.round(anchor.point.x)));
 await page.getByLabel('Y 座標').fill(String(Math.round(anchor.point.y)));
 await page.getByRole('button',{name:'前往',exact:true}).click();
 await page.waitForFunction(()=>JSON.parse(document.querySelector('.map-overlay').dataset.armyOverlay).markers>0);
 const sample=()=>page.evaluate(async()=>{
   const {armyPosition}=await import('/src/game/formal/armyPosition.ts');
   const {armyHeading}=await import('/src/game/presentation/armyOverlay.ts');
   const {displayClock}=await import('/src/game/presentation/liveClock.ts');
   const s=window.__r3ObservedArmy,time=displayClock.projectTime(s.campaignId,s.time);
   return {id:s.army.id,time,point:armyPosition(s.army,time),heading:armyHeading(s.army,time),overlay:JSON.parse(document.querySelector('.map-overlay').dataset.armyOverlay)};
 });
 const before=await sample();await page.screenshot({path:path.join(outDir,'25-autonomous-ai-before.png')});
 await page.evaluate(async()=>{for(let i=0;i<240;i++)await new Promise(requestAnimationFrame);});
 const after=await sample();await page.screenshot({path:path.join(outDir,'26-autonomous-ai-after.png')});
 const result={anchor,before,after,moved:before.point.x!==after.point.x||before.point.y!==after.point.y};
 await fs.writeFile(path.join(outDir,'autonomous-movement.json'),JSON.stringify(result,null,2));return result;
}
