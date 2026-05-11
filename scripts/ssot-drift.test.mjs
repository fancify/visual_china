// SSOT guard test —— 防止 build-time / runtime / manifest 数据漂移。
//
// codex SSOT 审计 (2026-05-11)：region bounds + world size 在 3 个地方各自维护：
//   1. src/data/qinlingRegion.js (运行时 source of truth)
//   2. scripts/qinling-dem-common.mjs (build script source)
//   3. public/data/regions/qinling/manifest.json (build output)
//
// 已修：(2) 改成 import (1)。剩下需要测试守住 (3) 不能漂离 (1)。
// 这个测试在 build:dem 跑过后必须 pass；如果有人手改 manifest.json 改飞了 bounds，
// 这个 test 会立即红。

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { qinlingRegionBounds, qinlingRegionWorld } from "../src/data/qinlingRegion.js";
import { QINLING_REGION_MANIFEST } from "./data-paths.mjs";

test("region manifest bounds === qinlingRegionBounds (no drift)", async () => {
  const manifest = JSON.parse(await readFile(QINLING_REGION_MANIFEST, "utf8"));
  assert.deepEqual(
    manifest.bounds,
    qinlingRegionBounds,
    "manifest.json bounds drifted from src/data/qinlingRegion.js — 跑 npm run build:dem 重新生成 manifest，或检查 qinlingRegion.js 是否被错误修改"
  );
});

test("region manifest world === qinlingRegionWorld (no drift)", async () => {
  const manifest = JSON.parse(await readFile(QINLING_REGION_MANIFEST, "utf8"));
  assert.deepEqual(
    manifest.world,
    qinlingRegionWorld,
    "manifest.json world.width/depth drifted from src/data/qinlingRegion.js"
  );
});
