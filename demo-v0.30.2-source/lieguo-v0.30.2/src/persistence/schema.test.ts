import { describe, expect, it } from "vitest";
import { hashSnapshot } from "@/simulation/world";
import { createInitialWorld } from "@/simulation/world";
import {
  selectNewestValidSnapshot,
  type SnapshotRecord
} from "./database";
import { parseWorldState } from "./schema";

function createWorld() {
  return createInitialWorld({
    campaignId: "migration-test",
    campaignSeed: 0x12345678,
    civilizationId: "civ_zhongguo",
    wallClockMs: 1_000
  });
}

describe("save schema migration and recovery", () => {
  it("migrates an M0 schema v1 mission into the M1 event queue", () => {
    const current = createWorld();
    const legacy = {
      schemaVersion: 1,
      campaignId: current.campaignId,
      campaignSeed: current.campaignSeed,
      civilizationId: current.civilizationId,
      revision: current.revision,
      worldTimeMs: current.worldTimeMs,
      lastCommittedWallClockMs: current.lastCommittedWallClockMs,
      resourcesMilli: current.resourcesMilli,
      productionRemainders: current.productionRemainders,
      population: current.population,
      nextSequenceId: 2,
      rngState: current.rngStates.simulation,
      scheduledEvents: [
        {
          id: "scout_1",
          dueWorldTimeMs: 12_000,
          priority: 50,
          sequenceId: 1,
          type: "scout_arrival",
          targetNodeId: "village_riverford",
          targetName: "河渡村"
        }
      ],
      scoutMissions: [
        {
          id: "scout_1",
          targetNodeId: "village_riverford",
          targetName: "河渡村",
          departedAtMs: 0,
          arrivesAtMs: 12_000
        }
      ],
      discoveredNodeIds: current.discoveredNodeIds,
      reports: current.reports
    };

    const migrated = parseWorldState(legacy);
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.eventQueue[0]?.missionId).toBe("scout_1");
    expect(migrated.commandLog).toEqual([]);
    expect(migrated.rngStates.ai).toBeGreaterThan(0);
  });

  it("skips a damaged current snapshot and selects the newest valid backup", () => {
    const validState = createWorld();
    const valid: SnapshotRecord = {
      campaignId: validState.campaignId,
      savedAtWallClockMs: 1_000,
      revision: validState.revision,
      checksum: hashSnapshot(validState),
      state: validState
    };
    const damaged: SnapshotRecord = {
      ...valid,
      savedAtWallClockMs: 2_000,
      checksum: "00000000",
      state: { ...validState, population: 999 }
    };

    const selected = selectNewestValidSnapshot([damaged, valid]);
    expect(selected?.record.savedAtWallClockMs).toBe(1_000);
    expect(selected?.state.population).toBe(300);
  });
});
