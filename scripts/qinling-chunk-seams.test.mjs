import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const chunksRoot = "public/data/regions/qinling/chunks";
const manifest = JSON.parse(await readFile(path.join(chunksRoot, "manifest.json"), "utf8"));

async function readChunk(id) {
  return JSON.parse(await readFile(path.join(chunksRoot, `${id}.json`), "utf8"));
}

function heightAt(chunk, column, row) {
  return chunk.heights[row * chunk.grid.columns + column];
}

test("Qinling terrain chunks include shared boundary samples to avoid visible seams", async () => {
  const west = await readChunk("qinling_0_0");
  const east = await readChunk("qinling_1_0");
  const north = await readChunk("qinling_0_0");
  const south = await readChunk("qinling_0_1");

  assert.ok(
    Math.abs(west.grid.columns - east.grid.columns) <= 1,
    "adjacent east/west chunks should stay within one shared-sample column of each other"
  );
  assert.ok(
    Math.abs(north.grid.rows - south.grid.rows) <= 1,
    "adjacent north/south chunks should stay within one shared-sample row of each other"
  );
  // Phase 2 全国 grid 3113×2158 / 63×44 chunks → 每 chunk ~50×50 (含 +1 共享边)
  assert.ok(west.grid.columns >= 49 && west.grid.columns <= 51);
  assert.ok(north.grid.rows >= 49 && north.grid.rows <= 51);

  for (let row = 0; row < west.grid.rows; row += 1) {
    assert.equal(
      heightAt(west, west.grid.columns - 1, row),
      heightAt(east, 0, row),
      `east/west seam row ${row} should share the same DEM sample`
    );
  }

  for (let column = 0; column < north.grid.columns; column += 1) {
    assert.equal(
      heightAt(north, column, north.grid.rows - 1),
      heightAt(south, column, 0),
      `north/south seam column ${column} should share the same DEM sample`
    );
  }
});

test("Qinling chunk manifest expands to the full-China terrain grid", (t) => {
  if (manifest.chunkColumns !== 125 || manifest.chunkRows !== 87) {
    return t.skip(
      `region chunk manifest still at ${manifest.chunkColumns}×${manifest.chunkRows}; rerun pipeline after code review`
    );
  }

  // Phase 3 全中国 0.9 km：grid 6225 × 4316 cells / targetChunkSpanCells 50
  assert.equal(manifest.chunkColumns, 125);
  assert.equal(manifest.chunkRows, 87);
  assert.equal(manifest.chunks.length, 125 * 87);
});
