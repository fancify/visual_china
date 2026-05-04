import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  ENGINE_CAMERA_FORWARD_AXIS,
  ENGINE_CAMERA_RIGHT_AXIS,
  ENGINE_CAMERA_UP_AXIS,
  ENGINE_AXIS_CONTRACT
} from "../src/game/worldAxis.js";
import {
  MAP_NORTH,
  MAP_SOUTH,
  MAP_EAST,
  MAP_WEST,
  MAP_ORIENTATION_CONTRACT,
  projectGeoToWorld,
  unprojectWorldToGeo,
  projectWorldToAtlasPixel,
  unprojectAtlasPixelToWorld,
  latitudeAtRow,
  longitudeAtColumn
} from "../src/game/mapOrientation.js";
import { geoToWorld, worldToGeo } from "../src/game/geoProjection.js";
import { worldPointToOverviewPixel } from "../src/game/atlasRender.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");

const qinlingBounds = {
  west: 103.5,
  east: 110.5,
  south: 28.5,
  north: 35.4
};
const qinlingWorld = { width: 193, depth: 331 };

test("engine axis contract describes Three.js convention only", () => {
  // worldAxis 不带"东南西北"语义——只描述引擎几何
  assert.deepEqual(
    { x: ENGINE_CAMERA_FORWARD_AXIS.x, y: ENGINE_CAMERA_FORWARD_AXIS.y, z: ENGINE_CAMERA_FORWARD_AXIS.z },
    { x: 0, y: 0, z: -1 }
  );
  assert.deepEqual(
    { x: ENGINE_CAMERA_RIGHT_AXIS.x, y: ENGINE_CAMERA_RIGHT_AXIS.y, z: ENGINE_CAMERA_RIGHT_AXIS.z },
    { x: 1, y: 0, z: 0 }
  );
  assert.deepEqual(
    { x: ENGINE_CAMERA_UP_AXIS.x, y: ENGINE_CAMERA_UP_AXIS.y, z: ENGINE_CAMERA_UP_AXIS.z },
    { x: 0, y: 1, z: 0 }
  );
  assert.ok(ENGINE_AXIS_CONTRACT.description.includes("Three.js"));
});

test("map orientation maps north to -Z (aligned with Three.js camera forward)", () => {
  assert.equal(MAP_ORIENTATION_CONTRACT.northAxis, "-z");
  assert.equal(MAP_ORIENTATION_CONTRACT.eastAxis, "+x");
  assert.deepEqual({ x: MAP_NORTH.x, z: MAP_NORTH.z }, { x: 0, z: -1 });
  assert.deepEqual({ x: MAP_SOUTH.x, z: MAP_SOUTH.z }, { x: 0, z: 1 });
  assert.deepEqual({ x: MAP_EAST.x, z: MAP_EAST.z }, { x: 1, z: 0 });
  assert.deepEqual({ x: MAP_WEST.x, z: MAP_WEST.z }, { x: -1, z: 0 });
});

test("projectGeoToWorld puts north at -Z and east at +X", () => {
  const center = projectGeoToWorld(
    {
      lon: (qinlingBounds.west + qinlingBounds.east) / 2,
      lat: (qinlingBounds.south + qinlingBounds.north) / 2
    },
    qinlingBounds,
    qinlingWorld
  );

  assert.ok(Math.abs(center.x) < 1e-9);
  assert.ok(Math.abs(center.z) < 1e-9);

  const northTip = projectGeoToWorld(
    {
      lon: (qinlingBounds.west + qinlingBounds.east) / 2,
      lat: qinlingBounds.north
    },
    qinlingBounds,
    qinlingWorld
  );
  assert.equal(northTip.x, 0);
  assert.equal(northTip.z, -qinlingWorld.depth / 2);

  const southTip = projectGeoToWorld(
    {
      lon: (qinlingBounds.west + qinlingBounds.east) / 2,
      lat: qinlingBounds.south
    },
    qinlingBounds,
    qinlingWorld
  );
  assert.equal(southTip.z, qinlingWorld.depth / 2);

  const eastTip = projectGeoToWorld(
    {
      lon: qinlingBounds.east,
      lat: (qinlingBounds.south + qinlingBounds.north) / 2
    },
    qinlingBounds,
    qinlingWorld
  );
  assert.equal(eastTip.x, qinlingWorld.width / 2);
  assert.equal(eastTip.z, 0);

  const westTip = projectGeoToWorld(
    {
      lon: qinlingBounds.west,
      lat: (qinlingBounds.south + qinlingBounds.north) / 2
    },
    qinlingBounds,
    qinlingWorld
  );
  assert.equal(westTip.x, -qinlingWorld.width / 2);
});

test("unprojectWorldToGeo round-trips projectGeoToWorld", () => {
  const samples = [
    { lon: 104, lat: 31 },
    { lon: 108.95, lat: 34.27 },
    { lon: 106.5, lat: 33 },
    { lon: 105.5, lat: 30.5 }
  ];

  for (const sample of samples) {
    const world = projectGeoToWorld(sample, qinlingBounds, qinlingWorld);
    const geo = unprojectWorldToGeo(world, qinlingBounds, qinlingWorld);
    assert.ok(Math.abs(geo.lon - sample.lon) < 1e-9);
    assert.ok(Math.abs(geo.lat - sample.lat) < 1e-9);
  }
});

test("legacy geoProjection.geoToWorld matches the new contract", () => {
  const samples = [
    { lon: 104, lat: 31 },
    { lon: 108.95, lat: 34.27 },
    { lon: 106.5, lat: 33 }
  ];

  for (const sample of samples) {
    const expected = projectGeoToWorld(sample, qinlingBounds, qinlingWorld);
    const legacy = geoToWorld(sample, qinlingBounds, qinlingWorld);
    assert.ok(Math.abs(expected.x - legacy.x) < 1e-9);
    assert.ok(Math.abs(expected.z - legacy.z) < 1e-9);
  }
});

test("legacy worldToGeo matches unprojectWorldToGeo", () => {
  const samples = [
    { x: 0, z: 0 },
    { x: 80, z: 60 },
    { x: -40, z: -100 }
  ];

  for (const sample of samples) {
    const expected = unprojectWorldToGeo(sample, qinlingBounds, qinlingWorld);
    const legacy = worldToGeo(sample, qinlingBounds, qinlingWorld);
    assert.ok(Math.abs(expected.lon - legacy.lon) < 1e-9);
    assert.ok(Math.abs(expected.lat - legacy.lat) < 1e-9);
  }
});

test("projectWorldToAtlasPixel puts north at canvas top, east at canvas right", () => {
  const canvas = { width: 200, height: 400 };

  const center = projectWorldToAtlasPixel(
    { x: 0, z: 0 },
    qinlingWorld,
    canvas
  );
  assert.equal(center.x, canvas.width / 2);
  assert.equal(center.y, canvas.height / 2);

  // 北 = -Z → canvas y 小 (top)
  const north = projectWorldToAtlasPixel(
    { x: 0, z: -qinlingWorld.depth / 2 },
    qinlingWorld,
    canvas
  );
  assert.equal(north.y, 0);

  // 南 = +Z → canvas y 大 (bottom)
  const south = projectWorldToAtlasPixel(
    { x: 0, z: qinlingWorld.depth / 2 },
    qinlingWorld,
    canvas
  );
  assert.equal(south.y, canvas.height);

  const east = projectWorldToAtlasPixel(
    { x: qinlingWorld.width / 2, z: 0 },
    qinlingWorld,
    canvas
  );
  assert.equal(east.x, canvas.width);

  const west = projectWorldToAtlasPixel(
    { x: -qinlingWorld.width / 2, z: 0 },
    qinlingWorld,
    canvas
  );
  assert.equal(west.x, 0);
});

test("unprojectAtlasPixelToWorld round-trips projectWorldToAtlasPixel", () => {
  const canvas = { width: 220, height: 270 };
  const samples = [
    { x: 0, z: 0 },
    { x: 70, z: -40 },
    { x: -30, z: 85 }
  ];

  for (const sample of samples) {
    const pixel = projectWorldToAtlasPixel(sample, qinlingWorld, canvas);
    const back = unprojectAtlasPixelToWorld(pixel, qinlingWorld, canvas);
    assert.ok(Math.abs(back.x - sample.x) < 1e-9);
    assert.ok(Math.abs(back.z - sample.z) < 1e-9);
  }
});

test("legacy atlasRender.worldPointToOverviewPixel matches the new contract", () => {
  const canvas = { width: 220, height: 270 };
  const samples = [
    { worldXZ: { x: 0, z: 0 }, legacyPoint: { x: 0, y: 0 } },
    { worldXZ: { x: 70, z: -40 }, legacyPoint: { x: 70, y: -40 } },
    { worldXZ: { x: -30, z: 85 }, legacyPoint: { x: -30, y: 85 } }
  ];

  for (const sample of samples) {
    const expected = projectWorldToAtlasPixel(sample.worldXZ, qinlingWorld, canvas);
    const legacy = worldPointToOverviewPixel(sample.legacyPoint, qinlingWorld, canvas);
    assert.ok(Math.abs(expected.x - legacy.x) < 1e-9);
    assert.ok(Math.abs(expected.y - legacy.y) < 1e-9);
  }
});

test("latitudeAtRow row=0 is north, row=rows-1 is south", () => {
  const rows = 333;
  const first = latitudeAtRow(0, rows, qinlingBounds);
  const last = latitudeAtRow(rows - 1, rows, qinlingBounds);
  const mid = latitudeAtRow(Math.floor((rows - 1) / 2), rows, qinlingBounds);
  assert.equal(first, qinlingBounds.north);
  assert.equal(last, qinlingBounds.south);
  assert.ok(mid > qinlingBounds.south && mid < qinlingBounds.north);
});

test("longitudeAtColumn column=0 is west, last column is east", () => {
  const columns = 208;
  assert.equal(longitudeAtColumn(0, columns, qinlingBounds), qinlingBounds.west);
  assert.equal(
    longitudeAtColumn(columns - 1, columns, qinlingBounds),
    qinlingBounds.east
  );
});

test("chinaLowresDemo no longer flips sampler input with mapZ = -z", async () => {
  const source = await readFile(
    path.join(repoRoot, "src/chinaLowresDemo.ts"),
    "utf8"
  );

  assert.ok(
    !/const\s+mapZ\s*=\s*-\s*z/.test(source),
    "chinaLowresDemo.ts must not use `mapZ = -z` hack; rely on mapOrientation contract instead"
  );
});
