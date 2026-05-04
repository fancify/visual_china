import assert from "node:assert/strict";
import test from "node:test";

import {
  densityProfileForClass,
  geoToWorld,
  worldToGeo
} from "../src/game/geoProjection.js";

const qinlingBounds = {
  west: 103.5,
  east: 110.5,
  south: 28.5,
  north: 35.4
};
const qinlingWorld = {
  width: 193,
  depth: 331
};

function nearlyEqual(actual, expected) {
  assert.ok(
    Math.abs(actual - expected) < 0.000001,
    `expected ${actual} to be approximately ${expected}`
  );
}

test("geographic and game coordinates use a strict linear reversible mapping", () => {
  const hanzhong = geoToWorld(
    { lon: 107.03, lat: 33.07 },
    qinlingBounds,
    qinlingWorld
  );
  const roundTrip = worldToGeo(hanzhong, qinlingBounds, qinlingWorld);

  nearlyEqual(hanzhong.x, 0.8271428571428663);
  // 南扩到 28.5 后，汉中相对整个 slice 明显更靠北，z 负值会更大。
  nearlyEqual(hanzhong.z, -53.72753623188408);
  nearlyEqual(roundTrip.lon, 107.03);
  nearlyEqual(roundTrip.lat, 33.07);
});

test("experience density changes pacing, not map projection", () => {
  const focus = densityProfileForClass("high-focus");
  const sparse = densityProfileForClass("ultra-sparse");
  const point = { lon: 87.62, lat: 43.82 };
  const bounds = { west: 73, east: 96, south: 35, north: 49 };
  const world = { width: 180, depth: 110 };
  const focusProjection = geoToWorld(point, bounds, world);
  const sparseProjection = geoToWorld(point, bounds, world);

  assert.deepEqual(focusProjection, sparseProjection);
  assert.equal(focus.coordinatePolicy, "strict-geographic");
  assert.equal(sparse.coordinatePolicy, "strict-geographic");
  assert.ok(sparse.travelSpeedMultiplier > focus.travelSpeedMultiplier);
  assert.ok(sparse.eventDensityMultiplier < focus.eventDensityMultiplier);
});
