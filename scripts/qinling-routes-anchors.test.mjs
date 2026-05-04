import assert from "node:assert/strict";
import test from "node:test";

import { qinlingRegionBounds } from "../src/data/qinlingRegion.js";
import {
  QINLING_ROUTE_ANCHOR_GEOGRAPHY,
  qinlingRouteAnchors
} from "../src/game/data/qinlingRouteAnchors.js";
import { qinlingRoutes } from "../src/game/qinlingRoutes.js";

const EXPECTED_ROUTE_IDS = [
  "chencang-road",
  "baoxie-road",
  "guanzhong-corridor",
  "tangluo-road",
  "ziwu-road",
  "jinniu-road",
  "micang-road",
  "qishan-road",
  "lizhi-road"
];

test("historical qinling routes expose verified anchor-based metadata", () => {
  for (const routeId of EXPECTED_ROUTE_IDS) {
    const route = qinlingRoutes.find((item) => item.id === routeId);

    assert.ok(route, `${routeId} should exist`);
    assert.equal(route.source?.name, "historical-anchor-points");
    assert.equal(route.source?.verification, "historical-references");
    assert.ok(route.points.length >= 4, `${routeId} should contain at least four anchors`);
  }
});

test("historical route anchor geography now stays within the expanded qinling region bounds", () => {
  for (const [routeId, anchors] of Object.entries(QINLING_ROUTE_ANCHOR_GEOGRAPHY)) {
    assert.ok(anchors.length >= 4, `${routeId} should define at least four geographic anchors`);

    for (const anchor of anchors) {
      const isInBounds =
        anchor.lat >= qinlingRegionBounds.south &&
        anchor.lat <= qinlingRegionBounds.north &&
        anchor.lon >= qinlingRegionBounds.west &&
        anchor.lon <= qinlingRegionBounds.east;

      assert.equal(isInBounds, true, `${routeId}:${anchor.name} should stay within region bounds`);
    }
  }
});

test("baoxie road keeps the Liuba-centered historical middle section", () => {
  const baoxieAnchors = QINLING_ROUTE_ANCHOR_GEOGRAPHY["baoxie-road"];
  assert.equal(baoxieAnchors.length, 7);

  const yingge = baoxieAnchors.find((anchor) => anchor.name.includes("鹦鸽镇"));
  assert.ok(yingge, "baoxie-road should keep 鹦鸽镇 as the Taibai-area historical anchor");
  assert.ok(
    yingge.note.includes("太白县"),
    "baoxie-road should explain that 鹦鸽镇 covers the Taibai county segment of the road"
  );

  const liuba = baoxieAnchors.find((anchor) => anchor.name.includes("留坝"));
  assert.ok(liuba, "baoxie-road should include 留坝县 as a key middle anchor");
  assert.ok(Math.abs(liuba.lat - 33.62) <= 0.02);
  assert.ok(Math.abs(liuba.lon - 106.92) <= 0.02);
});

test("ziwu-road starts at Xi'an city, not at the canyon mouth", () => {
  const anchors = QINLING_ROUTE_ANCHOR_GEOGRAPHY["ziwu-road"];
  assert.equal(anchors.length, 7);
  assert.equal(anchors[0].name, "西安");
  assert.ok(Math.abs(anchors[0].lat - 34.27) < 0.05);
  assert.ok(Math.abs(anchors[0].lon - 108.95) < 0.05);
  assert.deepEqual(qinlingRouteAnchors["ziwu-road"].labelPoint, qinlingRouteAnchors["ziwu-road"].points[3]);
});

test("tangluo-road starts at Zhouzhi city, not at the valley mouth", () => {
  const anchors = QINLING_ROUTE_ANCHOR_GEOGRAPHY["tangluo-road"];
  assert.equal(anchors.length, 7);
  assert.equal(anchors[0].name, "周至");
  assert.ok(Math.abs(anchors[0].lat - 34.16) < 0.05);
  assert.ok(Math.abs(anchors[0].lon - 108.22) < 0.05);
  assert.deepEqual(qinlingRouteAnchors["tangluo-road"].labelPoint, qinlingRouteAnchors["tangluo-road"].points[3]);
});

test("qishan road keeps the western detour through Qishan fort before turning back to Hanzhong", () => {
  const qishanAnchors = QINLING_ROUTE_ANCHOR_GEOGRAPHY["qishan-road"];
  assert.equal(qishanAnchors.length, 7);

  const qishanFort = qishanAnchors.find((anchor) => anchor.name.includes("祁山堡"));
  assert.ok(qishanFort, "qishan-road should include 祁山堡");
  assert.ok(Math.abs(qishanFort.lat - 34.2) <= 0.05);
  assert.ok(Math.abs(qishanFort.lon - 105.41) <= 0.05);

  const xiheIndex = qishanAnchors.findIndex((anchor) => anchor.name.includes("西和"));
  const fortIndex = qishanAnchors.findIndex((anchor) => anchor.name.includes("祁山堡"));
  const tianshuiIndex = qishanAnchors.findIndex((anchor) => anchor.name.includes("天水"));
  const chengxianIndex = qishanAnchors.findIndex((anchor) => anchor.name.includes("成县"));
  assert.equal(xiheIndex, -1, "qishan-road should keep 西和 as a city but remove it from the route polyline");
  assert.equal(tianshuiIndex < fortIndex && fortIndex < chengxianIndex, true);
});

test("jinniu road adds Guangyuan and orders Wulian/Zitong by verified latitude", () => {
  const jinniuAnchors = QINLING_ROUTE_ANCHOR_GEOGRAPHY["jinniu-road"];
  assert.equal(jinniuAnchors.length, 12);

  const names = jinniuAnchors.map((anchor) => anchor.name);
  const qipanIndex = names.findIndex((name) => name.includes("七盘关"));
  const guangyuanIndex = names.findIndex((name) => name.includes("广元"));
  const zhaohuaIndex = names.findIndex((name) => name.includes("昭化"));
  const jianmenIndex = names.findIndex((name) => name.includes("剑门关"));
  const wulianIndex = names.findIndex((name) => name.includes("武连"));
  const zitongIndex = names.findIndex((name) => name.includes("梓潼"));
  const mianyangIndex = names.findIndex((name) => name.includes("绵阳"));

  assert.equal(qipanIndex < guangyuanIndex && guangyuanIndex < zhaohuaIndex, true);

  const wulian = jinniuAnchors[wulianIndex];
  const zitong = jinniuAnchors[zitongIndex];
  assert.ok(wulian, "jinniu-road should include 武连");
  assert.ok(zitong, "jinniu-road should include 梓潼");

  if (wulian.lat > zitong.lat) {
    assert.equal(jianmenIndex < wulianIndex && wulianIndex < zitongIndex && zitongIndex < mianyangIndex, true);
  } else {
    assert.equal(jianmenIndex < zitongIndex && zitongIndex < wulianIndex && wulianIndex < mianyangIndex, true);
  }
});

test("guanzhong corridor links the northern Shu-road mouths across the Wei south bank", () => {
  const guanzhongAnchors = QINLING_ROUTE_ANCHOR_GEOGRAPHY["guanzhong-corridor"];
  assert.equal(guanzhongAnchors.length, 4);

  assert.deepEqual(
    guanzhongAnchors.map((anchor) => anchor.name),
    ["宝鸡", "眉县", "周至", "西安"]
  );
});

test("lizhi road starts from Chang'an and now lands inside the expanded southern slice", () => {
  const lizhiAnchors = QINLING_ROUTE_ANCHOR_GEOGRAPHY["lizhi-road"];
  assert.equal(lizhiAnchors.length, 5);
  assert.equal(lizhiAnchors[0]?.name.includes("西安"), true);
  assert.equal(lizhiAnchors.at(-1)?.name.includes("涪陵"), true);
  assert.ok(lizhiAnchors.at(-1).lat >= qinlingRegionBounds.south);
  assert.ok(lizhiAnchors.at(-1).lat <= 29.8, "lizhi-road should still reach the far south edge corridor");
});

test("precomputed world anchors stay aligned with route points", () => {
  for (const route of qinlingRoutes) {
    const precomputed = qinlingRouteAnchors[route.id];

    assert.ok(precomputed, `${route.id} should have precomputed anchors`);
    assert.deepEqual(route.points, precomputed.points);
    assert.deepEqual(route.labelPoint, precomputed.labelPoint);
  }
});
