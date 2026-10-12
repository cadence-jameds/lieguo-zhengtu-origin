import { describe, expect, it } from "vitest";
import { DAY_MS, MVP_PROTECTION_MS } from "./model";
import {
  advanceWorld,
  calculateOfflineWindow,
  createInitialWorld,
  hashWorld,
  queueScoutMission
} from "./world";

function createWorld() {
  return createInitialWorld({
    campaignId: "test-campaign",
    campaignSeed: 0x12345678,
    civilizationId: "civ_zhongguo",
    wallClockMs: 0
  });
}

describe("deterministic world advancement", () => {
  it("produces the same state when time is advanced once or in many slices", () => {
    const startingWorld = createWorld();
    const onePass = advanceWorld(startingWorld, 3_600_123).state;
    const firstSlice = advanceWorld(startingWorld, 1_200_041).state;
    const secondSlice = advanceWorld(firstSlice, 1_200_041).state;
    const manySlices = advanceWorld(secondSlice, 1_200_041).state;

    expect(hashWorld(manySlices)).toBe(hashWorld(onePass));
    expect(manySlices.resourcesMilli).toEqual(onePass.resourcesMilli);
    expect(manySlices.productionRemainders).toEqual(
      onePass.productionRemainders
    );
  });

  it("resolves a queued scout event identically online and offline", () => {
    const queued = queueScoutMission(createWorld(), "village_riverford", "河渡村");
    expect(queued.accepted).toBe(true);

    const onePass = advanceWorld(queued.state, 30_000).state;
    const split = advanceWorld(
      advanceWorld(queued.state, 10_000).state,
      20_000
    ).state;

    expect(hashWorld(split)).toBe(hashWorld(onePass));
    expect(onePass.discoveredNodeIds).toContain("village_riverford");
    expect(onePass.scoutMissions).toHaveLength(0);
  });

  it("uses priority then sequence ID for events due at the same time", () => {
    const world = createWorld();
    world.nextSequenceId = 10;
    world.scoutMissions = [
      {
        id: "mission_later",
        targetNodeId: "later",
        targetName: "後順位",
        departedAtMs: 0,
        arrivesAtMs: 1_000
      },
      {
        id: "mission_first",
        targetNodeId: "first",
        targetName: "第一順位",
        departedAtMs: 0,
        arrivesAtMs: 1_000
      },
      {
        id: "mission_second",
        targetNodeId: "second",
        targetName: "第二順位",
        departedAtMs: 0,
        arrivesAtMs: 1_000
      }
    ];
    world.eventQueue = [
      {
        id: "event_later",
        dueWorldTimeMs: 1_000,
        priority: 50,
        sequenceId: 2,
        type: "scout_arrival",
        missionId: "mission_later",
        targetNodeId: "later",
        targetName: "後順位"
      },
      {
        id: "event_second",
        dueWorldTimeMs: 1_000,
        priority: 10,
        sequenceId: 5,
        type: "scout_arrival",
        missionId: "mission_second",
        targetNodeId: "second",
        targetName: "第二順位"
      },
      {
        id: "event_first",
        dueWorldTimeMs: 1_000,
        priority: 10,
        sequenceId: 4,
        type: "scout_arrival",
        missionId: "mission_first",
        targetNodeId: "first",
        targetName: "第一順位"
      }
    ];

    const advanced = advanceWorld(world, 1_000).state;
    expect(advanced.discoveredNodeIds.slice(1)).toEqual([
      "first",
      "second",
      "later"
    ]);
  });

  it("never awards negative offline time when the device clock moves backward", () => {
    expect(calculateOfflineWindow(10_000, 5_000)).toEqual({
      elapsedMs: 0,
      clockRollbackDetected: true,
      largeClockJumpDetected: false
    });
  });

  it("flags a large catch-up window and keeps the Master protection at 72 hours", () => {
    expect(calculateOfflineWindow(1_000, 1_000 + 4 * DAY_MS)).toEqual({
      elapsedMs: 4 * DAY_MS,
      clockRollbackDetected: false,
      largeClockJumpDetected: true
    });
    expect(MVP_PROTECTION_MS).toBe(72 * 60 * 60 * 1_000);
  });
});
