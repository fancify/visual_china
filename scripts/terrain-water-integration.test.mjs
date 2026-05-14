import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  LAKE_WATER_COLOR,
  LAKE_WATER_OPACITY,
  OCEAN_WATER_COLOR,
  OCEAN_WATER_OPACITY,
  RIVER_WATER_COLOR,
  RIVER_WATER_OPACITY
} from "../src/game/terrain/waterStyle.ts";
import { createOceanPlane } from "../src/game/terrain/oceanRenderer.ts";
import { createLakeMaskSamplerFromBundle } from "../src/game/terrain/lakeRenderer.ts";
import { RiverLoader, updateRiverGroupShimmer } from "../src/game/terrain/riverRenderer.ts";
import { unprojectWorldToGeo } from "../src/game/mapOrientation.js";
import {
  qinlingRegionBounds,
  qinlingRegionWorld
} from "../src/data/qinlingRegion.js";

const sampler = {
  sampleHeightWorld() {
    return 1;
  }
};

function relativeLuminance(color) {
  const { r, g, b } = color;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function colorDistance(a, b) {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
}

test("ocean, river, and lake renderers use distinct water palettes", () => {
  const ocean = createOceanPlane();
  assert.equal(ocean.material.uniforms.uBaseColor.value.getHex(), OCEAN_WATER_COLOR.getHex());
  assert.equal(ocean.material.uniforms.uOpacity.value, OCEAN_WATER_OPACITY);

  const loader = new RiverLoader({ sampler });
  const group = loader.buildRiverGroup({
    schemaVersion: "visual-china.rivers-chunk.v1",
    chunkX: 0,
    chunkZ: 0,
    bounds: { west: 120, east: 121, south: 30, north: 31 },
    polylineCount: 1,
    polylines: [
      {
        id: "river-test",
        ord: 8,
        coords: [[120.1, 30.1], [120.2, 30.2]]
      }
    ]
  });
  assert.equal(group.children[0].material.color.getHex(), RIVER_WATER_COLOR.getHex());
  assert.equal(group.children[0].material.opacity, RIVER_WATER_OPACITY);
  assert.notEqual(RIVER_WATER_COLOR.getHex(), OCEAN_WATER_COLOR.getHex());
  assert.notEqual(LAKE_WATER_COLOR.getHex(), OCEAN_WATER_COLOR.getHex());
  assert.ok(RIVER_WATER_OPACITY < LAKE_WATER_OPACITY);
});

test("ocean water uses a brighter teal BotW-like palette instead of deep navy", () => {
  assert.ok(
    relativeLuminance(OCEAN_WATER_COLOR) > relativeLuminance(RIVER_WATER_COLOR),
    "ocean should read brighter than the restrained river overlay"
  );
  assert.ok(OCEAN_WATER_COLOR.g > OCEAN_WATER_COLOR.r);
  assert.ok(OCEAN_WATER_COLOR.b > OCEAN_WATER_COLOR.r);
  assert.ok(OCEAN_WATER_OPACITY >= 0.84);
  assert.ok(OCEAN_WATER_OPACITY <= 0.92);
});

test("lake water is lighter than ocean and close to the river palette", () => {
  assert.ok(
    relativeLuminance(LAKE_WATER_COLOR) > relativeLuminance(OCEAN_WATER_COLOR),
    "lake surfaces should read shallower than the sea"
  );
  assert.ok(
    colorDistance(LAKE_WATER_COLOR, RIVER_WATER_COLOR) < 0.25,
    "lake color should sit closer to rivers than to open sea"
  );
});

test("water surfaces expose subtle shimmer timing without changing base water style", () => {
  const ocean = createOceanPlane();
  assert.equal(ocean.material.fog, true);
  assert.ok(ocean.material.uniforms.fogColor, "fog-aware shader must include Three.js fog uniforms");
  assert.ok(ocean.material.uniforms.fogNear, "fog-aware shader must include Three.js fog uniforms");
  assert.ok(ocean.material.uniforms.fogFar, "fog-aware shader must include Three.js fog uniforms");
  assert.ok(ocean.userData.waterSurface);
  ocean.userData.waterSurface.setTime(12.5);
  assert.equal(ocean.material.uniforms.uTime.value, 12.5);
  assert.ok(ocean.material.uniforms.uShimmerStrength.value > 0);
  assert.ok(ocean.material.uniforms.uShimmerStrength.value < 0.3);

  const loader = new RiverLoader({ sampler });
  const group = loader.buildRiverGroup({
    schemaVersion: "visual-china.rivers-chunk.v1",
    chunkX: 0,
    chunkZ: 0,
    bounds: { west: 120, east: 121, south: 30, north: 31 },
    polylineCount: 1,
    polylines: [
      {
        id: "river-test",
        ord: 8,
        coords: [[120.1, 30.1], [120.2, 30.2]]
      }
    ]
  });
  const material = group.children[0].material;
  const baseColor = material.color.getHex();
  updateRiverGroupShimmer(group, 4);
  assert.notEqual(material.color.getHex(), baseColor);
  assert.ok(material.opacity >= RIVER_WATER_OPACITY * 0.96);
  assert.ok(material.opacity <= RIVER_WATER_OPACITY);
});

test("ocean plane is wide and fog-aware for an infinite sea horizon", () => {
  const ocean = createOceanPlane();
  assert.ok(ocean.geometry.parameters.width > 12000);
  assert.ok(ocean.geometry.parameters.height > 12000);
  assert.equal(ocean.material.fog, true);
});

test("ocean plane keeps coast color gradient disabled", () => {
  const ocean = createOceanPlane();

  assert.ok(ocean.material.uniforms.uCoastColorStrength, "ocean shader needs coast blend strength");
  assert.equal(ocean.material.uniforms.uCoastColorStrength.value, 0);
  assert.equal(ocean.material.uniforms.uUseCoastDistanceMap.value, 0);
});

test("lake mask sampler identifies lake interiors and holes", () => {
  const mask = createLakeMaskSamplerFromBundle({
    features: [
      {
        type: "Feature",
        properties: { name: "test", nameAlt: null, scalerank: 1 },
        geometry: {
          type: "Polygon",
          coordinates: [
            [[120, 31], [122, 31], [122, 29], [120, 29], [120, 31]],
            [[120.8, 30.2], [121.2, 30.2], [121.2, 29.8], [120.8, 29.8], [120.8, 30.2]]
          ]
        }
      }
    ]
  });

  assert.equal(mask.isWater(120.4, 30.4), true);
  assert.equal(mask.isWater(121, 30), false);
  assert.equal(mask.isWater(123, 30), false);
});

test("river renderer clips line segments outside land and inside lakes", () => {
  const loader = new RiverLoader({
    sampler,
    landMaskSampler: {
      isLand(lon) {
        return lon < 120.7;
      }
    },
    excludeWaterSampler: {
      isWater(lon) {
        return lon > 120.25 && lon < 120.45;
      }
    }
  });
  const group = loader.buildRiverGroup({
    schemaVersion: "visual-china.rivers-chunk.v1",
    chunkX: 0,
    chunkZ: 0,
    bounds: { west: 120, east: 121, south: 30, north: 31 },
    polylineCount: 1,
    polylines: [
      {
        id: "river-test",
        ord: 8,
        coords: [[120.1, 30.1], [120.3, 30.1], [120.5, 30.1], [120.9, 30.1]]
      }
    ]
  });

  const positions = Array.from(group.children[0].geometry.attributes.instanceStart.array);
  assert.ok(positions.length > 0);
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    assert.ok(Number.isFinite(x));
  }
  assert.ok(
    group.children[0].geometry.attributes.instanceStart.count < 15,
    "clipped rivers should emit fewer line segments than the full smoothed line"
  );
});

test("river renderer clips river mouths to the coastline instead of dropping the outlet segment", () => {
  const loader = new RiverLoader({
    sampler,
    landMaskSampler: {
      isLand(lon) {
        return lon < 120.5;
      }
    }
  });
  const group = loader.buildRiverGroup({
    schemaVersion: "visual-china.rivers-chunk.v1",
    chunkX: 0,
    chunkZ: 0,
    bounds: { west: 120, east: 121, south: 30, north: 31 },
    polylineCount: 1,
    polylines: [
      {
        id: "river-mouth-test",
        ord: 8,
        coords: [[120.1, 30.1], [120.9, 30.1]]
      }
    ]
  });

  const starts = Array.from(group.children[0].geometry.attributes.instanceStart.array);
  const ends = Array.from(group.children[0].geometry.attributes.instanceEnd.array);
  const emitted = [...starts, ...ends];
  const lons = [];
  for (let i = 0; i < emitted.length; i += 3) {
    const geo = unprojectWorldToGeo(
      { x: emitted[i], z: emitted[i + 2] },
      qinlingRegionBounds,
      qinlingRegionWorld
    );
    lons.push(geo.lon);
  }

  assert.ok(Math.max(...lons) > 120.49, "river should reach the coastline");
  assert.ok(Math.max(...lons) <= 120.501, "river should not continue offshore");
});

test("pyramid demo does not use the failed coastline overlay layer", () => {
  const source = fs.readFileSync(new URL("../src/pyramid-demo.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /createCoastlineOceanOverlay/);
});

test("pyramid demo exposes a beach tint compare toggle", () => {
  const source = fs.readFileSync(new URL("../src/pyramid-demo.ts", import.meta.url), "utf8");
  assert.match(source, /setBeachTint/);
  assert.match(source, /e\.key === "b"/);
});

test("pyramid demo starts above Beijing at roughly 10km altitude", () => {
  const source = fs.readFileSync(new URL("../src/pyramid-demo.ts", import.meta.url), "utf8");
  assert.match(source, /BEIJING_START_GEO\s*=\s*\{\s*lat:\s*39\.9042,\s*lon:\s*116\.4074\s*\}/);
  assert.match(source, /START_ALTITUDE_WORLD_Y\s*=\s*21\.4/);
  assert.match(source, /camera\.position\.set\(startWorld\.x,\s*START_ALTITUDE_WORLD_Y,\s*startWorld\.z\)/);
});
