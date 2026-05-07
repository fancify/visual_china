import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { geoToWorld } from "../src/game/geoProjection.js";
import {
  qinlingAncientSites,
  qinlingScenicLandmarks
} from "../src/game/qinlingAtlas.js";

const SOUTHERN_SLICE_BOUNDS = {
  south: 22,
  north: 35.4,
  west: 103.5,
  east: 117.0
};

const EXPECTED_SOUTHERN_SCENIC_IDS = [
  "scenic-lijiang-guilin",
  "scenic-zhangjiajie",
  "scenic-huangguoshu",
  "scenic-fanjing-shan",
  "scenic-wanfeng-lin",
  "scenic-leigong-shan",
  "scenic-fenghuang-old",
  "scenic-zhenyuan-old"
];

const EXPECTED_SOUTHERN_ANCIENT_IDS = [
  "ancient-haolong-tunsi",
  "ancient-xijiang-miao",
  "ancient-cuan-stele"
];

const EXPECTED_EASTERN_SCENIC_IDS = [
  "scenic-lushan",
  "scenic-dongting-hu",
  "scenic-poyang-hu",
  "scenic-yueyang-lou",
  "scenic-tengwang-ge",
  "scenic-chibi"
];

const EXPECTED_EASTERN_ANCIENT_IDS = [
  "ancient-yueyang-cheng",
  "ancient-jingzhou-gucheng"
];

const REMOVED_PLACEHOLDER_LANDMARKS = [
  "长安意象",
  "渭河平原",
  "褒斜谷意象",
  "汉中盆地",
  "成都平原"
];

// Phase 3 全国 0.9 km：channels 拆成 binary sidecar
const { loadDemAssetWithChannels } = await import("./dem-asset-io.mjs");
const asset = await loadDemAssetWithChannels("public/data/qinling-slice-dem.json");
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
  const hingeFragment = content.fragments.find((fragment) => fragment.id === "hanzhong-hinge");
  const hingeBeat = content.storyBeats.find((beat) => beat.id === "hanzhong-hinge");

  assert.ok(hingeFragment, "hanzhong-hinge fragment must exist");
  assert.ok(hingeBeat, "hanzhong-hinge story beat must exist");
  assert.ok(
    distance({ x: positionToWorld(hingeFragment.position).x, z: positionToWorld(hingeFragment.position).y }, expectedHanzhong) < 8,
    "hanzhong-hinge fragment should be near the real Hanzhong basin"
  );
  assert.ok(
    distance({ x: positionToWorld(hingeBeat.target).x, z: positionToWorld(hingeBeat.target).y }, expectedHanzhong) < 8,
    "hanzhong-hinge story target should be near the real Hanzhong basin"
  );
  assert.ok(
    sampleHeightAtWorld({ x: positionToWorld(hingeFragment.position).x, z: positionToWorld(hingeFragment.position).y }) < asset.minHeight + (asset.maxHeight - asset.minHeight) * 0.206,
    "hanzhong-hinge fragment should sample as a lowland basin"
  );
  assert.ok(
    sampleHeightAtWorld({ x: positionToWorld(hingeBeat.target).x, z: positionToWorld(hingeBeat.target).y }) < asset.minHeight + (asset.maxHeight - asset.minHeight) * 0.206,
    "hanzhong-hinge story target should sample as a lowland basin"
  );
});

test("Jianmen Pass stays as the only pass landmark near the real Jianmen area", () => {
  const expectedJianmen = geoToWorld(
    { lon: 105.54, lat: 32.2 },
    asset.bounds,
    asset.world
  );
  const jianmen = content.landmarks.find((landmark) => landmark.name === "剑门关");
  const passLandmarks = content.landmarks.filter((landmark) => landmark.kind === "pass");

  assert.ok(jianmen, "剑门关 landmark must exist");
  assert.deepEqual(
    passLandmarks.map((landmark) => landmark.name),
    ["剑门关", "軹关陉", "太行陉", "白陉", "滏口陉", "井陉", "飞狐陉", "蒲阴陉"],
    "north expansion should add the in-slice Taihang corridor passes while keeping 剑门关"
  );
  assert.ok(
    distance({ x: positionToWorld(jianmen.position).x, z: positionToWorld(jianmen.position).y }, expectedJianmen) < 9,
    "剑门关 should sit near the real Jianmen Pass area"
  );
});

test("legacy placeholder landmarks are removed from Qinling POI content", () => {
  const landmarkNames = new Set(content.landmarks.map((landmark) => landmark.name));

  for (const landmarkName of REMOVED_PLACEHOLDER_LANDMARKS) {
    assert.ok(
      !landmarkNames.has(landmarkName),
      `${landmarkName} placeholder landmark should be removed from content.json`
    );
  }
});

test("Guanzhong start and narrative fragment use real east-side coordinates", () => {
  const expectedChangan = geoToWorld(
    { lon: 108.94, lat: 34.34 },
    asset.bounds,
    asset.world
  );
  const heartlandFragment = content.fragments.find((fragment) => fragment.id === "guanzhong-heartland");

  assert.ok(heartlandFragment, "guanzhong-heartland fragment must exist");
  assert.ok(
    distance({ x: positionToWorld(content.routeStart).x, z: positionToWorld(content.routeStart).y }, expectedChangan) < 12,
    "routeStart should begin near the real Guanzhong capital area"
  );
  assert.ok(
    distance({ x: positionToWorld(heartlandFragment.position).x, z: positionToWorld(heartlandFragment.position).y }, expectedChangan) < 12,
    "first Guanzhong fragment should match the same east-side geography"
  );
});

test("requested scenic and ancient POIs stay inside the current Qinling slice", () => {
  const requiredPois = [
    qinlingAncientSites.find((entry) => entry.name === "三星堆"),
    qinlingAncientSites.find((entry) => entry.name === "秦始皇陵"),
    // 乾陵从 scenic 迁到 ancient（带阶梯封土 mound 视觉），test 来源同步切换
    qinlingAncientSites.find((entry) => entry.name === "乾陵"),
    qinlingScenicLandmarks.find((entry) => entry.name === "法门寺")
  ];

  requiredPois.forEach((poi) => {
    assert.ok(poi, "requested POI fixture should exist");
    assert.ok(
      poi.lat >= asset.bounds.south && poi.lat <= asset.bounds.north,
      `${poi.name} latitude should stay inside the current slice`
    );
    assert.ok(
      poi.lon >= asset.bounds.west && poi.lon <= asset.bounds.east,
      `${poi.name} longitude should stay inside the current slice`
    );
  });
});

test("southern Phase B scenic and ancient POIs stay inside the target slice", () => {
  const requiredPois = [
    ...EXPECTED_SOUTHERN_SCENIC_IDS.map((id) =>
      qinlingScenicLandmarks.find((entry) => entry.id === id)
    ),
    ...EXPECTED_SOUTHERN_ANCIENT_IDS.map((id) =>
      qinlingAncientSites.find((entry) => entry.id === id)
    )
  ];

  requiredPois.forEach((poi) => {
    assert.ok(poi, "southern Phase B POI fixture should exist");
    assert.ok(
      poi.lat >= SOUTHERN_SLICE_BOUNDS.south && poi.lat <= SOUTHERN_SLICE_BOUNDS.north,
      `${poi.name} latitude should stay inside the Phase B slice`
    );
    assert.ok(
      poi.lon >= SOUTHERN_SLICE_BOUNDS.west && poi.lon <= SOUTHERN_SLICE_BOUNDS.east,
      `${poi.name} longitude should stay inside the Phase B slice`
    );
    assert.equal(typeof poi.summary, "string");
    assert.ok(poi.summary.length > 0, `${poi.name} should include a summary`);
  });
});

test("scenic and ancient POI totals include the southern Phase B additions", () => {
  assert.equal(qinlingScenicLandmarks.length, 21);
  assert.equal(qinlingAncientSites.length, 21);
});

test("eastern Phase E scenic and ancient POIs stay inside the east-extension slice", () => {
  const requiredPois = [
    ...EXPECTED_EASTERN_SCENIC_IDS.map((id) =>
      qinlingScenicLandmarks.find((entry) => entry.id === id)
    ),
    ...EXPECTED_EASTERN_ANCIENT_IDS.map((id) =>
      qinlingAncientSites.find((entry) => entry.id === id)
    )
  ];

  requiredPois.forEach((poi) => {
    assert.ok(poi, "eastern Phase E POI fixture should exist");
    assert.ok(
      poi.lat >= SOUTHERN_SLICE_BOUNDS.south && poi.lat <= SOUTHERN_SLICE_BOUNDS.north,
      `${poi.name} latitude should stay inside the Phase E slice`
    );
    assert.ok(
      poi.lon >= SOUTHERN_SLICE_BOUNDS.west && poi.lon <= SOUTHERN_SLICE_BOUNDS.east,
      `${poi.name} longitude should stay inside the Phase E slice`
    );
    assert.equal(typeof poi.summary, "string");
    assert.ok(poi.summary.length > 0, `${poi.name} should include a summary`);
  });
});
