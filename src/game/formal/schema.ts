import {validateWonders} from './wonderSchema';
import {QUEUE_CAPACITY} from './queueCapacity';
import {craftsmanForConstruction} from './extinction';
import {governorSchema,governanceOrderShape,validateGovernance} from './governanceSchema';
import {autonomySchema,validateAutonomy} from './autonomySchema';
import {politicsSchema,politicsOrderShapes,validatePolitics} from './politicsSchema';
import {mountainFootprint} from './mountains';
import {z} from 'zod';
import {armyOrderShapes,armyIdSchema,battleIdSchema,formalArmySchema,combatSchema,wildCombatShape,battleReportSchema,validateCombatContracts} from './combatSchema';
import type {CampaignId,CityId,CommandId,EmpireId,EventId,FactionId,ProjectId,ReportId,ResearchProjectId,ShipmentId,WildSiteId} from './ids';
import type {CommandReceipt,FormalEvent,FormalOrder,FormalReport,FormalWorld,LargeProject,ResearchProject} from './model';
import {resourceKeys} from './model';
import {buildable,terrainAt} from './terrain';
import {TECH_CATALOG,BLACKSMITH_CAPS,BLACKSMITH_LINES} from './techCatalog';
import {UNIT_CATALOG} from './unitCatalog';
import {BUILDING_CATALOG,buildingKind,storageCapacity} from './catalogB3';
import {NATIVE_CONTENT_VERSION,NATIVE_RULESET_VERSION,NATIVE_GENERATOR_VERSION,NATIVE_TERRAIN_VERSION,FORMAL_CONTENT_VERSION,FORMAL_GENERATOR_VERSION,FORMAL_RULESET_VERSION,FORMAL_SCHEMA_VERSION,FORMAL_TERRAIN_VERSION} from './versions';
const int=z.number().int().nonnegative().safe(),positive=int.positive(),text=z.string().min(1).max(200);
function id<T extends string>(prefix:string):z.ZodType<T>{return z.string().regex(new RegExp(`^(?:${prefix}):[A-Za-z0-9_.-]{1,100}$`)) as unknown as z.ZodType<T>;}
export const factionIdSchema=id<FactionId>('faction'),cityIdSchema=id<CityId>('city'),commandIdSchema=id<CommandId>('command');
const eventIdSchema=id<EventId>('event'),projectIdSchema=id<ProjectId>('project'),researchIdSchema=id<ResearchProjectId>('research'),empireIdSchema=id<EmpireId>('empire');
export const resourcesSchema=z.object({food:int,wood:int,stone:int,gold:int}).strict();
export const receiptSchema:z.ZodType<CommandReceipt>=z.object({commandId:commandIdSchema,issuerId:factionIdSchema,fingerprint:z.string().min(1),committedRevision:int,disposition:z.enum(['applied','rolled-back'])}).strict();
const qualification=z.object({checkedAt:int,cityId:cityIdSchema,ownerFactionId:factionIdSchema,academyLevel:int,buildingLevels:z.record(int),prerequisiteTechIds:z.array(text),fullModernQualification:z.boolean(),researchCooperation:z.boolean()}).strict();
const duration=z.object({baseDurationMs:positive,academyMultiplier:z.number().finite().positive(),durationMs:positive}).strict();
const researchBase=z.object({projectId:researchIdSchema,techId:text,technologyScope:z.enum(['modern-common','modern-civilization','traditional','research-cooperation']),ownerFactionId:factionIdSchema,initiatingCityId:cityIdSchema,paymentMode:z.enum(['single-city','same-faction-direct']),requiredResources:resourcesSchema,contributedResources:resourcesSchema,contributions:z.array(z.object({commandId:commandIdSchema,sourceFactionId:factionIdSchema,sourceCityId:cityIdSchema,resources:resourcesSchema,at:int}).strict()),createdAt:int,qualificationSnapshot:qualification,durationSnapshot:duration,creationCommandId:commandIdSchema,fundingTransitionCommandId:commandIdSchema.nullable(),completionEventId:eventIdSchema.nullable()}).strict();
export const researchSchema:z.ZodType<ResearchProject>=z.discriminatedUnion('phase',[
 researchBase.extend({phase:z.literal('funding'),startedAt:z.never().optional(),completedAt:z.never().optional()}),
 researchBase.extend({phase:z.literal('researching'),startedAt:int,completedAt:z.never().optional()}),
 researchBase.extend({phase:z.literal('completed'),startedAt:int,completedAt:int}),
]).superRefine((p,c)=>{
 const fail=(message:string)=>c.addIssue({code:z.ZodIssueCode.custom,message});
 if(p.qualificationSnapshot.cityId!==p.initiatingCityId||p.qualificationSnapshot.ownerFactionId!==p.ownerFactionId||p.qualificationSnapshot.checkedAt!==p.createdAt)fail('Qualification snapshot identity mismatch');
 if(p.durationSnapshot.durationMs!==Math.round(p.durationSnapshot.baseDurationMs*p.durationSnapshot.academyMultiplier))fail('Duration snapshot inconsistent');
 if(p.qualificationSnapshot.academyLevel!==(p.qualificationSnapshot.buildingLevels.academy??0))fail('Academy snapshot inconsistent');
 if(p.paymentMode==='same-faction-direct'&&(p.qualificationSnapshot.academyLevel<15||!p.qualificationSnapshot.fullModernQualification||!p.qualificationSnapshot.researchCooperation||!['modern-common','modern-civilization'].includes(p.technologyScope)))fail('Research direct contribution scope invalid');
 const commands=new Set<string>();
 for(const x of p.contributions){if(x.sourceFactionId!==p.ownerFactionId||x.at<p.createdAt||commands.has(x.commandId))fail('Illegal research contribution identity');commands.add(x.commandId);
  if(p.paymentMode==='single-city'&&x.sourceCityId!==p.initiatingCityId)fail('Single-city payment source mismatch');}
 for(const r of resourceKeys){if(p.contributedResources[r]>p.requiredResources[r]||p.contributions.reduce((n,x)=>n+x.resources[r],0)!==p.contributedResources[r])fail('Research ledger inconsistent');}
 const full=resourceKeys.every(r=>p.contributedResources[r]===p.requiredResources[r]);
 if(p.phase==='funding'&&(full||p.fundingTransitionCommandId!==null||p.completionEventId!==null))fail('Funding must have no countdown');
 if(p.phase!=='funding'&&(!full||p.fundingTransitionCommandId===null||p.completionEventId===null||p.startedAt<p.createdAt||!commands.has(p.fundingTransitionCommandId)))fail('Research countdown missing funded transition');
 if(p.phase==='completed'&&p.completedAt!==p.startedAt+p.durationSnapshot.durationMs)fail('Research completion timestamp inconsistent');
});
const owner=z.discriminatedUnion('kind',[z.object({kind:z.literal('faction'),factionId:factionIdSchema}).strict(),z.object({kind:z.literal('empire'),empireId:empireIdSchema}).strict()]);
const contributors=z.discriminatedUnion('kind',[z.object({kind:z.literal('same-faction'),factionId:factionIdSchema}).strict(),z.object({kind:z.literal('current-empire-members'),empireId:empireIdSchema}).strict()]);
const shipmentBase=z.object({commandId:commandIdSchema.optional(),shipmentId:id<ShipmentId>('shipment'),projectId:projectIdSchema,sourceFactionId:factionIdSchema,sourceCityId:cityIdSchema,destinationCityId:cityIdSchema,resources:resourcesSchema,dispatchedAt:int,authorizationSnapshot:z.object({sourceCityOwnerFactionId:factionIdSchema,contributorEmpireId:empireIdSchema.nullable(),checkedAt:int}).strict()}).strict();
export const largeProjectSchema:z.ZodType<LargeProject>=z.object({projectId:projectIdSchema,kind:z.enum(['world-wonder','emergency-modernization','technology-transfer']),wonder:z.object({creationCommandId:commandIdSchema,hostOwnerFactionId:factionIdSchema,phase:z.enum(['funding','building','completed']),startedAt:int.nullable(),completionEventId:eventIdSchema.nullable(),completedAt:int.nullable()}).strict().optional(),owner,legalContributors:contributors,paymentMode:z.literal('physical-shipment'),initiatingCityId:cityIdSchema,requiredResources:resourcesSchema,poolResources:resourcesSchema,shipments:z.array(z.discriminatedUnion('phase',[
 shipmentBase.extend({phase:z.literal('in-transit'),arrivedAt:z.never().optional(),arrivalEventId:z.never().optional()}),shipmentBase.extend({phase:z.literal('arrived'),arrivedAt:int,arrivalEventId:eventIdSchema}),])),createdAt:int,durationMs:positive}).strict().superRefine((p,c)=>{
 const fail=(message:string)=>c.addIssue({code:z.ZodIssueCode.custom,message});
 if(p.owner.kind==='empire'&&(!['emergency-modernization','world-wonder'].includes(p.kind)||p.legalContributors.kind!=='current-empire-members'||p.owner.empireId!==p.legalContributors.empireId))fail('Empire project scope invalid');
 if(p.kind==='world-wonder'&&(p.owner.kind!=='empire'||!p.wonder)||p.kind!=='world-wonder'&&p.wonder)fail('Wonder state/owner invalid');
 if(p.owner.kind==='faction'&&(p.legalContributors.kind!=='same-faction'||p.owner.factionId!==p.legalContributors.factionId))fail('Faction project scope invalid');
 if(new Set(p.shipments.map(x=>x.shipmentId)).size!==p.shipments.length)fail('Duplicate shipment');
 for(const s of p.shipments){if(s.projectId!==p.projectId||s.destinationCityId!==p.initiatingCityId||s.dispatchedAt<p.createdAt)fail('Shipment project mismatch');
  if(p.legalContributors.kind==='same-faction'&&s.sourceFactionId!==p.legalContributors.factionId)fail('Illegal contributor');
  if(s.authorizationSnapshot.sourceCityOwnerFactionId!==s.sourceFactionId||s.authorizationSnapshot.checkedAt!==s.dispatchedAt)fail('Shipment authorization mismatch');
  if(p.legalContributors.kind==='current-empire-members'&&s.authorizationSnapshot.contributorEmpireId!==p.legalContributors.empireId)fail('Contributor was not an empire member at dispatch');
  if(s.phase==='arrived'&&s.arrivedAt<s.dispatchedAt)fail('Shipment arrived before dispatch');}
 for(const r of resourceKeys){const arrived=p.shipments.reduce((n,s)=>n+(s.phase==='arrived'?s.resources[r]:0),0);if(arrived!==p.poolResources[r]||arrived>p.requiredResources[r])fail('Project pool excludes in-transit resources');}
});
const fractionalResources=z.object({food:z.number().min(0).max(1),wood:z.number().min(0).max(1),stone:z.number().min(0).max(1),gold:z.number().min(0).max(1)}).strict();
const constructionSchema=z.object({castleCivilizationId:text.optional(),eventId:eventIdSchema,commandId:commandIdSchema,lane:z.union([z.literal(0),z.literal(1)]),lanePreference:z.union([z.literal(0),z.literal(1)]).optional(),target:z.discriminatedUnion('kind',[z.object({kind:z.literal('field'),slot:int.max(17)}).strict(),z.object({kind:z.literal('building'),key:text}).strict()]),action:z.literal('demolish').optional(),fromLevel:int.max(15),toLevel:int.max(15),createdAt:int,startsAt:int,durationMs:positive,qualificationHousing:z.number().nonnegative(),paidResources:resourcesSchema.optional()}).strict();
const economySchema=z.object({lastSettledAt:int,productionRemainder:fractionalResources,milestones:z.array(z.union([z.literal(10000),z.literal(15000),z.literal(20000),z.literal(22000),z.literal(25000),z.literal(30000)])),slots:z.record(int.max(14)),construction:z.array(constructionSchema).max(QUEUE_CAPACITY),promotion:z.object({eventId:eventIdSchema,commandId:commandIdSchema,startedAt:int,durationMs:z.literal(21600000),populationSnapshot:z.number().min(10000),housingSnapshot:z.number().min(10000),townhallSnapshot:int.min(5).max(15)}).strict().nullable(),reservedIncoming:resourcesSchema,settlementEventId:eventIdSchema}).strict();
const logisticsSchema=z.object({shipmentId:id<ShipmentId>('shipment'),projectId:projectIdSchema.optional(),commandId:commandIdSchema,sourceFactionId:factionIdSchema,sourceCityId:cityIdSchema,destinationCityId:cityIdSchema,resources:resourcesSchema,reservedResources:resourcesSchema.optional(),returnCargo:resourcesSchema.optional(),caravans:positive,path:z.array(z.object({x:int.max(383),y:int.max(383)}).strict()).min(1),distance:z.number().finite().nonnegative(),dispatchedAt:int,arrivalAt:int,returnAt:int,arrivalEventId:eventIdSchema,returnEventId:eventIdSchema,phase:z.enum(['outbound','returning']),authorizationSnapshot:z.object({sourceCityOwnerFactionId:factionIdSchema,contributorEmpireId:empireIdSchema.nullable(),checkedAt:int}).strict()}).strict();
const trainingSchema=z.object({commandId:commandIdSchema,eventId:eventIdSchema,ownerFactionId:factionIdSchema,unitId:text,producer:text,producerLevelSnapshot:int.min(1).max(15),lane:z.union([z.literal(0),z.literal(1)]),lanePreference:z.union([z.literal(0),z.literal(1)]).optional(),count:positive,remaining:positive,populationPerUnit:positive,unitCost:resourcesSchema,durationMs:positive,startsAt:int,nextAt:int}).strict();
const militarySchema=z.object({units:z.record(positive),queue:z.array(trainingSchema).max(QUEUE_CAPACITY),unpaidFood:z.number().finite().nonnegative()}).strict();
const ageProjectSchema=z.object({eventId:eventIdSchema,commandId:commandIdSchema,initiatingCityId:cityIdSchema,targetAge:z.union([z.literal(1),z.literal(2),z.literal(3)]),startedAt:int,durationMs:positive,populationSnapshot:z.number().nonnegative(),centerSnapshot:int.min(1).max(15)}).strict();
const autoRuleSchema=z.object({destinationCityId:cityIdSchema,reserve:resourcesSchema,maxCaravans:positive.max(15)}).strict();
const settlementSchema=z.object({projectId:projectIdSchema,commandId:commandIdSchema,ownerFactionId:factionIdSchema,sourceCityId:cityIdSchema,phase:z.enum(['preparing','ready','travelling']),population:z.literal(400),resourcesPaid:resourcesSchema,startedAt:int,prepDurationMs:positive,prepEventId:eventIdSchema,target:z.object({x:int.max(383),y:int.max(383),name:z.string().min(1).max(24)}).strict().optional(),escort:z.record(positive).optional(),arrivalAt:int.optional(),arrivalEventId:eventIdSchema.optional(),path:z.array(z.object({x:int.max(383),y:int.max(383)}).strict()).optional(),distance:z.number().positive().finite().optional()}).strict();
export const eventSchema=z.discriminatedUnion('type',[
 z.object({id:eventIdSchema,at:int,type:z.literal('governance.decide'),cityId:cityIdSchema}).strict(),
 z.object({id:eventIdSchema,at:int,type:z.literal('ai.decide'),factionId:factionIdSchema}).strict(),
 z.object({id:eventIdSchema,at:int,type:z.literal('research.complete'),projectId:researchIdSchema}).strict(),
 z.object({id:eventIdSchema,at:int,type:z.literal('wonder.complete'),projectId:projectIdSchema}).strict(),
 z.object({id:eventIdSchema,at:int,type:z.literal('economy.settle'),cityId:cityIdSchema}).strict(),
 z.object({id:eventIdSchema,at:int,type:z.literal('construction.complete'),cityId:cityIdSchema}).strict(),
 z.object({id:eventIdSchema,at:int,type:z.literal('city.promote.complete'),cityId:cityIdSchema}).strict(),
 z.object({id:eventIdSchema,at:int,type:z.literal('logistics.arrive'),shipmentId:id<ShipmentId>('shipment')}).strict(),
 z.object({id:eventIdSchema,at:int,type:z.literal('logistics.return'),shipmentId:id<ShipmentId>('shipment')}).strict(),
 z.object({id:eventIdSchema,at:int,type:z.literal('age.complete'),factionId:factionIdSchema}).strict(),
 z.object({id:eventIdSchema,at:int,type:z.literal('military.train'),cityId:cityIdSchema}).strict(),
 z.object({id:eventIdSchema,at:int,type:z.literal('settlement.ready'),projectId:projectIdSchema}).strict(),
 z.object({id:eventIdSchema,at:int,type:z.literal('settlement.arrive'),projectId:projectIdSchema}).strict(),
 z.object({id:eventIdSchema,at:int,type:z.literal('fixture.marker'),marker:text}).strict(),
 z.object({id:eventIdSchema,at:int,type:z.literal('politics.end-friendly'),a:text,b:text}).strict(),
 z.object({id:eventIdSchema,at:int,type:z.literal('craftsman.arrive'),craftsmanId:text}).strict(),
 z.object({id:eventIdSchema,at:int,type:z.literal('army.depart'),armyId:armyIdSchema}).strict(),
 z.object({id:eventIdSchema,at:int,type:z.literal('army.arrive'),armyId:armyIdSchema}).strict(),
 z.object({id:eventIdSchema,at:int,type:z.literal('army.return'),armyId:armyIdSchema}).strict(),
 z.object({id:eventIdSchema,at:int,type:z.literal('combat.round'),battleId:battleIdSchema}).strict(),
 z.object({id:eventIdSchema,at:int,type:z.literal('wild.respawn'),siteId:id<WildSiteId>('wild'),generation:int}).strict(),
]);
const exileSchema=z.object({id:id<WildSiteId>('wild'),exile:z.literal(true),sourceFactionId:factionIdSchema,civilizationId:text,createdAt:int,defeatedAt:int.optional(),spawnSlot:int.min(432),generation:z.literal(0),region:int,x:int.max(383),y:int.max(383),resource:z.literal('bandit'),level:z.literal(1),phase:z.enum(['active','cooldown']),defenders:z.record(positive),initialDefenders:z.record(positive),loot:resourcesSchema}).strict();
const craftsmanSchema=z.object({id:text,ownerFactionId:factionIdSchema,civilizationId:text,siteId:id<WildSiteId>('wild'),cityId:cityIdSchema.nullable(),carrierArmyId:armyIdSchema.nullable(),eventId:eventIdSchema.nullable(),destinationCityId:cityIdSchema.nullable(),arrivalAt:int.nullable(),path:z.array(z.object({x:int.max(383),y:int.max(383)}).strict()),departedAt:int,constructionCommandId:text.nullable()}).strict();
const extinctionSchema=z.object({extinct:z.array(factionIdSchema),sites:z.array(exileSchema),craftsmen:z.array(craftsmanSchema),cancelledResearch:z.array(researchSchema),rebirths:int}).strict();
const fixtureMetadata=z.object({appVersion:z.string().regex(/^\d+\.\d+\.\d+$/),schemaVersion:z.literal(FORMAL_SCHEMA_VERSION),contentVersion:z.literal(FORMAL_CONTENT_VERSION),rulesetVersion:z.literal(FORMAL_RULESET_VERSION),worldGeneratorVersion:z.literal(FORMAL_GENERATOR_VERSION),terrainVersion:z.literal(FORMAL_TERRAIN_VERSION)}).strict();
export const metadataSchema=z.union([fixtureMetadata,z.object({appVersion:z.string().regex(/^\d+\.\d+\.\d+$/),schemaVersion:z.literal(3),contentVersion:z.literal(NATIVE_CONTENT_VERSION),rulesetVersion:z.union([z.literal(NATIVE_RULESET_VERSION),z.literal('v86-b5.1')]),worldGeneratorVersion:z.literal(NATIVE_GENERATOR_VERSION),terrainVersion:z.union([z.literal(2),z.literal(NATIVE_TERRAIN_VERSION)])}).strict(),z.object({appVersion:z.string().regex(/^\d+\.\d+\.\d+$/),schemaVersion:z.literal(2),contentVersion:z.literal('lieguo-formal-b4.1'),rulesetVersion:z.enum(['v85-b4.2','v84-b4.1']),worldGeneratorVersion:z.literal(NATIVE_GENERATOR_VERSION),terrainVersion:z.literal(2)}).strict()]);
const worldSchema:z.ZodType<FormalWorld>=z.object({kind:z.literal('formal'),governors:z.array(governorSchema).optional(),autonomy:autonomySchema.optional(),metadata:metadataSchema,campaignId:id<CampaignId>('campaign'),fixture:z.boolean(),developer:z.object({enabled:z.boolean(),speed:z.union([z.literal(50),z.literal(100)])}).strict().optional(),extinction:extinctionSchema.optional(),politics:politicsSchema.optional(),worldLayer:z.object({regionSize:z.literal(32),mountains:z.object({revision:z.literal(1),sprites:z.array(z.object({x:int.max(383),y:int.max(383),variant:int.max(3),width:z.number().finite().positive().max(300),height:z.number().finite().positive().max(300),flip:z.boolean()}).strict()).max(512)}).strict().optional(),terrain:z.string().regex(/^[LFRWM]+$/),wildSites:z.array(z.object({id:id<WildSiteId>('wild'),spawnSlot:int.max(431),generation:int,region:int.max(143),x:int.max(383),y:int.max(383),resource:z.enum(['food','wood','stone','gold','bandit']),level:int.min(1).max(10),...wildCombatShape}).strict())}).strict().optional(),seed:int.max(4294967295),speed:z.union([z.literal(1),z.literal(3),z.literal(6),z.literal(10),z.literal(25)]),time:int,offlineHours:z.union([z.literal(0),z.literal(1),z.literal(4),z.literal(8),z.literal(12)]).optional(),clockMode:z.enum(['foreground','offline']).optional(),dimensions:z.object({width:positive,height:positive}).strict(),playerFactionId:factionIdSchema,revision:int,sequences:z.object({event:positive,report:positive,project:positive}).strict(),
 factions:z.array(z.object({id:factionIdSchema,name:text,civilizationId:text,empireId:empireIdSchema.nullable(),modernQualification:z.enum(['none','full']),researchCooperation:z.boolean(),techIds:z.array(text),researchQueue:researchIdSchema.nullable(),role:z.enum(['player','ai']).optional(),age:z.union([z.literal(0),z.literal(1),z.literal(2),z.literal(3)]).optional(),ageQueue:ageProjectSchema.nullable().optional(),protectionUntil:int.optional()}).strict()),
 cities:z.array(z.object({castleCivilizationId:z.enum(["civ_zhongguo","civ_byzantium","civ_frankia","civ_britannia","civ_japan","civ_mongolia"]).optional(),id:cityIdSchema,ownerFactionId:factionIdSchema,name:text,x:int,y:int,population:z.number().nonnegative().finite(),housing:int,stock:resourcesSchema,buildings:z.record(int),military:militarySchema.optional(),autoLogistics:z.array(autoRuleSchema).optional(),economy:economySchema.optional(),fields:z.array(z.object({slot:int.max(17),resource:z.enum(['food','wood','stone','gold']),level:int.max(15)}).strict()).optional(),wallLevel:int.max(15).optional(),cityPromotionCompleted:z.boolean().optional(),integrationWorkHours:z.number().nonnegative().finite().optional(),integrationTotalWorkHours:z.number().nonnegative().finite().optional(),startingCity:z.boolean().optional(),housingShortage:z.literal(true).optional(),developerResources:z.literal(true).optional()}).strict()),
 armies:z.array(formalArmySchema),combat:combatSchema.optional(),events:z.array(eventSchema),commandReceipts:z.array(receiptSchema),completionReceipts:z.array(z.object({eventId:eventIdSchema,projectId:researchIdSchema,at:int}).strict()),researchProjects:z.array(researchSchema),largeProjects:z.array(largeProjectSchema),logistics:z.array(logisticsSchema).optional(),settlements:z.array(settlementSchema).optional(),colonizationUnits:z.array(z.object({id:z.string().regex(/^colonization:[A-Za-z0-9_.-]{1,100}$/),kind:z.literal('colonization'),quantity:z.literal(1),ownerFactionId:factionIdSchema,sourceCityId:cityIdSchema,projectId:projectIdSchema,phase:z.enum(['ready','travelling']),population:z.literal(400),producedAt:int}).strict()).optional(),
}).strict().superRefine((w,c)=>{
 const fail=(message:string)=>c.addIssue({code:z.ZodIssueCode.custom,message});
 // Retain any matching applied issuer, including malformed duplicate IDs, just as the old .some checks did.
 const appliedReceipts=new Map<CommandId,Set<FactionId>>();
 for(const r of w.commandReceipts)if(r.disposition==='applied'){
  let issuers=appliedReceipts.get(r.commandId);if(!issuers){issuers=new Set();appliedReceipts.set(r.commandId,issuers);}issuers.add(r.issuerId);
 }
 const hasAppliedReceipt=(id:CommandId,issuer?:FactionId)=>issuer===undefined?appliedReceipts.has(id):appliedReceipts.get(id)?.has(issuer)??false;
 validateCombatContracts(w,fail,hasAppliedReceipt);
 validatePolitics(w,fail);validateWonders(w,fail);
 validateAutonomy(w,fail);validateGovernance(w,fail);
 if(w.extinction){const x=w.extinction,unique=(v:readonly string[])=>new Set(v).size===v.length;if(!unique(x.extinct)||!unique(x.sites.map(s=>s.id))||!unique(x.craftsmen.map(c=>c.id)))fail('Extinction duplicate identity');for(const id of x.extinct)if(!w.factions.some(f=>f.id===id)||w.cities.some(c=>c.ownerFactionId===id)||w.factions.find(f=>f.id===id)?.researchQueue!==null)fail('Extinct faction ownership invalid');for(const s of x.sites){if(!w.factions.some(f=>f.id===s.sourceFactionId&&f.civilizationId===s.civilizationId)||s.createdAt>w.time||Object.keys(s.initialDefenders).some(id=>!UNIT_CATALOG[id])||Object.keys(s.defenders).some(id=>!UNIT_CATALOG[id])||s.phase==='active'&&(s.defeatedAt!==undefined||!buildable(terrainAt(w,s.x,s.y))||w.cities.some(c=>c.x===s.x&&c.y===s.y)||w.worldLayer?.wildSites.some(t=>t.phase!=='cooldown'&&t.x===s.x&&t.y===s.y)||x.sites.some(t=>t!==s&&t.phase==='active'&&t.x===s.x&&t.y===s.y))||s.phase==='cooldown'&&(s.defeatedAt===undefined||Object.keys(s.defenders).length))fail('Exile lifecycle invalid');}for(const c of x.craftsmen){if(!w.factions.some(f=>f.id===c.ownerFactionId)||!x.sites.some(s=>s.id===c.siteId&&s.defeatedAt!==undefined&&s.civilizationId===c.civilizationId)||c.carrierArmyId&&!w.armies.some(a=>a.id===c.carrierArmyId&&a.ownerFactionId===c.ownerFactionId)||c.cityId&&!w.cities.some(a=>a.id===c.cityId&&a.ownerFactionId===c.ownerFactionId)||c.eventId&&!w.events.some(e=>e.type==='craftsman.arrive'&&e.id===c.eventId&&e.craftsmanId===c.id&&e.at===c.arrivalAt)||c.constructionCommandId&&!w.cities.some(a=>a.economy?.construction.some(j=>j.commandId===c.constructionCommandId&&craftsmanForConstruction(w,a,j)?.id===c.id)))fail('Craftsman reference invalid');}for(const e of w.events)if(e.type==='craftsman.arrive'&&!x.craftsmen.some(c=>c.eventId===e.id&&c.id===e.craftsmanId))fail('Dangling craftsman event');}

 for(const city of w.cities)for(const job of city.economy?.construction??[])if(job.castleCivilizationId&&!craftsmanForConstruction(w,city,job))fail('Special castle authorization invalid');

 const unique=(values:readonly string[])=>new Set(values).size===values.length;
 if(w.fixture){if(w.metadata.schemaVersion!==1||w.worldLayer)fail('Fixture contract mismatch');}
 else {
  if(![2,3].includes(w.metadata.schemaVersion)||w.dimensions.width!==384||w.dimensions.height!==384||!w.worldLayer||w.worldLayer.terrain.length!==384*384)fail('Native world contract mismatch');
  if(w.factions.length!==100||w.factions.filter(f=>f.role==='player').length!==1||w.factions.filter(f=>f.role==='ai').length!==99||w.factions.find(f=>f.id===w.playerFactionId)?.role!=='player')fail('Native faction roles invalid');
  if(w.metadata.terrainVersion===3&&!w.worldLayer?.mountains)fail('Formal mountain profile missing');
  if(w.worldLayer?.mountains){const anchors=new Set<string>();for(const d of w.worldLayer.mountains.sprites){const key=d.x+','+d.y;if(anchors.has(key)||terrainAt(w,d.x,d.y)!=='mountain')fail('Mountain anchor invalid');anchors.add(key);for(const p of mountainFootprint(d))if(terrainAt(w,p.x,p.y)!=='mountain')fail('Mountain footprint must block terrain');}}
  const occupied=new Set<number>();
  for(const n of w.cities){const key=n.y*w.dimensions.width+n.x;if(occupied.has(key)||!buildable(terrainAt(w,n.x,n.y)))fail('Illegal city terrain/overlap');occupied.add(key);if(!n.fields||n.fields.length!==18||!unique(n.fields.map(p=>String(p.slot)))||n.wallLevel===undefined||n.cityPromotionCompleted===undefined||n.integrationWorkHours===undefined||n.startingCity===undefined)fail('City formal fields missing');}
  if(w.worldLayer){if(w.worldLayer.wildSites.length!==432||!unique(w.worldLayer.wildSites.map(s=>s.id))||!unique(w.worldLayer.wildSites.map(s=>String(s.spawnSlot))))fail('Wild slot identity invalid');for(const s of w.worldLayer.wildSites){if(s.phase==='cooldown')continue;const key=s.y*384+s.x;if(occupied.has(key)||!buildable(terrainAt(w,s.x,s.y))||s.region!==Math.floor(s.y/32)*12+Math.floor(s.x/32))fail('Illegal wild site terrain/overlap/index');occupied.add(key);}}
 }
 const factions=new Set(w.factions.map(f=>f.id)),cities=new Set(w.cities.map(n=>n.id)),pending=new Set(w.events.map(e=>e.id)),done=new Set(w.completionReceipts.map(e=>e.eventId));
 for(const ids of [w.factions.map(x=>x.id),w.cities.map(x=>x.id),w.armies.map(x=>x.id),w.events.map(x=>x.id),w.commandReceipts.map(x=>x.commandId),w.completionReceipts.map(x=>x.eventId),w.researchProjects.map(x=>x.projectId),w.largeProjects.map(x=>x.projectId)])if(!unique(ids))fail('Duplicate typed identity');
 if(!factions.has(w.playerFactionId))fail('Missing player Faction');
 for(const n of w.cities)if(!factions.has(n.ownerFactionId)||n.x>=w.dimensions.width||n.y>=w.dimensions.height)fail('City ownership or coordinate invalid');
 const matches=(id:EventId,type:FormalEvent['type'],at?:number)=>w.events.some(e=>e.id===id&&e.type===type&&(at===undefined||e.at===at));
 if(!w.fixture){
  for(const f of w.factions){if(!Object.hasOwn(BLACKSMITH_CAPS,f.civilizationId))fail('Unknown native civilization');if(f.ageQueue===undefined)fail('Age queue missing');const p=f.ageQueue;if(p){const defs=[{p:500,c:3,h:4},{p:2000,c:5,h:8},{p:10000,c:10,h:16}],d=defs[p.targetAge-1];if(p.targetAge!==(f.age??0)+1||p.durationMs!==d.h*3600000||p.populationSnapshot<d.p||p.centerSnapshot<d.c||!matches(p.eventId,'age.complete',p.startedAt+p.durationMs)||!cities.has(p.initiatingCityId)||!hasAppliedReceipt(p.commandId,f.id))fail('Age project contract invalid');}
   for(const id of f.techIds)if(!TECH_CATALOG[id])fail('Unknown native technology');
  }
  for(const p of w.researchProjects){const d=TECH_CATALOG[p.techId],q=p.qualificationSnapshot,f=w.factions.find(f=>f.id===p.ownerFactionId);if(!d){fail('Unknown research catalog entry');continue;}
   const snapLevel=(kind:string)=>Math.max(0,...Object.entries(q.buildingLevels).filter(([k])=>k===kind||k.startsWith(kind+'.')).map(([,v])=>v));
   if(p.technologyScope!==d.scope||d.civilizationId&&d.civilizationId!==f?.civilizationId||!d.prerequisites.every(t=>q.prerequisiteTechIds.includes(t))||Object.entries(d.buildings).some(([k,lv])=>snapLevel(k)<lv)||!hasAppliedReceipt(p.creationCommandId,p.ownerFactionId))fail('Research catalog/qualification identity invalid');
   const discount=q.prerequisiteTechIds.includes('civilization.kaogong')&&d.category!=='elite'&&d.category!=='civilization'?.85:1,mult=d.category==='elite'?1:1-.015*(Math.max(1,q.academyLevel)-1);
   if(p.durationSnapshot.baseDurationMs!==d.baseDurationMs||Math.abs(p.durationSnapshot.academyMultiplier-mult)>1e-12||resourceKeys.some(r=>p.requiredResources[r]!==Math.round(d.cost[r]*discount))||p.paymentMode!==(['modern-common','modern-civilization'].includes(d.scope)?'same-faction-direct':'single-city')||d.scope!=='traditional'&&!q.fullModernQualification)fail('Research formal payment/duration contract invalid');
   if(d.category==='blacksmith'&&f){const [,line,tier]=d.id.split('.');if(+tier>BLACKSMITH_CAPS[f.civilizationId][BLACKSMITH_LINES.indexOf(line as typeof BLACKSMITH_LINES[number])])fail('Civilization blacksmith cap exceeded');}
  }
  for(const n of w.cities){if(n.population>n.housing&&!n.housingShortage)fail('Population exceeds housing');const m=n.military;if(!m||!n.autoLogistics){fail('Native military/auto logistics missing');continue;}
   for(const id of Object.keys(m.units))if(!UNIT_CATALOG[id])fail('Unknown unit identity');
   for(const j of m.queue){const u=UNIT_CATALOG[j.unitId];if(!u||j.remaining>j.count||j.populationPerUnit!==u.population||j.producer!==u.producer||!matches(j.eventId,'military.train',j.nextAt)||j.lane===1&&!n.economy?.milestones.includes(20000)||!hasAppliedReceipt(j.commandId,j.ownerFactionId))fail('Military queue contract invalid');}
   if(!unique(m.queue.map(j=>j.commandId)))fail('Duplicate training job');
   for(const rule of n.autoLogistics)if(!cities.has(rule.destinationCityId)||rule.destinationCityId===n.id)fail('Auto logistics destination missing');
  }
  if(w.settlements===undefined||!unique((w.settlements??[]).map(p=>p.projectId)))fail('Settlement identity invalid');const reserved=new Set<number>();
  for(const p of w.settlements??[]){if(!cities.has(p.sourceCityId)||!factions.has(p.ownerFactionId)||p.startedAt>w.time||resourceKeys.some(r=>p.resourcesPaid[r]!==({food:6000,wood:8000,stone:12000,gold:4000})[r])||!hasAppliedReceipt(p.commandId,p.ownerFactionId))fail('Settlement funding/owner contract invalid');
   if(p.phase==='preparing'&&!matches(p.prepEventId,'settlement.ready',p.startedAt+p.prepDurationMs)||p.phase==='ready'&&p.startedAt+p.prepDurationMs>w.time)fail('Settlement preparation event invalid');
   if(p.phase==='travelling'){if(!p.target||!p.escort||!p.arrivalEventId||!p.arrivalAt||!p.distance||!p.path||!matches(p.arrivalEventId,'settlement.arrive',p.arrivalAt))fail('Travelling settlement missing route/event');else{const key=p.target.y*384+p.target.x;if(reserved.has(key)||!buildable(terrainAt(w,p.target.x,p.target.y))||w.cities.some(c=>c.x===p.target!.x&&c.y===p.target!.y)||w.worldLayer!.wildSites.some(s=>s.phase!=='cooldown'&&s.x===p.target!.x&&s.y===p.target!.y))fail('Settlement coordinate reservation invalid');reserved.add(key);let count=0;for(const [id,n] of Object.entries(p.escort)){const u=UNIT_CATALOG[id];if(!u||u.combatClass==='siege')fail('Illegal settlement escort');else if(['infantry','ranged','cavalry','mounted-ranged'].includes(u.combatClass))count+=n;}if(count<20)fail('Settlement minimum escort invalid');}}
   else if(p.target||p.escort||p.arrivalAt||p.arrivalEventId||p.path||p.distance)fail('Non-travelling settlement has geometry');
   if(p.phase!=='travelling'&&(w.settlements??[]).filter(q=>q.sourceCityId===p.sourceCityId&&q.phase!=='travelling').length>1)fail('Only one preparing/ready settlement per city');
  }
  if(w.metadata.schemaVersion===3||w.metadata.rulesetVersion==='v85-b4.2'){
   const units=w.colonizationUnits;if(!units||!unique(units.map(u=>u.id))||!unique(units.map(u=>u.projectId)))fail('Colonization unit registry missing/duplicate');
   for(const u of units??[]){const p=w.settlements?.find(p=>p.projectId===u.projectId);if(!p||p.phase!==u.phase||p.sourceCityId!==u.sourceCityId||p.ownerFactionId!==u.ownerFactionId||u.id!=='colonization:'+u.projectId.slice(8)||u.producedAt!==p.startedAt+p.prepDurationMs||u.producedAt>w.time)fail('Colonization unit/project contract invalid');}
   for(const p of w.settlements??[])if((units??[]).filter(u=>u.projectId===p.projectId).length!==(p.phase==='preparing'?0:1))fail('Settlement must own exactly one produced unit');
  }
  for(const e of w.events){if(e.type==='age.complete'&&!w.factions.some(f=>f.id===e.factionId&&f.ageQueue?.eventId===e.id)||e.type==='military.train'&&!w.cities.some(c=>c.id===e.cityId&&c.military?.queue.some(j=>j.eventId===e.id))||e.type==='settlement.ready'&&!(w.settlements??[]).some(p=>p.projectId===e.projectId&&p.phase==='preparing'&&p.prepEventId===e.id)||e.type==='settlement.arrive'&&!(w.settlements??[]).some(p=>p.projectId===e.projectId&&p.phase==='travelling'&&p.arrivalEventId===e.id))fail('Dangling development event');}
  for(const n of w.cities){if(n.developerResources&&(!w.developer?.enabled||n.ownerFactionId!==w.playerFactionId))fail('Developer stock scope invalid');const e=n.economy;if(!e){fail('Native economy missing');continue;}
   if(e.lastSettledAt>w.time||Object.keys(e.slots).length>15||!unique(Object.values(e.slots).map(String))||!unique(e.milestones.map(String))||!matches(e.settlementEventId,'economy.settle'))fail('Economy anchor/slots/milestones/event invalid');
   if(Object.hasOwn(n.buildings,'wall')||Object.hasOwn(e.slots,'wall'))fail('Wall must use wallLevel only, without a free-building slot');
   let wall=n.wallLevel??0,wallEnd=0;for(const job of e.construction.filter(j=>j.target.kind==='building'&&j.target.key==='wall')){if(job.fromLevel!==wall||job.toLevel!==wall+1||job.toLevel>15||job.startsAt<wallEnd)fail('Wall construction level/dependency mismatch');wall=job.toLevel;wallEnd=job.startsAt+job.durationMs;}
   for(const [key,lv] of Object.entries(n.buildings)){const kind=buildingKind(key);if(!kind||lv>BUILDING_CATALOG[kind].maxLevel||key!=='center'&&e.slots[key]===undefined)fail('Building identity/level/slot mismatch');}
   for(const key of Object.keys(e.slots))if(!Object.hasOwn(n.buildings,key))fail('Dangling building slot');
   for(const r of resourceKeys){const reserved=(w.logistics??[]).filter(t=>!t.projectId&&t.destinationCityId===n.id&&t.phase==='outbound').reduce((v,t)=>v+(t.reservedResources??t.resources)[r],0);if(e.reservedIncoming[r]!==reserved||n.stock[r]+reserved>storageCapacity(n))fail('Stock/capacity/reservation ledger invalid');}
   for(const job of e.construction){if((job.action==='demolish'?(job.toLevel!==0||job.target.kind!=='building'||job.target.key==='center'||job.target.key==='wall'||!e.slots.hasOwnProperty(job.target.key)||e.construction.some(x=>x!==job&&x.target.kind==='building'&&job.target.kind==='building'&&x.target.key===job.target.key)):job.toLevel!==job.fromLevel+1)||job.startsAt<job.createdAt||!matches(job.eventId,'construction.complete',job.startsAt+job.durationMs)||job.lane===1&&!e.milestones.includes(15000)||!hasAppliedReceipt(job.commandId))fail('Construction contract mismatch');}
   if(e.promotion&&!matches(e.promotion.eventId,'city.promote.complete',e.promotion.startedAt+e.promotion.durationMs))fail('City promotion event missing');
  }
  if(w.logistics===undefined||!unique((w.logistics??[]).map(t=>t.shipmentId)))fail('Logistics identity invalid');
  for(const t of w.logistics??[]){if(resourceKeys.some(r=>(t.reservedResources?.[r]??t.resources[r])>t.resources[r]||(t.returnCargo?.[r]??0)>t.resources[r]))fail('Logistics cargo/booking exceeds dispatch');if(!cities.has(t.sourceCityId)||!cities.has(t.destinationCityId)||!factions.has(t.sourceFactionId)||t.dispatchedAt>w.time||t.arrivalAt<=t.dispatchedAt||t.returnAt-t.arrivalAt!==t.arrivalAt-t.dispatchedAt||t.authorizationSnapshot.checkedAt!==t.dispatchedAt||t.authorizationSnapshot.sourceCityOwnerFactionId!==t.sourceFactionId||t.caravans!==Math.ceil(resourceKeys.reduce((n,r)=>n+t.resources[r],0)/2000)||!matches(t.returnEventId,'logistics.return',t.returnAt)||t.phase==='outbound'&&!matches(t.arrivalEventId,'logistics.arrive',t.arrivalAt)||t.phase==='returning'&&t.arrivalAt>w.time||!hasAppliedReceipt(t.commandId,t.sourceFactionId))fail('Logistics contract invalid');}
  for(const event of w.events){if(event.type==='economy.settle'&&!w.cities.some(n=>n.id===event.cityId&&n.economy?.settlementEventId===event.id)||event.type==='construction.complete'&&!w.cities.some(n=>n.id===event.cityId&&n.economy?.construction.some(j=>j.eventId===event.id))||event.type==='city.promote.complete'&&!w.cities.some(n=>n.id===event.cityId&&n.economy?.promotion?.eventId===event.id)||event.type==='logistics.arrive'&&!(w.logistics??[]).some(t=>t.shipmentId===event.shipmentId&&t.phase==='outbound'&&t.arrivalEventId===event.id)||event.type==='logistics.return'&&!(w.logistics??[]).some(t=>t.shipmentId===event.shipmentId&&t.returnEventId===event.id))fail('Dangling economy event');}
 }
 for(const a of w.armies)if(!factions.has(a.ownerFactionId)||!cities.has(a.originCityId))fail('Army ownership invalid');
 for(const r of w.commandReceipts)if(!factions.has(r.issuerId)||r.committedRevision>w.revision)fail('Command receipt revision invalid');
 for(const e of w.events)if(e.at<w.time||done.has(e.id))fail('Event queue inconsistent');
 for(const p of w.researchProjects){
  const f=w.factions.find(f=>f.id===p.ownerFactionId);if(!f||p.createdAt>w.time)fail('Research owner missing');
  for(const x of p.contributions)if(!hasAppliedReceipt(x.commandId,x.sourceFactionId))fail('Contribution command receipt missing');
  const active=w.researchProjects.filter(x=>x.ownerFactionId===p.ownerFactionId&&x.phase!=='completed');if(active.length>1)fail('Only one Faction research queue');
  if(p.phase==='completed'){if(!f?.techIds.includes(p.techId)||!w.completionReceipts.some(r=>r.eventId===p.completionEventId&&r.projectId===p.projectId&&r.at===p.completedAt)||p.completedAt>w.time)fail('Completion receipt missing');}
  else if(f?.researchQueue!==p.projectId)fail('Research queue ownership mismatch');
  if(p.phase==='researching'&&(!pending.has(p.completionEventId!)||!w.events.some(e=>e.id===p.completionEventId&&e.type==='research.complete'&&e.projectId===p.projectId&&e.at===p.startedAt+p.durationSnapshot.durationMs)))fail('Research completion event missing');
 }
 for(const f of w.factions){if(!unique(f.techIds))fail('Duplicate technology');if(f.researchQueue!==null&&!w.researchProjects.some(p=>p.projectId===f.researchQueue&&p.ownerFactionId===f.id&&p.phase!=='completed'))fail('Dangling research queue');}
 for(const e of w.events){
  const suffix=e.id.slice(6);if(/^\d{16}$/.test(suffix)&&Number(suffix)>=w.sequences.event)fail('Event sequence would reuse an ID');
  if(e.type==='research.complete'&&!w.researchProjects.some(p=>p.projectId===e.projectId&&p.phase==='researching'&&p.completionEventId===e.id&&e.at===p.startedAt+p.durationSnapshot.durationMs))fail('Dangling or mismatched project event');
 }
 for(const r of w.completionReceipts)if(!w.researchProjects.some(p=>p.projectId===r.projectId&&p.phase==='completed'&&p.completionEventId===r.eventId&&p.completedAt===r.at)||r.at>w.time)fail('Invalid completion receipt');
 for(const p of w.largeProjects){
  if(p.owner.kind==='faction'&&!factions.has(p.owner.factionId))fail('Large project owner missing');
  // B1 abstract fixtures can model an empire before B6 politics; actual worlds may never persist an orphan.
  const empireOwner=p.owner.kind==='empire'?p.owner.empireId:null;
  if(p.kind!=='world-wonder'&&empireOwner&&(!w.fixture||w.politics)&&!w.politics?.empires.some(e=>e.id===empireOwner))fail('Large project empire owner missing');
 }
});
/** Validation is pure: strict shape and invariants, with no defaults/coercion/transforms/repairs. */
export function validateFormalWorld(value:unknown):FormalWorld {return worldSchema.parse(value);}
export const reportSchema:z.ZodType<FormalReport>=z.object({id:id<ReportId>('report'),sequence:positive,campaignId:id<CampaignId>('campaign'),ownerFactionId:factionIdSchema,at:int,realAt:int.optional(),clockSpeed:positive.max(200).optional(),read:z.boolean().optional(),category:z.enum(['system','research','battle','scout','diplomacy']),title:text,text:z.string().max(2000),battle:battleReportSchema.optional()}).strict().superRefine((r,c)=>{if((r.category==='battle'||r.category==='scout')!==!!r.battle||r.battle&&(r.category==='scout')!==(r.battle.mission==='scout'))c.addIssue({code:'custom',message:'Report category/payload mismatch'});});
export const orderSchema:z.ZodType<FormalOrder>=z.object({commandId:commandIdSchema,campaignId:id<CampaignId>('campaign'),issuerId:factionIdSchema,issuedWorldTime:int,expectedRevision:int,payload:z.discriminatedUnion('type',[
 governanceOrderShape,
 z.object({type:z.literal('wonder.start'),cityId:cityIdSchema,hostCityId:cityIdSchema}).strict(),
 z.object({type:z.literal('wonder.ship'),cityId:cityIdSchema,projectId:projectIdSchema,resources:resourcesSchema}).strict(),
 ...armyOrderShapes,
 z.object({type:z.literal('player.rebirth'),cityId:cityIdSchema,candidate:int.max(2),name:text.max(24)}).strict(),
 z.object({type:z.literal('craftsman.move'),cityId:cityIdSchema,craftsmanId:text,destinationCityId:cityIdSchema}).strict(),
 z.object({type:z.literal('craftsman.castle'),cityId:cityIdSchema,craftsmanId:text}).strict(),
 ...politicsOrderShapes,
 z.object({type:z.literal('campaign.configure'),cityId:cityIdSchema,speed:z.union([z.literal(1),z.literal(3),z.literal(6),z.literal(10),z.literal(25)]),offlineHours:z.union([z.literal(0),z.literal(1),z.literal(4),z.literal(8),z.literal(12)])}).strict(),
 z.object({type:z.literal('developer.configure'),cityId:cityIdSchema,enabled:z.boolean(),speed:z.union([z.literal(50),z.literal(100)]),shield:z.boolean().optional()}).strict(),
 z.object({type:z.literal('building.demolish'),cityId:cityIdSchema,key:text}).strict(),
 z.object({type:z.literal('field.upgrade'),cityId:cityIdSchema,slot:int.max(17),lane:z.union([z.literal(0),z.literal(1)]).optional()}).strict(),
 z.object({type:z.literal('building.upgrade'),cityId:cityIdSchema,key:text,lane:z.union([z.literal(0),z.literal(1)]).optional(),slot:int.max(14).optional()}).strict(),
 z.object({type:z.literal('construction.cancel'),cityId:cityIdSchema,constructionCommandId:commandIdSchema}).strict(),
 z.object({type:z.literal('city.promote'),cityId:cityIdSchema}).strict(),
 z.object({type:z.literal('logistics.dispatch'),cityId:cityIdSchema,destinationCityId:cityIdSchema,resources:resourcesSchema}).strict(),
 z.object({type:z.literal('research.start'),cityId:cityIdSchema,techId:text}).strict(),
 z.object({type:z.literal('age.start'),cityId:cityIdSchema}).strict(),
 z.object({type:z.literal('military.recruit'),cityId:cityIdSchema,unitId:text,count:positive,lane:z.union([z.literal(0),z.literal(1)]).optional()}).strict(),
 z.object({type:z.literal('military.cancel'),cityId:cityIdSchema,trainingCommandId:commandIdSchema}).strict(),
 z.object({type:z.literal('military.disband'),cityId:cityIdSchema,unitId:text,count:positive}).strict(),
 z.object({type:z.literal('settlement.prepare'),cityId:cityIdSchema}).strict(),
 z.object({type:z.literal('settlement.cancel'),cityId:cityIdSchema}).strict(),
 z.object({type:z.literal('settlement.dispatch'),cityId:cityIdSchema,x:int.max(383),y:int.max(383),name:z.string().min(1).max(24).regex(/^[^\x00-\x1f\x7f]+$/),escort:z.record(int)}).strict(),
 z.object({type:z.literal('logistics.auto.set'),cityId:cityIdSchema,rules:z.array(autoRuleSchema)}).strict(),
 z.object({type:z.literal('city.rename'),cityId:cityIdSchema,name:z.string().min(1).max(24).regex(/^[^\x00-\x1f\x7f]+$/)}).strict(),
 z.object({type:z.literal('research.contribute'),projectId:researchIdSchema,cityId:cityIdSchema,resources:resourcesSchema}).strict(),
])}).strict();
