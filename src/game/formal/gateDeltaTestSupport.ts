import {expect} from 'vitest';
import {battlefield,issue,dispatch,arrive} from './combatTestSupport';
import {build} from './developmentTestSupport';
import {advanceFormal} from './reducer';
import {createExile} from './extinction';
import {changeCityOwner} from './economy';
import {isMissionArmy} from './combatModel';
import {validateFormalWorld} from './schema';
import {buildable,terrainAt} from './terrain';
import {spatial,invalidateSpatial} from './spatial';
import type {FormalWorld} from './model';
export function craftWorld(secondCity=true){let w=battlefield();if(secondCity)changeCityOwner(w,w.cities[1],w.playerFactionId,'receive');w.factions[0].age=2;build(w.cities[0],'center',8);for(const key of ['townhall','academy'])build(w.cities[0],key,5);createExile(w,w.factions.find(f=>f.civilizationId==='civ_japan')!.id,{militia:4},[],w.cities[1]);w.cities[0].military!.units={militia:100};w=issue(w,{type:'army.dispatch',cityId:w.cities[0].id,mission:'raid',target:{kind:'wild',siteId:w.extinction!.sites[0].id,generation:0},units:{militia:100}}).world;w=arrive(w).world;w=advanceFormal(w,w.armies.filter(isMissionArmy)[0].arrivalAt).world;w.cities[0].military!.units={};w.cities[2].military!.units={militia:1000};return validateFormalWorld(w);}
export function captureCraftCity(w:FormalWorld){w=dispatch(w,'conquest',{militia:1000},2,0).world;const army=w.armies.filter(isMissionArmy).find(a=>a.ownerFactionId===w.factions[2].id)!;return advanceFormal(w,army.arrivalAt);}
export function extinctSiege(playerTarget=false){let w=battlefield();if(playerTarget){changeCityOwner(w,w.cities[2],w.playerFactionId,'receive');w.cities[0].wallLevel=15;w.cities[0].military!.units={};}w.cities[1].military!.units={militia:30,ram:5};if(!playerTarget){w.cities[2].military!.units={};w.cities[2].wallLevel=15;}w=dispatch(w,'conquest',{militia:30,ram:5},1,playerTarget?0:2).world;w=arrive(w).world;const siegeId=w.combat!.battles[0].id;w.cities[playerTarget?2:0].military!.units={militia:1000};w=dispatch(w,'conquest',{militia:1000},playerTarget?2:0,1).world;const arrival=w.armies.filter(isMissionArmy).find(a=>a.ownerFactionId===w.playerFactionId)!.arrivalAt;w=advanceFormal(w,arrival).world;expect(w.extinction!.extinct).toContain(w.factions[1].id);expect(w.armies.find(a=>a.battleId===siegeId)).toMatchObject({status:'engaged',extinctionPending:true});return {world:validateFormalWorld(w),siegeId,targetCityId:w.cities[playerTarget?0:2].id};}
export function nearCity(w:FormalWorld,index:number){const home=w.cities[0];for(let r=1;r<10;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){const x=home.x+dx,y=home.y+dy;if(buildable(terrainAt(w,x,y))&&!spatial(w).at(x,y).city&&!spatial(w).at(x,y).site){w.cities[index].x=x;w.cities[index].y=y;invalidateSpatial(w);return;}}throw Error('fixture placement');}
