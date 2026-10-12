import { describe, expect, it } from "vitest";
import {
  createInitialWorld,
  hashSnapshot,
  queueScoutMission
} from "@/simulation/world";
import { parseWorldState } from "./schema";
import { createSaveExport, importSaveExport } from "./transfer";

function createWorld() {
  const world = createInitialWorld({
    campaignId: "portable-source",
    campaignSeed: 0x11223344,
    civilizationId: "civ_byzantion",
    wallClockMs: 1_000
  });
  return queueScoutMission(world, "village_riverford", "河渡村").state;
}

describe("portable save transfer", () => {
  it("round-trips a complete snapshot while preserving deterministic state", () => {
    const original = createWorld();
    const exported = createSaveExport(original, 2_000);
    const envelope = JSON.parse(exported.serialized) as {
      snapshot: unknown;
      checksum: string;
    };
    const reparsed = parseWorldState(envelope.snapshot);

    expect(reparsed).toEqual(original);
    expect(hashSnapshot(reparsed)).toBe(envelope.checksum);
    const imported = importSaveExport(
      exported.serialized,
      "portable-target",
      3_000
    );

    expect(exported.filename.endsWith(".realm-save")).toBe(true);
    expect(imported.campaignId).toBe("portable-target");
    expect(imported.eventQueue).toHaveLength(1);
    expect(imported.rngStates.simulation).toBe(original.rngStates.simulation);
  });

  it("rejects a tampered snapshot before overwriting the campaign", () => {
    const exported = createSaveExport(createWorld(), 2_000);
    const tampered = JSON.parse(exported.serialized) as {
      snapshot: { population: number };
    };
    tampered.snapshot.population += 1;

    expect(() =>
      importSaveExport(JSON.stringify(tampered), "portable-target", 3_000)
    ).toThrow(/checksum/);
  });
});
