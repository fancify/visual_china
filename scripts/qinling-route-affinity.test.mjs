import assert from "node:assert/strict";
import test from "node:test";

import { qinlingRoutes, routeAffinityAt } from "../src/game/qinlingRoutes.js";

test("Qinling route affinity does not use unverified hand-drawn routes by default", () => {
  const influence = routeAffinityAt({ x: 34, y: 28 });

  assert.equal(influence.affinity, 0);
  assert.equal(influence.nearestRoute, null);
});

test("Qinling draft route affinity remains available for QA when explicitly requested", () => {
  const influence = routeAffinityAt({ x: 34, y: 28 }, 11, {
    includeUnverifiedRoutes: true
  });

  assert.ok(influence.affinity > 0.7);
  assert.equal(influence.nearestRoute?.id, "baoxie-road");
});

test("Qinling route affinity is low away from the Guanzhong-Hanzhong crossings", () => {
  const influence = routeAffinityAt({ x: -62, y: -42 });

  assert.ok(influence.affinity < 0.2);
});

test("named route labels include Chencang Road and Jianmen Shu Road", () => {
  const chencang = qinlingRoutes.find((route) => route.id === "chencang-road");
  const jianmen = qinlingRoutes.find((route) => route.id === "jianmen-shu-road");

  assert.ok(chencang, "陈仓道 must be a named route");
  assert.ok(jianmen, "剑门蜀道 must be a named route south of Hanzhong");
  assert.equal(chencang.label, "陈仓道");
  assert.equal(jianmen.label, "剑门蜀道");
  assert.ok(chencang.labelPoint, "陈仓道 needs a visible map label anchor");
  assert.ok(jianmen.labelPoint, "剑门蜀道 needs a visible map label anchor");
});
