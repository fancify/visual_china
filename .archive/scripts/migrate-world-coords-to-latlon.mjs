#!/usr/bin/env node
// 一次性迁移：把 qinlingHydrography.js / public hydrography JSON / poi/content.json
// 里所有 hardcoded {x, y} 世界坐标转成 {lat, lon}（OLD bounds 反投影出来的）。
// 之后 bounds 一改，consumer 在 runtime 把 lat/lon 投到 NEW bounds 即可。
//
// 旧坐标契约：x = world.x（east+），y in points = world.z（south+，north-）。
// 反投影：unprojectWorldToGeo({x, z: y}, OLD_BOUNDS, OLD_WORLD)。
//
// Usage: node scripts/migrate-world-coords-to-latlon.mjs

import fs from "node:fs/promises";

const OLD_BOUNDS = { west: 103.5, east: 109, south: 30.4, north: 35.4 };
const OLD_WORLD = { width: 180, depth: 240 };

function unprojectXY(x, y) {
  // y 在数据里 = world.z
  const lonSpan = OLD_BOUNDS.east - OLD_BOUNDS.west;
  const latSpan = OLD_BOUNDS.north - OLD_BOUNDS.south;
  return {
    lat: +(OLD_BOUNDS.south + (0.5 - y / OLD_WORLD.depth) * latSpan).toFixed(5),
    lon: +(OLD_BOUNDS.west + (x / OLD_WORLD.width + 0.5) * lonSpan).toFixed(5)
  };
}

// ============ qinlingHydrography.js ============
async function migrateHydrographyJs() {
  const path = "src/game/qinlingHydrography.js";
  let src = await fs.readFile(path, "utf8");

  // 匹配 { x: NUMBER, y: NUMBER }（允许负号、小数）
  // qinlingHydrography 里的 points 数组都是这样。改成 { lat, lon }——
  // hydrographyAtlas.js 已更新成只读 lat/lon。
  const pointRegex = /\{\s*x:\s*(-?\d+(?:\.\d+)?)\s*,\s*y:\s*(-?\d+(?:\.\d+)?)\s*\}/g;
  let count = 0;
  src = src.replace(pointRegex, (_match, x, y) => {
    const { lat, lon } = unprojectXY(parseFloat(x), parseFloat(y));
    count += 1;
    return `{ lat: ${lat}, lon: ${lon} }`;
  });

  await fs.writeFile(path, src, "utf8");
  console.log(`qinlingHydrography.js: 迁移 ${count} 个点`);
}

// ============ public hydrography JSON ============
async function migrateHydrographyJson() {
  const path = "public/data/regions/qinling/hydrography/modern.json";
  const data = JSON.parse(await fs.readFile(path, "utf8"));
  let count = 0;
  for (const feature of data.features) {
    if (feature.geometry?.points) {
      feature.geometry.points = feature.geometry.points.map((p) => {
        count += 1;
        return unprojectXY(p.x, p.y);
      });
    }
  }
  await fs.writeFile(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log(`hydrography modern.json: 迁移 ${count} 个点`);
}

// ============ poi/content.json ============
async function migrateContentJson() {
  const path = "public/data/regions/qinling/poi/content.json";
  const data = JSON.parse(await fs.readFile(path, "utf8"));
  let count = 0;

  function migratePosition(obj, key = "position") {
    if (obj?.[key] && typeof obj[key].x === "number" && typeof obj[key].y === "number") {
      const { lat, lon } = unprojectXY(obj[key].x, obj[key].y);
      obj[key] = { lat, lon };
      count += 1;
    }
  }

  data.landmarks?.forEach((l) => migratePosition(l));
  data.fragments?.forEach((f) => migratePosition(f));
  data.storyBeats?.forEach((b) => migratePosition(b, "target"));
  if (data.routeStart && typeof data.routeStart.x === "number") {
    const { lat, lon } = unprojectXY(data.routeStart.x, data.routeStart.y);
    data.routeStart = { lat, lon };
    count += 1;
  }

  await fs.writeFile(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log(`poi/content.json: 迁移 ${count} 个点`);
}

await migrateHydrographyJs();
await migrateHydrographyJson();
await migrateContentJson();
console.log("done. 跑 npm test 验证 + 检查 consumer 是否需要改。");
