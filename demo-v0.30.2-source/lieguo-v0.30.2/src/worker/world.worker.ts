/// <reference lib="webworker" />

import {
  countBackups,
  createRecoveryPoint,
  loadWorld,
  saveWorld,
  type SaveWorldOptions
} from "@/persistence/database";
import { createSaveExport, importSaveExport } from "@/persistence/transfer";
import type { WorldState } from "@/simulation/model";
import {
  advanceWorld,
  applyLoadDiagnostics,
  calculateOfflineWindow,
  createInitialWorld,
  createOfflineSummary,
  executeWorldCommand,
  toWorldView
} from "@/simulation/world";
import type {
  MainToWorkerMessage,
  WorkerToMainMessage
} from "./protocol";

const workerScope: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;
const AUTOSAVE_INTERVAL_MS = 5 * 60 * 1_000;
const VIEW_INTERVAL_MS = 500;

let world: WorldState | null = null;
let lastMonotonicMs = performance.now();
let lastObservedWallClockMs = Date.now();
let lastAutosaveMonotonicMs = performance.now();
let lastViewMonotonicMs = 0;
let timerId: number | null = null;
let operationChain: Promise<void> = Promise.resolve();

function post(message: WorkerToMainMessage): void {
  workerScope.postMessage(message);
}

function reportFatal(error: unknown): void {
  post({
    type: "error",
    message: error instanceof Error ? error.message : "世界模擬發生未知錯誤。"
  });
}

function enqueue(operation: () => Promise<void>): void {
  operationChain = operationChain.then(operation).catch(reportFatal);
}

function advanceToNow(): void {
  if (!world) {
    return;
  }

  const now = performance.now();
  const wallClockMs = Date.now();
  const monotonicDeltaMs = Math.max(0, Math.floor(now - lastMonotonicMs));
  const timing = calculateOfflineWindow(
    lastObservedWallClockMs,
    wallClockMs
  );
  const deltaMs = timing.clockRollbackDetected
    ? monotonicDeltaMs
    : timing.elapsedMs;

  if (timing.clockRollbackDetected || timing.largeClockJumpDetected) {
    world = applyLoadDiagnostics(world, {
      recoveredFromBackup: false,
      clockRollbackDetected: timing.clockRollbackDetected,
      largeClockJumpDetected: timing.largeClockJumpDetected
    });
  }

  if (deltaMs > 0) {
    world = advanceWorld(world, deltaMs).state;
  }
  lastMonotonicMs = now;
  lastObservedWallClockMs = wallClockMs;
}

async function persist(options: SaveWorldOptions = {}): Promise<void> {
  if (!world) {
    return;
  }

  world = await saveWorld(world, options);
  lastAutosaveMonotonicMs = performance.now();
}

async function tick(): Promise<void> {
  if (!world) {
    return;
  }

  advanceToNow();
  const now = performance.now();

  if (now - lastViewMonotonicMs >= VIEW_INTERVAL_MS) {
    post({ type: "update", view: toWorldView(world) });
    lastViewMonotonicMs = now;
  }

  if (now - lastAutosaveMonotonicMs >= AUTOSAVE_INTERVAL_MS) {
    await persist({ backupReason: "scheduled_autosave" });
    post({
      type: "persistence_updated",
      backupCount: await countBackups(world.campaignId)
    });
  }
}

function startLoop(): void {
  if (timerId !== null) {
    workerScope.clearInterval(timerId);
  }

  timerId = workerScope.setInterval(() => {
    enqueue(tick);
  }, 250);
}

async function initialize(
  message: Extract<MainToWorkerMessage, { type: "initialize" }>
): Promise<void> {
  const now = Date.now();
  const loaded = await loadWorld(message.campaignId);
  let offlineSummary = null;

  if (loaded.state) {
    const timing = calculateOfflineWindow(
      loaded.state.lastCommittedWallClockMs,
      now
    );

    if (
      timing.elapsedMs > 0 ||
      timing.clockRollbackDetected ||
      loaded.recoveredFromBackup
    ) {
      await createRecoveryPoint(
        loaded.state,
        loaded.recoveredFromBackup
          ? "before_backup_recovery"
          : "before_offline_catchup",
        now
      );
    }

    const diagnosed = applyLoadDiagnostics(loaded.state, {
      recoveredFromBackup: loaded.recoveredFromBackup,
      clockRollbackDetected: timing.clockRollbackDetected,
      largeClockJumpDetected: timing.largeClockJumpDetected
    });
    const advanced = advanceWorld(diagnosed, timing.elapsedMs);
    offlineSummary =
      timing.elapsedMs >= 1_000 ||
      loaded.recoveredFromBackup ||
      timing.clockRollbackDetected
        ? createOfflineSummary(
            diagnosed,
            advanced.state,
            timing.elapsedMs,
            advanced.completedEvents,
            {
              recoveredFromBackup: loaded.recoveredFromBackup,
              clockRollbackDetected: timing.clockRollbackDetected,
              largeClockJumpDetected: timing.largeClockJumpDetected
            }
          )
        : null;
    world = advanced.state;
  } else {
    world = createInitialWorld({
      campaignId: message.campaignId,
      campaignSeed: message.campaignSeed,
      civilizationId: message.civilizationId,
      wallClockMs: now
    });
  }

  lastMonotonicMs = performance.now();
  lastObservedWallClockMs = now;
  lastAutosaveMonotonicMs = lastMonotonicMs;
  await persist({ createBackup: false, wallClockMs: now });
  post({
    type: "ready",
    view: toWorldView(world),
    offlineSummary,
    persistence: {
      backupCount: await countBackups(message.campaignId),
      recoveredFromBackup: loaded.recoveredFromBackup,
      ...(loaded.recoveryRevision === undefined
        ? {}
        : { recoveryRevision: loaded.recoveryRevision })
    }
  });
  startLoop();
}

async function handleCommand(
  message: Extract<MainToWorkerMessage, { type: "execute_command" }>
): Promise<void> {
  if (!world) {
    post({ type: "command_rejected", reason: "世界仍在載入。" });
    return;
  }

  advanceToNow();
  const result = executeWorldCommand(world, message.command);
  world = result.state;
  await persist({ backupReason: "player_command" });
  post({
    type: "persistence_updated",
    backupCount: await countBackups(world.campaignId)
  });

  if (!result.accepted) {
    post({
      type: "command_rejected",
      reason: result.reason ?? "命令未通過規則檢查。"
    });
  } else {
    post({
      type: "command_accepted",
      message: `斥候已受命前往 ${message.command.targetName}`
    });
  }
  post({ type: "update", view: toWorldView(world) });
}

async function handleExport(): Promise<void> {
  if (!world) {
    post({
      type: "operation_failed",
      operation: "export",
      message: "世界仍在載入。"
    });
    return;
  }

  try {
    advanceToNow();
    await persist({ backupReason: "before_manual_export" });
    post({
      type: "persistence_updated",
      backupCount: await countBackups(world.campaignId)
    });
    const exported = createSaveExport(world, Date.now());
    post({ type: "save_exported", ...exported });
  } catch (error) {
    post({
      type: "operation_failed",
      operation: "export",
      message: error instanceof Error ? error.message : "存檔匯出失敗。"
    });
  }
}

async function handleImport(
  message: Extract<MainToWorkerMessage, { type: "import_save" }>
): Promise<void> {
  if (!world) {
    post({
      type: "operation_failed",
      operation: "import",
      message: "世界仍在載入。"
    });
    return;
  }

  try {
    advanceToNow();
    const currentCampaignId = world.campaignId;
    const now = Date.now();
    const imported = importSaveExport(
      message.serialized,
      currentCampaignId,
      now
    );

    await createRecoveryPoint(world, "before_manual_import", now);
    world = await saveWorld(imported, {
      createBackup: false,
      wallClockMs: now
    });
    lastMonotonicMs = performance.now();
    lastObservedWallClockMs = now;
    lastAutosaveMonotonicMs = lastMonotonicMs;
    post({
      type: "save_imported",
      view: toWorldView(world),
      persistence: {
        backupCount: await countBackups(currentCampaignId),
        recoveredFromBackup: false
      }
    });
  } catch (error) {
    post({
      type: "operation_failed",
      operation: "import",
      message: error instanceof Error ? error.message : "存檔匯入失敗。"
    });
  }
}

async function handleFlush(): Promise<void> {
  if (!world) {
    return;
  }

  try {
    advanceToNow();
    await persist({ backupReason: "lifecycle_flush" });
    post({
      type: "persistence_updated",
      backupCount: await countBackups(world.campaignId)
    });
    post({ type: "flushed" });
  } catch (error) {
    post({
      type: "operation_failed",
      operation: "flush",
      message: error instanceof Error ? error.message : "存檔提交失敗。"
    });
  }
}

async function handleMessage(message: MainToWorkerMessage): Promise<void> {
  if (message.type === "initialize") {
    await initialize(message);
    return;
  }
  if (message.type === "execute_command") {
    await handleCommand(message);
    return;
  }
  if (message.type === "resume") {
    advanceToNow();
    if (world) {
      post({ type: "update", view: toWorldView(world) });
    }
    return;
  }
  if (message.type === "flush") {
    await handleFlush();
    return;
  }
  if (message.type === "export_save") {
    await handleExport();
    return;
  }
  if (message.type === "import_save") {
    await handleImport(message);
  }
}

workerScope.addEventListener(
  "message",
  (event: MessageEvent<MainToWorkerMessage>) => {
    enqueue(() => handleMessage(event.data));
  }
);
