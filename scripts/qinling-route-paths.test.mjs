import assert from "node:assert/strict";
import test from "node:test";

import { qinlingRouteAnchors } from "../src/game/data/qinlingRouteAnchors.js";
import { qinlingRoutePaths } from "../src/game/data/qinlingRoutePaths.js";
import { qinlingRoutes } from "../src/game/qinlingRoutes.js";

test("dense qinling route paths cover every current historical route id", () => {
  const expectedRouteIds = qinlingRoutes.map((route) => route.id).sort();
  const actualRouteIds = Object.keys(qinlingRoutePaths).sort();

  assert.equal(actualRouteIds.length, 11);
  assert.deepEqual(actualRouteIds, expectedRouteIds);
});

test("dense qinling route paths add intermediate terrain-aware samples while preserving endpoints", () => {
  for (const route of qinlingRoutes) {
    const anchors = qinlingRouteAnchors[route.id]?.points;
    const dense = qinlingRoutePaths[route.id];

    assert.ok(dense, `${route.id} should have a dense terrain-aware path`);
    assert.ok(
      dense.length > anchors.length,
      `${route.id} should add intermediate points beyond anchor count`
    );
    assert.deepEqual(dense[0], anchors[0], `${route.id} should preserve the first anchor exactly`);
    assert.deepEqual(
      dense.at(-1),
      anchors.at(-1),
      `${route.id} should preserve the final anchor exactly`
    );
  }
});

test("southern expansion route paths keep every anchor vertex in order", () => {
  for (const routeId of ["chama-route", "xiang-qian-route"]) {
    const anchors = qinlingRouteAnchors[routeId]?.points;
    const dense = qinlingRoutePaths[routeId];

    assert.ok(anchors, `${routeId} should expose anchors`);
    assert.ok(dense, `${routeId} should expose a dense path`);

    let denseCursor = 0;
    for (const anchor of anchors) {
      const foundIndex = dense.findIndex(
        (point, index) => index >= denseCursor && point.x === anchor.x && point.y === anchor.y
      );
      assert.ok(foundIndex >= denseCursor, `${routeId} should preserve anchor ${anchor.x},${anchor.y} in dense path order`);
      denseCursor = foundIndex + 1;
    }
  }
});
