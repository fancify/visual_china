import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { gameHeightToRealMeters } from "../src/game/realElevation.ts";

const regionAsset = JSON.parse(
  await readFile("public/data/regions/qinling/slice-l1.json", "utf8")
);

test("gameHeightToRealMeters maps min, midpoint, and max height into real meters", () => {
  const asset = {
    minHeight: -3,
    maxHeight: 13,
    presentation: {
      realPeakMeters: 3700
    }
  };

  assert.equal(gameHeightToRealMeters(-3, asset), 0);
  assert.equal(gameHeightToRealMeters(5, asset), 1850);
  assert.equal(gameHeightToRealMeters(13, asset), 3700);
});

test("gameHeightToRealMeters falls back to the default real peak when metadata is absent", () => {
  const asset = {
    minHeight: -3,
    maxHeight: 13
  };

  assert.equal(gameHeightToRealMeters(13, asset), 3700);
});

test("gameHeightToRealMeters keeps current qinling gameplay heights in a plausible real-world range", () => {
  assert.equal(gameHeightToRealMeters(regionAsset.minHeight, regionAsset), 0);
  assert.equal(gameHeightToRealMeters(regionAsset.maxHeight, regionAsset), 3700);

  const zitongLikeHeightMeters = gameHeightToRealMeters(-1.44, regionAsset);
  assert.ok(
    zitongLikeHeightMeters >= 300 && zitongLikeHeightMeters <= 500,
    `expected -1.44 gameplay height to map near low-hill elevation, got ${zitongLikeHeightMeters}m`
  );
});
