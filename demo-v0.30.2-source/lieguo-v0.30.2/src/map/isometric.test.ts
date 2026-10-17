import { describe, expect, it } from "vitest";
import {
  GRID_COLUMNS,
  GRID_ROWS,
  TILE_HEIGHT,
  TILE_WIDTH,
  gridToWorld
} from "./isometric";
import { mapNodes } from "./nodes";

describe("isometric map projection", () => {
  it("projects both board axes onto the 2:1 diamond grid", () => {
    const origin = gridToWorld(0, 0);
    const nextColumn = gridToWorld(1, 0);
    const nextRow = gridToWorld(0, 1);

    expect(nextColumn.x - origin.x).toBe(TILE_WIDTH / 2);
    expect(nextColumn.y - origin.y).toBe(TILE_HEIGHT / 2);
    expect(nextRow.x - origin.x).toBe(-TILE_WIDTH / 2);
    expect(nextRow.y - origin.y).toBe(TILE_HEIGHT / 2);
  });

  it("keeps every M0 location inside the rendered board", () => {
    for (const node of mapNodes) {
      expect(node.column).toBeGreaterThanOrEqual(0);
      expect(node.column).toBeLessThan(GRID_COLUMNS);
      expect(node.row).toBeGreaterThanOrEqual(0);
      expect(node.row).toBeLessThan(GRID_ROWS);
    }
  });
});
