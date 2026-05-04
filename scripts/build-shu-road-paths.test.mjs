import assert from "node:assert/strict";
import test from "node:test";

import { findPath } from "./build-shu-road-paths.mjs";

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
