import Dexie, { type EntityTable } from "dexie";
import {
  CONTENT_VERSION,
  WORLD_SCHEMA_VERSION,
  type CommandLogEntry,
  type ScheduledEvent,
  type WorldState
} from "@/simulation/model";
import { hashText } from "@/simulation/rng";
import { hashSnapshot, stableStringify } from "@/simulation/world";
import { parseWorldState, validateWorldInvariants } from "./schema";

interface CampaignRecord {
  campaignId: string;
  campaignSeed: number;
  civilizationId: string;
  createdAtWallClockMs: number;
  updatedAtWallClockMs: number;
  currentRevision: number;
  currentChecksum: string;
  contentVersion: string;
  status: "active";
}

export interface SnapshotRecord {
  campaignId: string;
  savedAtWallClockMs: number;
  revision: number;
  checksum: string;
  state: unknown;
}

interface EventQueueRecord {
  campaignId: string;
  revision: number;
  checksum: string;
  events: ScheduledEvent[];
}

interface CommandLogRecord extends CommandLogEntry {
  id: string;
  campaignId: string;
}

export interface BackupRecord extends SnapshotRecord {
  id: string;
  reason: string;
}

interface SettingRecord {
  key: string;
  value: unknown;
}

interface ContentMetaRecord {
  key: string;
  schemaVersion: number;
  contentVersion: string;
  updatedAtWallClockMs: number;
}

class GuozhanDatabase extends Dexie {
  campaigns!: EntityTable<CampaignRecord, "campaignId">;
  snapshots!: EntityTable<SnapshotRecord, "campaignId">;
  eventQueue!: EntityTable<EventQueueRecord, "campaignId">;
  commandLog!: EntityTable<CommandLogRecord, "id">;
  backups!: EntityTable<BackupRecord, "id">;
  settings!: EntityTable<SettingRecord, "key">;
  contentMeta!: EntityTable<ContentMetaRecord, "key">;

  constructor() {
    super("guozhan-game-mvp");
    this.version(1).stores({
      snapshots: "&campaignId, savedAtWallClockMs"
    });
    this.version(2)
      .stores({
        campaigns: "&campaignId, updatedAtWallClockMs, status",
        snapshots: "&campaignId, revision, savedAtWallClockMs",
        eventQueue: "&campaignId, revision",
        commandLog: "&id, campaignId, sequenceId, issuedWorldTimeMs",
        backups: "&id, campaignId, savedAtWallClockMs, revision",
        settings: "&key",
        contentMeta: "&key"
      })
      .upgrade(async (transaction) => {
        await transaction
          .table("snapshots")
          .toCollection()
          .modify((record: SnapshotRecord) => {
            try {
              const migrated = parseWorldState(record.state);
              record.state = migrated;
              record.revision = migrated.revision;
              record.checksum = hashSnapshot(migrated);
            } catch {
              // 保留無法解析的原始內容，loadWorld 會改從備份回復或停止載入。
            }
          });
      });
  }
}

const database = new GuozhanDatabase();
const BACKUP_LIMIT = 5;

export interface LoadWorldResult {
  state: WorldState | null;
  recoveredFromBackup: boolean;
  recoveryRevision?: number;
  backupCount: number;
}

export interface SaveWorldOptions {
  wallClockMs?: number;
  backupReason?: string;
  forceBackup?: boolean;
  createBackup?: boolean;
}

function eventQueueChecksum(events: ScheduledEvent[]): string {
  return hashText(stableStringify(events)).toString(16).padStart(8, "0");
}

function decodeSnapshot(record: SnapshotRecord | BackupRecord): WorldState | null {
  try {
    const state = parseWorldState(record.state);
    if (hashSnapshot(state) !== record.checksum) {
      return null;
    }
    validateWorldInvariants(state);
    return state;
  } catch {
    return null;
  }
}

export function selectNewestValidSnapshot(
  records: Array<SnapshotRecord | BackupRecord>
): { state: WorldState; record: SnapshotRecord | BackupRecord } | null {
  const sorted = [...records].sort(
    (left, right) =>
      right.savedAtWallClockMs - left.savedAtWallClockMs ||
      right.revision - left.revision
  );

  for (const record of sorted) {
    const state = decodeSnapshot(record);
    if (state) {
      return { state, record };
    }
  }

  return null;
}

async function trimBackups(campaignId: string): Promise<void> {
  const backups = await database.backups
    .where("campaignId")
    .equals(campaignId)
    .toArray();
  backups.sort(
    (left, right) =>
      right.savedAtWallClockMs - left.savedAtWallClockMs ||
      right.revision - left.revision
  );
  const staleIds = backups.slice(BACKUP_LIMIT).map((record) => record.id);
  if (staleIds.length > 0) {
    await database.backups.bulkDelete(staleIds);
  }
}

function createBackupRecord(
  record: SnapshotRecord,
  reason: string,
  backupWallClockMs: number
): BackupRecord {
  return {
    ...record,
    id: `${record.campaignId}:${backupWallClockMs}:${record.revision}:${record.checksum}`,
    savedAtWallClockMs: backupWallClockMs,
    reason
  };
}

export async function loadWorld(campaignId: string): Promise<LoadWorldResult> {
  const [current, queueRecord, backups] = await Promise.all([
    database.snapshots.get(campaignId),
    database.eventQueue.get(campaignId),
    database.backups.where("campaignId").equals(campaignId).toArray()
  ]);

  if (current) {
    const state = decodeSnapshot(current);
    const queueMatches =
      !queueRecord ||
      (queueRecord.revision === state?.revision &&
        queueRecord.checksum === eventQueueChecksum(state.eventQueue) &&
        stableStringify(queueRecord.events) === stableStringify(state.eventQueue));
    if (state && queueMatches) {
      return {
        state,
        recoveredFromBackup: false,
        backupCount: backups.length
      };
    }
  }

  const recovered = selectNewestValidSnapshot(backups);
  if (recovered) {
    return {
      state: recovered.state,
      recoveredFromBackup: true,
      recoveryRevision: recovered.record.revision,
      backupCount: backups.length
    };
  }

  if (!current && backups.length === 0) {
    return {
      state: null,
      recoveredFromBackup: false,
      backupCount: 0
    };
  }

  throw new Error("目前存檔及五份輪替備份均未通過完整性檢查；原始資料未被覆寫。");
}

export async function createRecoveryPoint(
  state: WorldState,
  reason: string,
  wallClockMs = Date.now()
): Promise<void> {
  const validated = parseWorldState(state);
  const record: SnapshotRecord = {
    campaignId: validated.campaignId,
    savedAtWallClockMs: validated.lastCommittedWallClockMs,
    revision: validated.revision,
    checksum: hashSnapshot(validated),
    state: validated
  };

  await database.transaction("rw", database.backups, async () => {
    await database.backups.put(
      createBackupRecord(record, reason, wallClockMs)
    );
    await trimBackups(validated.campaignId);
  });
}

export async function saveWorld(
  state: WorldState,
  options: SaveWorldOptions = {}
): Promise<WorldState> {
  const committedAt = options.wallClockMs ?? Date.now();
  const committedState = parseWorldState({
    ...state,
    lastCommittedWallClockMs: committedAt
  });
  const checksum = hashSnapshot(committedState);

  await database.transaction(
    "rw",
    [
      database.campaigns,
      database.snapshots,
      database.eventQueue,
      database.commandLog,
      database.backups,
      database.contentMeta
    ],
    async () => {
      const previous = await database.snapshots.get(committedState.campaignId);
      const previousState = previous ? decodeSnapshot(previous) : null;
      const shouldBackUp =
        options.createBackup !== false &&
        previous &&
        previousState &&
        (options.forceBackup === true || previous.checksum !== checksum);

      if (shouldBackUp) {
        await database.backups.put(
          createBackupRecord(
            previous,
            options.backupReason ?? "automatic_rotation",
            committedAt
          )
        );
      }

      await database.snapshots.put({
        campaignId: committedState.campaignId,
        savedAtWallClockMs: committedAt,
        revision: committedState.revision,
        checksum,
        state: committedState
      });
      await database.eventQueue.put({
        campaignId: committedState.campaignId,
        revision: committedState.revision,
        checksum: eventQueueChecksum(committedState.eventQueue),
        events: committedState.eventQueue.map((event) => ({ ...event }))
      });
      await database.campaigns.put({
        campaignId: committedState.campaignId,
        campaignSeed: committedState.campaignSeed,
        civilizationId: committedState.civilizationId,
        createdAtWallClockMs:
          (await database.campaigns.get(committedState.campaignId))
            ?.createdAtWallClockMs ?? committedAt,
        updatedAtWallClockMs: committedAt,
        currentRevision: committedState.revision,
        currentChecksum: checksum,
        contentVersion: committedState.contentVersion,
        status: "active"
      });

      if (committedState.commandLog.length > 0) {
        await database.commandLog.bulkPut(
          committedState.commandLog.map((entry) => ({
            ...entry,
            id: `${committedState.campaignId}:${entry.id}`,
            campaignId: committedState.campaignId
          }))
        );
      }

      await database.contentMeta.put({
        key: "world",
        schemaVersion: WORLD_SCHEMA_VERSION,
        contentVersion: CONTENT_VERSION,
        updatedAtWallClockMs: committedAt
      });
      await trimBackups(committedState.campaignId);
    }
  );

  return committedState;
}

export async function countBackups(campaignId: string): Promise<number> {
  return database.backups.where("campaignId").equals(campaignId).count();
}
