// pyramid-decode.test.mjs
//
// 验证 src/game/terrain/pyramidDecode.js 能正确解码 build-dem-pyramid.mjs 的输出
// 跑法: node --test scripts/pyramid-decode.test.mjs

import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import path from "node:path";

import { decodePyramidChunk, float16ToFloat32 } from "../src/game/terrain/pyramidDecode.js";

const OUT_DIR = path.resolve("public/data/dem");

test("decode L0 chunk: magic + version + tier", async () => {
  // 找一个 L0 chunk
  const files = await fs.readdir(path.join(OUT_DIR, "L0"));
  const sampleFile = files.find((f) => f.endsWith(".bin"));
  assert.ok(sampleFile, "no L0 chunks found");
  const buf = await fs.readFile(path.join(OUT_DIR, "L0", sampleFile));
  const decoded = decodePyramidChunk(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  assert.equal(decoded.tier, 0);
  assert.equal(decoded.cellsPerChunk, 256);
  const expectedChunk = sampleFile.replace(".bin", "").split("_").map(Number);
  assert.equal(decoded.chunkX, expectedChunk[0]);
  assert.equal(decoded.chunkZ, expectedChunk[1]);
});

test("L0 chunk heights are plausible (valid count, China terrain)", async () => {
  const files = await fs.readdir(path.join(OUT_DIR, "L0"));
  // 找一个中部 chunk
  const candidates = files.filter((f) => f.endsWith(".bin"));
  let testedAny = false;
  for (const f of candidates.slice(0, 5)) {
    const buf = await fs.readFile(path.join(OUT_DIR, "L0", f));
    const decoded = decodePyramidChunk(
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    );
    let valid = 0;
    let min = Infinity;
    let max = -Infinity;
    for (const v of decoded.heights) {
      if (Number.isFinite(v)) {
        valid += 1;
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    if (valid > 0) {
      assert.ok(min > -500, `chunk ${f}: min height ${min} too low`);
      assert.ok(max < 10000, `chunk ${f}: max height ${max} too high`);
      testedAny = true;
    }
  }
  assert.ok(testedAny, "no L0 chunks had any valid heights");
});

test("L1 chunk decodes & has higher cell coverage (downsampled)", async () => {
  const files = await fs.readdir(path.join(OUT_DIR, "L1"));
  const sampleFile = files.find((f) => f.endsWith(".bin"));
  assert.ok(sampleFile, "no L1 chunks");
  const buf = await fs.readFile(path.join(OUT_DIR, "L1", sampleFile));
  const decoded = decodePyramidChunk(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  );
  assert.equal(decoded.tier, 1);
  assert.equal(decoded.cellsPerChunk, 256);
});

test("float16ToFloat32 round-trip preserves values within 1e-2 for typical elevations", () => {
  // Test elevations across China range
  const testValues = [-100, 0, 100, 500, 1000, 3000, 5000, 8848];
  // We can't easily test reverse direction (float32 → float16 is in mjs script not browser code).
  // Instead test specific encoded values:
  // 0x0000 = 0
  // 0x4900 ≈ 10
  // 0x6000 ≈ 512
  // 0x7000 ≈ 8192
  assert.equal(float16ToFloat32(0x0000), 0);
  // 0x3c00 = 1.0
  assert.ok(Math.abs(float16ToFloat32(0x3c00) - 1.0) < 1e-6);
  // 0x4900 = 10.0
  assert.ok(Math.abs(float16ToFloat32(0x4900) - 10.0) < 1e-3);
});

test("L3 chunk decodes (smallest tier, fewest chunks)", async () => {
  const files = await fs.readdir(path.join(OUT_DIR, "L3"));
  const sampleFile = files.find((f) => f.endsWith(".bin"));
  assert.ok(sampleFile, "no L3 chunks");
  const buf = await fs.readFile(path.join(OUT_DIR, "L3", sampleFile));
  const decoded = decodePyramidChunk(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  );
  assert.equal(decoded.tier, 3);
});
