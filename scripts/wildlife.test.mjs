import assert from "node:assert/strict";
import test from "node:test";
import { BufferGeometry, InstancedMesh } from "three";
import { setCityFlattenZones } from "../src/game/cityFlattenZones.js";

async function loadWildlifeModule() {
  try {
    return await import("../src/game/wildlife.ts");
  } catch (error) {
    assert.fail(`wildlife module should exist and be importable: ${error}`);
  }
}

function makeWildlifeSampler({
  normalizedHeight,
  slope = 0,
  river = 0,
  settlement = 0,
  width = 36,
  depth = 36,
  worldBounds
}) {
  return {
    asset: {
      minHeight: 0,
      maxHeight: 1,
      world: { width, depth },
      grid: { columns: 2, rows: 2 },
      bounds: undefined,
      presentation: undefined,
      worldBounds
    },
    sampleHeight() {
      return normalizedHeight;
    },
    sampleSurfaceHeight(x, z) {
      return normalizedHeight + x * 0.002 + z * 0.001;
    },
    sampleSlope() {
      return slope;
    },
    sampleRiver() {
      return river;
    },
    sampleSettlement() {
      return settlement;
    }
  };
}

function buildChunkSamplers(count, samplerFactory) {
  return Array.from({ length: count }, (_, index) => samplerFactory(index));
}

test("wildlife chunk builder reduces density to sparse single-animal chunks", async () => {
  const wildlife = await loadWildlifeModule();
  const samplers = buildChunkSamplers(35, (seed) =>
    makeWildlifeSampler({
      normalizedHeight: 0.18,
      slope: 0.08,
      river: seed % 5 === 0 ? 0.18 : 0.03,
      worldBounds: { minX: seed * 40, maxX: seed * 40 + 36, minZ: 0, maxZ: 36 }
    })
  );
  const allSpawns = samplers.flatMap((sampler) => wildlife.buildWildlifeChunk(sampler, {
    biomeId: "warm-temperate-humid",
    vegetationDensity: 1
  }));

  samplers.forEach((sampler, index) => {
    const spawns = wildlife.buildWildlifeChunk(sampler, {
      biomeId: "warm-temperate-humid",
      vegetationDensity: 1
    });
    assert.ok(
      spawns.length <= 2,
      `each chunk should spawn at most 2 wildlife instances, got ${spawns.length} on chunk ${index}`
    );
  });

  assert.ok(
    allSpawns.length >= 10 && allSpawns.length <= 25,
    `35 chunks should now yield sparse wildlife counts in the 10-25 range, got ${allSpawns.length}`
  );
});

test("wildlife keeps mountain deer and river cranes in their intended habitats", async () => {
  const wildlife = await loadWildlifeModule();
  const mountainBiome = {
    biomeId: "warm-temperate-humid",
    vegetationDensity: 1.15
  };
  const subtropicalBiome = {
    biomeId: "subtropical-humid",
    vegetationDensity: 1.3
  };

  const mountainSpawns = buildChunkSamplers(24, (seed) =>
    makeWildlifeSampler({
      normalizedHeight: 0.44,
      slope: 0.18,
      river: 0.03,
      worldBounds: { minX: seed * 40, maxX: seed * 40 + 36, minZ: 0, maxZ: 36 }
    })
  ).flatMap((sampler) => wildlife.buildWildlifeChunk(sampler, mountainBiome));

  const riverSpawns = buildChunkSamplers(24, (seed) =>
    makeWildlifeSampler({
      normalizedHeight: 0.18,
      slope: 0.06,
      river: 0.42,
      worldBounds: { minX: 0, maxX: 36, minZ: seed * 40, maxZ: seed * 40 + 36 }
    })
  ).flatMap((sampler) => wildlife.buildWildlifeChunk(sampler, subtropicalBiome));

  const drySpawns = buildChunkSamplers(24, (seed) =>
    makeWildlifeSampler({
      normalizedHeight: 0.18,
      slope: 0.06,
      river: 0.02,
      worldBounds: { minX: 40, maxX: 76, minZ: seed * 40, maxZ: seed * 40 + 36 }
    })
  ).flatMap((sampler) => wildlife.buildWildlifeChunk(sampler, subtropicalBiome));

  const deer = mountainSpawns.filter((spawn) => spawn.kind === "deer");
  const cranes = riverSpawns.filter((spawn) => spawn.kind === "crane");
  const dryCranes = drySpawns.filter((spawn) => spawn.kind === "crane");

  assert.ok(deer.length > 0, "mountain chunks should still produce deer");
  deer.forEach((spawn) => {
    assert.ok(
      spawn.normalizedHeight > 0.4,
      `deer should stay on mountain terrain above normalized height 0.4, got ${spawn.normalizedHeight}`
    );
  });

  assert.ok(cranes.length > 0, "subtropical river chunks should still produce cranes");
  cranes.forEach((spawn) => {
    assert.ok(
      spawn.river > 0.1,
      `crane should only spawn near riverMask > 0.1, got ${spawn.river}`
    );
  });
  assert.equal(dryCranes.length, 0, "dry chunks should not spawn cranes");
});

test("wildlife chunk builder skips city flatten zones entirely", async () => {
  const wildlife = await loadWildlifeModule();
  const samplers = buildChunkSamplers(24, (seed) =>
    makeWildlifeSampler({
      normalizedHeight: 0.18,
      slope: 0.06,
      river: 0.02,
      worldBounds: { minX: seed * 40, maxX: seed * 40 + 36, minZ: 0, maxZ: 36 }
    })
  );

  setCityFlattenZones([]);
  const baseline = samplers.flatMap((sampler) =>
    wildlife.buildWildlifeChunk(sampler, {
      biomeId: "warm-temperate-humid",
      vegetationDensity: 1
    })
  );

  setCityFlattenZones(
    samplers.map((sampler, index) => ({
      cityId: `city-${index}`,
      centerX: (sampler.asset.worldBounds.minX + sampler.asset.worldBounds.maxX) * 0.5,
      centerZ: (sampler.asset.worldBounds.minZ + sampler.asset.worldBounds.maxZ) * 0.5,
      radius: 40,
      groundY: 0.18
    }))
  );
  const flattened = samplers.flatMap((sampler) =>
    wildlife.buildWildlifeChunk(sampler, {
      biomeId: "warm-temperate-humid",
      vegetationDensity: 1
    })
  );

  assert.ok(baseline.length > 0, "baseline chunk set should still spawn wildlife");
  assert.equal(flattened.length, 0);
});

test("wildlife handle uses one merged instanced mesh per kind", async () => {
  const wildlife = await loadWildlifeModule();
  const sampler = makeWildlifeSampler({
    normalizedHeight: 0.44,
    slope: 0.16,
    river: 0.03,
    worldBounds: { minX: 0, maxX: 36, minZ: 0, maxZ: 36 }
  });
  const handle = wildlife.createWildlifeHandle([sampler]);

  assert.equal(handle.group.children.length, 4, "wildlife draw calls should collapse to 4 kind meshes");
  handle.group.children.forEach((child) => {
    assert.ok(child instanceof InstancedMesh, "each wildlife child should be a single InstancedMesh");
    assert.ok(child.geometry instanceof BufferGeometry, "each wildlife kind should use merged BufferGeometry");
  });

  Object.values(wildlife.sharedWildlifeGeometries).forEach((geometry) => {
    assert.ok(geometry instanceof BufferGeometry, "shared wildlife silhouettes should be merged BufferGeometry objects");
  });

  wildlife.disposeWildlife(handle);
});

test("wildlife wander pose moves over time and stays inside wander radius while hugging terrain", async () => {
  const wildlife = await loadWildlifeModule();
  const sampler = makeWildlifeSampler({
    normalizedHeight: 0.3,
    slope: 0.04,
    river: 0.02,
    worldBounds: { minX: 0, maxX: 36, minZ: 0, maxZ: 36 }
  });
  const instance = {
    kind: "deer",
    centerX: 6,
    centerZ: -4,
    phaseOffset: 0.35,
    wanderRadius: 2.2,
    speed: 0.18,
    scale: 1
  };

  const pose0 = wildlife.computeWildlifePose(instance, 0, sampler);
  const pose1 = wildlife.computeWildlifePose(instance, 1, sampler);
  const pose5 = wildlife.computeWildlifePose(instance, 5, sampler);

  assert.notDeepEqual(
    { x: pose0.position.x, z: pose0.position.z },
    { x: pose1.position.x, z: pose1.position.z },
    "wander pose should move between elapsed seconds 0 and 1"
  );
  assert.notDeepEqual(
    { x: pose1.position.x, z: pose1.position.z },
    { x: pose5.position.x, z: pose5.position.z },
    "wander pose should continue moving over time"
  );

  [pose0, pose1, pose5].forEach((pose) => {
    const dx = pose.position.x - instance.centerX;
    const dz = pose.position.z - instance.centerZ;
    assert.ok(
      Math.hypot(dx, dz) <= instance.wanderRadius + 0.001,
      `wander pose should stay inside its radius, got distance ${Math.hypot(dx, dz)}`
    );
    const expectedGround = sampler.sampleSurfaceHeight(pose.position.x, pose.position.z);
    assert.ok(
      pose.position.y >= expectedGround + 0.02,
      `wildlife should stay slightly above terrain, got y ${pose.position.y} for ground ${expectedGround}`
    );
    assert.ok(
      pose.position.y <= expectedGround + 0.5,
      `wildlife grounding offset should stay tight to the surface, got y ${pose.position.y} for ground ${expectedGround}`
    );
  });
});
