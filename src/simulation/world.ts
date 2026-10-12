import { hashText, nextRandom, normalizeSeed } from "./rng";
import {
  CONTENT_VERSION,
  DAY_MS,
  HOUR_MS,
  MVP_PROTECTION_MS,
  RESOURCE_SCALE,
  WORLD_SCHEMA_VERSION,
  emptyLedger,
  productionPerHourMilli,
  resourceKeys,
  type CommandLogEntry,
  type OfflineSummary,
  type ResourceLedger,
  type ScheduledEvent,
  type WorldCommand,
  type WorldState,
  type WorldView
} from "./model";

const SCOUT_TRAVEL_MS = 12_000;
const MAX_COMMAND_LOG_ENTRIES = 200;
const MAX_REPORTS = 24;
const LARGE_CLOCK_JUMP_MS = 3 * DAY_MS;

export interface CreateWorldOptions {
  campaignId: string;
  campaignSeed: number;
  civilizationId: string;
  wallClockMs: number;
}

export interface AdvanceResult {
  state: WorldState;
  completedEvents: number;
}

export interface ExecuteCommandResult {
  state: WorldState;
  entry: CommandLogEntry;
  accepted: boolean;
  reason?: string;
}

export interface OfflineWindow {
  elapsedMs: number;
  clockRollbackDetected: boolean;
  largeClockJumpDetected: boolean;
}

function createRngStates(seed: number): WorldState["rngStates"] {
  const normalized = normalizeSeed(seed);
  return {
    simulation: normalized,
    map: hashText(`${normalized}:map`),
    ai: hashText(`${normalized}:ai`),
    combat: hashText(`${normalized}:combat`)
  };
}

export function createInitialWorld(options: CreateWorldOptions): WorldState {
  return {
    schemaVersion: WORLD_SCHEMA_VERSION,
    contentVersion: CONTENT_VERSION,
    campaignId: options.campaignId,
    campaignSeed: normalizeSeed(options.campaignSeed),
    civilizationId: options.civilizationId,
    revision: 1,
    worldTimeMs: 0,
    lastCommittedWallClockMs: options.wallClockMs,
    resourcesMilli: {
      food: 1_200 * RESOURCE_SCALE,
      wood: 820 * RESOURCE_SCALE,
      stone: 360 * RESOURCE_SCALE,
      gold: 240 * RESOURCE_SCALE
    },
    productionRemainders: emptyLedger(),
    population: 300,
    nextSequenceId: 1,
    rngStates: createRngStates(options.campaignSeed),
    eventQueue: [],
    commandLog: [],
    scoutMissions: [],
    discoveredNodeIds: ["settlement_capital"],
    reports: [
      {
        id: "report_world_awakes",
        worldTimeMs: 0,
        kind: "world",
        title: "世界開始運行",
        detail: "六個文明已在區域地圖上建立起始據點。"
      }
    ],
    diagnostics: {
      clockRollbackCount: 0,
      largeClockJumpCount: 0,
      recoveredBackupCount: 0
    }
  };
}

function cloneLedger(ledger: ResourceLedger): ResourceLedger {
  return { ...ledger };
}

export function cloneWorld(state: WorldState): WorldState {
  return {
    ...state,
    resourcesMilli: cloneLedger(state.resourcesMilli),
    productionRemainders: cloneLedger(state.productionRemainders),
    rngStates: { ...state.rngStates },
    eventQueue: state.eventQueue.map((event) => ({ ...event })),
    commandLog: state.commandLog.map((entry) => ({ ...entry })),
    scoutMissions: state.scoutMissions.map((mission) => ({ ...mission })),
    discoveredNodeIds: [...state.discoveredNodeIds],
    reports: state.reports.map((report) => ({ ...report })),
    diagnostics: { ...state.diagnostics }
  };
}

export function compareScheduledEvents(
  left: ScheduledEvent,
  right: ScheduledEvent
): number {
  return (
    left.dueWorldTimeMs - right.dueWorldTimeMs ||
    left.priority - right.priority ||
    left.sequenceId - right.sequenceId ||
    left.id.localeCompare(right.id)
  );
}

function accrueResources(state: WorldState, deltaMs: number): void {
  for (const key of resourceKeys) {
    const totalNumerator =
      state.productionRemainders[key] +
      productionPerHourMilli[key] * deltaMs;
    const gainMilli = Math.floor(totalNumerator / HOUR_MS);

    state.resourcesMilli[key] += gainMilli;
    state.productionRemainders[key] = totalNumerator % HOUR_MS;
  }
}

function resolveEvent(state: WorldState, event: ScheduledEvent): void {
  if (event.type !== "scout_arrival") {
    return;
  }

  state.scoutMissions = state.scoutMissions.filter(
    (mission) => mission.id !== event.missionId
  );

  if (!state.discoveredNodeIds.includes(event.targetNodeId)) {
    state.discoveredNodeIds.push(event.targetNodeId);
  }

  state.reports.unshift({
    id: `report_${event.id}`,
    worldTimeMs: event.dueWorldTimeMs,
    kind: "scouting",
    title: `斥候抵達：${event.targetName}`,
    detail: "已確認道路、地格與聚落位置。"
  });
  state.reports = state.reports.slice(0, MAX_REPORTS);
}

export function advanceWorld(
  input: WorldState,
  requestedDeltaMs: number
): AdvanceResult {
  const state = cloneWorld(input);
  const deltaMs = Math.max(0, Math.floor(requestedDeltaMs));
  const targetWorldTime = state.worldTimeMs + deltaMs;
  let completedEvents = 0;

  while (true) {
    state.eventQueue.sort(compareScheduledEvents);

    const nextEvent = state.eventQueue[0];
    if (!nextEvent || nextEvent.dueWorldTimeMs > targetWorldTime) {
      break;
    }

    const stepMs = Math.max(0, nextEvent.dueWorldTimeMs - state.worldTimeMs);
    accrueResources(state, stepMs);
    state.worldTimeMs += stepMs;
    state.eventQueue.shift();
    resolveEvent(state, nextEvent);
    completedEvents += 1;
  }

  const finalStepMs = Math.max(0, targetWorldTime - state.worldTimeMs);
  accrueResources(state, finalStepMs);
  state.worldTimeMs = targetWorldTime;

  if (deltaMs > 0 || completedEvents > 0) {
    state.revision += 1;
  }

  return { state, completedEvents };
}

export function executeWorldCommand(
  input: WorldState,
  command: WorldCommand
): ExecuteCommandResult {
  const state = cloneWorld(input);
  const commandSequenceId = state.nextSequenceId;
  state.nextSequenceId += 1;

  let accepted = true;
  let reason: string | undefined;

  if (
    command.type === "dispatch_scout" &&
    state.scoutMissions.some(
      (mission) => mission.targetNodeId === command.targetNodeId
    )
  ) {
    accepted = false;
    reason = "已有斥候前往此地。";
  }

  if (accepted && command.type === "dispatch_scout") {
    const missionId = `scout_${commandSequenceId}`;
    const eventSequenceId = state.nextSequenceId;
    const random = nextRandom(state.rngStates.simulation);
    const travelVariationMs = Math.floor(random.value * 2_000);
    const arrivesAtMs =
      state.worldTimeMs + SCOUT_TRAVEL_MS + travelVariationMs;

    state.rngStates.simulation = random.state;
    state.nextSequenceId += 1;
    state.scoutMissions.push({
      id: missionId,
      targetNodeId: command.targetNodeId,
      targetName: command.targetName,
      departedAtMs: state.worldTimeMs,
      arrivesAtMs
    });
    state.eventQueue.push({
      id: `event_${eventSequenceId}`,
      dueWorldTimeMs: arrivesAtMs,
      priority: 50,
      sequenceId: eventSequenceId,
      type: "scout_arrival",
      missionId,
      targetNodeId: command.targetNodeId,
      targetName: command.targetName
    });
    state.eventQueue.sort(compareScheduledEvents);
  }

  const entry: CommandLogEntry = {
    id: `command_${commandSequenceId}`,
    sequenceId: commandSequenceId,
    issuedWorldTimeMs: state.worldTimeMs,
    type: command.type,
    targetNodeId: command.targetNodeId,
    targetName: command.targetName,
    accepted,
    ...(reason ? { reason } : {})
  };

  state.commandLog.push(entry);
  state.commandLog = state.commandLog.slice(-MAX_COMMAND_LOG_ENTRIES);
  state.revision += 1;

  return { state, entry, accepted, ...(reason ? { reason } : {}) };
}

export function queueScoutMission(
  input: WorldState,
  targetNodeId: string,
  targetName: string
): ExecuteCommandResult {
  return executeWorldCommand(input, {
    type: "dispatch_scout",
    targetNodeId,
    targetName
  });
}

export function calculateOfflineWindow(
  lastCommittedWallClockMs: number,
  currentWallClockMs: number
): OfflineWindow {
  if (currentWallClockMs < lastCommittedWallClockMs) {
    return {
      elapsedMs: 0,
      clockRollbackDetected: true,
      largeClockJumpDetected: false
    };
  }

  const elapsedMs = Math.floor(currentWallClockMs - lastCommittedWallClockMs);
  return {
    elapsedMs,
    clockRollbackDetected: false,
    largeClockJumpDetected: elapsedMs >= LARGE_CLOCK_JUMP_MS
  };
}

export function applyLoadDiagnostics(
  input: WorldState,
  options: {
    recoveredFromBackup: boolean;
    clockRollbackDetected: boolean;
    largeClockJumpDetected: boolean;
  }
): WorldState {
  if (
    !options.recoveredFromBackup &&
    !options.clockRollbackDetected &&
    !options.largeClockJumpDetected
  ) {
    return input;
  }

  const state = cloneWorld(input);

  if (options.recoveredFromBackup) {
    state.diagnostics.recoveredBackupCount += 1;
    state.reports.unshift({
      id: `report_recovery_${state.revision}`,
      worldTimeMs: state.worldTimeMs,
      kind: "system",
      title: "已從自動備份回復",
      detail: "最新存檔未通過完整性檢查，系統已安全使用最近的有效版本。"
    });
  }

  if (options.clockRollbackDetected) {
    state.diagnostics.clockRollbackCount += 1;
    state.reports.unshift({
      id: `report_clock_rollback_${state.revision}`,
      worldTimeMs: state.worldTimeMs,
      kind: "system",
      title: "偵測到裝置時間倒退",
      detail: "本次離線時間以 0 計算，世界進度沒有被倒扣。"
    });
  }

  if (options.largeClockJumpDetected) {
    state.diagnostics.largeClockJumpCount += 1;
    state.reports.unshift({
      id: `report_clock_jump_${state.revision}`,
      worldTimeMs: state.worldTimeMs,
      kind: "system",
      title: "正在追算較長的離線期間",
      detail: "世界仍使用相同規則完整追算，沒有套用離線上限。"
    });
  }

  state.reports = state.reports.slice(0, MAX_REPORTS);
  state.revision += 1;
  return state;
}

export function toWorldView(state: WorldState): WorldView {
  return {
    campaignId: state.campaignId,
    civilizationId: state.civilizationId,
    revision: state.revision,
    worldTimeMs: state.worldTimeMs,
    resources: Object.fromEntries(
      resourceKeys.map((key) => [key, state.resourcesMilli[key] / RESOURCE_SCALE])
    ) as WorldView["resources"],
    productionPerHour: Object.fromEntries(
      resourceKeys.map((key) => [
        key,
        productionPerHourMilli[key] / RESOURCE_SCALE
      ])
    ) as WorldView["productionPerHour"],
    population: state.population,
    protectionRemainingMs: Math.max(0, MVP_PROTECTION_MS - state.worldTimeMs),
    pendingEventCount: state.eventQueue.length,
    acceptedCommandCount: state.commandLog.filter((entry) => entry.accepted).length,
    scoutMissions: state.scoutMissions.map((mission) => ({ ...mission })),
    discoveredNodeIds: [...state.discoveredNodeIds],
    reports: state.reports.map((report) => ({ ...report }))
  };
}

export function createOfflineSummary(
  before: WorldState,
  after: WorldState,
  elapsedMs: number,
  completedEvents: number,
  flags: {
    recoveredFromBackup?: boolean;
    clockRollbackDetected?: boolean;
    largeClockJumpDetected?: boolean;
  } = {}
): OfflineSummary {
  return {
    elapsedMs,
    completedEvents,
    gainedResources: Object.fromEntries(
      resourceKeys.map((key) => [
        key,
        (after.resourcesMilli[key] - before.resourcesMilli[key]) / RESOURCE_SCALE
      ])
    ) as OfflineSummary["gainedResources"],
    recoveredFromBackup: flags.recoveredFromBackup ?? false,
    clockRollbackDetected: flags.clockRollbackDetected ?? false,
    largeClockJumpDetected: flags.largeClockJumpDetected ?? false
  };
}

export function hashWorld(state: WorldState): string {
  const canonical = stableStringify({
    schemaVersion: state.schemaVersion,
    contentVersion: state.contentVersion,
    campaignId: state.campaignId,
    campaignSeed: state.campaignSeed,
    civilizationId: state.civilizationId,
    worldTimeMs: state.worldTimeMs,
    resourcesMilli: state.resourcesMilli,
    productionRemainders: state.productionRemainders,
    population: state.population,
    nextSequenceId: state.nextSequenceId,
    rngStates: state.rngStates,
    eventQueue: [...state.eventQueue].sort(compareScheduledEvents),
    commandLog: [...state.commandLog].sort(
      (left, right) => left.sequenceId - right.sequenceId
    ),
    scoutMissions: state.scoutMissions,
    discoveredNodeIds: [...state.discoveredNodeIds].sort(),
    reports: state.reports,
    diagnostics: state.diagnostics
  });

  return hashText(canonical).toString(16).padStart(8, "0");
}

export function hashSnapshot(state: WorldState): string {
  const canonical = stableStringify({
    worldHash: hashWorld(state),
    revision: state.revision,
    lastCommittedWallClockMs: state.lastCommittedWallClockMs
  });

  return hashText(canonical).toString(16).padStart(8, "0");
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) =>
      item === undefined ? null : canonicalize(item)
    );
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .filter((key) => record[key] !== undefined)
        .sort()
        .map((key) => [key, canonicalize(record[key])])
    );
  }

  return value;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}
