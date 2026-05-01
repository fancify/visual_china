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

  assert.equal(west.grid.columns, east.grid.columns);
  assert.equal(north.grid.rows, south.grid.rows);
  assert.equal(west.grid.columns, 49);
  assert.equal(north.grid.rows, 49);

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

test("Qinling chunk manifest still covers a 4 by 5 terrain grid", () => {
  assert.equal(manifest.chunkColumns, 4);
  assert.equal(manifest.chunkRows, 5);
  assert.equal(manifest.chunks.length, 20);
});
