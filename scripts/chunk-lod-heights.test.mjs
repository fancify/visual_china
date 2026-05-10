import assert from "node:assert/strict";
import test from "node:test";

import { buildChunkLodHeights } from "./chunk-lod-heights.mjs";

test("buildChunkLodHeights emits L1/L2/L3 average pooled height grids", () => {
  const heights = Array.from({ length: 7 * 5 }, (_, index) => index + 1);
  const asset = {
    grid: { columns: 7, rows: 5 },
    heights
  };

  const lodHeights = buildChunkLodHeights(asset);

  assert.equal(lodHeights.L1.grid.columns, 4);
  assert.equal(lodHeights.L1.grid.rows, 3);
  assert.equal(lodHeights.L2.grid.columns, 2);
  assert.equal(lodHeights.L2.grid.rows, 2);
  assert.equal(lodHeights.L3.grid.columns, 2);
  assert.equal(lodHeights.L3.grid.rows, 2);

  const expectedL1First = (1 + 2 + 8 + 9) / 4;
  assert.equal(lodHeights.L1.heights[0], expectedL1First);

  const expectedL1Edge = (7 + 14) / 2;
  assert.equal(lodHeights.L1.heights[3], expectedL1Edge);
});

test("chunk LOD payload is schema v2 compatible plain JSON", () => {
  const lodHeights = buildChunkLodHeights({
    grid: { columns: 4, rows: 4 },
    heights: [
      1, 2, 3, 4,
      5, 6, 7, 8,
      9, 10, 11, 12,
      13, 14, 15, 16
    ]
  });

  const encoded = JSON.parse(JSON.stringify({ schemaVersion: 2, lodHeights }));

  assert.equal(encoded.schemaVersion, 2);
  assert.deepEqual(Object.keys(encoded.lodHeights).sort(), ["L1", "L2", "L3"]);
  assert.equal(Array.isArray(encoded.lodHeights.L1.heights), true);
  assert.equal(encoded.lodHeights.L1.heights[0], (1 + 2 + 5 + 6) / 4);
});
