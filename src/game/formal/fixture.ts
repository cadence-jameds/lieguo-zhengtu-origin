import {armyId,campaignId,cityId,commandId,factionId,researchProjectId} from './ids';
import type {FormalWorld,ResearchProject} from './model';
import {zeroResources} from './model';
import {formalMetadata} from './versions';
import {validateFormalWorld} from './schema';
export const fixtureIds={player:factionId('player'),other:factionId('other'),home:cityId('home'),support:cityId('support'),foreign:cityId('foreign'),research:researchProjectId('fixture-modern')};
/** Constructed directly. Never imports legacyGame, newGame, repair, normalize, or upgrade. */
export function createFormalFixture(options:{campaign?:string;seed?:number;speed?:number;name?:string;civilizationId?:string;research?:boolean}={}):FormalWorld {
 const {player,other,home,support,foreign}=fixtureIds;
 const stock=()=>({food:600,wood:600,stone:600,gold:600});
 const w:FormalWorld={kind:'formal',metadata:formalMetadata(),campaignId:campaignId(options.campaign??'b1-fixture'),fixture:true,seed:options.seed??90217,speed:options.speed??1,time:0,dimensions:{width:32,height:32},playerFactionId:player,revision:0,sequences:{event:1,report:1,project:1},
 factions:[{id:player,name:options.name??'玩家',civilizationId:options.civilizationId??'civ_zhongguo',empireId:null,modernQualification:'none',researchCooperation:false,techIds:[],researchQueue:null},{id:other,name:'驗證勢力',civilizationId:'civ_frankia',empireId:null,modernQualification:'none',researchCooperation:false,techIds:[],researchQueue:null}],
 cities:[{id:home,ownerFactionId:player,name:'起始城',x:12,y:12,population:200,housing:400,stock:stock(),buildings:{center:1}},{id:support,ownerFactionId:player,name:'支援城',x:18,y:12,population:200,housing:400,stock:stock(),buildings:{center:1}},{id:foreign,ownerFactionId:other,name:'驗證城',x:24,y:18,population:200,housing:400,stock:stock(),buildings:{center:1}}],
 armies:[{id:armyId('fixture'),ownerFactionId:player,originCityId:home}],events:[],commandReceipts:[],completionReceipts:[],researchProjects:[],largeProjects:[]};
 if(options.research){
 w.cities[0].buildings.academy=15;w.factions[0].modernQualification='full';w.factions[0].researchCooperation=true;w.factions[0].techIds=['fixture.cooperation'];
 const p:ResearchProject={projectId:fixtureIds.research,techId:'fixture.modern-research',technologyScope:'modern-common',ownerFactionId:player,initiatingCityId:home,paymentMode:'same-faction-direct',phase:'funding',requiredResources:{food:100,wood:100,stone:100,gold:100},contributedResources:zeroResources(),contributions:[],createdAt:0,qualificationSnapshot:{checkedAt:0,cityId:home,ownerFactionId:player,academyLevel:15,buildingLevels:{academy:15},prerequisiteTechIds:['fixture.cooperation'],fullModernQualification:true,researchCooperation:true},durationSnapshot:{baseDurationMs:60000,academyMultiplier:.79,durationMs:47400},creationCommandId:commandId('fixture-create'),fundingTransitionCommandId:null,completionEventId:null};
 w.researchProjects.push(p);w.factions[0].researchQueue=p.projectId;
 }
 return validateFormalWorld(w);
}
