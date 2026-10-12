import { useEffect, useRef } from "react";
import {
  Application,
  Container,
  FederatedPointerEvent,
  Graphics,
  Text,
  TextStyle
} from "pixi.js";
import { civilizationById } from "@/content/civilizations";
import {
  GRID_COLUMNS,
  GRID_ROWS,
  MAP_HEIGHT,
  MAP_WIDTH,
  TILE_HEIGHT,
  TILE_WIDTH,
  diamondPoints,
  gridToWorld,
  type GridPoint,
  type WorldPoint
} from "./isometric";
import { mapNodes, type MapNode } from "./nodes";

interface WorldMapCanvasProps {
  selectedNodeId: string;
  discoveredNodeIds: string[];
  onSelectNode: (nodeId: string) => void;
}

type TerrainKind =
  | "farmland"
  | "forest"
  | "grass"
  | "hill"
  | "mountain"
  | "steppe"
  | "water";

const terrainColors: Record<TerrainKind, readonly number[]> = {
  farmland: [0x8fa84e, 0xa0b45a, 0x819946],
  forest: [0x2c5339, 0x315d3d, 0x274b35],
  grass: [0x5e783d, 0x688242, 0x59713a],
  hill: [0x6e7043, 0x79764a, 0x64683f],
  mountain: [0x69645a, 0x756d5f, 0x5d5a52],
  steppe: [0x8b8147, 0x978b4e, 0x7f7842],
  water: [0x326c80, 0x39788c, 0x2d6277]
};

const roadPairs = [
  ["settlement_capital", "village_riverford"],
  ["village_riverford", "village_hillwatch"],
  ["village_riverford", "resource_ironwood"],
  ["resource_ironwood", "capital_frankia"],
  ["capital_frankia", "capital_mongol"],
  ["resource_ironwood", "resource_horseplain"],
  ["resource_horseplain", "capital_byzantion"],
  ["resource_horseplain", "capital_japan"]
] as const;

const riverRoutes: GridPoint[][] = [
  [
    { column: 3, row: 1 },
    { column: 5, row: 4 },
    { column: 6, row: 8 },
    { column: 9, row: 11 },
    { column: 10, row: 15 },
    { column: 13, row: 19 },
    { column: 18, row: 21 }
  ],
  [
    { column: 9, row: 11 },
    { column: 13, row: 10 },
    { column: 17, row: 11 },
    { column: 20, row: 14 },
    { column: 24, row: 15 }
  ]
];

function coordinateHash(column: number, row: number): number {
  return Math.abs(
    Math.imul(column + 17, 73_856_093) ^ Math.imul(row + 31, 19_349_663)
  );
}

function terrainKindAt(column: number, row: number): TerrainKind {
  const isNearSettlement = mapNodes.some(
    (node) =>
      node.kind !== "resource" &&
      Math.abs(node.column - column) + Math.abs(node.row - row) <= 1
  );

  if (isNearSettlement) {
    return "farmland";
  }

  if (
    (column >= 24 && row <= 4) ||
    (column <= 1 && row >= 17) ||
    (column >= 26 && row >= 17)
  ) {
    return "water";
  }

  if (
    (column <= 4 && row >= 13) ||
    (column >= 22 && column <= 26 && row >= 1 && row <= 4)
  ) {
    return "mountain";
  }

  if (
    (column >= 2 && column <= 8 && row >= 5 && row <= 11) ||
    (column >= 13 && column <= 18 && row >= 15 && row <= 20)
  ) {
    return coordinateHash(column, row) % 4 === 0 ? "grass" : "forest";
  }

  if (column >= 14 && row <= 8) {
    return "steppe";
  }

  return coordinateHash(column, row) % 7 === 0 ? "hill" : "grass";
}

function terrainColor(kind: TerrainKind, column: number, row: number): number {
  const palette = terrainColors[kind];
  return palette[coordinateHash(column, row) % palette.length];
}

function parseColor(value: string): number {
  return Number.parseInt(value.replace("#", ""), 16);
}

function mixColor(color: number, amount: number): number {
  const red = Math.max(0, Math.min(255, ((color >> 16) & 0xff) + amount));
  const green = Math.max(0, Math.min(255, ((color >> 8) & 0xff) + amount));
  const blue = Math.max(0, Math.min(255, (color & 0xff) + amount));
  return (red << 16) | (green << 8) | blue;
}

function nodeColor(node: MapNode): number {
  if (node.civilizationId) {
    return parseColor(
      civilizationById.get(node.civilizationId)?.accent ?? "#c6a15b"
    );
  }

  return node.kind === "resource" ? 0xd1a34b : 0xbab39a;
}

function addRoute(graphics: Graphics, points: readonly WorldPoint[]): void {
  const first = points[0];

  if (!first) {
    return;
  }

  graphics.moveTo(first.x, first.y);
  for (const point of points.slice(1)) {
    graphics.lineTo(point.x, point.y);
  }
}

function roadRoute(from: MapNode, to: MapNode, index: number): WorldPoint[] {
  const bend =
    index % 2 === 0
      ? { column: to.column, row: from.row }
      : { column: from.column, row: to.row };

  return [
    gridToWorld(from.column, from.row),
    gridToWorld(bend.column, bend.row),
    gridToWorld(to.column, to.row)
  ];
}

function drawTileDetail(
  details: Graphics,
  kind: TerrainKind,
  point: WorldPoint,
  column: number,
  row: number
): void {
  const variation = coordinateHash(column, row) % 3;

  if (kind === "farmland") {
    details
      .poly(diamondPoints(point.x, point.y, TILE_WIDTH - 14, TILE_HEIGHT - 7), true)
      .stroke({ color: 0xd5c66c, width: 1.2, alpha: 0.82 });
    details
      .moveTo(point.x - 18, point.y - 4)
      .lineTo(point.x + 5, point.y + 8)
      .moveTo(point.x - 5, point.y - 8)
      .lineTo(point.x + 18, point.y + 4)
      .stroke({ color: 0x6e843d, width: 1, alpha: 0.72 });
    return;
  }

  if (kind === "forest") {
    for (let tree = 0; tree < 3; tree += 1) {
      const offsetX = (tree - 1) * 11 + variation * 2;
      const offsetY = tree % 2 === 0 ? 2 : -4;
      details
        .poly(
          [
            point.x + offsetX,
            point.y - 11 + offsetY,
            point.x + offsetX + 7,
            point.y + 5 + offsetY,
            point.x + offsetX - 7,
            point.y + 5 + offsetY
          ],
          true
        )
        .fill({ color: 0x183d2a, alpha: 0.82 });
    }
    return;
  }

  if (kind === "mountain") {
    details
      .poly(
        [
          point.x - 17,
          point.y + 7,
          point.x - 2,
          point.y - 13,
          point.x + 8,
          point.y + 7
        ],
        true
      )
      .fill({ color: 0x4b4a45, alpha: 0.9 })
      .poly(
        [
          point.x - 1,
          point.y - 13,
          point.x + 6,
          point.y - 3,
          point.x + 2,
          point.y - 5,
          point.x - 5,
          point.y - 3
        ],
        true
      )
      .fill({ color: 0xd0c8ad, alpha: 0.8 });
    return;
  }

  if (kind === "water") {
    const offset = variation * 3;
    details
      .moveTo(point.x - 17 + offset, point.y - 2)
      .lineTo(point.x - 4 + offset, point.y - 2)
      .moveTo(point.x + 2 - offset, point.y + 5)
      .lineTo(point.x + 16 - offset, point.y + 5)
      .stroke({ color: 0x75b5c3, width: 1.2, alpha: 0.58 });
  }
}

function drawSelection(ring: Graphics, nodeId: string): void {
  const node = mapNodes.find((candidate) => candidate.id === nodeId) ?? mapNodes[0];
  const point = gridToWorld(node.column, node.row);

  ring
    .clear()
    .poly(diamondPoints(0, 0, TILE_WIDTH + 10, TILE_HEIGHT + 6), true)
    .fill({ color: 0xf4d16f, alpha: 0.13 })
    .stroke({ color: 0xf6d77d, width: 3, alpha: 0.98 });
  ring.position.set(point.x, point.y);
}

function createLocationMarker(node: MapNode, discovered: boolean): Container {
  const marker = new Container();
  const color = nodeColor(node);
  const isVisible = discovered || node.kind === "capital";

  marker.alpha = isVisible ? 1 : 0.5;
  marker.addChild(
    new Graphics().ellipse(0, 6, node.kind === "capital" ? 28 : 22, 8).fill({
      color: 0x101611,
      alpha: 0.52
    })
  );

  const structure = new Graphics();

  if (node.kind === "resource") {
    structure
      .poly([-17, 4, -5, -18, 3, 5], true)
      .fill({ color: mixColor(color, -36) })
      .poly([-5, 5, 7, -24, 18, 5], true)
      .fill({ color })
      .poly([-2, -5, 7, -24, 10, -5], true)
      .fill({ color: mixColor(color, 42), alpha: 0.9 });
  } else {
    const size = node.kind === "capital" ? 23 : 18;
    const roofHeight = node.kind === "capital" ? 27 : 22;

    structure
      .poly([-size, -10, 0, 2, 0, 20, -size, 8], true)
      .fill({ color: mixColor(color, -58) })
      .poly([size, -10, 0, 2, 0, 20, size, 8], true)
      .fill({ color: mixColor(color, -26) })
      .poly([-size, -10, 0, -roofHeight, size, -10, 0, 2], true)
      .fill({ color: mixColor(color, 18) })
      .stroke({ color: 0x1b211b, width: 2, alpha: 0.9 });

    if (node.kind === "capital") {
      structure
        .rect(-4, 2, 8, 17)
        .fill({ color: 0x302c22, alpha: 0.88 })
        .moveTo(0, -27)
        .lineTo(0, -47)
        .stroke({ color: 0xe7d9b3, width: 2 })
        .poly([1, -46, 15, -41, 1, -36], true)
        .fill({ color });
    }
  }

  marker.addChild(structure);
  return marker;
}

function interpolateRoute(points: readonly WorldPoint[], progress: number): WorldPoint {
  if (points.length < 2) {
    return points[0] ?? { x: 0, y: 0 };
  }

  const segmentProgress = progress * (points.length - 1);
  const segmentIndex = Math.min(
    points.length - 2,
    Math.floor(segmentProgress)
  );
  const localProgress = segmentProgress - segmentIndex;
  const from = points[segmentIndex];
  const to = points[segmentIndex + 1];

  return {
    x: from.x + (to.x - from.x) * localProgress,
    y: from.y + (to.y - from.y) * localProgress
  };
}

export function WorldMapCanvas({
  selectedNodeId,
  discoveredNodeIds,
  onSelectNode
}: WorldMapCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const selectionRingRef = useRef<Graphics | null>(null);
  const discoveryKey = discoveredNodeIds.join("|");

  useEffect(() => {
    if (selectionRingRef.current) {
      drawSelection(selectionRingRef.current, selectedNodeId);
    }
  }, [selectedNodeId]);

  useEffect(() => {
    const host = hostRef.current;

    if (!host) {
      return;
    }

    let cancelled = false;
    let initialized = false;
    let resizeObserver: ResizeObserver | null = null;
    const app = new Application();

    const initialize = async (): Promise<void> => {
      await app.init({
        resizeTo: host,
        antialias: true,
        backgroundColor: 0x435b38,
        resolution: Math.min(window.devicePixelRatio, 2),
        autoDensity: true
      });
      initialized = true;

      if (cancelled) {
        app.destroy(true, { children: true });
        return;
      }

      app.canvas.className = "world-map-canvas";
      app.canvas.setAttribute("aria-hidden", "true");
      host.appendChild(app.canvas);

      const world = new Container();
      app.stage.addChild(world);

      const backdrop = new Graphics()
        .rect(0, 0, MAP_WIDTH, MAP_HEIGHT)
        .fill({ color: 0x435b38 });
      const backgroundTerrain = new Graphics();
      for (let row = -2; row < GRID_ROWS + 2; row += 1) {
        for (let column = -2; column < GRID_COLUMNS + 2; column += 1) {
          const point = gridToWorld(column, row);
          const kind = terrainKindAt(column, row);
          backgroundTerrain
            .poly(diamondPoints(point.x, point.y), true)
            .fill({ color: terrainColor(kind, column, row), alpha: 0.76 });
        }
      }
      world.addChild(backdrop, backgroundTerrain);

      const terrain = new Graphics();
      const territory = new Graphics();
      const details = new Graphics();
      const grid = new Graphics();
      const capitals = mapNodes.filter((node) => node.kind === "capital");

      for (let row = 0; row < GRID_ROWS; row += 1) {
        for (let column = 0; column < GRID_COLUMNS; column += 1) {
          const point = gridToWorld(column, row);
          const kind = terrainKindAt(column, row);
          const tileShape = diamondPoints(point.x, point.y);

          terrain
            .poly(tileShape, true)
            .fill({ color: terrainColor(kind, column, row) });

          const controllingCapital = capitals.find(
            (capital) =>
              Math.abs(capital.column - column) +
                Math.abs(capital.row - row) <=
              2
          );

          if (controllingCapital?.civilizationId) {
            const accent = civilizationById.get(
              controllingCapital.civilizationId
            )?.accent;
            if (accent) {
              territory
                .poly(tileShape, true)
                .fill({ color: parseColor(accent), alpha: 0.16 });
            }
          }

          drawTileDetail(details, kind, point, column, row);
          grid.poly(tileShape, true);
        }
      }

      grid.stroke({ color: 0x213a35, width: 1.15, alpha: 0.74 });
      world.addChild(terrain, territory, details, grid);

      const riverShadow = new Graphics();
      const rivers = new Graphics();
      for (const route of riverRoutes) {
        const points = route.map((point) => gridToWorld(point.column, point.row));
        addRoute(riverShadow, points);
        addRoute(rivers, points);
      }
      riverShadow.stroke({ color: 0x18363f, width: 10, alpha: 0.78 });
      rivers.stroke({ color: 0x3aa2c0, width: 5.5, alpha: 0.96 });
      world.addChild(riverShadow, rivers);

      const roadShadow = new Graphics();
      const roads = new Graphics();
      const renderedRoads: WorldPoint[][] = [];
      roadPairs.forEach(([fromId, toId], index) => {
        const from = mapNodes.find((node) => node.id === fromId);
        const to = mapNodes.find((node) => node.id === toId);
        if (!from || !to) {
          return;
        }

        const route = roadRoute(from, to, index);
        renderedRoads.push(route);
        addRoute(roadShadow, route);
        addRoute(roads, route);
      });
      roadShadow.stroke({ color: 0x3b3222, width: 8, alpha: 0.55 });
      roads.stroke({ color: 0xd4bd7e, width: 4, alpha: 0.92 });
      world.addChild(roadShadow, roads);

      const selectionRing = new Graphics();
      drawSelection(selectionRing, selectedNodeId);
      selectionRingRef.current = selectionRing;
      world.addChild(selectionRing);

      const labelStyle = new TextStyle({
        fontFamily: "Microsoft JhengHei, PingFang TC, system-ui, sans-serif",
        fontSize: 15,
        fontWeight: "700",
        fill: 0xf3ecd9,
        stroke: { color: 0x111812, width: 4 }
      });

      const sortedNodes = [...mapNodes].sort(
        (left, right) =>
          left.column + left.row - (right.column + right.row)
      );

      for (const node of sortedNodes) {
        const discovered = discoveredNodeIds.includes(node.id);
        const point = gridToWorld(node.column, node.row);
        const marker = createLocationMarker(node, discovered);
        marker.position.set(point.x, point.y - 7);
        marker.eventMode = "static";
        marker.cursor = "pointer";
        marker.on("pointertap", (event: FederatedPointerEvent) => {
          event.stopPropagation();
          onSelectNode(node.id);
        });
        world.addChild(marker);

        const label = new Text({
          text:
            discovered || node.kind === "capital" ? node.name : "未知地點",
          style: labelStyle
        });
        label.anchor.set(0.5, 0);
        label.position.set(point.x, point.y + 22);
        world.addChild(label);
      }

      const caravanRoute = renderedRoads[0] ?? [];
      const caravan = new Graphics()
        .poly(diamondPoints(0, 0, 14, 8), true)
        .fill({ color: 0xf4d77a })
        .stroke({ color: 0x2b2113, width: 2 });
      world.addChild(caravan);

      app.ticker.add((ticker) => {
        const progress = (ticker.lastTime % 10_000) / 10_000;
        const point = interpolateRoute(caravanRoute, progress);
        caravan.position.set(point.x, point.y - 3);
      });

      let dragging = false;
      let lastPointer = { x: 0, y: 0 };

      app.stage.eventMode = "static";
      app.stage.hitArea = app.screen;
      app.stage.on("pointerdown", (event: FederatedPointerEvent) => {
        dragging = true;
        lastPointer = { x: event.global.x, y: event.global.y };
      });
      app.stage.on("pointerup", () => {
        dragging = false;
      });
      app.stage.on("pointerupoutside", () => {
        dragging = false;
      });
      app.stage.on("pointermove", (event: FederatedPointerEvent) => {
        if (!dragging) {
          return;
        }

        world.x += event.global.x - lastPointer.x;
        world.y += event.global.y - lastPointer.y;
        lastPointer = { x: event.global.x, y: event.global.y };
      });

      const fitMap = (): void => {
        const fitScale =
          Math.min(host.clientWidth / MAP_WIDTH, host.clientHeight / MAP_HEIGHT) *
          0.96;
        const scale = Math.max(0.32, Math.min(1.2, fitScale));
        world.scale.set(scale);
        world.position.set(
          (host.clientWidth - MAP_WIDTH * scale) / 2,
          (host.clientHeight - MAP_HEIGHT * scale) / 2
        );
        app.stage.hitArea = app.screen;
      };

      const handleWheel = (event: WheelEvent): void => {
        event.preventDefault();
        const oldScale = world.scale.x;
        const nextScale = Math.min(
          2.1,
          Math.max(0.3, oldScale * (event.deltaY > 0 ? 0.9 : 1.1))
        );
        const canvasBounds = app.canvas.getBoundingClientRect();
        const pointerX = event.clientX - canvasBounds.left;
        const pointerY = event.clientY - canvasBounds.top;
        const localX = (pointerX - world.x) / oldScale;
        const localY = (pointerY - world.y) / oldScale;

        world.scale.set(nextScale);
        world.position.set(
          pointerX - localX * nextScale,
          pointerY - localY * nextScale
        );
      };

      fitMap();
      resizeObserver = new ResizeObserver(fitMap);
      resizeObserver.observe(host);
      app.canvas.addEventListener("wheel", handleWheel, { passive: false });
    };

    void initialize();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      selectionRingRef.current = null;
      if (initialized) {
        app.destroy(true, { children: true });
      }
    };
  }, [discoveryKey, onSelectNode]);

  return <div ref={hostRef} className="world-map-host" />;
}
