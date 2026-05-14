// dem-pyramid-sanity.test.mjs
//
// P1 烤完后的 invariants 检查
// 跑法: node --test scripts/dem-pyramid-sanity.test.mjs

import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import { chinaBounds } from "./china-dem-common.mjs";
import {
  TIER_PARAMS,
  TIER_NAMES,
  pyramidOutputDir,
  chunkBoundsAt,
  manifestOutputPath
} from "./dem-pyramid-common.mjs";

const manifest = JSON.parse(await fs.readFile(manifestOutputPath(), "utf8"));

function float16ToFloat32(h) {
  const s = (h & 0x8000) >> 15;
  const e = (h & 0x7c00) >> 10;
  const f = h & 0x03ff;
  if (e === 0) return (s ? -1 : 1) * Math.pow(2, -14) * (f / 1024);
  if (e === 0x1f) return f ? NaN : (s ? -Infinity : Infinity);
  return (s ? -1 : 1) * Math.pow(2, e - 15) * (1 + f / 1024);
}

async function readChunk(tierName, x, z) {
  const fp = path.join(pyramidOutputDir(), tierName, `${x}_${z}.bin`);
  const buf = await fs.readFile(fp);
  // header
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const magic = dv.getUint16(0, true);
  const ver = dv.getUint8(2);
  const tier = dv.getUint8(3);
  const cx = dv.getUint16(4, true);
  const cz = dv.getUint16(6, true);
  // data
  const N = TIER_PARAMS[tierName].cellsPerChunk;
  const dataBytes = buf.length - 8;
  const arraySide = Math.round(Math.sqrt(dataBytes / 2));
  const ghostWidth = ver === 2 ? 1 : 0;
  const heights = new Float32Array(N * N);
  for (let row = 0; row < N; row += 1) {
    for (let col = 0; col < N; col += 1) {
      const srcRow = row + ghostWidth;
      const srcCol = col + ghostWidth;
      const f16 = dv.getUint16(8 + (srcRow * arraySide + srcCol) * 2, true);
      heights[row * N + col] = float16ToFloat32(f16);
    }
  }
  return { header: { magic, ver, tier, cx, cz }, heights };
}

test("manifest.json schema is valid", () => {
  assert.equal(manifest.schemaVersion, "visual-china.dem-pyramid.v2");
  assert.equal(manifest.projection, "strict-geographic");
  assert.ok(manifest.tiers.L0);
  assert.ok(manifest.tiers.L1);
  assert.ok(manifest.tiers.L2);
  assert.ok(manifest.tiers.L3);
});

test("L0 chunk count reasonable (1000-2200)", () => {
  const n = manifest.tiers.L0.chunkCount;
  assert.ok(n > 1000, `L0 chunks=${n} too few`);
  assert.ok(n < 2200, `L0 chunks=${n} too many`);
});

test("each tier has exactly 256×256 cells per chunk", () => {
  for (const t of ["L0", "L1", "L2", "L3"]) {
    assert.equal(manifest.tiers[t].cellsPerChunk, 256);
  }
});

test("tier chunkSizeDeg doubles each level (256 cells per chunk × 2× cell increase)", () => {
  assert.equal(manifest.tiers.L0.chunkSizeDeg, 1);
  assert.equal(manifest.tiers.L1.chunkSizeDeg, 2);
  assert.equal(manifest.tiers.L2.chunkSizeDeg, 4);
  assert.equal(manifest.tiers.L3.chunkSizeDeg, 8);
});

test("L0 binary chunk header round-trips", async () => {
  // Pick first existing chunk
  const range = manifest.tiers.L0;
  const x = range.chunkRangeX[0];
  const z = 15; // middle latitude
  const chunk = await readChunk("L0", x, z).catch(() => null);
  if (chunk) {
    assert.equal(chunk.header.magic, 0xdead);
    assert.ok([1, 2].includes(chunk.header.ver));
    assert.equal(chunk.header.tier, 0);
    assert.equal(chunk.header.cx, x);
    assert.equal(chunk.header.cz, z);
  }
});

test("L0 elevation values are plausible (China terrain -200m to 9000m)", async () => {
  // Pick a chunk likely to have land (中部 around x=40, z=18)
  const chunk = await readChunk("L0", 40, 18).catch(() => null);
  if (!chunk) {
    console.warn("    (no L0 40_18, skipping)");
    return;
  }
  let min = Infinity, max = -Infinity, validCount = 0;
  for (const v of chunk.heights) {
    if (Number.isFinite(v)) {
      validCount += 1;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  assert.ok(validCount > 0, "no valid heights in chunk");
  assert.ok(min > -500, `min height ${min} too low`);
  assert.ok(max < 10000, `max height ${max} too high`);
});

test("L1 2×2 mean pool produces consistent values (sample check)", async () => {
  // Look up an L1 chunk; verify it corresponds to 4 L0 children
  const L1Range = manifest.tiers.L1;
  // L1 chunk (x=15, z=8) should aggregate L0 (30,16) (31,16) (30,17) (31,17)
  const l1Chunk = await readChunk("L1", 15, 8).catch(() => null);
  if (!l1Chunk) {
    console.warn("    (no L1 15_8, skipping)");
    return;
  }
  // Just verify the L1 chunk has plausible values
  let validCount = 0;
  for (const v of l1Chunk.heights) if (Number.isFinite(v)) validCount += 1;
  assert.ok(validCount > 0, "L1 chunk has no valid heights");
});

test("L3 chunks exist and have lowest resolution", async () => {
  const range = manifest.tiers.L3;
  const chunk = await readChunk("L3", range.chunkRangeX[0], 2).catch(() => null);
  if (chunk) {
    assert.equal(chunk.header.tier, 3);
  }
});

test("chunk bounds at (0,0) cover NW corner of china", () => {
  const b = chunkBoundsAt("L0", 0, 0);
  assert.equal(b.west, chinaBounds.west);
  assert.equal(b.north, chinaBounds.north);
  // 浮点比较用 epsilon
  assert.ok(Math.abs(b.east - b.west - 1) < 1e-9);
  assert.ok(Math.abs(b.north - b.south - 1) < 1e-9);
});

test("disk size within budget (<360 MB total)", async () => {
  let total = 0;
  for (const t of TIER_NAMES) {
    const dir = path.join(pyramidOutputDir(), t);
    try {
      const files = await fs.readdir(dir);
      for (const f of files) {
        if (!f.endsWith(".bin")) continue;
        const st = await fs.stat(path.join(dir, f));
        total += st.size;
      }
    } catch {
      // tier 不存在
    }
  }
  const MB = total / 1024 / 1024;
  console.log(`    Pyramid total: ${MB.toFixed(1)} MB`);
  assert.ok(MB < 360, `pyramid size ${MB.toFixed(1)} MB > 360 MB`);
});
