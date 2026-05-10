import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("city floor plates render as non-occluding low-alpha ground hints", async () => {
  const source = await readFile(new URL("../src/game/cityMarkers.ts", import.meta.url), "utf8");

  assert.match(source, /const CITY_FLOOR_OPACITY = 0\.22;/);
  assert.match(source, /depthWrite:\s*false/);
  assert.match(source, /nextFloorMesh\.renderOrder = -1;/);
});
