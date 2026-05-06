import assert from "node:assert/strict";
import test from "node:test";

import { getEtopoSampler } from "./etopo-fallback.mjs";
import { qinlingWorkspacePath } from "./qinling-dem-common.mjs";

const etopoTiffPath = qinlingWorkspacePath(
  "data",
  "etopo",
  "ETOPO_2022_v1_60s_N90W180_bed.tif"
);

test("ETOPO fallback uses the 60s global TIFF source only", async () => {
  const sampler = await getEtopoSampler();

  assert.equal(sampler.sourcePath, etopoTiffPath);
  assert.doesNotMatch(sampler.sourcePath, /china-etopo-2022-60s-stride7\.ascii$/);
});

test("ETOPO fallback samples Wuhan as lowland terrain from the 60s TIFF", async () => {
  const sampler = await getEtopoSampler();
  const meters = sampler.sample(114.31, 30.59);

  assert.ok(meters >= 0 && meters <= 100, `expected Wuhan lowland elevation, got ${meters}`);
});

test("ETOPO fallback samples Taibai Shan as high relief from the 60s TIFF", async () => {
  const sampler = await getEtopoSampler();
  const meters = sampler.sample(107.78, 33.95);

  assert.ok(meters >= 2500 && meters <= 3900, `expected Taibai Shan alpine elevation, got ${meters}`);
});

test("ETOPO fallback keeps bathymetry negative over deep ocean", async () => {
  const sampler = await getEtopoSampler();
  // 选东海冲绳海槽以东的深海点（不在台湾海峡浅滩）
  const meters = sampler.sample(130, 25);

  assert.ok(
    meters <= -1000 && meters >= -8000,
    `expected deep-ocean bathymetry between -1000m and -8000m, got ${meters}`
  );
});

test("ETOPO TIFF 60s gives ~1.85 km resolution (not coarse 13 km)", async () => {
  const sampler = await getEtopoSampler();
  const a = sampler.sample(107.5, 33.5);
  const b = sampler.sample(107.5, 33.6);

  assert.ok(
    Math.abs(a - b) > 5,
    `Expected resolution-distinguishable values across 11km, got ${a} vs ${b}`
  );
});
