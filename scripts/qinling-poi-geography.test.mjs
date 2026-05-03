import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { geoToWorld } from "../src/game/geoProjection.js";

const asset = JSON.parse(
  fs.readFileSync("public/data/qinling-slice-dem.json", "utf8")
);
const content = JSON.parse(
  fs.readFileSync("public/data/regions/qinling/poi/content.json", "utf8")
);

// content.json positions 现在是 {lat, lon}（refactor #63 之后），测试要先
// 投到当前 region 的世界坐标再做距离比较。helper 把 lat/lon 投到 world
// 之后输出 {x, y} —— y 在数据约定里 = world.z。
function positionToWorld(pos) {
  if (typeof pos.lat === "number" && typeof pos.lon === "number") {
    const wp = geoToWorld({ lon: pos.lon, lat: pos.lat }, asset.bounds, asset.world);
    return { x: wp.x, y: wp.z };
  }
  return { x: pos.x, y: pos.y };
}

function sampleHeightAtWorld(position) {
  // 新 mapOrientation 契约：北 = -Z → row 0；z 越大（越南）→ row 越大。
  const column = Math.round(
    (position.x / asset.world.width + 0.5) * (asset.grid.columns - 1)
  );
  const row = Math.round(
    (position.z / asset.world.depth + 0.5) * (asset.grid.rows - 1)
  );

  return asset.heights[row * asset.grid.columns + column];
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

test("Hanzhong basin POIs sit on the real Hanzhong lowland, not south mountain terrain", () => {
  const expectedHanzhong = geoToWorld(
    { lon: 107.03, lat: 33.07 },
    asset.bounds,
    asset.world
  );
  const basin = content.landmarks.find((landmark) => landmark.name === "汉中盆地");
  const hingeFragment = content.fragments.find((fragment) => fragment.id === "hanzhong-hinge");
  const hingeBeat = content.storyBeats.find((beat) => beat.id === "hanzhong-hinge");

  assert.ok(basin, "汉中盆地 landmark must exist");
  assert.ok(hingeFragment, "hanzhong-hinge fragment must exist");
  assert.ok(hingeBeat, "hanzhong-hinge story beat must exist");
  assert.ok(
    distance({ x: positionToWorld(basin.position).x, z: positionToWorld(basin.position).y }, expectedHanzhong) < 8,
    `汉中盆地 landmark is ${distance({ x: positionToWorld(basin.position).x, z: positionToWorld(basin.position).y }, expectedHanzhong).toFixed(2)} world units from the real Hanzhong basin`
  );
  assert.ok(
    distance({ x: positionToWorld(hingeFragment.position).x, z: positionToWorld(hingeFragment.position).y }, expectedHanzhong) < 8,
    "hanzhong-hinge fragment should be near the real Hanzhong basin"
  );
  assert.ok(
    distance({ x: positionToWorld(hingeBeat.target).x, z: positionToWorld(hingeBeat.target).y }, expectedHanzhong) < 8,
    "hanzhong-hinge story target should be near the real Hanzhong basin"
  );
  assert.ok(
    sampleHeightAtWorld({ x: positionToWorld(basin.position).x, z: positionToWorld(basin.position).y }) < asset.minHeight + (asset.maxHeight - asset.minHeight) * 0.18,
    "汉中盆地 landmark should sample as a lowland basin"
  );
});

test("Jianmen Pass and Chencang Road are explicit geographic landmarks", () => {
  const expectedJianmen = geoToWorld(
    { lon: 105.54, lat: 32.2 },
    asset.bounds,
    asset.world
  );
  const expectedDasanguan = geoToWorld(
    { lon: 106.98, lat: 34.16 },
    asset.bounds,
    asset.world
  );
  const jianmen = content.landmarks.find((landmark) => landmark.name === "剑门关");
  const chencang = content.landmarks.find((landmark) => landmark.name === "陈仓道");

  assert.ok(jianmen, "剑门关 landmark must exist");
  assert.ok(chencang, "陈仓道 landmark must exist");
  assert.ok(
    distance({ x: positionToWorld(jianmen.position).x, z: positionToWorld(jianmen.position).y }, expectedJianmen) < 9,
    "剑门关 should sit near the real Jianmen Pass area"
  );
  assert.ok(
    distance({ x: positionToWorld(chencang.position).x, z: positionToWorld(chencang.position).y }, expectedDasanguan) < 12,
    "陈仓道 label should anchor near the Dasanguan / Chencang crossing area"
  );
});

test("Guanzhong start and Changan POIs use real east-side coordinates", () => {
  const expectedChangan = geoToWorld(
    { lon: 108.94, lat: 34.34 },
    asset.bounds,
    asset.world
  );
  const changan = content.landmarks.find((landmark) => landmark.name === "长安意象");
  const heartlandFragment = content.fragments.find((fragment) => fragment.id === "guanzhong-heartland");

  assert.ok(changan, "长安意象 landmark must exist");
  assert.ok(heartlandFragment, "guanzhong-heartland fragment must exist");
  assert.ok(
    distance({ x: positionToWorld(changan.position).x, z: positionToWorld(changan.position).y }, expectedChangan) < 8,
    "长安意象 should sit near the real Xi'an/Chang'an area, not the old hand-placed center"
  );
  assert.ok(
    distance({ x: positionToWorld(content.routeStart).x, z: positionToWorld(content.routeStart).y }, expectedChangan) < 12,
    "routeStart should begin near the real Guanzhong capital area"
  );
  assert.ok(
    distance({ x: positionToWorld(heartlandFragment.position).x, z: positionToWorld(heartlandFragment.position).y }, expectedChangan) < 12,
    "first Guanzhong fragment should match the same east-side geography"
  );
});
