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
it('CityScenes only supplies a geometry anchor; Shell owns exactly one floating shield on every game view',()=>{
 for(const district of ['town','outskirts'] as const){const html=renderToStaticMarkup(<CityScenes world={w} city={c} initialDistrict={district} mobile onBuilding={noop} onField={noop}/>);expect(html).not.toContain('protection-shield');expect(html).toContain('data-protection-scene="'+district+'"');}
 for(const view of ['city','map','army','research','legion','diplomacy','reports','empire','tasks','settings'] as const){const html=renderToStaticMarkup(<Shell world={w} city={c} cities={[c]} mobile view={view} onView={noop} onCity={noop} onHome={noop} onResource={noop} onMore={noop} moreOpen={false} busy={false}>{view}</Shell>);const host=document.createElement('div');host.innerHTML=html;expect(host.querySelectorAll('.protection-shield')).toHaveLength(1);expect(host.querySelector('.main-surface>.formal-protection-status')).toBeNull();}
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
 try{for(const speed of [1,10,25]){const world=structuredClone(w);world.speed=speed;const left=48*HOUR;displayClock.adopt({campaignId:world.campaignId,time:0,speed,running:true});await act(async()=>root.render(<ProtectionStatus world={world}/>));const expected=left/effectiveSpeed(world),seconds=Math.ceil(expected/1000),label=[Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(n=>String(n).padStart(2,'0')).join(':');expect(document.querySelector('.protection-shield time')!.textContent).toBe(label);
 await act(async()=>displayClock.adopt({campaignId:world.campaignId,time:speed*1000,speed,running:true}));expect(document.querySelector('.protection-shield time')!.textContent).not.toBe(label);
 world.extinction={sites:[],craftsmen:[],extinct:[world.playerFactionId],rebirths:0,cancelledResearch:[],defeat:{at:0,ended:false}};await act(async()=>root.render(<ProtectionStatus world={{...world}}/>));expect(document.querySelector('.protection-shield time')!.textContent).toBe(label);await act(async()=>displayClock.adopt({campaignId:world.campaignId,time:3600000,speed,running:true}));expect(document.querySelector('.protection-shield time')!.textContent).toBe(label);
 delete world.extinction;world.developer={enabled:true,speed:100};world.factions[0].protectionKind='rebirth';displayClock.stop();await act(async()=>{displayClock.adopt({campaignId:world.campaignId,time:0,speed:100,running:false});root.render(<ProtectionStatus world={{...world}}/>);});expect(document.querySelector('.protection-shield')!.getAttribute('aria-label')).toBe('復國保護 00:28:48');
 world.time=left;await act(async()=>root.render(<ProtectionStatus world={{...world}}/>));expect(host.innerHTML).toBe('');expect(document.querySelector('.protection-shield')).toBeNull();}
 }finally{await act(async()=>root.unmount());host.remove();displayClock.stop();vi.unstubAllGlobals();}
});
it('one persistent portal keeps its countdown and closes details across all views and removes itself on expiry',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const host=document.createElement('div');document.body.append(host);const root=createRoot(host),world=structuredClone(w);world.speed=25;displayClock.adopt({campaignId:world.campaignId,time:0,speed:25,running:false});
 try{
  await act(async()=>root.render(<ProtectionStatus world={world} view="city" cityId={c.id}/>));const shield=document.querySelector<HTMLButtonElement>('.protection-shield')!;shield.getBoundingClientRect=()=>new DOMRect(100,200,84,28);
  for(const view of ['map','army','research','legion','diplomacy','reports','empire','tasks','settings','city']){
   await act(async()=>shield.click());expect(document.querySelector('.protection-details')).not.toBeNull();
   await act(async()=>root.render(<ProtectionStatus world={world} view={view} cityId={c.id}/>));expect(document.querySelectorAll('.protection-shield')).toHaveLength(1);expect(document.querySelector('.protection-shield')).toBe(shield);expect(document.querySelector('.protection-details')).toBeNull();expect(shield.textContent).toBe('🛡️ 01:55:12');
  }
  await act(async()=>displayClock.adopt({campaignId:world.campaignId,time:25000,speed:25,running:false}));expect(shield.textContent).toBe('🛡️ 01:55:11');
  const ended=structuredClone(world);ended.factions[0].protectionUntil=0;await act(async()=>root.render(<ProtectionStatus world={ended} view="city"/>));expect(document.querySelector('.protection-shield')).toBeNull();expect(document.querySelector('.protection-details')).toBeNull();
 }finally{await act(async()=>root.unmount());host.remove();displayClock.stop();vi.unstubAllGlobals();}
});
