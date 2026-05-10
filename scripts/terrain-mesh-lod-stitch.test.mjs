import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("terrain mesh L1 attributes no longer pin perimeter vertices to L0", async () => {
  const source = await readFile(
    new URL("../src/game/terrainMesh.ts", import.meta.url),
    "utf8"
  );

  assert.doesNotMatch(source, /shouldKeepTerrainLodVertexAtL0/);
  assert.match(
    source,
    /const lod1Y = hasL1 \? sampler\.sampleHeightLod\(x, z, 1\) : y;/
  );
});
