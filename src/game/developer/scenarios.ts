import {createFormalWorld,CIVILIZATIONS} from '../formal/generator';
import type {FormalCity,FormalCommand,FormalWorld} from '../formal/model';
import {commandId} from '../formal/ids';
import {changeCityOwner,MILESTONES} from '../formal/economy';
import {HOUSING} from '../formal/catalogB3';
import {validateFormalWorld} from '../formal/schema';
import {submitFormalOrder} from '../formal/reducer';
import {buildable,terrainAt} from '../formal/terrain';
import {spatial} from '../formal/spatial';
export const SCENARIOS={new:'B2 原始新世界',economy:'B3 經濟／City／建設',logistics:'B3 雙城物流',military:'B4 科研／軍事／精銳',colony:'v85 拓殖隊（2000 人）',modern:'B4 D1 多城投入（資格 fixture）'} as const;
export type Scenario=keyof typeof SCENARIOS;
export type DeveloperConfig={scenario:Scenario;seed:number;speed:number;civilizationId:string;population?:number;castleLevel?:number;age?:0|1|2|3;cooperation?:boolean};
export function putBuilding(c:FormalCity,key:string,level:number){
 c.buildings[key]=level;
 if(key!=='center'&&c.economy!.slots[key]===undefined)c.economy!.slots[key]=Object.keys(c.economy!.slots).length;
 if(key==='residence')c.housing=400+HOUSING[level];
}
export function prepareCity(c:FormalCity,config:DeveloperConfig){
 const full=['military','colony','modern'].includes(config.scenario),warehouses=config.scenario==='modern'?5:3;
 putBuilding(c,'center',full?10:5);putBuilding(c,'residence',15);
 for(let i=0;i<warehouses;i++)putBuilding(c,'warehouse.'+i,15);
 putBuilding(c,'townhall',5);putBuilding(c,'market',5);
 if(full)for(const [key,lv] of Object.entries({academy:15,blacksmith:config.scenario==='modern'?15:5,barracks:config.scenario==='modern'?15:1,archery:config.scenario==='modern'?15:1,stable:config.scenario==='modern'?15:1,workshop:config.scenario==='modern'?15:1,castle:config.castleLevel??1}))putBuilding(c,key,lv);
 c.population=config.population??(config.scenario==='colony'?2000:full?22000:10000);
 if(!Number.isFinite(c.population)||c.population<0||c.population>c.housing)throw new Error('測試人口須在 0～住房上限之間。');
 c.economy!.milestones=MILESTONES.filter(n=>n<=c.population);c.stock={food:warehouses*100000,wood:warehouses*100000,stone:warehouses*100000,gold:warehouses*100000};
 if(config.scenario==='colony')c.military!.units={spearman:40,scout:20,ram:1};
}
/** Explicit test setup only. No fixture command is added to the production reducer. */
export function developerWorld(config:DeveloperConfig,campaign='developer-'+crypto.randomUUID()):FormalWorld{
 if(!Object.hasOwn(SCENARIOS,config.scenario)||![1,3,6,10,25].includes(config.speed)||!Number.isInteger(config.seed)||config.seed<0||config.seed>2147483647||!CIVILIZATIONS.includes(config.civilizationId as typeof CIVILIZATIONS[number]))throw new Error('測試情境設定無效。');
 if(config.castleLevel!==undefined&&(!Number.isInteger(config.castleLevel)||config.castleLevel<1||config.castleLevel>15))throw new Error('城堡等級須為 1～15。');
 const w=createFormalWorld({campaign,seed:config.seed,speed:config.speed,civilizationId:config.civilizationId,name:'驗證領主',offlineHours:0});
 if(config.scenario==='new')return w;
 prepareCity(w.cities[0],config);w.factions[0].age=config.age??(['military','colony'].includes(config.scenario)?2:config.scenario==='modern'?3:1);
 if(['logistics','modern'].includes(config.scenario)){
  const home=w.cities[0],second=w.cities.slice(1).sort((a,b)=>Math.hypot(a.x-home.x,a.y-home.y)-Math.hypot(b.x-home.x,b.y-home.y))[0];
  changeCityOwner(w,second,w.playerFactionId,'receive');second.integrationWorkHours=0;
  if(config.scenario==='modern')prepareCity(second,config);
 }
 if(config.scenario==='modern'){w.factions[0].modernQualification='full';w.factions[0].researchCooperation=config.cooperation!==false;w.factions[0].techIds=config.cooperation===false?[]:['research.cooperation'];}
 validateFormalWorld(w);return w;
}
export function developerOrder(w:FormalWorld,payload:FormalCommand,id=crypto.randomUUID(),issuer=w.playerFactionId){return {commandId:commandId('dev-'+id),campaignId:w.campaignId,issuerId:issuer,issuedWorldTime:w.time,expectedRevision:w.revision,payload};}
export function commitCheck(w:FormalWorld,payload:FormalCommand){const r=submitFormalOrder(w,developerOrder(w,payload));if(r.ack?.status!=='committed')throw new Error(r.ack?.reason??'命令未提交');return r.world;}
export function nearEmptyTarget(w:FormalWorld){
 const c=w.cities[0],index=spatial(w);
 for(let r=1;r<=15;r++)for(let y=Math.max(0,c.y-r);y<=Math.min(383,c.y+r);y++)for(let x=Math.max(0,c.x-r);x<=Math.min(383,c.x+r);x++){
  const at=index.at(x,y);if(buildable(terrainAt(w,x,y))&&!at.city&&!at.site&&!at.reservation)return{x,y};
 }
 throw new Error('找不到近郊合法拓殖空格。');
}
