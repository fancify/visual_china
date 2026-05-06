import assert from "node:assert/strict";
import test from "node:test";

import { qinlingRouteAnchors } from "../src/game/data/qinlingRouteAnchors.js";
import { qinlingRoutePaths } from "../src/game/data/qinlingRoutePaths.js";
import { buildRoutePaths, findPath } from "./build-shu-road-paths.mjs";

function createGrid(rows) {
  return {
    cols: rows[0].length,
    rows: rows.length,
    heightAt(col, row) {
      if (row < 0 || row >= rows.length || col < 0 || col >= rows[0].length) {
        return Number.POSITIVE_INFINITY;
      }

      return rows[row][col];
    }
  };
}

test("A* prefers a flatter detour instead of cutting across a steep ridge", () => {
  const grid = createGrid([
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 100, 0, 0, 0],
    [0, 0, 0, 100, 0, 0, 0],
    [0, 0, 0, 100, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0]
  ]);

  const path = findPath(
    { col: 0, row: 2 },
    { col: 6, row: 2 },
    grid,
    { slopePenalty: 8, elevationPenalty: 0.4, maxDeflection: 4 }
  );

  assert.ok(path, "path should exist");
  assert.equal(path[0].col, 0);
  assert.equal(path[0].row, 2);
  assert.equal(path.at(-1).col, 6);
  assert.equal(path.at(-1).row, 2);
  assert.equal(
    path.some(({ col, row }) => col === 3 && row >= 1 && row <= 3),
    false,
    "path should avoid the steep ridge cells"
  );
  assert.ok(
    path.some(({ row }) => row === 0 || row === 4),
    "path should use the flatter top or bottom detour"
  );
});

test("A* maxDeflection limits how far the route may swing away from the anchor line", () => {
  const grid = createGrid([
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, Number.POSITIVE_INFINITY, 0, 0, 0],
    [0, 0, 0, Number.POSITIVE_INFINITY, 0, 0, 0],
    [0, 0, 0, Number.POSITIVE_INFINITY, 0, 0, 0],
    [0, 0, 0, Number.POSITIVE_INFINITY, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0]
  ]);

  const blockedByDeflection = findPath(
    { col: 0, row: 2 },
    { col: 6, row: 2 },
    grid,
    { slopePenalty: 8, elevationPenalty: 0.4, maxDeflection: 1 }
  );
  const allowedDetour = findPath(
    { col: 0, row: 2 },
    { col: 6, row: 2 },
    grid,
    { slopePenalty: 8, elevationPenalty: 0.4, maxDeflection: 3 }
  );

  assert.equal(blockedByDeflection, null);
  assert.ok(allowedDetour, "path should exist once the corridor is wide enough");
  assert.ok(
    allowedDetour.some(({ row }) => row === 0 || row === 5),
    "detour should leave the direct corridor when allowed"
  );
});

test("route path builder and generated data both include the two southern expansion routes", () => {
  const routeIds = Object.keys(qinlingRouteAnchors).sort();
  const pathIds = Object.keys(qinlingRoutePaths).sort();

  assert.equal(routeIds.length, 11);
  assert.equal(pathIds.length, 11);
  assert.ok(routeIds.includes("chama-route"));
  assert.ok(routeIds.includes("xiang-qian-route"));
  assert.ok(pathIds.includes("chama-route"));
  assert.ok(pathIds.includes("xiang-qian-route"));
});

test("buildRoutePaths returns per-route stats for arbitrary southern route anchor sets", () => {
  const regionAsset = {
    grid: { columns: 12, rows: 12 },
    heights: new Array(144).fill(0)
  };

  const routeAnchors = {
    "chama-route": {
      points: [
        { x: -4, y: -4 },
        { x: 0, y: 0 },
        { x: 4, y: 4 }
      ]
    },
    "xiang-qian-route": {
      points: [
        { x: -4, y: 4 },
        { x: 0, y: 0 },
        { x: 4, y: -4 }
      ]
    }
  };

  const result = buildRoutePaths({
    routeAnchors,
    regionAsset,
    world: { width: 10, depth: 10 },
    pathOptions: { slopePenalty: 8, elevationPenalty: 0.4, maxDeflection: 20 }
  });

  assert.deepEqual(
    result.stats.routes.map((route) => route.routeId).sort(),
    ["chama-route", "xiang-qian-route"]
  );
  assert.equal(result.paths["chama-route"][0].x, -4);
  assert.equal(result.paths["chama-route"].at(-1).x, 4);
  assert.equal(result.paths["xiang-qian-route"][0].y, 4);
  assert.equal(result.paths["xiang-qian-route"].at(-1).y, -4);
});
