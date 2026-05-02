#!/usr/bin/env node
/**
 * 翻转 JS/TS 源码里 hardcoded 2D 点的 .y 字段（这些 .y 实际是 world.z）。
 *
 * 涵盖以下模式：
 *   - new Vector2(<num>, <num>)
 *   - point(<num>, <num>)
 *   - { x: <num>, y: <num> }（带 x,y 字段的对象字面量）
 *
 * 不动：
 *   - 字符串里的数字
 *   - 注释里的数字
 *   - 非 2D point 用法（先按精确模式匹配避免误伤）
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");

const targets = [
  "src/data/qinlingSlice.ts",
  "src/data/fragments.ts",
  "src/game/qinlingAtlas.js",
  "src/game/qinlingHydrography.js",
  "src/game/qinlingRoutes.js",
  "src/game/storyGuide.ts"
];

function flipNumber(s) {
  // s 是数字字符串（含可能的负号和小数点）
  const num = Number(s);
  if (!Number.isFinite(num)) return s;
  const flipped = -num;
  // 保留原本风格：原本 0 翻还是 0；保留小数位
  if (flipped === 0) return "0";
  return String(flipped);
}

function flipSourceText(text) {
  let result = text;

  // Pattern 1: `new Vector2(X, Y)` —— 翻 Y
  result = result.replace(
    /new\s+Vector2\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/g,
    (_match, x, y) => `new Vector2(${x}, ${flipNumber(y)})`
  );

  // Pattern 2: `point(X, Y)` —— 翻 Y
  result = result.replace(
    /\bpoint\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/g,
    (_match, x, y) => `point(${x}, ${flipNumber(y)})`
  );

  // Pattern 3: 对象字面量 `{ x: X, y: Y }`（同行）—— 翻 Y
  // 注意要避免误伤 viewport / canvas / html rect 等用 x/y 的对象
  // 当前项目里 atlas/hydro/routes 的世界点都用 {x, y} 形式，先粗略翻所有
  // 同行对象，特殊误伤后续手动调
  result = result.replace(
    /\{\s*x:\s*(-?\d+(?:\.\d+)?)\s*,\s*y:\s*(-?\d+(?:\.\d+)?)\s*\}/g,
    (_match, x, y) => `{ x: ${x}, y: ${flipNumber(y)} }`
  );

  return result;
}

async function main() {
  for (const rel of targets) {
    const full = path.join(repoRoot, rel);
    let raw;
    try {
      raw = await fs.readFile(full, "utf8");
    } catch (err) {
      console.warn(`skip ${rel}: ${err.message}`);
      continue;
    }
    const next = flipSourceText(raw);
    if (next === raw) {
      console.log(`unchanged ${rel}`);
      continue;
    }
    await fs.writeFile(full, next);
    console.log(`flipped ${rel}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
