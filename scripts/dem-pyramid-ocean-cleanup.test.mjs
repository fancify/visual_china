import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  removeStaleChunkOutput,
  removeStaleTierChunks
} from "./dem-pyramid-cleanup.mjs";
import { classifyEtopoMeters } from "./etopo-ocean-mask.mjs";

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

test("force rebuild removes stale DEM chunk when new bake classifies it as ocean", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "dem-pyramid-cleanup-"));
  const chunkPath = path.join(dir, "old-ocean-placeholder.bin");
  await writeFile(chunkPath, "old land mesh");

  const removed = await removeStaleChunkOutput(chunkPath);

  assert.equal(removed, true);
  assert.equal(await exists(chunkPath), false);
  await rm(dir, { recursive: true, force: true });
});

test("stale chunk cleanup is a no-op when no old chunk exists", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "dem-pyramid-cleanup-"));
  const chunkPath = path.join(dir, "missing.bin");

  const removed = await removeStaleChunkOutput(chunkPath);

  assert.equal(removed, false);
  assert.equal(await exists(chunkPath), false);
  await rm(dir, { recursive: true, force: true });
});

test("stale chunk cleanup does not delete non-file paths", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "dem-pyramid-cleanup-"));
  const removed = await removeStaleChunkOutput(dir);

  assert.equal(removed, false);
  assert.equal(await readFile(dir).catch((error) => error.code), "EISDIR");
  await rm(dir, { recursive: true, force: true });
});

test("ETOPO classifier treats shallow below-sea-level cells as ocean", () => {
  assert.equal(classifyEtopoMeters(-6), "ocean");
  assert.equal(classifyEtopoMeters(-0.6), "ocean");
  assert.equal(classifyEtopoMeters(0), "land");
  assert.equal(classifyEtopoMeters(2), "land");
});

test("downsample cleanup removes parent chunks that no longer have child data", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "dem-pyramid-tier-cleanup-"));
  await writeFile(path.join(dir, "1_1.bin"), "keep");
  await writeFile(path.join(dir, "2_2.bin"), "stale");
  await writeFile(path.join(dir, "notes.txt"), "not a chunk");

  const removed = await removeStaleTierChunks(dir, new Set(["1_1"]));

  assert.deepEqual(removed, ["2_2.bin"]);
  assert.equal(await exists(path.join(dir, "1_1.bin")), true);
  assert.equal(await exists(path.join(dir, "2_2.bin")), false);
  assert.equal(await exists(path.join(dir, "notes.txt")), true);
  await rm(dir, { recursive: true, force: true });
});
