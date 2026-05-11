#!/usr/bin/env node
/**
 * 一次性翻转所有数据 z 字段，把"+Z=北"旧契约迁移到"-Z=北"新契约。
 *
 * 受影响的字段：
 *   - JSON: routeStart.y, landmarks[].position.y, fragments[].position.y,
 *           storyBeats[].target.y, hydrography features[].geometry.points[].y,
 *           chunk worldBounds.minZ/maxZ, OSM evidence points[].y
 *   - JS/TS 源码：grep 出 `position: new Vector2(x, NUMBER)`、`point(x, NUMBER)`、
 *           `world: { points: [{ x, y: NUMBER }, ...] }` 等模式手工翻
 *
 * 这里只处理 JSON 数据（脚本可批量），JS/TS 源码翻转见单独逐文件 Edit。
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");

const targets = [
  "public/data/regions/qinling/poi/content.json",
  "public/data/regions/qinling/hydrography/primary-modern.json",
  "public/data/regions/qinling/hydrography/osm-modern.json",
  "public/data/regions/qinling/manifest.json",
  "public/data/regions/qinling/slice-l1.json"
];

function flipPoint(p) {
  if (p && typeof p === "object" && typeof p.y === "number") {
    p.y = -p.y;
  }
}

function deepFlipChunkBounds(node) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    node.forEach(deepFlipChunkBounds);
    return;
  }
  // chunk worldBounds: { minX, maxX, minZ, maxZ } —— minZ/maxZ 是 world.z，需要翻
  // 翻完 minZ 和 maxZ 后还要 swap 才能保持 min<=max 不变
  if (
    typeof node.minZ === "number" &&
    typeof node.maxZ === "number"
  ) {
    const newMinZ = -node.maxZ;
    const newMaxZ = -node.minZ;
    node.minZ = newMinZ;
    node.maxZ = newMaxZ;
  }
  for (const key of Object.keys(node)) {
    deepFlipChunkBounds(node[key]);
  }
}

function deepFlipPointY(node) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    node.forEach(deepFlipPointY);
    return;
  }
  // 一个对象同时有 x 和 y 数字字段 → 视为 2D point，翻 y
  // 但要避开 chunk worldBounds 已经在 deepFlipChunkBounds 里处理过的对象
  const keys = Object.keys(node);
  const looksLike2DPoint =
    keys.length <= 4 &&
    typeof node.x === "number" &&
    typeof node.y === "number" &&
    !("minX" in node) &&
    !("minZ" in node);
  if (looksLike2DPoint) {
    node.y = -node.y;
    return;
  }
  for (const key of keys) {
    deepFlipPointY(node[key]);
  }
}

async function main() {
  // chunk manifest 单独处理（worldBounds 翻转 + swap）
  const chunkDir = path.join(repoRoot, "public/data/regions/qinling/chunks");
  let chunkFiles = [];
  try {
    chunkFiles = (await fs.readdir(chunkDir))
      .filter((f) => f.endsWith(".json"))
      .map((f) => path.join("public/data/regions/qinling/chunks", f));
  } catch {
    /* no chunks */
  }

  for (const rel of [...targets, ...chunkFiles]) {
    const full = path.join(repoRoot, rel);
    let raw;
    try {
      raw = await fs.readFile(full, "utf8");
    } catch (err) {
      console.warn(`skip ${rel}: ${err.message}`);
      continue;
    }
    const data = JSON.parse(raw);
    deepFlipChunkBounds(data);
    deepFlipPointY(data);
    await fs.writeFile(full, JSON.stringify(data, null, 2));
    console.log(`flipped ${rel}`);
  }

  console.log("\nDone. JS/TS hardcoded points need manual inspection.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
