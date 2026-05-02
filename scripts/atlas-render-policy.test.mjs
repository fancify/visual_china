import assert from "node:assert/strict";
import test from "node:test";

import {
  atlasCanvasPoint,
  atlasFeatureCenter,
  atlasLayerDrawOrder,
  atlasMinimumDisplayPriority,
  missingDemTileWorldRects,
  parseMissingDemTileNames,
  atlasVisibleFeatures,
  worldPointToOverviewPixel
} from "../src/game/atlasRender.js";
import {
  qinlingAtlasFeatures,
  qinlingAtlasLayers
} from "../src/game/qinlingAtlas.js";

const world = { width: 180, depth: 240 };

test("atlas render policy keeps the default overview readable", () => {
  const visible = atlasVisibleFeatures(qinlingAtlasFeatures, qinlingAtlasLayers);
  const visibleLayers = new Set(visible.map((feature) => feature.layer));

  // 城市层用真实坐标 verification: external-vector，跟 3D 共用同一份
  // source-of-truth，所以默认就显示。water（curated-modern-qinling）
  // 还没 external-vector 标记、pass 是 manual-atlas-draft，按"默认视图
  // 只展示已核验事实"的策略仍被过滤掉。livelihood 整层 defaultVisible:
  // false，专题视图单独打开。
  // landform / road / military / culture 整层已经删除（codex review 后
  // 跟 3D 对齐），所以这里不再断言它们"不可见"——assertion 写出来反而误导。
  assert.ok(visibleLayers.has("city"), "verified real cities should render by default");
  assert.ok(!visibleLayers.has("water"), "unverified curated water stays out of the default overview");
  assert.ok(!visibleLayers.has("pass"), "manual-draft passes stay hidden until evidence layer toggled");
  assert.ok(!visibleLayers.has("livelihood"), "livelihood is opt-in subject layer");
});

test("atlas render policy does not expose unverified or raw evidence features as facts", () => {
  const features = [
    {
      id: "draft-landform",
      layer: "landform",
      displayPriority: 10,
      source: { name: "manual-atlas-draft", verification: "unverified" }
    },
    {
      id: "osm-water",
      layer: "water",
      displayPriority: 8,
      source: { name: "openstreetmap-overpass", verification: "external-vector" }
    },
    {
      id: "primary-water",
      layer: "water",
      displayPriority: 8,
      source: { name: "primary-modern-qinling", verification: "external-vector" }
    }
  ];
  const layers = [
    { id: "landform", defaultVisible: true },
    { id: "water", defaultVisible: true }
  ];

  assert.deepEqual(
    atlasVisibleFeatures(features, layers).map((feature) => feature.id),
    ["primary-water"]
  );
  assert.deepEqual(
    atlasVisibleFeatures(features, layers, { includeUnverifiedFeatures: true })
      .map((feature) => feature.id),
    // landform 已不在 atlasLayerDrawOrder 里，sort 时拿到 fallback index 99，
    // 排在 water 后面。这里只是验证 includeUnverifiedFeatures 让 unverified
    // 特征也通过 filter，顺序差异是 draw order 收缩的副作用。
    ["primary-water", "draft-landform"]
  );
  assert.deepEqual(
    atlasVisibleFeatures(features, layers, { includeEvidenceFeatures: true })
      .map((feature) => feature.id),
    ["osm-water", "primary-water"]
  );
});

test("atlas render order puts water under city/pass/scenic/livelihood point labels", () => {
  // landform / road / military / culture 整层删除、scenic（名胜）后续加上。
  // 水系作为底色先画，叙事节点 pass / scenic / livelihood 后画压在城市之上。
  assert.deepEqual(atlasLayerDrawOrder, [
    "water",
    "city",
    "pass",
    "scenic",
    "livelihood"
  ]);
});

test("world points convert to overview pixels without changing geographic proportions", () => {
  // 新 mapOrientation 契约：北 = -Z → 画布 y 小（上方）；南 = +Z → 画布 y 大。
  assert.deepEqual(
    worldPointToOverviewPixel({ x: -90, y: -120 }, world, { width: 220, height: 270 }),
    { x: 0, y: 0 }
  );
  assert.deepEqual(
    worldPointToOverviewPixel({ x: 90, y: 120 }, world, { width: 220, height: 270 }),
    { x: 220, y: 270 }
  );
});

test("atlas canvas points clamp out-of-bounds features to the overview frame", () => {
  assert.deepEqual(
    atlasCanvasPoint(
      { x: 120, y: 160 },
      world,
      { width: 220, height: 270 }
    ),
    { x: 220, y: 270 }
  );
});

test("atlas feature center uses the average of rendered world points", () => {
  const center = atlasFeatureCenter(
    {
      world: {
        points: [
          { x: -90, y: -120 },
          { x: 90, y: 120 }
        ]
      }
    },
    world,
    { width: 220, height: 270 }
  );

  assert.deepEqual(center, { x: 110, y: 135 });
});

test("atlas render policy exposes interpolated DEM tile gaps as map quality areas", () => {
  const notes = [
    "Missing required tiles filled by neighbor interpolation: N32E103_FABDEM_V1-2.tif, N32E104_FABDEM_V1-2.tif."
  ];

  assert.deepEqual(parseMissingDemTileNames(notes), [
    "N32E103_FABDEM_V1-2.tif",
    "N32E104_FABDEM_V1-2.tif"
  ]);

  const rects = missingDemTileWorldRects({
    bounds: { west: 103.5, east: 109, south: 30.4, north: 35.4 },
    world,
    notes
  });

  assert.equal(rects.length, 2);
  assert.equal(rects[0].tileName, "N32E103_FABDEM_V1-2.tif");
  assert.ok(rects[0].minX >= -90, "western missing tile should be clipped to slice bounds");
  assert.ok(rects[0].maxX < rects[1].maxX, "adjacent missing tiles should preserve geography order");
  assert.ok(rects[0].minY < rects[0].maxY, "missing tile rect should have visible north-south span");
});

test("atlas render policy keeps compact overview to reviewed main rivers", () => {
  assert.equal(atlasMinimumDisplayPriority({ fullscreen: false, scale: 1 }), 9);
  assert.equal(atlasMinimumDisplayPriority({ fullscreen: true, scale: 1 }), 9);
  assert.equal(atlasMinimumDisplayPriority({ fullscreen: true, scale: 1.5 }), 7);
  assert.equal(atlasMinimumDisplayPriority({ fullscreen: true, scale: 2 }), 4);
  assert.equal(atlasMinimumDisplayPriority({ fullscreen: true, scale: 4 }), 4);

  const features = [
    {
      id: "major",
      layer: "water",
      displayPriority: 10,
      source: { verification: "external-vector" }
    },
    {
      id: "primary-tributary",
      layer: "water",
      displayPriority: 8,
      source: { verification: "external-vector" }
    }
  ];
  const layers = [{ id: "water", defaultVisible: true }];

  assert.deepEqual(
    atlasVisibleFeatures(features, layers, { minDisplayPriority: 9 }).map((feature) => feature.id),
    ["major"]
  );
  assert.deepEqual(
    atlasVisibleFeatures(features, layers, { minDisplayPriority: 7 }).map((feature) => feature.id),
    ["major", "primary-tributary"]
  );
});

test("atlas render policy keeps needs-review water out of the default overview", () => {
  const features = [
    {
      id: "review-water",
      layer: "water",
      displayPriority: 8,
      source: { name: "primary-modern-qinling", verification: "needs-review" }
    },
    {
      id: "verified-water",
      layer: "water",
      displayPriority: 8,
      source: { name: "primary-modern-qinling", verification: "external-vector" }
    }
  ];
  const layers = [{ id: "water", defaultVisible: true }];

  assert.deepEqual(
    atlasVisibleFeatures(features, layers).map((feature) => feature.id),
    ["verified-water"]
  );
});
