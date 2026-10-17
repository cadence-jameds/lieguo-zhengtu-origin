export const GRID_COLUMNS = 28;
export const GRID_ROWS = 22;
export const TILE_WIDTH = 72;
export const TILE_HEIGHT = 36;

const MAP_MARGIN_X = 140;
const MAP_MARGIN_TOP = 88;
const MAP_MARGIN_BOTTOM = 180;

export const ISO_ORIGIN_X = MAP_MARGIN_X + (GRID_ROWS * TILE_WIDTH) / 2;
export const ISO_ORIGIN_Y = MAP_MARGIN_TOP;

export const MAP_WIDTH =
  MAP_MARGIN_X * 2 + ((GRID_COLUMNS + GRID_ROWS) * TILE_WIDTH) / 2;
export const MAP_HEIGHT =
  MAP_MARGIN_TOP +
  ((GRID_COLUMNS + GRID_ROWS) * TILE_HEIGHT) / 2 +
  MAP_MARGIN_BOTTOM;

export interface GridPoint {
  column: number;
  row: number;
}

export interface WorldPoint {
  x: number;
  y: number;
}

export function gridToWorld(column: number, row: number): WorldPoint {
  return {
    x: ISO_ORIGIN_X + ((column - row) * TILE_WIDTH) / 2,
    y: ISO_ORIGIN_Y + ((column + row) * TILE_HEIGHT) / 2
  };
}

export function diamondPoints(
  centerX: number,
  centerY: number,
  width = TILE_WIDTH,
  height = TILE_HEIGHT
): number[] {
  return [
    centerX,
    centerY - height / 2,
    centerX + width / 2,
    centerY,
    centerX,
    centerY + height / 2,
    centerX - width / 2,
    centerY
  ];
}
