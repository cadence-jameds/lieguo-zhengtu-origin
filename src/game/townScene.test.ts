import {it,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {existsSync} from 'node:fs';
import {TownScene,townLots,townSceneArt} from './TownScene';
import {BuildingSprite,ConstructionSprite,constructionWallSceneArt} from './assets';
import {newGame} from './legacyWorld';
it('場景呈現不改存檔；所有原有地塊仍有獨立操作入口',()=>{const g=newGame('civ_zhongguo',1,1,0),n=g.nodes.find(n=>n.owner===g.player)!,before=JSON.stringify(g);const html=renderToStaticMarkup(createElement(TownScene,{n,civ:g.player,era:0,speed:1,time:0,mobile:true,labels:false,onSelect:()=>{}}));expect((html.match(/aria-label="地塊 /g)||[]).length).toBe(16);expect(html).toContain('城門與城防');expect(html).toContain('橫向捲動');expect(html).not.toContain('city-frontier');expect(JSON.stringify(g)).toBe(before);expect(new Set(townLots.map(p=>p.join(','))).size).toBe(16);});
it('未建城防不顯示牆；已建城防依時代切換配套場景',()=>{expect(townSceneArt(0,2)).toContain('open');expect(townSceneArt(1,1)).toContain('feudal-stone');expect(townSceneArt(2,2)).toContain('stone');});
it('各時代的無牆、有牆與整條施工場景都有可載入的圖片',()=>{for(const era of [0,1,2])for(const [wall,constructing] of [[0,false],[1,false],[1,true]] as const){const file=new URL('../../public/'+townSceneArt(wall,era,constructing),import.meta.url);expect(existsSync(file),townSceneArt(wall,era,constructing)).toBe(true);}});
it('排隊與施工中的城牆整條顯示各時代的施工圖，完成後恢復防線',()=>{
 const g=newGame('civ_frankia',14,1,0),n=g.nodes.find(n=>n.owner===g.player)!;
 const job={id:801,item:'wall',quantity:1,at:12_000,started:6_000,owner:g.player,plot:16,action:'build' as const};
 n.build=[job];n.buildings.wall=1;
 for(const era of [0,1,2]){
  const art=constructionWallSceneArt(era);
  expect(existsSync(new URL('../../public/'+art,import.meta.url)),art).toBe(true);
  expect(renderToStaticMarkup(createElement(BuildingSprite,{building:'wall',era}))).toContain(townSceneArt(1,era));
  expect(renderToStaticMarkup(createElement(ConstructionSprite,{building:'wall',era}))).toContain(art);
  const render=(time:number)=>renderToStaticMarkup(createElement(TownScene,{n,civ:g.player,era,speed:1,time,mobile:false,labels:true,onSelect:()=>{}}));
  expect(render(2_000)).toContain(art);
  expect(render(2_000)).not.toContain('town-wall-construction');
  expect(render(2_000)).not.toContain(townSceneArt(0,era));
  expect(render(2_000)).toContain('⏳');
  expect(render(8_000)).toContain(art);
  expect(render(8_000)).toContain('施工進度');
  n.build=[];
  expect(render(12_000)).not.toContain(art);
  expect(render(12_000)).toContain(townSceneArt(1,era));
  n.build=[job];
 }
});
