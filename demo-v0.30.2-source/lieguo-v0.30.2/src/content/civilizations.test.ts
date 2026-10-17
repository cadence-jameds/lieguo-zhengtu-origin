import { describe, expect, it } from "vitest";
import { civilizations } from "./civilizations";

describe("civilization content", () => {
  it("contains the six confirmed civilizations without duplicate ids", () => {
    expect(civilizations.map((civilization) => civilization.name)).toEqual([
      "中國",
      "拜占庭",
      "法蘭克",
      "不列顛",
      "日本",
      "蒙古"
    ]);

    expect(new Set(civilizations.map((civilization) => civilization.id)).size).toBe(6);
    expect(
      new Set(civilizations.map((civilization) => civilization.signatureUnit.id)).size
    ).toBe(6);
  });
});
