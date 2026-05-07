import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import "./hydrosheds-sampler.test.mjs";

import {
  collectQinlingDemStatus,
  formatQinlingDemStatus
} from "./qinling-dem-status.mjs";
import {
  qinlingOutputGrid,
  qinlingResolutionStrategy
} from "./qinling-dem-common.mjs";

const buildRealDemScriptPath = fileURLToPath(
  new URL("./build-qinling-real-dem.mjs", import.meta.url)
);

test("collects Qinling DEM download and asset status", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "qinling-dem-status-"));
  const archiveDir = path.join(rootDir, "data", "fabdem", "qinling", "archives");
  const tilesDir = path.join(rootDir, "data", "fabdem", "qinling", "tiles");
  const publicDataDir = path.join(rootDir, "public", "data");
  const regionDir = path.join(publicDataDir, "regions", "qinling");

  await fs.mkdir(archiveDir, { recursive: true });
  await fs.mkdir(tilesDir, { recursive: true });
  await fs.mkdir(regionDir, { recursive: true });
  await fs.writeFile(path.join(archiveDir, "N30E100-N40E110_FABDEM_V1-2.zip.part"), "12345");
  await fs.writeFile(path.join(tilesDir, "N30E103_FABDEM_V1-2.tif"), "");
  await fs.writeFile(path.join(tilesDir, "notes.txt"), "");
  await fs.writeFile(
    path.join(publicDataDir, "qinling-slice-dem.json"),
    `${JSON.stringify({ sourceType: "FABDEM V1-2" })}\n`
  );
  await fs.writeFile(path.join(regionDir, "manifest.json"), "{}\n");

  const status = await collectQinlingDemStatus({
    rootDir,
    expectedArchiveBytes: 10_000
  });

  assert.equal(status.archiveFinal.exists, false);
  assert.equal(status.partial.exists, true);
  assert.equal(status.partial.bytes, 5);
  assert.equal(status.partial.totalBytes, 10_000);
  assert.equal(status.partial.progressPercent, 0.05);
  assert.equal(status.tiles.tifCount, 1);
  assert.equal(status.sliceDem.sourceType, "FABDEM V1-2");
  assert.equal(status.regionManifest.exists, true);

  const formatted = formatQinlingDemStatus(status);
  assert.match(formatted, /Archive final zip: missing/);
  assert.match(formatted, /Partial download: present/);
  assert.match(formatted, /Tiles directory TIFF count: 1/);
  assert.match(formatted, /qinling-slice-dem\.json sourceType: FABDEM V1-2/);
  assert.match(formatted, /Region manifest: present/);
});

test("build-qinling-real-dem is wired to a single HydroSHEDS source", async () => {
  const buildScript = await fs.readFile(buildRealDemScriptPath, "utf8");

  assert.match(buildScript, /getHydroShedsSampler/);
  assert.doesNotMatch(buildScript, /getEtopoSampler/);
  assert.doesNotMatch(buildScript, /SUPPORTED_DEM_SOURCES/);
  assert.doesNotMatch(buildScript, /--source/);
});

test("Qinling DEM common config switches to the full-China 0.9km grid", () => {
  assert.deepEqual(qinlingOutputGrid, {
    columns: 6225,
    rows: 4316
  });
  assert.equal(qinlingResolutionStrategy.target, "900m-stride2-450m-hydrosheds15s");
  assert.match(qinlingResolutionStrategy.comment, /HydroSHEDS 15s/);
  assert.deepEqual(qinlingResolutionStrategy.runtimeSampleSpacingKm, {
    eastWest: 0.9,
    northSouth: 0.9
  });
});
