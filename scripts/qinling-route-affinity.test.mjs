import assert from "node:assert/strict";
import test from "node:test";

import { qinlingRoutes, routeAffinityAt } from "../src/game/qinlingRoutes.js";

test("Qinling route affinity uses historical-reference routes by default", () => {
  // 北扩到 40°N 后 baseline 更新：同一留坝经纬度按当前 slice 重新投影到世界坐标。
  // 留坝县 (lat 33.62, lon 106.92) — 褒斜道中段，当前 slice 的实际世界坐标
  const influence = routeAffinityAt({ x: -92.01, y: -84.28 });

  assert.ok(influence.affinity > 0.7);
  assert.equal(influence.nearestRoute?.id, "baoxie-road");
});

test("Qinling historical routes stay available when explicitly including unverified routes", () => {
  // 北扩到 40°N 后 baseline 更新：同一昭化经纬度按当前 slice 重新投影到世界坐标。
  // 昭化（古葭萌） (lat 32.32, lon 105.86) — 金牛道中段，当前 slice 的实际世界坐标
  const influence = routeAffinityAt({ x: -121.29, y: -42.46 }, 11, {
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
