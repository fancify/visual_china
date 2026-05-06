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
  // Phase 2 全国扩张：bounds 含 Tibet/Everest 区域，realPeak 自然抬到接近 8157m
  // (实际 Int16 ETOPO 60s 全球极值)。容忍带覆盖 8000-8500m 防小波动。
  assert.ok(
    realPeakMeters >= 8000 && realPeakMeters <= 8500,
    `expected current qinling asset to expose Everest-range real peak, got ${realPeakMeters}m`
  );
  assert.equal(gameHeightToRealMeters(regionAsset.maxHeight, regionAsset), realPeakMeters);

  // 同一 -1.44 gameplay 高度，因为 verticalRange 现在 ~15.6（旧 ~16.5），映射到
  // realRange ~ 8157（旧 ~5227），所以 zitong 类山地的真实海拔会低一些。
  const zitongLikeHeightMeters = gameHeightToRealMeters(-1.44, regionAsset);
  assert.ok(
    zitongLikeHeightMeters >= 1000 && zitongLikeHeightMeters <= 1500,
    `expected -1.44 gameplay height to map near low-hill elevation, got ${zitongLikeHeightMeters}m`
  );
});
