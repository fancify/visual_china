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
  const realPeakMeters = regionAsset.presentation?.realPeakMeters;

  assert.equal(gameHeightToRealMeters(regionAsset.minHeight, regionAsset), 0);
  assert.ok(
    realPeakMeters >= 4977 && realPeakMeters <= 5477,
    `expected current qinling asset to expose a high-elevation real peak, got ${realPeakMeters}m`
  );
  assert.equal(gameHeightToRealMeters(regionAsset.maxHeight, regionAsset), realPeakMeters);

  const zitongLikeHeightMeters = gameHeightToRealMeters(-1.44, regionAsset);
  assert.ok(
    zitongLikeHeightMeters >= 793 && zitongLikeHeightMeters <= 893,
    `expected -1.44 gameplay height to map near low-hill elevation, got ${zitongLikeHeightMeters}m`
  );
});
