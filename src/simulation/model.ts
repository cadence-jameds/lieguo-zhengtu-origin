export const WORLD_SCHEMA_VERSION = 2 as const;
export const CONTENT_VERSION = "m1.0.0";
export const GAME_BUILD = "m1.0.0";
export const RESOURCE_SCALE = 1_000;
export const HOUR_MS = 60 * 60 * 1_000;
export const DAY_MS = 24 * HOUR_MS;
export const MVP_PROTECTION_MS = 72 * HOUR_MS;

export const resourceKeys = ["food", "wood", "stone", "gold"] as const;
export type ResourceKey = (typeof resourceKeys)[number];

export type ResourceLedger = Record<ResourceKey, number>;

export interface RngStates {
  simulation: number;
  map: number;
  ai: number;
  combat: number;
}

export interface ScheduledEvent {
  id: string;
  dueWorldTimeMs: number;
  priority: number;
  sequenceId: number;
  type: "scout_arrival";
  missionId: string;
  targetNodeId: string;
  targetName: string;
}

export interface DispatchScoutCommand {
  type: "dispatch_scout";
  targetNodeId: string;
  targetName: string;
}

export type WorldCommand = DispatchScoutCommand;

export interface CommandLogEntry {
  id: string;
  sequenceId: number;
  issuedWorldTimeMs: number;
  type: WorldCommand["type"];
  targetNodeId: string;
  targetName: string;
  accepted: boolean;
  reason?: string;
}

export interface ScoutMission {
  id: string;
  targetNodeId: string;
  targetName: string;
  departedAtMs: number;
  arrivesAtMs: number;
}

export interface WorldReport {
  id: string;
  worldTimeMs: number;
  kind: "world" | "scouting" | "system";
  title: string;
  detail: string;
}

export interface WorldDiagnostics {
  clockRollbackCount: number;
  largeClockJumpCount: number;
  recoveredBackupCount: number;
}

export interface WorldState {
  schemaVersion: typeof WORLD_SCHEMA_VERSION;
  contentVersion: string;
  campaignId: string;
  campaignSeed: number;
  civilizationId: string;
  revision: number;
  worldTimeMs: number;
  lastCommittedWallClockMs: number;
  resourcesMilli: ResourceLedger;
  productionRemainders: ResourceLedger;
  population: number;
  nextSequenceId: number;
  rngStates: RngStates;
  eventQueue: ScheduledEvent[];
  commandLog: CommandLogEntry[];
  scoutMissions: ScoutMission[];
  discoveredNodeIds: string[];
  reports: WorldReport[];
  diagnostics: WorldDiagnostics;
}

export interface WorldView {
  campaignId: string;
  civilizationId: string;
  revision: number;
  worldTimeMs: number;
  resources: Record<ResourceKey, number>;
  productionPerHour: Record<ResourceKey, number>;
  population: number;
  protectionRemainingMs: number;
  pendingEventCount: number;
  acceptedCommandCount: number;
  scoutMissions: ScoutMission[];
  discoveredNodeIds: string[];
  reports: WorldReport[];
}

export interface OfflineSummary {
  elapsedMs: number;
  completedEvents: number;
  gainedResources: Record<ResourceKey, number>;
  recoveredFromBackup: boolean;
  clockRollbackDetected: boolean;
  largeClockJumpDetected: boolean;
}

export interface PersistenceStatus {
  backupCount: number;
  recoveredFromBackup: boolean;
  recoveryRevision?: number;
}

export const productionPerHourMilli: ResourceLedger = {
  food: 42 * RESOURCE_SCALE,
  wood: 31 * RESOURCE_SCALE,
  stone: 14 * RESOURCE_SCALE,
  gold: 9 * RESOURCE_SCALE
};

export function emptyLedger(): ResourceLedger {
  return { food: 0, wood: 0, stone: 0, gold: 0 };
}
