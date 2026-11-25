// @vitest-environment happy-dom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {craftWorld} from '../formal/gateDeltaTestSupport';
import {CraftsmanPanel} from './CraftsmanPanel';
let el:HTMLDivElement,root:ReturnType<typeof createRoot>;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);el=document.createElement('div');document.body.append(el);root=createRoot(el);});
afterEach(async()=>{await act(async()=>root.unmount());el.remove();vi.unstubAllGlobals();});
function fixture(civ?:string){const w=craftWorld(false);if(civ)w.extinction!.craftsmen[0].civilizationId=civ;return w;}

it('shows each real team civilization, not the player or castle art, and does not badge a mixed summary',async()=>{
 const w=fixture('civ_byzantium'),c=w.cities[0],team=w.extinction!.craftsmen[0];
 expect(team.ownerFactionId).toBe(w.playerFactionId);
 expect(w.factions.find(f=>f.id===team.ownerFactionId)!.civilizationId).not.toBe(team.civilizationId);
 c.castleCivilizationId='civ_frankia';
 w.extinction!.craftsmen.push({...team,id:'second-craftsman',civilizationId:'civ_japan'});
 const issue=vi.fn(),tag=(where:ParentNode)=>where.querySelector('.craftsman-civ-tag');
 await act(async()=>root.render(<CraftsmanPanel world={w} city={c} issue={issue} busy={false}/>));
 const card=el.querySelector<HTMLButtonElement>('[aria-label="管理工匠團"]')!;
 expect(tag(card)).toBeNull();
 expect(card.querySelector('img')!.src).toContain('unit-craftsman-corps.webp');
 await act(async()=>card.click());
 const detail=el.querySelector('.special-unit-detail')!;
 expect(tag(detail)?.textContent).toBe('拜');
 expect(tag(detail)?.getAttribute('aria-label')).toBe('工匠團文明：拜占庭');
 expect(tag(detail)?.getAttribute('title')).toBe('拜占庭');
 const picker=el.querySelector<HTMLSelectElement>('[aria-label="選取工匠團"]')!;
 await act(async()=>{picker.value='second-craftsman';picker.dispatchEvent(new Event('change',{bubbles:true}));});
 expect(tag(detail)?.textContent).toBe('日');
 expect(tag(detail)?.getAttribute('aria-label')).toBe('工匠團文明：日本');
 expect(issue).not.toHaveBeenCalled();
});

it.each(['missing','unknown','toString'])('never fabricates a civilization badge for %s information',async(kind)=>{
 const w=fixture(),c=w.cities[0];
 if(kind==='missing')w.extinction!.craftsmen=[];
 else w.extinction!.craftsmen[0].civilizationId=kind;
 await act(async()=>root.render(<CraftsmanPanel world={w} city={c} issue={vi.fn()} busy={false}/>));
 const card=el.querySelector<HTMLButtonElement>('[aria-label="管理工匠團"]')!;
 expect(card.querySelector('.craftsman-civ-tag')).toBeNull();
 await act(async()=>card.click());
 expect(el.querySelector('.special-unit-detail .craftsman-civ-tag')).toBeNull();
});

it('marks a summary card only when all its teams have the same known civilization',async()=>{
 const w=fixture('civ_byzantium'),c=w.cities[0],team=w.extinction!.craftsmen[0];
 w.extinction!.craftsmen.push({...team,id:'same-civ-team'});
 await act(async()=>root.render(<CraftsmanPanel world={w} city={c} issue={vi.fn()} busy={false}/>));
 expect(el.querySelector('.special-unit-card .craftsman-civ-tag')?.textContent).toBe('拜');
});

it('uses the approved covered wagon in both the army card and its existing details',async()=>{
 const {ArmyView}=await import('./DevelopmentViews');
 const w=fixture(),c=w.cities[0],issue=vi.fn();
 await act(async()=>root.render(<ArmyView world={w} city={c} issue={issue} busy={false}/>));
 const card=el.querySelector<HTMLButtonElement>('button[aria-label="管理拓殖隊"]')!;
 const cardArt=card.querySelector<HTMLImageElement>('.settler-card-portrait')!;
 expect(cardArt.getAttribute('alt')).toBe('拓殖隊與移民篷車');
 expect(cardArt.src).toContain('unit-settler-team.webp');
 await act(async()=>card.click());
 expect(el.querySelector<HTMLImageElement>('.settler-detail-portrait')?.src).toBe(cardArt.src);
 expect(el.textContent).toContain('整備需城堡時代');
 expect(issue).not.toHaveBeenCalled();
});
