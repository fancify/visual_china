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
  },
  sampleHeightWorldCached() {
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

test("lake renderer samples cached terrain height without prefetching nationwide DEM chunks", () => {
  const source = fs.readFileSync(new URL("../src/game/terrain/lakeRenderer.ts", import.meta.url), "utf8");
  assert.match(source, /sampleHeightWorldCached/);
  assert.doesNotMatch(source, /sampler\.sampleHeightWorld\(/);
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

test("lake mask sampler filters high-rank reservoir rectangles from the demo lake layer", () => {
  const mask = createLakeMaskSamplerFromBundle({
    features: [
      {
        type: "Feature",
        properties: { name: "Baidagang Shuiku", nameAlt: null, scalerank: 9 },
        geometry: {
          type: "Polygon",
          coordinates: [
            [[117.32, 38.76], [117.43, 38.76], [117.43, 38.68], [117.32, 38.68], [117.32, 38.76]]
          ]
        }
      },
      {
        type: "Feature",
        properties: { name: null, nameAlt: null, scalerank: 7 },
        geometry: {
          type: "Polygon",
          coordinates: [
            [[116.1, 38.9], [116.3, 38.9], [116.3, 38.8], [116.1, 38.8], [116.1, 38.9]]
          ]
        }
      },
      {
        type: "Feature",
        properties: { name: "Tai Hu", nameAlt: "Lake Tai", scalerank: 2 },
        geometry: {
          type: "Polygon",
          coordinates: [
            [[120, 31], [121, 31], [121, 30], [120, 30], [120, 31]]
          ]
        }
      }
    ]
  });

  assert.equal(mask.isWater(117.36, 38.72), false);
  assert.equal(mask.isWater(116.2, 38.85), false);
  assert.equal(mask.isWater(120.5, 30.5), true);
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

test("river loader builds a spatial candidate index instead of scanning the manifest every frame", () => {
  const loader = new RiverLoader({ sampler });
  loader.manifest = {
    schemaVersion: "visual-china.rivers-pyramid.v1",
    generatedAt: "test",
    bounds: { west: 100, east: 130, south: 20, north: 50 },
    minOrder: 4,
    tierGrid: "L0",
    totalPolylines: 4,
    chunkCount: 4,
    chunks: [
      { x: 0, z: 0, file: "0_0.json", count: 1 },
      { x: 1, z: 0, file: "1_0.json", count: 1 },
      { x: 4, z: 0, file: "4_0.json", count: 1 },
      { x: 1, z: 2, file: "1_2.json", count: 1 }
    ]
  };

  const candidates = loader.findCandidateChunks(1, 0, 1);
  assert.deepEqual(candidates, [{ x: 0, z: 0 }, { x: 1, z: 0 }]);
  assert.ok(loader.getCandidateIndexSizeForTest() > 0);
});

test("river renderer samples cached terrain height without prefetching DEM chunks", () => {
  const source = fs.readFileSync(new URL("../src/game/terrain/riverRenderer.ts", import.meta.url), "utf8");
  assert.match(source, /sampleHeightWorldCached/);
  assert.doesNotMatch(source, /sampler\.sampleHeightWorld\(/);
});

test("pyramid demo evicts river groups outside the active candidate radius", () => {
  const source = fs.readFileSync(new URL("../src/pyramid-demo.ts", import.meta.url), "utf8");
  assert.match(source, /activeRiverKeys/);
  assert.match(source, /scene\.remove\(rh\.group\)/);
  assert.match(source, /loadedRiverGroups\.delete\(key\)/);
});

test("pyramid demo defers non-critical overlays until after the first render opportunity", () => {
  const source = fs.readFileSync(new URL("../src/pyramid-demo.ts", import.meta.url), "utf8");
  assert.match(source, /async function initDeferredOverlays\(\)/);
  assert.match(source, /await new Promise<void>\(\(resolve\) => requestAnimationFrame/);
  assert.match(source, /void initDeferredOverlays\(\)/);
  assert.match(source, /let debugOverlay: ReturnType<typeof createDebugOverlay> \| null = null/);
  assert.match(source, /let riverLoader: RiverLoader \| null = null/);
  assert.match(source, /if \(riverLoader\) \{/);
});

test("pyramid demo preload screen stages terrain and water before entering", () => {
  const html = fs.readFileSync(new URL("../pyramid-demo.html", import.meta.url), "utf8");
  const source = fs.readFileSync(new URL("../src/pyramid-demo.ts", import.meta.url), "utf8");
  const poems = JSON.parse(fs.readFileSync(new URL("../src/data/tangThreeHundredPoems.json", import.meta.url), "utf8"));

  assert.match(html, /id="preload"/);
  assert.doesNotMatch(html, /preload-title/);
  assert.doesNotMatch(html, /千里江山正在展开/);
  assert.match(html, /body \{[\s\S]*background: #c7d5e3/);
  assert.match(html, /#canvas \{[\s\S]*background: #c7d5e3/);
  assert.match(html, /rgba\(246, 249, 244, 0\)/);
  assert.match(html, /backdrop-filter: none/);
  assert.match(html, /#preload-panel \{[\s\S]*text-align: center/);
  assert.match(html, /#preload-panel \{[\s\S]*text-shadow: none/);
  assert.match(html, /#preload-track \{[\s\S]*margin: 0 auto/);
  assert.match(html, /@keyframes preload-sheen/);
  assert.match(html, /id="preload-bar"/);
  assert.ok(poems.length >= 300, "preload poetry should use the full Three Hundred Tang Poems corpus");
  assert.ok(poems.every((poem) => poem.title && poem.author && poem.eraName && poem.yearLabel));
  assert.ok(poems.every((poem) => Array.isArray(poem.lines) && poem.lines.length > 0));
  assert.match(source, /tangThreeHundredPoems/);
  assert.doesNotMatch(source, /\\\\n/);
  assert.match(source, /sanitizePoemText/);
  assert.match(source, /stripPoemParentheticals/);
  assert.match(source, /replace\(\s*\/\[\\uFF08\\uFF09/);
  assert.match(source, /一作\|通：\|又作\|或作/);
  assert.match(source, /POEM_ROTATION_MS = 15_000/);
  assert.match(source, /setInterval\(showRandomPreloadPoem, POEM_ROTATION_MS\)/);
  assert.match(source, /preloadPoemMeta/);
  assert.match(source, /animatePreloadProgress/);
  assert.match(source, /DEMO_VIEW_RADIUS_UNITS = 360/);
  assert.match(source, /viewRadiusUnits: DEMO_VIEW_RADIUS_UNITS/);
  assert.match(source, /setPreloadProgress\(0\.22, "加载出生点附近 L0\.\.\."/);
  assert.match(source, /await preloadTerrainChunks\(coreL0\)/);
  assert.match(source, /setPreloadProgress\(0\.48, "加载远景 L3\.\.\."/);
  assert.match(source, /await preloadTerrainChunks\(fallbackL3\)/);
  assert.match(source, /setPreloadProgress\(0\.58, "构建预览地形\.\.\."/);
  assert.match(source, /await handle\.updateVisibleAsync\(camera, scene\);\nrenderer\.render\(scene, camera\);\n\n\/\/ ocean plane/);
  assert.match(source, /setPreloadProgress\(0\.86, "加载河流索引\.\.\."/);
  assert.match(source, /setPreloadProgress\(0\.94, "构建当前视野地形\.\.\."/);
  assert.match(source, /await handle\.updateVisibleAsync\(camera, scene\)/);
  assert.match(source, /renderer\.render\(scene, camera\);\n\n\/\/ keys/);
  assert.match(source, /createPyramidEnvironmentRuntime/);
  assert.match(source, /enableSkyDome: true/);
  assert.match(source, /pyramidEnvironment\.update\(dt\)/);
  assert.match(source, /setTimeout\(hidePreload, 180\)/);
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

test("pyramid demo does not expose temporary globals after terrain seam debugging", () => {
  const source = fs.readFileSync(new URL("../src/pyramid-demo.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /pyramidHandle/);
  assert.doesNotMatch(source, /验完即删/);
});
