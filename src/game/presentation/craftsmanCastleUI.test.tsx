// @vitest-environment happy-dom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {craftWorld} from '../formal/gateDeltaTestSupport';
import {CIV_NAMES} from './artMap';
import {craftsmanCastleAction,constructionAction} from './cityActions';
import {canonicalJSON} from '../formal/canonical';
import {submitFormalOrder,advanceFormal} from '../formal/reducer';
import {order,build} from '../formal/developmentTestSupport';
import {validateFormalWorld} from '../formal/schema';
import {buildingDuration,buildingCost} from '../formal/catalogB3';
import {CraftsmanPanel} from './CraftsmanPanel';
let el:HTMLDivElement,root:ReturnType<typeof createRoot>;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);el=document.createElement('div');document.body.append(el);root=createRoot(el);});
afterEach(async()=>{await act(async()=>root.unmount());el.remove();vi.unstubAllGlobals();});
it.each(['same','foreign'])('zero-stock %s-civilization craftsman can build without ordinary castle payment',async(kind)=>{
 const w=craftWorld(false),c=w.cities[0],craft=w.extinction!.craftsmen[0];if(kind==='same'){craft.civilizationId=w.factions[0].civilizationId;const site=w.extinction!.sites.find(site=>site.id===craft.siteId)!;site.civilizationId=craft.civilizationId;site.sourceFactionId=w.factions.find(f=>f.civilizationId===craft.civilizationId&&f.id!==w.playerFactionId)!.id;}c.stock={food:0,wood:0,stone:0,gold:0};const issue=vi.fn();
 await act(async()=>root.render(<CraftsmanPanel world={w} city={c} issue={issue} busy={false}/>));await act(async()=>el.querySelector<HTMLButtonElement>('[aria-label="管理工匠團"]')!.click());
 const button=[...el.querySelectorAll('button')].find(b=>/建造.*城堡/.test(b.textContent??''))!;expect(button).toBeDefined();expect(button.disabled).toBe(false);expect([...el.querySelectorAll('.cost span')].map(n=>n.textContent?.trim())).toEqual(['穀 0','木 0','石 0','金 0']);
 await act(async()=>button.click());expect(issue).toHaveBeenCalledWith({type:'craftsman.castle',cityId:c.id,craftsmanId:craft.id});
});

function fixture(civ?:string){const w=craftWorld(false),craft=w.extinction!.craftsmen[0];if(civ){craft.civilizationId=civ;const site=w.extinction!.sites.find(site=>site.id===craft.siteId)!;site.civilizationId=civ;site.sourceFactionId=w.factions.find(f=>f.civilizationId===civ&&f.id!==w.playerFactionId)!.id;}return validateFormalWorld(w);}
it.each(Object.keys(CIV_NAMES))('%s craftsman preview is pure, free, and matches real normal-duration construction',civ=>{
 const w=fixture(civ),c=w.cities[0],craft=w.extinction!.craftsmen[0];c.stock={food:0,wood:0,stone:0,gold:0};const before=canonicalJSON(w),quote=craftsmanCastleAction(w,c,craft.id);expect(quote.allowed).toBe(true);expect(quote.cost).toEqual({food:0,wood:0,stone:0,gold:0});expect(quote.duration).toBe(buildingDuration('castle',1,8));expect(canonicalJSON(w)).toBe(before);
 const t=submitFormalOrder(w,order(w,{type:'craftsman.castle',cityId:c.id,craftsmanId:craft.id}));expect(t.ack!.status).toBe('committed');const job=t.world.cities[0].economy!.construction.find(j=>j.target.kind==='building'&&j.target.key==='castle')!;expect(job.paidResources).toEqual(quote.cost);expect(job.durationMs).toBe(quote.duration);expect(job.castleCivilizationId).toBe(civ);
 const finished=advanceFormal(t.world,job.startsAt+job.durationMs).world;expect(finished.cities[0].castleCivilizationId).toBe(civ);expect(finished.extinction!.craftsmen.some(x=>x.id===craft.id)).toBe(false);
});
it.each(['age','building','existing','queue','ownership','craft'] as const)('real %s precondition blocks preview and the actual command',kind=>{
 let w=fixture(),c=w.cities[0];const id=w.extinction!.craftsmen[0].id;
 if(kind==='age')w.factions[0].age=1;
 if(kind==='building')c.buildings.townhall=0;
 if(kind==='existing')build(c,'castle',1);
 if(kind==='queue'){for(let i=0;i<5;i++)w=submitFormalOrder(w,order(w,{type:'field.upgrade',cityId:c.id,slot:i})).world;c=w.cities[0];expect(c.economy!.construction).toHaveLength(5);}
 if(kind==='ownership')c=w.cities[2];
 const craftId=kind==='craft'?'missing-craftsman':id,quote=craftsmanCastleAction(w,c,craftId),actual=submitFormalOrder(w,order(w,{type:'craftsman.castle',cityId:c.id,craftsmanId:craftId}));expect(quote.allowed).toBe(false);expect(actual.ack!.status).toBe('rejected');expect(quote.reason).toBe(actual.ack!.reason);
});
it('ordinary castle Lv1 and Lv2 keep their paid resource rules and normal timing',()=>{
 let w=fixture();const c=w.cities[0],quote=constructionAction(w,c,{key:'castle'});expect(quote.cost).toEqual(buildingCost('castle',1));const t=submitFormalOrder(w,order(w,{type:'building.upgrade',cityId:c.id,key:'castle'}));expect(t.ack!.status).toBe('committed');const job=t.world.cities[0].economy!.construction[0];expect(job.paidResources).toEqual(quote.cost);expect(job.durationMs).toBe(quote.duration);w=advanceFormal(t.world,job.startsAt+job.durationMs).world;const next=constructionAction(w,w.cities[0],{key:'castle'});expect(next.cost).toEqual(buildingCost('castle',2));expect(next.cost!.stone).toBeGreaterThan(0);expect(w.extinction!.craftsmen).toHaveLength(1);
});
