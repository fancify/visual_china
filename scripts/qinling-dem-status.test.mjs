import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import "./etopo-fallback.test.mjs";

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

test("build-qinling-real-dem exposes an explicit srtm90 CLI mode placeholder", async () => {
  const isolatedRoot = await fs.mkdtemp(path.join(os.tmpdir(), "qinling-dem-build-"));
  const result = spawnSync(
    process.execPath,
    [buildRealDemScriptPath, "--source", "srtm90"],
    {
      cwd: isolatedRoot,
      encoding: "utf8"
    }
  );
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;

  assert.notEqual(result.status, 0, "srtm90 placeholder mode should exit non-zero until implemented");
  assert.match(
    output,
    /srtm90 source not yet implemented; use --source fabdem \(default\)\./
  );
});

test("build-qinling-real-dem warns when required FABDEM tiles fall back to ETOPO", async () => {
  const buildScript = await fs.readFile(buildRealDemScriptPath, "utf8");

  assert.match(buildScript, /Missing tile \$\{tileName\}, fallback to ETOPO 60s/);
});

test("Qinling DEM common config switches to the full-China 1.8km grid", () => {
  assert.deepEqual(qinlingOutputGrid, {
    columns: 3113,
    rows: 2158
  });
  assert.equal(qinlingResolutionStrategy.target, "1800m-stride4-450m");
  assert.equal(
    qinlingResolutionStrategy.comment,
    "Full China at 1.8 km cell with ETOPO 60s + future HydroSHEDS upgrade path"
  );
  assert.deepEqual(qinlingResolutionStrategy.runtimeSampleSpacingKm, {
    eastWest: 1.8,
    northSouth: 1.8
  });
});
