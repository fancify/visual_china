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

test("historical route anchor geography stays within qinling region bounds unless explicitly extending out of slice", () => {
  for (const [routeId, anchors] of Object.entries(QINLING_ROUTE_ANCHOR_GEOGRAPHY)) {
    assert.ok(anchors.length >= 4, `${routeId} should define at least four geographic anchors`);

    for (const anchor of anchors) {
      const isInBounds =
        anchor.lat >= qinlingRegionBounds.south &&
        anchor.lat <= qinlingRegionBounds.north &&
        anchor.lon >= qinlingRegionBounds.west &&
        anchor.lon <= qinlingRegionBounds.east;

      if (routeId === "lizhi-road" && anchor.name.includes("涪陵")) {
        assert.equal(isInBounds, false, "lizhi-road should extend out of the current south slice");
        continue;
      }

      assert.equal(isInBounds, true, `${routeId}:${anchor.name} should stay within region bounds`);
    }
  }
});

test("baoxie road keeps the Liuba-centered historical middle section", () => {
  const baoxieAnchors = QINLING_ROUTE_ANCHOR_GEOGRAPHY["baoxie-road"];
  assert.equal(baoxieAnchors.length, 7);

  const liuba = baoxieAnchors.find((anchor) => anchor.name.includes("留坝"));
  assert.ok(liuba, "baoxie-road should include 留坝县 as a key middle anchor");
  assert.ok(Math.abs(liuba.lat - 33.62) <= 0.02);
  assert.ok(Math.abs(liuba.lon - 106.92) <= 0.02);
});

test("qishan road keeps the western detour through Qishan fort before turning back to Hanzhong", () => {
  const qishanAnchors = QINLING_ROUTE_ANCHOR_GEOGRAPHY["qishan-road"];
  assert.equal(qishanAnchors.length, 8);

  const qishanFort = qishanAnchors.find((anchor) => anchor.name.includes("祁山堡"));
  assert.ok(qishanFort, "qishan-road should include 祁山堡");
  assert.ok(Math.abs(qishanFort.lat - 34.43) <= 0.02);
  assert.ok(Math.abs(qishanFort.lon - 104.43) <= 0.02);

  const xiheIndex = qishanAnchors.findIndex((anchor) => anchor.name.includes("西和"));
  const fortIndex = qishanAnchors.findIndex((anchor) => anchor.name.includes("祁山堡"));
  const chengxianIndex = qishanAnchors.findIndex((anchor) => anchor.name.includes("成县"));
  assert.equal(xiheIndex < fortIndex && fortIndex < chengxianIndex, true);
});

test("jinniu road includes Wulian and Zitong between Jianmen Pass and Mianyang", () => {
  const jinniuAnchors = QINLING_ROUTE_ANCHOR_GEOGRAPHY["jinniu-road"];
  assert.equal(jinniuAnchors.length, 11);

  const names = jinniuAnchors.map((anchor) => anchor.name);
  const jianmenIndex = names.findIndex((name) => name.includes("剑门关"));
  const wulianIndex = names.findIndex((name) => name.includes("武连"));
  const zitongIndex = names.findIndex((name) => name.includes("梓潼"));
  const mianyangIndex = names.findIndex((name) => name.includes("绵阳"));

  assert.equal(jianmenIndex < wulianIndex && wulianIndex < zitongIndex && zitongIndex < mianyangIndex, true);
});

test("lizhi road starts from Chang'an and extends beyond the current southern slice", () => {
  const lizhiAnchors = QINLING_ROUTE_ANCHOR_GEOGRAPHY["lizhi-road"];
  assert.equal(lizhiAnchors.length, 5);
  assert.equal(lizhiAnchors[0]?.name.includes("西安"), true);
  assert.equal(lizhiAnchors.at(-1)?.name.includes("涪陵"), true);
  assert.ok(lizhiAnchors.at(-1).lat < qinlingRegionBounds.south);
});

test("precomputed world anchors stay aligned with route points", () => {
  for (const route of qinlingRoutes) {
    const precomputed = qinlingRouteAnchors[route.id];

    assert.ok(precomputed, `${route.id} should have precomputed anchors`);
    assert.deepEqual(route.points, precomputed.points);
    assert.deepEqual(route.labelPoint, precomputed.labelPoint);
  }
});
