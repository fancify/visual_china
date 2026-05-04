import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { qinlingRegionWorld } from "../src/data/qinlingRegion.js";
import { qinlingRouteAnchors } from "../src/game/data/qinlingRouteAnchors.js";

export const DEFAULT_PATH_OPTIONS = Object.freeze({
  slopePenalty: 8,
  elevationPenalty: 0.4,
  maxDeflection: 30
});

const REGION_ASSET_PATH = "public/data/qinling-slice-dem.json";
const OUTPUT_PATH = "src/game/data/qinlingRoutePaths.js";

class MinHeap {
  constructor() {
    this.items = [];
  }

  get size() {
    return this.items.length;
  }

  push(item) {
    this.items.push(item);
    this.#bubbleUp(this.items.length - 1);
  }

  pop() {
    if (this.items.length === 0) {
      return null;
    }

    const root = this.items[0];
    const tail = this.items.pop();

    if (this.items.length > 0 && tail) {
      this.items[0] = tail;
      this.#bubbleDown(0);
    }

    return root;
  }

  #bubbleUp(index) {
    let currentIndex = index;

    while (currentIndex > 0) {
      const parentIndex = Math.floor((currentIndex - 1) / 2);

      if (this.items[parentIndex].f <= this.items[currentIndex].f) {
        break;
      }

      [this.items[parentIndex], this.items[currentIndex]] = [
        this.items[currentIndex],
        this.items[parentIndex]
      ];
      currentIndex = parentIndex;
    }
  }

  #bubbleDown(index) {
    let currentIndex = index;

    while (true) {
      const left = currentIndex * 2 + 1;
      const right = left + 1;
      let nextIndex = currentIndex;

      if (
        left < this.items.length &&
        this.items[left].f < this.items[nextIndex].f
      ) {
        nextIndex = left;
      }

      if (
        right < this.items.length &&
        this.items[right].f < this.items[nextIndex].f
      ) {
        nextIndex = right;
      }

      if (nextIndex === currentIndex) {
        break;
      }

      [this.items[currentIndex], this.items[nextIndex]] = [
        this.items[nextIndex],
        this.items[currentIndex]
      ];
      currentIndex = nextIndex;
    }
  }
}

function keyFor(col, row) {
  return `${col},${row}`;
}

function pointFromKey(key) {
  const [col, row] = key.split(",").map(Number);
  return { col, row };
}

function heuristic(a, b) {
  return Math.hypot(b.col - a.col, b.row - a.row);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distancePointToSegment(point, start, end) {
  const dx = end.col - start.col;
  const dy = end.row - start.row;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    return Math.hypot(point.col - start.col, point.row - start.row);
  }

  const t = clamp(
    ((point.col - start.col) * dx + (point.row - start.row) * dy) / lengthSq,
    0,
    1
  );
  const projectedCol = start.col + dx * t;
  const projectedRow = start.row + dy * t;
  return Math.hypot(point.col - projectedCol, point.row - projectedRow);
}

export function findPath(start, goal, grid, options = {}) {
  const slopePenalty = options.slopePenalty ?? DEFAULT_PATH_OPTIONS.slopePenalty;
  const elevationPenalty =
    options.elevationPenalty ?? DEFAULT_PATH_OPTIONS.elevationPenalty;
  const maxDeflection = options.maxDeflection ?? DEFAULT_PATH_OPTIONS.maxDeflection;
  const startHeight = grid.heightAt(start.col, start.row);
  const goalHeight = grid.heightAt(goal.col, goal.row);

  if (!Number.isFinite(startHeight) || !Number.isFinite(goalHeight)) {
    return null;
  }

  if (start.col === goal.col && start.row === goal.row) {
    return [start];
  }

  const openSet = new MinHeap();
  const cameFrom = new Map();
  const gScore = new Map();
  const startKey = keyFor(start.col, start.row);
  gScore.set(startKey, 0);
  openSet.push({
    key: startKey,
    col: start.col,
    row: start.row,
    g: 0,
    f: heuristic(start, goal)
  });

  while (openSet.size > 0) {
    const current = openSet.pop();
    const currentKey = current.key;
    const bestKnown = gScore.get(currentKey);

    if (bestKnown === undefined || current.g > bestKnown + 1e-9) {
      continue;
    }

    if (current.col === goal.col && current.row === goal.row) {
      const path = [{ col: current.col, row: current.row }];
      let cursorKey = currentKey;

      while (cameFrom.has(cursorKey)) {
        cursorKey = cameFrom.get(cursorKey);
        path.push(pointFromKey(cursorKey));
      }

      return path.reverse();
    }

    const fromHeight = grid.heightAt(current.col, current.row);

    for (const [dc, dr] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1]
    ]) {
      const nextCol = current.col + dc;
      const nextRow = current.row + dr;

      if (
        nextCol < 0 ||
        nextCol >= grid.cols ||
        nextRow < 0 ||
        nextRow >= grid.rows
      ) {
        continue;
      }

      if (
        distancePointToSegment(
          { col: nextCol, row: nextRow },
          start,
          goal
        ) > maxDeflection
      ) {
        continue;
      }

      const toHeight = grid.heightAt(nextCol, nextRow);

      if (!Number.isFinite(toHeight)) {
        continue;
      }

      const stepDistance = Math.hypot(dc, dr);
      const slope = Math.abs(toHeight - fromHeight) / stepDistance;
      const stepCost =
        stepDistance * (1 + slope * slopePenalty) +
        Math.abs(toHeight) * elevationPenalty;
      const tentativeG = current.g + stepCost;
      const nextKey = keyFor(nextCol, nextRow);
      const currentBest = gScore.get(nextKey);

      if (currentBest !== undefined && tentativeG >= currentBest - 1e-9) {
        continue;
      }

      cameFrom.set(nextKey, currentKey);
      gScore.set(nextKey, tentativeG);
      openSet.push({
        key: nextKey,
        col: nextCol,
        row: nextRow,
        g: tentativeG,
        f: tentativeG + heuristic({ col: nextCol, row: nextRow }, goal)
      });
    }
  }

  return null;
}

export function worldToGrid(point, world, cols, rows) {
  return {
    col: clamp(
      Math.round(((point.x + world.width * 0.5) / world.width) * (cols - 1)),
      0,
      cols - 1
    ),
    row: clamp(
      Math.round(((point.y + world.depth * 0.5) / world.depth) * (rows - 1)),
      0,
      rows - 1
    )
  };
}

export function gridToWorld(point, world, cols, rows) {
  return {
    x: ((point.col / (cols - 1)) - 0.5) * world.width,
    y: ((point.row / (rows - 1)) - 0.5) * world.depth
  };
}

function roundPoint(point) {
  return {
    x: Number(point.x.toFixed(3)),
    y: Number(point.y.toFixed(3))
  };
}

export async function loadRegionAsset(assetPath = REGION_ASSET_PATH) {
  return JSON.parse(await readFile(assetPath, "utf8"));
}

function buildGrid(regionAsset) {
  const { columns: cols, rows } = regionAsset.grid;
  const heights = new Float32Array(regionAsset.heights);

  return {
    cols,
    rows,
    heightAt(col, row) {
      if (col < 0 || col >= cols || row < 0 || row >= rows) {
        return Number.POSITIVE_INFINITY;
      }

      return heights[row * cols + col];
    }
  };
}

function buildDenseSegmentWorldPath(startPoint, endPoint, grid, world, options) {
  const start = worldToGrid(startPoint, world, grid.cols, grid.rows);
  const goal = worldToGrid(endPoint, world, grid.cols, grid.rows);

  if (start.col === goal.col && start.row === goal.row) {
    return [roundPoint(startPoint), roundPoint(endPoint)];
  }

  const path = findPath(start, goal, grid, options);

  if (!path || path.length < 2) {
    return [roundPoint(startPoint), roundPoint(endPoint)];
  }

  const worldPath = [roundPoint(startPoint)];

  for (let index = 1; index < path.length - 1; index += 1) {
    worldPath.push(
      roundPoint(gridToWorld(path[index], world, grid.cols, grid.rows))
    );
  }

  worldPath.push(roundPoint(endPoint));
  return worldPath;
}

export function buildRoutePaths({
  routeAnchors = qinlingRouteAnchors,
  regionAsset,
  world = qinlingRegionWorld,
  pathOptions = DEFAULT_PATH_OPTIONS
}) {
  if (!regionAsset) {
    throw new Error("buildRoutePaths requires a regionAsset");
  }

  const startedAt = performance.now();
  const grid = buildGrid(regionAsset);
  const paths = {};
  const routeStats = [];

  for (const [routeId, anchorEntry] of Object.entries(routeAnchors)) {
    const anchors = anchorEntry.points;
    const dense = [];
    let fallbackSegments = 0;

    for (let index = 0; index < anchors.length - 1; index += 1) {
      const worldPath = buildDenseSegmentWorldPath(
        anchors[index],
        anchors[index + 1],
        grid,
        world,
        pathOptions
      );

      if (worldPath.length <= 2) {
        fallbackSegments += 1;
      }

      if (index === 0) {
        dense.push(...worldPath);
      } else {
        dense.push(...worldPath.slice(1));
      }
    }

    paths[routeId] = dense;
    routeStats.push({
      routeId,
      anchorCount: anchors.length,
      denseCount: dense.length,
      segmentCount: Math.max(0, anchors.length - 1),
      fallbackSegments
    });
  }

  const durationMs = performance.now() - startedAt;
  const totalPoints = routeStats.reduce((sum, route) => sum + route.denseCount, 0);

  return {
    paths,
    stats: {
      durationMs,
      totalPoints,
      routes: routeStats
    }
  };
}

export function serializeRoutePaths(paths) {
  return `// 自动生成 by scripts/build-shu-road-paths.mjs，不要手改。\nexport const qinlingRoutePaths = ${JSON.stringify(
    paths,
    null,
    2
  )};\n`;
}

export async function generateRoutePaths({
  assetPath = REGION_ASSET_PATH,
  outputPath = OUTPUT_PATH,
  routeAnchors = qinlingRouteAnchors,
  world = qinlingRegionWorld,
  pathOptions = DEFAULT_PATH_OPTIONS
} = {}) {
  const regionAsset = await loadRegionAsset(assetPath);
  const result = buildRoutePaths({
    routeAnchors,
    regionAsset,
    world,
    pathOptions
  });
  const source = serializeRoutePaths(result.paths);
  await writeFile(outputPath, source, "utf8");

  return {
    ...result,
    outputPath,
    source
  };
}

function formatBuildSummary(result) {
  const lines = [
    `Generated ${result.stats.routes.length} route paths in ${result.stats.durationMs.toFixed(1)}ms`,
    `Total dense points: ${result.stats.totalPoints}`,
    `Output: ${result.outputPath}`
  ];

  result.stats.routes.forEach((route) => {
    lines.push(
      `- ${route.routeId}: ${route.anchorCount} anchors -> ${route.denseCount} points`
    );
  });

  return lines.join("\n");
}

const isMainModule =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  const result = await generateRoutePaths();
  console.log(formatBuildSummary(result));
}
