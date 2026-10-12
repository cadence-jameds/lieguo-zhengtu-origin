import { z } from "zod";
import {
  GAME_BUILD,
  WORLD_SCHEMA_VERSION,
  type WorldState
} from "@/simulation/model";
import {
  cloneWorld,
  hashSnapshot,
  stableStringify
} from "@/simulation/world";
import {
  parseWorldState,
  scheduledEventSchema,
  validateWorldInvariants
} from "./schema";

const FORMAT_ID = "guozhan-realm-save";
const EXPORT_VERSION = 1;
const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

const saveEnvelopeSchema = z.object({
  formatId: z.literal(FORMAT_ID),
  exportVersion: z.literal(EXPORT_VERSION),
  schemaVersion: z.number().int().positive(),
  contentVersion: z.string().min(1),
  gameBuild: z.string().min(1),
  campaignId: z.string().min(1),
  createdAtWallClockMs: z.number().int().nonnegative(),
  worldTimeMs: z.number().int().nonnegative(),
  campaignSeed: z.number().int().nonnegative(),
  snapshot: z.unknown(),
  pendingEvents: z.array(scheduledEventSchema),
  rngStates: z.object({
    simulation: z.number().int().positive(),
    map: z.number().int().positive(),
    ai: z.number().int().positive(),
    combat: z.number().int().positive()
  }),
  checksum: z.string().regex(/^[0-9a-f]{8}$/)
});

export interface SaveExport {
  filename: string;
  serialized: string;
}

function safeFilenamePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 48);
}

export function createSaveExport(
  state: WorldState,
  createdAtWallClockMs: number
): SaveExport {
  const snapshot = cloneWorld(state);
  const envelope = {
    formatId: FORMAT_ID,
    exportVersion: EXPORT_VERSION,
    schemaVersion: WORLD_SCHEMA_VERSION,
    contentVersion: state.contentVersion,
    gameBuild: GAME_BUILD,
    campaignId: state.campaignId,
    createdAtWallClockMs,
    worldTimeMs: state.worldTimeMs,
    campaignSeed: state.campaignSeed,
    snapshot,
    pendingEvents: snapshot.eventQueue,
    rngStates: snapshot.rngStates,
    checksum: hashSnapshot(snapshot)
  } as const;

  const date = new Date(createdAtWallClockMs).toISOString().slice(0, 10);
  return {
    filename: `${safeFilenamePart(state.campaignId)}-${date}.realm-save`,
    serialized: JSON.stringify(envelope, null, 2)
  };
}

export function importSaveExport(
  serialized: string,
  targetCampaignId: string,
  wallClockMs: number
): WorldState {
  if (new Blob([serialized]).size > MAX_IMPORT_BYTES) {
    throw new Error("匯入檔超過 5 MiB 安全上限。");
  }

  let raw: unknown;
  try {
    raw = JSON.parse(serialized) as unknown;
  } catch {
    throw new Error("匯入檔不是有效的 JSON 存檔。");
  }

  const envelope = saveEnvelopeSchema.parse(raw);
  const imported = parseWorldState(envelope.snapshot);

  if (hashSnapshot(imported) !== envelope.checksum) {
    throw new Error("匯入檔 checksum 不一致，未覆蓋目前戰役。");
  }
  if (
    imported.campaignId !== envelope.campaignId ||
    imported.campaignSeed !== envelope.campaignSeed ||
    imported.worldTimeMs !== envelope.worldTimeMs
  ) {
    throw new Error("匯入檔的戰役資訊互相矛盾，未覆蓋目前戰役。");
  }
  if (
    stableStringify(imported.eventQueue) !==
    stableStringify(envelope.pendingEvents)
  ) {
    throw new Error("匯入檔的事件佇列與 snapshot 不一致。");
  }
  if (
    stableStringify(imported.rngStates) !== stableStringify(envelope.rngStates)
  ) {
    throw new Error("匯入檔的 RNG 狀態與 snapshot 不一致。");
  }

  const state = cloneWorld(imported);
  state.campaignId = targetCampaignId;
  state.lastCommittedWallClockMs = wallClockMs;
  state.revision += 1;
  state.reports.unshift({
    id: `report_import_${state.revision}`,
    worldTimeMs: state.worldTimeMs,
    kind: "system",
    title: "存檔匯入完成",
    detail: "匯入內容已通過版本、事件佇列、RNG 與 checksum 驗證。"
  });
  state.reports = state.reports.slice(0, 24);
  validateWorldInvariants(state);
  return state;
}
