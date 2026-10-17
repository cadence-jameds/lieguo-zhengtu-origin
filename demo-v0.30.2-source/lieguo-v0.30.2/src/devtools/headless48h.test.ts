import { describe, expect, it } from "vitest";
import { DAY_MS } from "@/simulation/model";
import {
  advanceWorld,
  createInitialWorld,
  hashWorld,
  queueScoutMission
} from "@/simulation/world";

function createScenario() {
  let state = createInitialWorld({
    campaignId: "headless-48h",
    campaignSeed: 0x1a2b3c4d,
    civilizationId: "civ_zhongguo",
    wallClockMs: 0
  });

  for (const [targetNodeId, targetName] of [
    ["village_riverford", "河渡村"],
    ["village_hillwatch", "丘望村"],
    ["resource_ironwood", "鐵木林"],
    ["capital_frankia", "法蘭克首都"]
  ] as const) {
    state = queueScoutMission(state, targetNodeId, targetName).state;
  }

  return state;
}

describe("48-hour headless world runner", () => {
  it("matches one-pass offline catch-up and ten-minute foreground slices", () => {
    const startingState = createScenario();
    const onePass = advanceWorld(startingState, 2 * DAY_MS).state;
    let sliced = startingState;

    for (let slice = 0; slice < 288; slice += 1) {
      sliced = advanceWorld(sliced, 10 * 60 * 1_000).state;
    }

    expect(hashWorld(sliced)).toBe(hashWorld(onePass));
    expect(sliced.worldTimeMs).toBe(2 * DAY_MS);
    expect(sliced.eventQueue).toHaveLength(0);
    expect(sliced.scoutMissions).toHaveLength(0);
    expect(sliced.discoveredNodeIds).toHaveLength(5);
  });
});
