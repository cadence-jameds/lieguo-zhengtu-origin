import {expect,it} from 'vitest';
import {eraBounds} from './assets';
import {battleScene} from './ReportsView';
import {command,faction,node} from './legacyEngine';
import {exportSave,importSave,validate} from './legacyPersistence';
import {tileReason} from './settlement';
import {emptyTroops,type Report} from './legacyTypes';
import {newGame} from './legacyWorld';

it('stores at most five unique buildable favorite tiles through a quick save and import',()=>{
 const g=newGame('civ_byzantion',902,1,0),points:{x:number;y:number}[]=[];
 for(let x=0;x<256&&points.length<6;x++)for(let y=0;y<256&&points.length<6;y++)if(!tileReason(g,{x,y}))points.push({x,y});
 for(const at of points.slice(0,5))expect(command(g,{type:'tile_favorite',action:'add',at})).toBe('');
 expect(command(g,{type:'tile_favorite',action:'add',at:points[0]})).toContain('已在');
 expect(command(g,{type:'tile_favorite',action:'add',at:points[5]})).toContain('最多');
 const copy=importSave(exportSave(g));expect(copy.favoriteTiles).toEqual(points.slice(0,5));
 expect(command(copy,{type:'tile_favorite',action:'remove',at:points[2]})).toBe('');
 expect(command(copy,{type:'tile_favorite',action:'add',at:points[5]})).toBe('');
 expect(copy.favoriteTiles).toHaveLength(5);
 expect(command(copy,{type:'tile_favorite',action:'add',at:{x:256,y:0}})).not.toBe('');
 expect(()=>validate({...copy,favoriteTiles:[points[0],points[0]]})).toThrow();
});

it('allows one 500 person order and rejects 501 while preserving 200 residents',()=>{
 const g=newGame('civ_frankia',902,1,0),n=node(g,faction(g,g.player).capital);
 const plot=n.plots.find(p=>p.kind==='urban'&&!p.building)!;plot.building='barracks';plot.level=1;n.buildings.barracks=1;
 n.population=800;n.stock.food=20000;n.stock.wood=20000;
 expect(command(g,{type:'train',city:n.id,unit:'militia',count:501})).toContain('1～500');
 expect(command(g,{type:'train',city:n.id,unit:'militia',count:500})).toBe('');
 expect(n.train[0].quantity).toBe(500);expect(n.population).toBe(300);
 expect(importSave(exportSave(g)).nodes.find(city=>city.id===n.id)?.train[0].quantity).toBe(500);
});

it('keeps all six halls inside their era atlas while restoring the Byzantine dome and separating academy from the next row',()=>{
 for(const era of [0,1,2])for(let civ=0;civ<6;civ++){const b=eraBounds(14+civ,era),width=era===2?1402:1536,height=era===2?1122:1024;expect(b.x).toBeGreaterThanOrEqual(0);expect(b.y).toBeGreaterThanOrEqual(0);expect(b.x+b.w).toBeLessThanOrEqual(width+1);expect(b.y+b.h).toBeLessThanOrEqual(height);}
 expect(eraBounds(15,1).y).toBeLessThan(768);expect(eraBounds(11,1).y+eraBounds(11,1).h).toBeLessThan(768);
 expect(eraBounds(12,1).y+eraBounds(12,1).h).toBeLessThan(768);
});

it('describes only recorded siege, losses and outcome; leaves exceptional reports unchanged',()=>{
 const before={...emptyTroops(),militia:12,archer:4,siege:2},after={...before,militia:10,archer:3},enemyBefore={...emptyTroops(),militia:9},enemyAfter={...enemyBefore,militia:6};
 const report:Report={id:1,at:0,owner:'civ_byzantion',kind:'battle',title:'洛津 · 攻方勝利',text:'甲 攻擊 乙。地形：平原；城牆 2 級；攻方補給 充足。',before,after,enemyBefore,enemyAfter};
 const siege=battleScene(report)!;expect(siege).toContain('城牆');expect(siege).toContain('攻城器');expect(siege).toContain('守軍迎擊後折損 3 人');expect(siege).toContain('攻方也付出 3 人');expect(siege).toContain('攻方取得勝勢');
 const wild=battleScene({...report,title:'山林木寨 Lv.2 · 第 1 回合',text:'甲 攻擊 中立。城牆 0 級；'}, {kind:'camp',npcResource:'wood'} as Parameters<typeof battleScene>[1])!;
 expect(wild).toContain('資源據點');expect(wild).not.toContain('城門');expect(wild).toContain('下一回合');
 expect(battleScene({...report,title:'國土盡失 · 已被擊敗',text:'沒有完整紀錄。'})).toBeNull();
});
