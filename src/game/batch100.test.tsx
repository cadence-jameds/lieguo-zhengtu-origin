import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {newGame} from './legacyWorld';
import {command,advance,node,faction,production,productionDetail,protectedStock,relation,canDiplomacy} from './legacyEngine';
import {emptyTroops,resources,HOUR} from './legacyTypes';
import {makePlots} from './city';
import {importSave,exportSave} from './legacyPersistence';
import {uniqueCityName,normalizeCityNames} from './cityNames';
import {Cost} from './ui';
import {ArmyView,DiplomacyView} from './Views';
import {CatalogDialog} from './Catalog';
const setup=()=>{const g=newGame('civ_britannia',802,1,0);g.events=[];g.sandbox=true;g.protectionUntil=0;for(const f of g.factions)f.protectionUntil=0;return g;};
it('產量明細與引擎同源，含兩座伐木場、科技、出征耗糧',()=>{
 const g=setup(),n=node(g,faction(g,g.player).capital);n.buildings.farm=2;n.buildings.lumber=3;n.buildings.quarry=2;n.buildings.mine=1;n.buildings.market=1;n.plots=makePlots(n.buildings);const spare=n.plots.find(p=>p.kind==='urban'&&!p.building)!;spare.building='lumber';spare.level=2;n.troops={...emptyTroops(),spear:49,scout:3};faction(g,g.player).tech=['agriculture','carpentry'];
 // Ledger supplies this city's 29 soldiers away from home.
 const ledger=new Map([[n.id,29]]),p=production(g,n,ledger);for(const r of resources){expect(p[r]).toBeGreaterThan(0);expect(productionDetail(g,n,r,ledger).rows.reduce((s,x)=>s+x.value,0)).toBeCloseTo(p[r]);}
});
it('敵方大量斥候也不能攔截，雙方收到戰報且偵察方存活',()=>{
 const g=setup(),a=node(g,faction(g,g.player).capital),f=g.factions.find(f=>f.id!==g.player)!,b=node(g,f.capital);a.troops.scout=2;b.troops.scout=100;
 expect(command(g,{type:'march',from:a.id,to:b.id,kind:'scout',troops:{...emptyTroops(),scout:2}})).toBe('');const m=g.marches[0];advance(g,m.at);expect(m.status).toBe('returning');expect(m.troops.scout).toBe(2);expect(g.reports.some(r=>r.owner===f.id&&r.title.includes('遭敵方偵察'))).toBe(true);expect(g.reports.some(r=>r.owner===g.player&&r.title.includes('偵察完成'))).toBe(true);
});
it('地庫保護各類資源，掠奪受載重限制並記錄守方損失',()=>{
 const g=setup(),a=node(g,faction(g,g.player).capital),f=g.factions.find(f=>f.id!==g.player)!,b=node(g,f.capital);a.troops={...emptyTroops(),militia:1000};b.troops=emptyTroops();b.buildings.warehouse=1;b.buildings.cellar=2;b.buildings.wall=0;b.plots=makePlots(b.buildings);for(const r of resources)b.stock[r]=2000;
 expect(protectedStock(b,'wood')).toBe(1000);expect(command(g,{type:'march',from:a.id,to:b.id,kind:'raid',troops:{...emptyTroops(),militia:1000}})).toBe('');advance(g,g.marches[0].at+60_000);for(const r of resources)expect(b.stock[r]).toBeCloseTo(1000);const defense=g.reports.find(r=>r.owner===f.id&&r.kind==='battle');expect(defense?.loot?.wood).toBe(1000);expect(defense?.text).toContain('守方戰報');
 b.buildings.warehouse=5;b.plots=makePlots(b.buildings);expect(protectedStock(b,'wood')).toBe(1000);b.buildings.cellar=0;b.plots=makePlots(b.buildings);expect(protectedStock(b,'wood')).toBe(0);
});
it('只有勢力領袖能外交，盟約約束双方成員並阻擋出兵',()=>{
 const g=setup(),me=faction(g,g.player),others=g.factions.filter(f=>f.id!==g.player),[enemy,ally,other]=others;
 expect(command(g,{type:'diplomacy',target:enemy.id,action:'war'})).toContain('僅限');me.league=me.id;ally.league=me.id;enemy.league=enemy.id;other.league=enemy.id;
 expect(canDiplomacy(g,ally.id)).toBe(false);expect(command(g,{type:'diplomacy',target:enemy.id,action:'alliance'})).toBe('');expect(relation(g,ally.id,other.id)).toBe('alliance');const a=node(g,ally.capital),b=node(g,other.capital);a.troops.scout=1;expect(command(g,{type:'march',from:a.id,to:b.id,kind:'scout',troops:{...emptyTroops(),scout:1}},ally.id)).toContain('禁止');
});
it('城市能重複改名、拒絕修改別人城市，命名避開全部既有名稱',()=>{
 const g=setup(),n=node(g,faction(g,g.player).capital),other=g.nodes.find(n=>n.owner&&n.owner!==g.player)!;
 expect(command(g,{type:'rename_city',city:n.id,name:'青溪'})).toBe('');expect(command(g,{type:'rename_city',city:n.id,name:'長林'})).toBe('');expect(command(g,{type:'rename_city',city:other.id,name:'測試'})).not.toBe('');other.name='長林';normalizeCityNames(g);expect(other.name).not.toBe('長林');const names=new Set(g.nodes.map(n=>n.name));expect(names.has(uniqueCityName(g))).toBe(false);expect(importSave(exportSave(g)).nodes.find(x=>x.id===n.id)?.name).toBe('長林');
});
it('人口正常速度按60+中心15計算',()=>{const g=setup(),n=node(g,faction(g,g.player).capital);n.population=100;n.buildings.hall=2;n.buildings.house=2;n.troops=emptyTroops();g.events=[{id:g.next++,type:'pulse',at:1000,ref:''}];advance(g,HOUR);expect(n.population).toBeCloseTo(190,0);});
it('手機小卡與桌面直接招募分開，浮窗無大圖且不足標示差額',()=>{
 const g=setup(),n=node(g,faction(g,g.player).capital),props={g,n,busy:false,issue:()=>{}};const desktop=renderToStaticMarkup(<ArmyView {...props}/>),mobile=renderToStaticMarkup(<ArmyView {...props} mobile/>);expect(desktop).toContain('desktop-recruits');expect(desktop).toContain('每批人數');expect(mobile).not.toContain('type="number"');expect(mobile).toContain('catalog-grid');expect(renderToStaticMarkup(<CatalogDialog title="test" art={{sheet:'units',index:0}} onClose={()=>{}}>文字</CatalogDialog>)).not.toContain('catalog-image');expect(renderToStaticMarkup(<Cost cost={{food:100,wood:0,stone:0,gold:0}} stock={{food:30,wood:0,stone:0,gold:0}}/>)).toContain('缺 70');const diplomacy=renderToStaticMarkup(<DiplomacyView g={g} confirm={()=>{}}/>);expect(diplomacy).toContain('勢力分頁');expect(diplomacy).not.toContain('締結盟約');
});
