import assert from "node:assert/strict";
import test from "node:test";

import { qinlingRouteAnchors } from "../src/game/data/qinlingRouteAnchors.js";
import { qinlingRoutePaths } from "../src/game/data/qinlingRoutePaths.js";
import { qinlingRoutes } from "../src/game/qinlingRoutes.js";

test("dense qinling route paths cover every current historical route id", () => {
  const expectedRouteIds = qinlingRoutes.map((route) => route.id).sort();
  const actualRouteIds = Object.keys(qinlingRoutePaths).sort();

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
