import {it,expect} from 'vitest';
import {renderToStaticMarkup as render} from 'react-dom/server';
import {newGame} from './world';
import {command,faction,owned,recruitablePopulation} from './engine';
import {exportSave,importSave} from './persistence';
import {settlementCost,tileReason} from './settlement';
import {ResourceSprite} from './ResourceSprite';
import {fieldBuildings,resourceLayout,fieldCounts} from './resourceFields';
import {FieldDistribution} from './FieldDistribution';
import {MiniatureCity} from './MiniatureCity';
import {EraUpgrade} from './Views';
import {Home} from './Home';
import {Start} from './ui';
import {OutskirtsScene} from './OutskirtsScene';
import {TownScene} from './TownScene';
import {refreshBuildingLevel} from './city';
import {emptyTroops} from './types';
import {RELEASE} from './release';
import {civilizations} from '../content/civilizations';
import {existsSync} from 'node:fs';
const setup=()=>newGame('civ_zhongguo',902,1,0);
it.each([1,10,50,100,12,120])('speed %s survives save validation, existing population is retained',speed=>{
 const g=newGame('civ_zhongguo',902,speed,0);expect(owned(g,g.player)[0].population).toBe(200);owned(g,g.player)[0].population=477;
 const loaded=importSave(exportSave(g));expect(loaded.speed).toBe(speed);expect(owned(loaded,loaded.player)[0].population).toBe(477);
 expect(JSON.parse(exportSave(g)).appVersion).toBe(RELEASE.version);
});
it('settlement charges exact new costs, origin retains 200 and cannot recruit below reserve',()=>{
 const g=setup(),n=owned(g,g.player)[0];faction(g,g.player).era=2;n.population=600;n.stock={food:1000,wood:1000,stone:1000,gold:1000};
 let at={x:0,y:0};while(tileReason(g,at))at.x++;
 expect(command(g,{type:'settle_at',from:n.id,at,troops:{...emptyTroops(),militia:10}})).toBe('');
 expect(n.population).toBe(200);expect(recruitablePopulation(n)).toBe(0);expect(n.stock).toEqual({food:650,wood:700,stone:350,gold:650});expect(settlementCost).toEqual({food:350,wood:300,stone:650,gold:350});
});
it('era panel shows prerequisite and all resource shortages together',()=>{
 const g=setup(),n=owned(g,g.player)[0];n.stock={food:0,wood:0,stone:0,gold:0};
 const html=render(<EraUpgrade g={g} n={n} issue={()=>{}} busy={false}/>);expect(html).toContain('需要學院 1');expect(html).toContain('缺 ');expect(html.match(/缺 /g)!.length).toBeGreaterThanOrEqual(3);
});
it('resource art changes at level 4 for every resource type',()=>{
 for(const building of fieldBuildings){for(const level of [0,3])expect(render(<ResourceSprite building={building} level={level}/>)).toContain('field-'+building+'.webp');
 for(const level of [4,5]){const html=render(<ResourceSprite building={building} level={level}/>);expect(html).toContain('building-sprite');expect(html).not.toContain('field-'+building+'.webp');}}
});
it('restoration tile counts match actual generated resource plots',()=>{
 const g=setup(),point={x:100,y:100},counts=fieldCounts(resourceLayout(g.seed,point));const html=render(<FieldDistribution g={g} point={point}/>);
 for(const n of Object.values(counts))expect(html).toContain('<strong>'+n+'</strong>');expect(Object.values(counts).reduce((a,b)=>a+b,0)).toBe(18);
});
it('mobile scenes start enlarged; center has no name caption and separates wall layers',()=>{
 const g=setup(),n=owned(g,g.player)[0],props={n,civ:g.player,era:0,time:0,speed:1,mobile:true,labels:false,onSelect:()=>{}};
 const html=render(<OutskirtsScene {...props} onEnter={()=>{}}/>);expect(html).toContain('outskirts-close');expect(html).not.toContain('<small>進入城內</small>');expect(render(<TownScene {...props}/>)).toContain('town-close');
 const city=render(<MiniatureCity civ={g.player} era={0} wall={1}/>);expect(city).toContain('wall-rear');expect(city).toContain('wall-front');
 expect(city).toContain('miniature-city walled');
 expect(render(<MiniatureCity civ={g.player} era={0} wall={0}/>)).not.toContain('miniature-city walled');
});
it('six civilization miniatures use distinct tiles inside each era wall',()=>{
 for(const era of [0,1,2]){
  for(const art of [`cities-age-${era}.webp`,`wall-ring-${era}.webp`])expect(existsSync(new URL('../../public/art/'+art,import.meta.url))).toBe(true);
  const positions=new Set<string>();
  for(const civ of civilizations){
   const html=render(<MiniatureCity civ={civ.id} era={era} wall={1}/>);
   expect(html).toContain(`cities-age-${era}.webp`);
   expect(html).toContain(`wall-ring-${era}.webp`);
   expect(html.match(/class="miniature-city-wall wall-(rear|front)"/g)).toHaveLength(2);
   positions.add(html.match(/background-position:([^;"]+)/)?.[1]??'');
  }
  expect(positions.size).toBe(6);
 }
});
it('new game defaults to actual 1X and exposes only the requested speeds',()=>{
 const html=render(<Start busy={false} onStart={()=>{}}/>);for(const speed of [1,3,6,10,50])expect(html).toContain('value="'+speed+'"');
 expect(html).toContain('value="1" selected=""');expect(html).not.toContain('value="12"');expect(html).not.toContain('value="120"');
});
it('home lists loaded settings and exposes recovery while new game remains accessible',()=>{
 const game=setup();game.offlineLimit=0;const props={game,loading:false,busy:false,updateText:'',updateReady:false,updating:false,onStart:()=>{},onNew:()=>{},onUpdate:()=>{},onCheck:()=>{}};
 const html=render(<Home {...props}/>);for(const text of ['戰役時間','戰役速度','離線推進世界','關閉','200 名居民'])expect(html).toContain(text);
 const broken=render(<Home {...props} game={null} error="損毀" onReset={()=>{}}/>);expect(broken).toContain('刪除舊存檔並重新開始');expect(broken).toContain('>開始新遊戲</button>');
});
it('unrelated joins stay silent while joining the player league produces notice',()=>{
 const g=setup(),others=g.factions.filter(f=>f.id!==g.player);const leader=others[0],joiner=others[1];leader.era=1;
 expect(command(g,{type:'league',action:'create'},leader.id)).toBe('');g.reports=[];
 expect(command(g,{type:'league',action:'join',target:leader.id},joiner.id)).toBe('');expect(g.reports.filter(r=>r.title.startsWith('軍團消息'))).toHaveLength(0);
 const me=faction(g,g.player);me.era=1;expect(command(g,{type:'league',action:'create'})).toBe('');g.reports=[];
 expect(command(g,{type:'league',action:'join',target:g.player},others[2].id)).toBe('');expect(g.reports.filter(r=>r.title.startsWith('軍團消息'))).toHaveLength(1);
});
it('all owners can recruit only available civilian surplus',()=>{
 const g=setup();for(const owner of [g.player,g.factions.find(f=>f.id!==g.player)!.id]){const n=owned(g,owner)[0];Object.assign(n.plots[1],{building:'barracks',level:1});refreshBuildingLevel(n,'barracks');n.population=210;n.stock={food:5000,wood:5000,stone:5000,gold:5000};
 expect(command(g,{type:'train',city:n.id,unit:'militia',count:10},owner)).toBe('');expect(n.population).toBe(200);expect(command(g,{type:'train',city:n.id,unit:'militia',count:1},owner)).toContain('人口不足');}
});
