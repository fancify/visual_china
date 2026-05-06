import assert from "node:assert/strict";
import test from "node:test";

import {
  densityProfileForClass,
  geoToWorld,
  worldToGeo
} from "../src/game/geoProjection.js";
import { projectGeoToWorld } from "../src/game/mapOrientation.js";
import {
  qinlingRegionBounds,
  qinlingRegionWorld
} from "../src/data/qinlingRegion.js";
import {
  qinlingAncientSites,
  qinlingAtlasFeatures,
  qinlingScenicLandmarks,
  qinlingWaterSystem
} from "../src/game/qinlingAtlas.js";
import { qinlingModernHydrography } from "../src/game/qinlingHydrography.js";
import { realQinlingCities } from "../src/data/realCities.js";

const qinlingBounds = qinlingRegionBounds;
const qinlingWorld = qinlingRegionWorld;

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

  assert.deepEqual(qinlingBounds, {
    west: 73.0,
    east: 135.0,
    south: 18.0,
    north: 53.0
  });
  assert.deepEqual(qinlingWorld, {
    width: 1711,
    depth: 1186
  });
  nearlyEqual(hanzhong.x, 83.61822580645173);
  nearlyEqual(hanzhong.z, 82.34228571428568);
  nearlyEqual(roundTrip.lon, 107.03);
  nearlyEqual(roundTrip.lat, 33.07);
});

test("world.depth physically matches lat-span × cos(midLat) of slice", () => {
  const lonSpan = qinlingRegionBounds.east - qinlingRegionBounds.west;
  const latSpan = qinlingRegionBounds.north - qinlingRegionBounds.south;
  const midLat = (qinlingRegionBounds.north + qinlingRegionBounds.south) / 2;
  const cosMidLat = Math.cos((midLat * Math.PI) / 180);

  // u_per_lon * cos(midLat) = u_per_lat，保证局部东西/南北物理尺度 1:1。
  const uPerLon = qinlingRegionWorld.width / lonSpan;
  const uPerLatPhysical = uPerLon / cosMidLat;
  const uPerLatActual = qinlingRegionWorld.depth / latSpan;
  const stretchRatio = uPerLatActual / uPerLatPhysical;

  assert.ok(
    stretchRatio > 0.95 && stretchRatio < 1.05,
    `world depth must keep N-S aspect within 5% of physical (cos(midLat)=${cosMidLat.toFixed(3)}). ` +
      `Got u/° lon=${uPerLon.toFixed(2)}, u/° lat actual=${uPerLatActual.toFixed(2)}, ` +
      `physical=${uPerLatPhysical.toFixed(2)}, stretch=${stretchRatio.toFixed(3)}.`
  );
});

test("atlas projection uses the same qinlingRegionBounds + qinlingRegionWorld as 3D scene", () => {
  const xianCity = realQinlingCities.find((city) => city.id === "xian");
  const xianAtlas = qinlingAtlasFeatures.find((feature) => feature.id === "real-city-xian");
  const taibai = qinlingScenicLandmarks.find((spot) => spot.id === "scenic-taibai-shan");
  const taibaiAtlas = qinlingAtlasFeatures.find((feature) => feature.id === "scenic-taibai-shan");
  const sanxingdui = qinlingAncientSites.find((site) => site.id === "ancient-sanxingdui");
  const sanxingduiAtlas = qinlingAtlasFeatures.find((feature) => feature.id === "ancient-sanxingdui");
  const weiheSource = qinlingModernHydrography.features.find(
    (feature) => feature.displayName === "渭河" || feature.name === "渭河"
  );
  const weiheAtlas = qinlingWaterSystem.find((feature) => feature.name === "渭河");

  assert.ok(xianCity && xianAtlas, "Xi'an atlas city must come from real city projection");
  assert.ok(taibai && taibaiAtlas, "Taibai atlas POI must exist");
  assert.ok(sanxingdui && sanxingduiAtlas, "Sanxingdui atlas POI must exist");
  assert.ok(weiheSource && weiheAtlas, "Wei River atlas geometry must exist");

  for (const [label, geo, atlasPoint] of [
    ["Xi'an city", xianCity, xianAtlas.world],
    ["Taibai scenic", taibai, taibaiAtlas.world],
    ["Sanxingdui ancient", sanxingdui, sanxingduiAtlas.world]
  ]) {
    const worldPoint = projectGeoToWorld(geo, qinlingRegionBounds, qinlingRegionWorld);
    nearlyEqual(atlasPoint.x, worldPoint.x);
    nearlyEqual(atlasPoint.y, worldPoint.z);
  }

  const sampleIndexes = [0, Math.floor(weiheSource.geometry.points.length / 2), weiheSource.geometry.points.length - 1];
  for (const index of sampleIndexes) {
    const geoPoint = weiheSource.geometry.points[index];
    const atlasPoint = weiheAtlas.world.points[index];
    const worldPoint = projectGeoToWorld(geoPoint, qinlingRegionBounds, qinlingRegionWorld);

    nearlyEqual(atlasPoint.x, worldPoint.x);
    nearlyEqual(atlasPoint.y, worldPoint.z);
  }
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
