import assert from "node:assert/strict";
import test from "node:test";

import { shouldKeepTerrainLodVertexAtL0 } from "../src/game/terrainLodMorph.ts";

test("shouldKeepTerrainLodVertexAtL0 pins only chunk perimeter vertices", () => {
  assert.equal(shouldKeepTerrainLodVertexAtL0(-2, 0, 4, 4), true);
  assert.equal(shouldKeepTerrainLodVertexAtL0(2, 0, 4, 4), true);
  assert.equal(shouldKeepTerrainLodVertexAtL0(0, -2, 4, 4), true);
  assert.equal(shouldKeepTerrainLodVertexAtL0(0, 2, 4, 4), true);
  assert.equal(shouldKeepTerrainLodVertexAtL0(0, 0, 4, 4), false);
  assert.equal(shouldKeepTerrainLodVertexAtL0(1, 1, 4, 4), false);
});
