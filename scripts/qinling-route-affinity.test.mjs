import assert from "node:assert/strict";
import test from "node:test";

import { qinlingRoutes, routeAffinityAt } from "../src/game/qinlingRoutes.js";

test("Qinling route affinity uses historical-reference routes by default", () => {
  const influence = routeAffinityAt({ x: 15.23, y: -36 });

  assert.ok(influence.affinity > 0.7);
  assert.equal(influence.nearestRoute?.id, "baoxie-road");
});

test("Qinling historical routes stay available when explicitly including unverified routes", () => {
  const influence = routeAffinityAt({ x: -24.65, y: 27.84 }, 11, {
    includeUnverifiedRoutes: true
  });

  assert.ok(influence.affinity > 0.7);
  assert.equal(influence.nearestRoute?.id, "jinniu-road");
});

test("Qinling route affinity is low away from the Guanzhong-Hanzhong crossings", () => {
  const influence = routeAffinityAt({ x: 78, y: 78 });

  assert.ok(influence.affinity < 0.2);
});

test("named route labels include Chencang, Jinniu, and Micang roads", () => {
  const chencang = qinlingRoutes.find((route) => route.id === "chencang-road");
  const jinniu = qinlingRoutes.find((route) => route.id === "jinniu-road");
  const micang = qinlingRoutes.find((route) => route.id === "micang-road");

  assert.ok(chencang, "陈仓道 must be a named route");
  assert.ok(jinniu, "金牛道 must be a named route south of Hanzhong");
  assert.ok(micang, "米仓道 must be a named route toward Bazhong");
  assert.equal(chencang.label, "陈仓道");
  assert.equal(jinniu.label, "金牛道");
  assert.equal(micang.label, "米仓道");
  assert.ok(chencang.labelPoint, "陈仓道 needs a visible map label anchor");
  assert.ok(jinniu.labelPoint, "金牛道 needs a visible map label anchor");
  assert.ok(micang.labelPoint, "米仓道 needs a visible map label anchor");
});
