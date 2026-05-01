import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRouteRibbonVertices,
  qinlingRouteRibbonStyle
} from "../src/game/routeRibbon.js";

test("route ribbon creates broad ground quads instead of thin WebGL lines", () => {
  const vertices = buildRouteRibbonVertices(
    [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 }
    ],
    {
      width: 4,
      yOffset: 0.35,
      sampleHeight: (x, z) => x * 0.1 + z * 0.05
    }
  );

  assert.equal(vertices.length, 36);
  assert.ok(Number.isFinite(vertices[1]));
  assert.ok(Number.isFinite(vertices[4]));
  assert.ok(
    Math.abs(vertices[2] - vertices[5]) >= 3.9,
    "first segment should have a visible ribbon width across z"
  );
});

test("Qinling route ribbon style reads as a guide overlay, not opaque terrain", () => {
  assert.ok(qinlingRouteRibbonStyle.width >= 2.2);
  assert.ok(qinlingRouteRibbonStyle.width <= 3);
  assert.ok(qinlingRouteRibbonStyle.yOffset >= 0.8);
  assert.ok(qinlingRouteRibbonStyle.opacity <= 0.12);
});
