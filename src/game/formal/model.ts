import type { ArmyId, CampaignId, CityId, CommandId, EmpireId, EventId, FactionId, ProjectId, ReportId, ResearchProjectId, ShipmentId, WildSiteId } from './ids';
import type { VersionMetadata } from './versions';
import type {ArmyCommand,ArmyMissionState,BattleReportPayload,CombatState} from './combatModel';
export const resourceKeys = ['food','wood','stone','gold'] as const;
export type Resources = Record<typeof resourceKeys[number], number>;
export const zeroResources = (): Resources => ({food:0,wood:0,stone:0,gold:0});
export type ResourceField = {slot:number;resource:typeof resourceKeys[number];level:number};
export type TerrainClass = 'land'|'forest'|'river'|'water'|'mountain';
export type WorldLayer = {regionSize:32;terrain:string;mountains?:import('./mountains').MountainProfile;wildSites:WildSite[]};
export type WildSite = {id:WildSiteId;spawnSlot:number;generation:number;region:number;x:number;y:number;resource:typeof resourceKeys[number]|'bandit';level:number;phase?:'active'|'cooldown';defenders?:Record<string,number>;initialDefenders?:Record<string,number>;loot?:Resources;style?:number;budget?:number;respawnAt?:number;respawnEventId?:EventId};
export type Construction = {castleCivilizationId?:string;eventId:EventId;commandId:CommandId;lane:0|1;lanePreference?:0|1;target:{kind:'field';slot:number}|{kind:'building';key:string};action?:'demolish';fromLevel:number;toLevel:number;createdAt:number;startsAt:number;durationMs:number;qualificationHousing:number;paidResources?:Resources};
export type CityPromotion = {eventId:EventId;commandId:CommandId;startedAt:number;durationMs:number;populationSnapshot:number;housingSnapshot:number;townhallSnapshot:number};
export type CityEconomy = {lastSettledAt:number;productionRemainder:Resources;milestones:number[];slots:Record<string,number>;construction:Construction[];promotion:CityPromotion|null;reservedIncoming:Resources;settlementEventId:EventId};
export type LogisticsShipment = {shipmentId:ShipmentId;projectId?:ProjectId;commandId:CommandId;sourceFactionId:FactionId;sourceCityId:CityId;destinationCityId:CityId;resources:Resources;reservedResources?:Resources;returnCargo?:Resources;caravans:number;path:{x:number;y:number}[];distance:number;dispatchedAt:number;arrivalAt:number;returnAt:number;arrivalEventId:EventId;returnEventId:EventId;phase:'outbound'|'returning';authorizationSnapshot:{sourceCityOwnerFactionId:FactionId;contributorEmpireId:EmpireId|null;checkedAt:number}};
export type TrainingJob={commandId:CommandId;eventId:EventId;ownerFactionId:FactionId;unitId:string;producer:string;producerLevelSnapshot:number;lane:0|1;lanePreference?:0|1;count:number;remaining:number;populationPerUnit:number;unitCost:Resources;durationMs:number;startsAt:number;nextAt:number};
export type CityMilitary={units:Record<string,number>;queue:TrainingJob[];unpaidFood:number};
export type AgeProject={eventId:EventId;commandId:CommandId;initiatingCityId:CityId;targetAge:1|2|3;startedAt:number;durationMs:number;populationSnapshot:number;centerSnapshot:number};
export type Settlement={projectId:ProjectId;commandId:CommandId;ownerFactionId:FactionId;sourceCityId:CityId;phase:'preparing'|'ready'|'travelling';population:400;resourcesPaid:Resources;startedAt:number;prepDurationMs:number;prepEventId:EventId;target?:{x:number;y:number;name:string};escort?:Record<string,number>;arrivalAt?:number;arrivalEventId?:EventId;path?:{x:number;y:number}[];distance?:number};
export type AutoLogistics={destinationCityId:CityId;reserve:Resources;maxCaravans:number};
/** Castle-produced civilian carrier; deliberately separate from combat catalogs and military queues. */
export type ColonizationUnit={id:string;kind:'colonization';quantity:1;ownerFactionId:FactionId;sourceCityId:CityId;projectId:ProjectId;phase:'ready'|'travelling';population:400;producedAt:number};
export type FormalCity = {castleCivilizationId?:string;housingShortage?:true;developerResources?:true;id:CityId;ownerFactionId:FactionId;name:string;x:number;y:number;population:number;housing:number;stock:Resources;buildings:Record<string,number>;military?:CityMilitary;autoLogistics?:AutoLogistics[];economy?:CityEconomy;fields?:ResourceField[];wallLevel?:number;cityPromotionCompleted?:boolean;integrationWorkHours?:number;integrationTotalWorkHours?:number;startingCity?:boolean};
export type FormalFaction = {protectionUntil?:number;id:FactionId;name:string;civilizationId:string;empireId:EmpireId|null;modernQualification:'none'|'full';researchCooperation:boolean;techIds:string[];researchQueue:ResearchProjectId|null;role?:'player'|'ai';age?:0|1|2|3;ageQueue?:AgeProject|null};
export type FormalArmy = {id:ArmyId;ownerFactionId:FactionId;originCityId:CityId}&Partial<ArmyMissionState>;
export type QualificationSnapshot = {checkedAt:number;cityId:CityId;ownerFactionId:FactionId;academyLevel:number;buildingLevels:Record<string,number>;prerequisiteTechIds:string[];fullModernQualification:boolean;researchCooperation:boolean};
export type DurationSnapshot = {baseDurationMs:number;academyMultiplier:number;durationMs:number};
export type ResearchContribution = {commandId:CommandId;sourceFactionId:FactionId;sourceCityId:CityId;resources:Resources;at:number};
type ResearchBase = {
  projectId:ResearchProjectId;techId:string;technologyScope:'modern-common'|'modern-civilization'|'traditional'|'research-cooperation';ownerFactionId:FactionId;initiatingCityId:CityId;
  paymentMode:'single-city'|'same-faction-direct';requiredResources:Resources;contributedResources:Resources;
  contributions:ResearchContribution[];createdAt:number;qualificationSnapshot:QualificationSnapshot;durationSnapshot:DurationSnapshot;
  creationCommandId:CommandId;fundingTransitionCommandId:CommandId|null;completionEventId:EventId|null;
};
export type ResearchProject = ResearchBase & (
  | {phase:'funding';startedAt?:never;completedAt?:never}
  | {phase:'researching';startedAt:number;completedAt?:never}
  | {phase:'completed';startedAt:number;completedAt:number}
);
/** Large projects and direct research are distinct contracts, never an omnibus shared stock. */
export type LargeProjectOwner = {kind:'faction';factionId:FactionId}|{kind:'empire';empireId:EmpireId};
export type ContributorScope = {kind:'same-faction';factionId:FactionId}|{kind:'current-empire-members';empireId:EmpireId};
export type Shipment = {commandId?:CommandId;shipmentId:ShipmentId;projectId:ProjectId;sourceFactionId:FactionId;sourceCityId:CityId;destinationCityId:CityId;resources:Resources;dispatchedAt:number;authorizationSnapshot:{sourceCityOwnerFactionId:FactionId;contributorEmpireId:EmpireId|null;checkedAt:number}} & (
  | {phase:'in-transit';arrivedAt?:never;arrivalEventId?:never}
  | {phase:'arrived'|'returned';arrivedAt:number;arrivalEventId:EventId}
);
/** Stable host/owner snapshots and completion identity remain available to later destruction,
 * breakthrough and conquest work. Those systems do not run in B9-1. */
export type BreakthroughConstruction={creationCommandId:CommandId;wonderProjectId:ProjectId;phase:'funding'|'building'|'paused'|'completed';workPeriods:{startedAt:number;endedAt:number}[];discardedWorkMs:number;activeSince:number|null;completionEventId:EventId|null;completedAt:number|null;qualifiedFactionIds:FactionId[]};
export type BreakthroughCommand={type:'breakthrough.start';cityId:CityId}|{type:'breakthrough.ship';cityId:CityId;projectId:ProjectId;resources:Resources};
export type WonderConstruction={integrity?:'intact'|'damaged'|'ruins';creationCommandId:CommandId;hostOwnerFactionId:FactionId;phase:'funding'|'building'|'completed';startedAt:number|null;completionEventId:EventId|null;completedAt:number|null};
export type WonderCommand={type:'wonder.start';cityId:CityId;hostCityId:CityId}|{type:'wonder.ship';cityId:CityId;projectId:ProjectId;resources:Resources};
export type LargeProject = {
  projectId:ProjectId;kind:'world-wonder'|'civilization-breakthrough'|'emergency-modernization'|'technology-transfer';wonder?:WonderConstruction;breakthrough?:BreakthroughConstruction;owner:LargeProjectOwner;legalContributors:ContributorScope;
  paymentMode:'physical-shipment';initiatingCityId:CityId;requiredResources:Resources;poolResources:Resources;
  shipments:Shipment[];createdAt:number;durationMs:number;
};
export type FormalEvent = {id:EventId;at:number} & (
  | {type:'research.complete';projectId:ResearchProjectId}
  | {type:'wonder.complete';projectId:ProjectId}
  | {type:'breakthrough.complete';projectId:ProjectId}
  | {type:'economy.settle';cityId:CityId}
  | {type:'construction.complete';cityId:CityId}
  | {type:'city.promote.complete';cityId:CityId}
  | {type:'logistics.arrive';shipmentId:ShipmentId}
  | {type:'logistics.return';shipmentId:ShipmentId}
  | {type:'age.complete';factionId:FactionId}
  | {type:'military.train';cityId:CityId}
  | {type:'settlement.ready';projectId:ProjectId}
  | {type:'settlement.arrive';projectId:ProjectId}
  | {type:'craftsman.arrive';craftsmanId:string}
  | {type:'army.depart';armyId:ArmyId}
  | {type:'politics.end-friendly';a:string;b:string}
  | {type:'army.arrive';armyId:ArmyId}
  | {type:'army.return';armyId:ArmyId}
  | {type:'combat.round';battleId:import('./ids').BattleId}
  | {type:'wild.respawn';siteId:WildSiteId;generation:number}
  | {type:'governance.decide';cityId:CityId}
  | {type:'ai.decide';factionId:FactionId}
  | {type:'fixture.marker';marker:string}
);
export type CompletionReceipt = {eventId:EventId;projectId:ResearchProjectId;at:number};
export type CommandReceipt = {commandId:CommandId;issuerId:FactionId;fingerprint:string;committedRevision:number;disposition:'applied'|'rolled-back'};
export type FormalWorld = {
  kind:'formal';governors?:import('./governance').Governor[];autonomy?:import('./autonomyModel').Autonomy;extinction?:import('./extinction').ExtinctionState;politics?:import('./politics').Politics;developer?:{enabled:boolean;speed:50|100};metadata:VersionMetadata;campaignId:CampaignId;fixture:boolean;worldLayer?:WorldLayer;seed:number;speed:number;time:number;offlineHours?:0|1|4|8|12;clockMode?:'foreground'|'offline';
  dimensions:{width:number;height:number};playerFactionId:FactionId;revision:number;
  sequences:{event:number;report:number;project:number};
  factions:FormalFaction[];cities:FormalCity[];armies:FormalArmy[];events:FormalEvent[];
  commandReceipts:CommandReceipt[];completionReceipts:CompletionReceipt[];
  researchProjects:ResearchProject[];largeProjects:LargeProject[];logistics?:LogisticsShipment[];settlements?:Settlement[];colonizationUnits?:ColonizationUnit[];combat?:CombatState;
};
export type FormalReport = {id:ReportId;sequence:number;campaignId:CampaignId;ownerFactionId:FactionId;at:number;realAt?:number;clockSpeed?:number;read?:boolean;category:'system'|'research'|'battle'|'scout'|'diplomacy';title:string;text:string;battle?:BattleReportPayload};
export type MilitaryCommand={type:'military.recruit';cityId:CityId;unitId:string;count:number;lane?:0|1}|{type:'military.cancel';cityId:CityId;trainingCommandId:CommandId}|{type:'military.disband';cityId:CityId;unitId:string;count:number};
export type DevelopmentCommand={type:'research.start';cityId:CityId;techId:string}|{type:'age.start';cityId:CityId}|{type:'settlement.prepare';cityId:CityId}|{type:'settlement.cancel';cityId:CityId}|{type:'settlement.dispatch';cityId:CityId;x:number;y:number;name:string;escort:Record<string,number>}|{type:'logistics.auto.set';cityId:CityId;rules:AutoLogistics[]};
export type EconomyCommand = {type:'building.demolish';cityId:CityId;key:string}|{type:'field.upgrade';cityId:CityId;slot:number;lane?:0|1}|{type:'building.upgrade';cityId:CityId;key:string;lane?:0|1;slot?:number}|{type:'construction.cancel';cityId:CityId;constructionCommandId:CommandId}|{type:'city.promote';cityId:CityId}|{type:'logistics.dispatch';cityId:CityId;destinationCityId:CityId;resources:Resources};
export type FormalCommand = BreakthroughCommand|WonderCommand| {type:'campaign.configure';cityId:CityId;speed:1|3|6|10|25;offlineHours:0|1|4|8|12}| import('./governance').GovernanceCommand| import('./extinction').ExtinctionCommand| {type:'developer.configure';cityId:CityId;enabled:boolean;speed:50|100;shield?:boolean}|import('./politics').PoliticalCommand|import('./politics').CooperationCommand|ArmyCommand|DevelopmentCommand|MilitaryCommand|EconomyCommand| {type:'city.rename';cityId:CityId;name:string}|{type:'research.contribute';projectId:ResearchProjectId;cityId:CityId;resources:Resources};
export type FormalOrder = {commandId:CommandId;campaignId:CampaignId;issuerId:FactionId;issuedWorldTime:number;expectedRevision:number;payload:FormalCommand};
export type CommandAck = {commandId:CommandId;status:'committed'|'duplicate'|'rolled-back'|'rejected';revision:number;originalRevision?:number;reason?:string};
export type FormalTransition = {world:FormalWorld;reports:FormalReport[];ack?:CommandAck};
