import {existsSync,statSync} from 'node:fs';
import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {buildingIds,type Job} from './legacyTypes';
import {ConstructionSprite,constructionArtPath,constructionScale} from './assets';
import {newGame} from './legacyWorld';
import {owned} from './legacyEngine';
import {TownScene} from './TownScene';
import {OutskirtsScene} from './OutskirtsScene';
import {civilizations} from '../content/civilizations';

it('all sixteen building types resolve to existing art in every civilization and era',()=>{
 const paths=new Set<string>();
 for(const building of buildingIds){
  const civilizationPaths=new Set(civilizations.map(c=>constructionArtPath(building,2,c.id)));
  expect(civilizationPaths.size,building).toBe(building==='hall'||building==='castle'?6:1);
  for(const civilization of civilizations)for(const era of [0,1,2])for(const targetLevel of [1,9,10])paths.add(constructionArtPath(building,era,civilization.id,targetLevel));
 }
 expect(paths.size).toBe(56);
 for(const path of paths){const file=new URL('../../public/'+path,import.meta.url);expect(existsSync(file),path).toBe(true);expect(statSync(file).size,path).toBeGreaterThan(10_000);}
 expect(renderToStaticMarkup(<ConstructionSprite building="barracks"/>)).toContain('construction-barracks.webp');
 expect(renderToStaticMarkup(<ConstructionSprite building="castle" civ="civ_britannia"/>)).toContain('construction-castle-civ_britannia.webp');
 expect(constructionArtPath('hall',2,'civ_japan~1')).toBe(constructionArtPath('hall',2,'civ_japan'));
 expect(constructionArtPath('hall',0,'civ_britannia')).toContain('civ_britannia-dark');
 expect(constructionArtPath('hall',1,'civ_britannia')).toContain('civ_britannia-feudal');
 expect(constructionArtPath('academy',2,'civ_britannia')).toContain('academy-castle');
 expect(constructionArtPath('academy',1)).toContain('academy-feudal');
 expect(constructionArtPath('warehouse',1,'civ_frankia')).toBe('art/construction-warehouse-feudal-v2.webp');
 expect(constructionArtPath('warehouse',0,'civ_frankia')).toBe('art/construction-warehouse-dark-v2.webp');
 expect(constructionArtPath('warehouse',2,'civ_frankia')).toBe('art/construction-warehouse-castle.webp');
 expect(constructionArtPath('house',1)).toBe('art/construction-house.webp');
 expect(constructionArtPath('farm',2,undefined,9)).toBe('art/construction-farm.webp');
 expect(constructionArtPath('farm',2,undefined,10)).toBe('art/construction-farm-castle.webp');
 expect(constructionArtPath('lumber',1,undefined,9)).toBe('art/construction-lumber.webp');
 expect(constructionArtPath('lumber',1,undefined,10)).toBe('art/construction-lumber-feudal.webp');
 expect(constructionArtPath('wall',0)).toContain('scene-dark-construction-v2');
 expect(constructionArtPath('wall',1)).toContain('scene-feudal-construction-v2');
 expect(constructionArtPath('wall',2)).toContain('scene-castle-construction-v2');
 expect(constructionScale('hall',2,'civ_mongol')).toBeLessThan(.7);
 expect(constructionScale('hall',2,'civ_britannia')).toBeLessThan(.75);
 expect(constructionScale('warehouse',1,'civ_frankia')).toBe(1);
 for(const civilization of civilizations)for(const era of [0,1,2])expect(constructionScale('hall',era,civilization.id)).toBeGreaterThan(.6);
});

it('city and resource scenes show half-built art as soon as work is queued',()=>{
 const g=newGame('civ_zhongguo',902,1,0),n=owned(g,g.player)[0];
 const urban=n.plots.find(p=>p.kind==='urban'&&!p.building)!;
 const job:Job={id:501,item:'barracks',quantity:1,at:10_000,started:0,owner:g.player,plot:urban.id,action:'build'};
 n.build=[job];
 const town=()=>renderToStaticMarkup(<TownScene n={n} civ={g.player} era={0} time={5_000} speed={1} mobile={false} labels={true} onSelect={()=>{}}/>);
 expect(town()).toContain('construction-barracks.webp');
 n.build=[{...job,id:502,item:'wall',plot:16},job];
 expect(town()).toContain('city-scene-dark-construction-v2.webp');
 expect(town()).not.toContain('city-scene-dark-open.webp');
 expect(town()).toContain('construction-barracks.webp');
 expect(town()).toContain('⏳');
 n.build=[job,{...job,id:505,item:'wall',plot:16}];
 expect(town()).toContain('city-scene-dark-construction-v2.webp');
 const farm=n.plots.find(p=>p.kind==='resource'&&p.building==='farm')!;
 n.build=[{...job,id:503,item:'farm',plot:farm.id}];
 const outer=()=>renderToStaticMarkup(<OutskirtsScene n={n} civ={g.player} era={0} time={5_000} speed={1} mobile={false} labels={true} onEnter={()=>{}} onSelect={()=>{}}/>);
 expect(outer()).toContain('construction-farm.webp');
 n.build=[{...job,id:504,item:'house',plot:urban.id},n.build[0]];
 expect(outer()).toContain('construction-farm.webp');
 expect(outer()).toContain('⏳');
});

it('a castle being built in town keeps the selected civilization art',()=>{
 const g=newGame('civ_frankia',903,1,0),n=owned(g,g.player)[0],urban=n.plots.find(p=>p.kind==='urban'&&!p.building)!;
 n.build=[{id:601,item:'castle',quantity:1,at:10_000,started:0,owner:g.player,plot:urban.id,action:'build'}];
 const html=renderToStaticMarkup(<TownScene n={n} civ={g.player} era={2} time={5_000} speed={1} mobile={false} labels={true} onSelect={()=>{}}/>);
 expect(html).toContain('construction-castle-civ_frankia.webp');
 expect(html).not.toContain('construction-castle-civ_zhongguo.webp');
});

it('a queued castle-age upgrade already displays the era-matched construction art',()=>{
 const g=newGame('civ_britannia',904,1,0),n=owned(g,g.player)[0],urban=n.plots.find(p=>p.kind==='urban'&&!p.building)!;
 urban.building='academy';urban.level=1;n.buildings.academy=1;
 n.build=[{id:701,item:'academy',quantity:1,at:10_000,started:0,owner:g.player,plot:urban.id,action:'build'}];
 const town=(time:number)=>renderToStaticMarkup(<TownScene n={n} civ={g.player} era={2} time={time} speed={1} mobile={false} labels={true} onSelect={()=>{}}/>);
 expect(town(5_000)).toContain('construction-academy-castle.webp');
 n.build[0].started=6_000;
 expect(town(5_000)).toContain('construction-academy-castle.webp');
 expect(town(5_000)).toContain('⏳');
 n.build[0].action='demolish';
 expect(town(5_000)).not.toContain('construction-academy-castle.webp');
 const farm=n.plots.find(p=>p.kind==='resource'&&p.building==='farm')!;
 farm.level=8;n.build=[{...n.build[0],id:702,item:'farm',plot:farm.id,started:0,action:'build'}];
 const outer=()=>renderToStaticMarkup(<OutskirtsScene n={n} civ={g.player} era={2} time={5_000} speed={1} mobile={false} labels={true} onEnter={()=>{}} onSelect={()=>{}}/>);
 expect(outer()).toContain('construction-farm.webp');
 expect(outer()).not.toContain('construction-farm-castle.webp');
 farm.level=9;
 expect(outer()).toContain('construction-farm-castle.webp');
 n.build[0].started=6_000;
 expect(outer()).toContain('construction-farm-castle.webp');
 expect(outer()).toContain('⏳');
});
