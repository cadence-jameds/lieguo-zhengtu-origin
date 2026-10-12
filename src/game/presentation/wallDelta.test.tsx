// @vitest-environment happy-dom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {existsSync} from 'node:fs';
import FormalCityPanel from '../FormalCityPanel';
import {createFormalWorld} from '../formal/generator';
import {advanceFormal,submitFormalOrder} from '../formal/reducer';
import {order} from '../formal/testSupport';
import type {FormalCommand,FormalWorld} from '../formal/model';
import {constructionWallSceneArt,finishedWallSceneArt} from '../assets';
import {visualAge} from './artMap';
import {displayClock} from './liveClock';

let container:HTMLDivElement,root:Root,world:FormalWorld,mobile:boolean,serial=0;
beforeEach(()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 vi.spyOn(performance,'now').mockReturnValue(0);
 container=document.createElement('div');document.body.append(container);root=createRoot(container);
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();displayClock.stop();vi.restoreAllMocks();vi.unstubAllGlobals();});
function make(age:0|1|2|3=0){
 world=createFormalWorld({campaign:'wall-ui-'+(++serial),seed:90217,speed:50});
 const c=world.cities[0];c.buildings.center=2;c.buildings['warehouse.0']=15;c.economy!.slots['warehouse.0']=0;c.stock={food:10000,wood:10000,stone:10000,gold:10000};world.factions[0].age=age;
}
function submit(payload:FormalCommand){
 const t=submitFormalOrder(world,order(world,'wall-ui-command-'+(++serial),payload));expect(t.ack?.status,t.ack?.reason).toBe('committed');world=t.world;
}
function render(){
 displayClock.adopt({campaignId:world.campaignId,time:world.time,speed:world.speed,running:false});
 root.render(<div className={mobile?'mobile-layout':'desktop-layout'}><FormalCityPanel world={world} cityId={world.cities[0].id} busy={false} mobile={mobile} issue={p=>{submit(p);render();}}/></div>);
}
const button=(text:string,scope:ParentNode=container)=>[...scope.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===text)!;
const gate=()=>container.querySelector<HTMLButtonElement>('.town-gate')!;
const scene=()=>container.querySelector<HTMLImageElement>('.town-background')!;
async function showTown(){await act(async()=>render());await act(async()=>button('城內').click());}

for(const layout of [false,true])for(const age of [0,1,3] as const)it(`${layout?'mobile':'desktop'} age${age}: gate uses real wall commands, queued cancellation and unchanged DEMO art through completion`,async()=>{
 mobile=layout;make(age);const era=visualAge(age),initialSlots=structuredClone(world.cities[0].economy!.slots);
 await showTown();expect(container.querySelectorAll('[data-testid^="town-anchor-"]')).toHaveLength(16);
 await act(async()=>gate().click());let dialog=container.querySelector('dialog')!;
 expect(dialog.textContent).toContain('固定防線');expect(dialog.querySelector('.building-detail .badge')!.textContent).toBe('Lv0');expect(dialog.textContent).toContain('不占自由建築槽');expect(dialog.querySelector('.icon-slot')).toBeNull();
 expect(button('升級至 Lv1',dialog).disabled).toBe(false);
 await act(async()=>button('升級至 Lv1',dialog).click());const first=world.cities[0].economy!.construction[0];
 expect(first.target).toEqual({kind:'building',key:'wall'});expect(world.cities[0].wallLevel).toBe(0);expect(world.cities[0].economy!.slots).toEqual(initialSlots);
 const constructionPath=constructionWallSceneArt(era);expect(existsSync('public/'+constructionPath)).toBe(true);expect(scene().getAttribute('src')).toBe('/'+constructionPath);
 expect(container.querySelector('.construction-overlays .gate-progress [role="progressbar"]')).not.toBeNull();expect(container.textContent).toContain('城牆 → Lv1');expect(container.textContent).toContain('施工中');
 await act(async()=>gate().click());dialog=container.querySelector('dialog')!;
 expect(dialog.querySelector('.wall-detail-art image')!.getAttribute('href')).toBe('/'+constructionPath);
 await act(async()=>button('升級至 Lv2',dialog).click());const second=world.cities[0].economy!.construction[1];expect(second.startsAt).toBe(first.startsAt+first.durationMs);
 await act(async()=>gate().click());dialog=container.querySelector('dialog')!;
 expect(dialog.textContent).toContain('⏳ 排隊中 · Lv2');const queued=[...dialog.querySelectorAll<HTMLElement>('.construction-preview')].find(e=>e.textContent?.includes('排隊中'))!;
 await act(async()=>button('取消工程',queued).click());expect(world.cities[0].economy!.construction).toHaveLength(1);expect(world.cities[0].wallLevel).toBe(0);
 world=advanceFormal(world,first.startsAt+first.durationMs).world;await act(async()=>render());
 const finishedPath=finishedWallSceneArt(era);expect(existsSync('public/'+finishedPath)).toBe(true);expect(scene().getAttribute('src')).toBe('/'+finishedPath);expect(gate().getAttribute('aria-label')).toContain('城牆 1 級');expect(container.querySelector('.construction-overlays .gate-progress .construction-progress')).toBeNull();
 await act(async()=>gate().click());dialog=container.querySelector('dialog')!;expect(dialog.querySelector('.building-detail .badge')!.textContent).toBe('Lv1');expect(dialog.querySelector('.wall-detail-art image')!.getAttribute('href')).toBe('/'+finishedPath);
 expect(world.cities[0].buildings).not.toHaveProperty('wall');expect(world.cities[0].economy!.slots).toEqual(initialSlots);
});
for(const layout of [false,true])it(`${layout?'mobile':'desktop'}: waiting wall keeps open scene and becomes construction art only after its shared lane is free`,async()=>{
 mobile=layout;make();submit({type:'field.upgrade',cityId:world.cities[0].id,slot:0});submit({type:'building.upgrade',cityId:world.cities[0].id,key:'wall'});
 const field=world.cities[0].economy!.construction[0],wall=world.cities[0].economy!.construction[1];await showTown();expect(scene().getAttribute('src')).toBe('/art/city-scene-dark-open.webp');expect(container.querySelector('.construction-overlays .gate-progress [aria-label="等待施工"]')).not.toBeNull();
 await act(async()=>gate().click());expect(container.querySelector('dialog')!.textContent).toContain('⏳ 排隊中 · Lv1');
 world=advanceFormal(world,field.startsAt+field.durationMs).world;await act(async()=>render());expect(scene().getAttribute('src')).toBe('/'+constructionWallSceneArt(0));expect(container.querySelector('.construction-overlays .gate-progress [aria-label="等待施工"]')).toBeNull();expect(container.querySelector('.construction-overlays .gate-progress [role="progressbar"]')).not.toBeNull();expect(world.cities[0].wallLevel).toBe(0);
 world=advanceFormal(world,wall.startsAt+wall.durationMs).world;await act(async()=>render());expect(world.cities[0].wallLevel).toBe(1);expect(container.querySelector('.building-detail .badge')!.textContent).toBe('Lv1');
});
for(const layout of [false,true])it(`${layout?'mobile':'desktop'}: formal prerequisite, maximum15 and inherited queue refund notice stay visible`,async()=>{
 mobile=layout;make();world.cities[0].buildings.center=1;await showTown();await act(async()=>gate().click());let dialog=container.querySelector('dialog')!;expect(dialog.textContent).toContain('城市中心 Lv2');expect(button('升級至 Lv1',dialog).disabled).toBe(true);
 world=structuredClone(world);world.cities[0].buildings.center=2;world.cities[0].wallLevel=15;await act(async()=>render());dialog=container.querySelector('dialog')!;expect(dialog.querySelector('.building-detail .badge')!.textContent).toBe('Lv15');expect(dialog.textContent).toContain('已達最高等級');expect(button('最高等級',dialog).disabled).toBe(true);
 make();submit({type:'building.upgrade',cityId:world.cities[0].id,key:'wall'});await act(async()=>render());await act(async()=>container.querySelector<HTMLButtonElement>('[aria-label="取消城牆工程"]')!.click());dialog=[...container.querySelectorAll('dialog')].find(d=>d.textContent?.includes('施工中的工程退回50%'))!;expect(dialog.textContent).toContain('超出部分不保留');await act(async()=>button('確認取消',dialog).click());expect(world.cities[0].wallLevel).toBe(0);expect(world.cities[0].economy!.construction).toEqual([]);
});
