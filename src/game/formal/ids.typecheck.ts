import {battleId,resolutionId,type BattleId,type ResolutionId,armyId,cityId,commandId,eventId,factionId,projectId,reportId,researchProjectId,type ArmyId,type CityId,type CommandId,type EventId,type FactionId,type ProjectId,type ReportId,type ResearchProjectId} from './ids';
const faction:FactionId=factionId('typecheck'),city:CityId=cityId('typecheck'),army:ArmyId=armyId('typecheck'),event:EventId=eventId('typecheck'),command:CommandId=commandId('typecheck'),project:ProjectId=projectId('typecheck'),research:ResearchProjectId=researchProjectId('typecheck'),report:ReportId=reportId('typecheck');
// These compile-time negative checks run in the required production typecheck.
// @ts-expect-error A CityId is not a FactionId.
const badFaction:FactionId=city;
// @ts-expect-error A FactionId is not a CityId.
const badCity:CityId=faction;
// @ts-expect-error An EventId is not an ArmyId.
const badArmy:ArmyId=event;
// @ts-expect-error A CommandId is not an EventId.
const badEvent:EventId=command;
// @ts-expect-error A ReportId is not a CommandId.
const badCommand:CommandId=report;
// @ts-expect-error Research and large-project IDs are separate identities.
const badProject:ProjectId=research;
// @ts-expect-error A ProjectId is not a ResearchProjectId.
const badResearch:ResearchProjectId=project;
// @ts-expect-error An ArmyId is not a ReportId.
const badReport:ReportId=army;
// @ts-expect-error Raw strings do not enter the authority model.
const raw:CityId='city:typecheck';
void [badFaction,badCity,badArmy,badEvent,badCommand,badProject,badResearch,badReport,raw];

const battle:BattleId=battleId('typecheck'),resolution:ResolutionId=resolutionId('typecheck');
// @ts-expect-error Battle and resolution IDs are distinct from report IDs.
const badBattle:BattleId=report;
// @ts-expect-error A battle parent is not its child resolution identity.
const badResolution:ResolutionId=battle;
// @ts-expect-error A resolution is not a battle.
const wrongBattle:BattleId=resolution;
void [badBattle,badResolution,wrongBattle];
