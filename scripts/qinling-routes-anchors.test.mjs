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
  "micang-road"
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

test("historical route anchor geography stays within qinling region bounds", () => {
  for (const [routeId, anchors] of Object.entries(QINLING_ROUTE_ANCHOR_GEOGRAPHY)) {
    assert.ok(anchors.length >= 4, `${routeId} should define at least four geographic anchors`);

    for (const anchor of anchors) {
      assert.ok(
        anchor.lat >= qinlingRegionBounds.south &&
          anchor.lat <= qinlingRegionBounds.north,
        `${routeId}:${anchor.name} latitude ${anchor.lat} must stay within region bounds`
      );
      assert.ok(
        anchor.lon >= qinlingRegionBounds.west &&
          anchor.lon <= qinlingRegionBounds.east,
        `${routeId}:${anchor.name} longitude ${anchor.lon} must stay within region bounds`
      );
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

test("precomputed world anchors stay aligned with route points", () => {
  for (const route of qinlingRoutes) {
    const precomputed = qinlingRouteAnchors[route.id];

    assert.ok(precomputed, `${route.id} should have precomputed anchors`);
    assert.deepEqual(route.points, precomputed.points);
    assert.deepEqual(route.labelPoint, precomputed.labelPoint);
  }
});
