// @vitest-environment happy-dom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it,vi} from 'vitest';
import {CityScenes} from './CityScenes';
import {Shell} from './Shell';
import {ProtectionStatus} from './ProtectionStatus';
import {BuildingDetail} from './BuildingDetail';
import {constructionAction} from './cityActions';
import {createFormalWorld} from '../formal/generator';
import {QUEUE_CAPACITY,HOUR} from '../formal/economy';
import {effectiveSpeed} from '../formal/playtest';
import {displayClock} from './liveClock';
const w=createFormalWorld({campaign:'scene-protection',seed:90217}),c=w.cities[0],noop=()=>{};
it('only outskirts owns the shield, outside scrolling composition, without a Shell status row on other pages',()=>{
 const outside=renderToStaticMarkup(<CityScenes world={w} city={c} mobile onBuilding={noop} onField={noop}/>),inside=renderToStaticMarkup(<CityScenes world={w} city={c} initialDistrict="town" mobile onBuilding={noop} onField={noop}/>);
 const host=document.createElement('div');host.innerHTML=outside;const shield=host.querySelector('.formal-protection-status')!;expect(shield.parentElement!.className).toBe('city-scene-viewport');expect(shield.closest('.town-viewport')).toBeNull();expect(shield.closest('.outskirts-composition')).toBeNull();expect(host.querySelector('.city-scene-viewport')!.firstElementChild!.className).toBe('town-viewport');expect(inside).not.toContain('protection-shield');
 for(const view of ['map','army','research','settings'] as const){const shell=renderToStaticMarkup(<Shell world={w} city={c} cities={[c]} mobile view={view} onView={noop} onCity={noop} onHome={noop} onResource={noop} onMore={noop} moreOpen={false} busy={false}>{view}</Shell>);expect(shell).not.toContain('formal-protection-status');expect(shell).not.toContain('protection-shield');}
});
it('queue copy uses the existing five-item capacity for fields, buildings, walls and training, including 3/5',()=>{
 const world=structuredClone(w),city=world.cities[0];city.buildings.barracks=1;city.economy!.slots.barracks=1;
 city.economy!.construction=Array.from({length:QUEUE_CAPACITY},(_,i)=>({target:{kind:'field',slot:17},toLevel:i+1,startsAt:0,durationMs:HOUR,lane:0,commandId:'command:copy-'+i} as never));
 for(const target of [{field:0},{key:'warehouse.1'},{key:'wall'}])expect(constructionAction(world,city,target).reasons).toContain(`已排滿 ${QUEUE_CAPACITY} 項工程`);
 for(const n of [4,3]){city.economy!.construction.length=n;for(const target of [{field:0},{key:'warehouse.1'},{key:'wall'}])expect(constructionAction(world,city,target).reasons).toEqual([]);}
 city.military!.queue=Array.from({length:3},(_,i)=>({unitId:'militia',producer:'barracks',remaining:1,nextAt:HOUR,durationMs:HOUR,startsAt:0,lane:0,commandId:'command:training-'+i} as never));
 const scene=renderToStaticMarkup(<CityScenes world={world} city={city} onBuilding={noop} onField={noop}/>),detail=renderToStaticMarkup(<BuildingDetail world={world} city={city} buildingKey="barracks" issue={noop} busy={false}/>);
 expect(scene).toContain(`建造 3/${QUEUE_CAPACITY}`);expect(scene).toContain(`訓練 3/${QUEUE_CAPACITY}`);expect(detail).toContain(`軍事訓練佇列 3/${QUEUE_CAPACITY}`);expect(scene+detail).not.toMatch(/3\/3|已排滿 3 項/);
});
it('effective 1X/10X/25X and developer speed, pause, rebirth and expiry retain the official clock conversion',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{for(const speed of [1,10,25]){const world=structuredClone(w);world.speed=speed;const left=48*HOUR;displayClock.adopt({campaignId:world.campaignId,time:0,speed,running:true});await act(async()=>root.render(<ProtectionStatus world={world}/>));const expected=left/effectiveSpeed(world),seconds=Math.ceil(expected/1000),label=[Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(n=>String(n).padStart(2,'0')).join(':');expect(host.querySelector('time')!.textContent).toBe(label);
 await act(async()=>displayClock.adopt({campaignId:world.campaignId,time:speed*1000,speed,running:true}));expect(host.querySelector('time')!.textContent).not.toBe(label);
 world.extinction={sites:[],craftsmen:[],extinct:[world.playerFactionId],rebirths:0,cancelledResearch:[],defeat:{at:0,ended:false}};await act(async()=>root.render(<ProtectionStatus world={{...world}}/>));expect(host.querySelector('time')!.textContent).toBe(label);await act(async()=>displayClock.adopt({campaignId:world.campaignId,time:3600000,speed,running:true}));expect(host.querySelector('time')!.textContent).toBe(label);
 delete world.extinction;world.developer={enabled:true,speed:100};world.factions[0].protectionKind='rebirth';displayClock.stop();await act(async()=>{displayClock.adopt({campaignId:world.campaignId,time:0,speed:100,running:false});root.render(<ProtectionStatus world={{...world}}/>);});expect(host.querySelector('button')!.getAttribute('aria-label')).toBe('復國保護 00:28:48');
 world.time=left;await act(async()=>root.render(<ProtectionStatus world={{...world}}/>));expect(host.innerHTML).toBe('');}
 }finally{await act(async()=>root.unmount());host.remove();displayClock.stop();vi.unstubAllGlobals();}
});
