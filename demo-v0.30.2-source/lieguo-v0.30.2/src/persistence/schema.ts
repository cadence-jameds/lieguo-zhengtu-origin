import { z } from "zod";
import {
  CONTENT_VERSION,
  WORLD_SCHEMA_VERSION,
  type WorldState
} from "@/simulation/model";
import { hashText, normalizeSeed } from "@/simulation/rng";
import { compareScheduledEvents } from "@/simulation/world";

const nonnegativeInteger = z.number().int().nonnegative();
const positiveInteger = z.number().int().positive();

const resourceLedgerSchema = z.object({
  food: nonnegativeInteger,
  wood: nonnegativeInteger,
  stone: nonnegativeInteger,
  gold: nonnegativeInteger
});

const scoutMissionSchema = z.object({
  id: z.string().min(1),
  targetNodeId: z.string().min(1),
  targetName: z.string().min(1),
  departedAtMs: nonnegativeInteger,
  arrivesAtMs: nonnegativeInteger
});

const reportSchemaV1 = z.object({
  id: z.string().min(1),
  worldTimeMs: nonnegativeInteger,
  kind: z.enum(["world", "scouting"]),
  title: z.string(),
  detail: z.string()
});

const reportSchemaV2 = reportSchemaV1.extend({
  kind: z.enum(["world", "scouting", "system"])
});

const legacyEventSchema = z.object({
  id: z.string().min(1),
  dueWorldTimeMs: nonnegativeInteger,
  priority: z.number().int(),
  sequenceId: positiveInteger,
  type: z.literal("scout_arrival"),
  targetNodeId: z.string().min(1),
  targetName: z.string().min(1)
});

export const scheduledEventSchema = legacyEventSchema.extend({
  missionId: z.string().min(1)
});

const commandLogEntrySchema = z.object({
  id: z.string().min(1),
  sequenceId: positiveInteger,
  issuedWorldTimeMs: nonnegativeInteger,
  type: z.literal("dispatch_scout"),
  targetNodeId: z.string().min(1),
  targetName: z.string().min(1),
  accepted: z.boolean(),
  reason: z.string().optional()
});

const legacyWorldSchema = z.object({
  schemaVersion: z.literal(1),
  campaignId: z.string().min(1),
  campaignSeed: nonnegativeInteger,
  civilizationId: z.string().min(1),
  revision: positiveInteger,
  worldTimeMs: nonnegativeInteger,
  lastCommittedWallClockMs: nonnegativeInteger,
  resourcesMilli: resourceLedgerSchema,
  productionRemainders: resourceLedgerSchema,
  population: nonnegativeInteger,
  nextSequenceId: positiveInteger,
  rngState: nonnegativeInteger,
  scheduledEvents: z.array(legacyEventSchema),
  scoutMissions: z.array(scoutMissionSchema),
  discoveredNodeIds: z.array(z.string().min(1)),
  reports: z.array(reportSchemaV1)
});

export const worldStateSchema = z.object({
  schemaVersion: z.literal(WORLD_SCHEMA_VERSION),
  contentVersion: z.string().min(1),
  campaignId: z.string().min(1),
  campaignSeed: nonnegativeInteger,
  civilizationId: z.string().min(1),
  revision: positiveInteger,
  worldTimeMs: nonnegativeInteger,
  lastCommittedWallClockMs: nonnegativeInteger,
  resourcesMilli: resourceLedgerSchema,
  productionRemainders: resourceLedgerSchema,
  population: nonnegativeInteger,
  nextSequenceId: positiveInteger,
  rngStates: z.object({
    simulation: positiveInteger,
    map: positiveInteger,
    ai: positiveInteger,
    combat: positiveInteger
  }),
  eventQueue: z.array(scheduledEventSchema),
  commandLog: z.array(commandLogEntrySchema),
  scoutMissions: z.array(scoutMissionSchema),
  discoveredNodeIds: z.array(z.string().min(1)),
  reports: z.array(reportSchemaV2),
  diagnostics: z.object({
    clockRollbackCount: nonnegativeInteger,
    largeClockJumpCount: nonnegativeInteger,
    recoveredBackupCount: nonnegativeInteger
  })
});

function migrateV1ToV2(input: z.infer<typeof legacyWorldSchema>): WorldState {
  const seed = normalizeSeed(input.campaignSeed);
  const migrated: WorldState = {
    schemaVersion: WORLD_SCHEMA_VERSION,
    contentVersion: CONTENT_VERSION,
    campaignId: input.campaignId,
    campaignSeed: seed,
    civilizationId: input.civilizationId,
    revision: input.revision,
    worldTimeMs: input.worldTimeMs,
    lastCommittedWallClockMs: input.lastCommittedWallClockMs,
    resourcesMilli: { ...input.resourcesMilli },
    productionRemainders: { ...input.productionRemainders },
    population: input.population,
    nextSequenceId: input.nextSequenceId,
    rngStates: {
      simulation: normalizeSeed(input.rngState),
      map: hashText(`${seed}:map`),
      ai: hashText(`${seed}:ai`),
      combat: hashText(`${seed}:combat`)
    },
    eventQueue: input.scheduledEvents
      .map((event) => ({ ...event, missionId: event.id }))
      .sort(compareScheduledEvents),
    commandLog: [],
    scoutMissions: input.scoutMissions.map((mission) => ({ ...mission })),
    discoveredNodeIds: [...input.discoveredNodeIds],
    reports: input.reports.map((report) => ({ ...report })),
    diagnostics: {
      clockRollbackCount: 0,
      largeClockJumpCount: 0,
      recoveredBackupCount: 0
    }
  };

  validateWorldInvariants(migrated);
  return migrated;
}

export function parseWorldState(input: unknown): WorldState {
  const version = z
    .object({ schemaVersion: z.number().int() })
    .passthrough()
    .safeParse(input);

  if (!version.success) {
    throw new Error("存檔缺少有效的 schemaVersion。");
  }

  if (version.data.schemaVersion === 1) {
    return migrateV1ToV2(legacyWorldSchema.parse(input));
  }

  if (version.data.schemaVersion !== WORLD_SCHEMA_VERSION) {
    throw new Error(`不支援的存檔版本：${version.data.schemaVersion}。`);
  }

  const parsed = worldStateSchema.parse(input) as WorldState;
  const normalized: WorldState = {
    ...parsed,
    resourcesMilli: { ...parsed.resourcesMilli },
    productionRemainders: { ...parsed.productionRemainders },
    rngStates: { ...parsed.rngStates },
    eventQueue: parsed.eventQueue
      .map((event) => ({ ...event }))
      .sort(compareScheduledEvents),
    commandLog: parsed.commandLog.map((entry) => ({ ...entry })),
    scoutMissions: parsed.scoutMissions.map((mission) => ({ ...mission })),
    discoveredNodeIds: [...parsed.discoveredNodeIds],
    reports: parsed.reports.map((report) => ({ ...report })),
    diagnostics: { ...parsed.diagnostics }
  };

  validateWorldInvariants(normalized);
  return normalized;
}

export function validateWorldInvariants(state: WorldState): void {
  const ids = new Set<string>();
  const sequenceIds = new Set<number>();
  let highestSequenceId = 0;

  for (const event of state.eventQueue) {
    if (ids.has(event.id)) {
      throw new Error(`事件 ID 重複：${event.id}。`);
    }
    if (sequenceIds.has(event.sequenceId)) {
      throw new Error(`事件序號重複：${event.sequenceId}。`);
    }
    if (event.dueWorldTimeMs < state.worldTimeMs) {
      throw new Error(`事件 ${event.id} 的時間早於目前世界時間。`);
    }
    ids.add(event.id);
    sequenceIds.add(event.sequenceId);
    highestSequenceId = Math.max(highestSequenceId, event.sequenceId);
  }

  for (const command of state.commandLog) {
    if (ids.has(command.id)) {
      throw new Error(`命令 ID 重複：${command.id}。`);
    }
    if (sequenceIds.has(command.sequenceId)) {
      throw new Error(`命令／事件序號重複：${command.sequenceId}。`);
    }
    ids.add(command.id);
    sequenceIds.add(command.sequenceId);
    highestSequenceId = Math.max(highestSequenceId, command.sequenceId);
  }

  const missionIds = new Set<string>();
  for (const mission of state.scoutMissions) {
    if (missionIds.has(mission.id)) {
      throw new Error(`斥候任務 ID 重複：${mission.id}。`);
    }
    if (mission.arrivesAtMs < mission.departedAtMs) {
      throw new Error(`斥候任務 ${mission.id} 的抵達時間無效。`);
    }
    missionIds.add(mission.id);
  }

  for (const event of state.eventQueue) {
    if (!missionIds.has(event.missionId)) {
      throw new Error(`事件 ${event.id} 找不到對應的斥候任務。`);
    }
  }

  if (state.nextSequenceId <= highestSequenceId) {
    throw new Error("nextSequenceId 沒有領先既有命令與事件。");
  }
}
