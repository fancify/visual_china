import assert from "node:assert/strict";
import test from "node:test";

import { Box3, BufferGeometry, Color, InstancedMesh, Matrix4, Quaternion, Vector3 } from "three";

import { qinlingRuntimeBudget } from "../src/game/performanceBudget.ts";
import {
  PLANT_KINDS,
  buildPlantGeometrySet,
  createChunkScenery,
  plantKindForCell,
  sharedGrassGeometry
} from "../src/game/scenery.ts";

function geometrySize(geometry) {
  assert.ok(geometry instanceof BufferGeometry, "expected BufferGeometry");
  geometry.computeBoundingBox();
  const box = geometry.boundingBox ?? new Box3();
  return box.getSize(new Vector3());
}

function makeFlatScenerySampler({
  normalizedHeight,
  slope = 0,
  river = 0.12,
  width = 36,
  depth = 36,
  bounds
}) {
  return {
    asset: {
      minHeight: 0,
      maxHeight: 1,
      world: { width, depth },
      grid: { columns: 2, rows: 2 },
      bounds,
      presentation: undefined,
      worldBounds: undefined
    },
    sampleHeight() {
      return normalizedHeight;
    },
    sampleSurfaceHeight() {
      return normalizedHeight;
    },
    sampleSlope() {
      return slope;
    },
    sampleRiver() {
      return river;
    }
  };
}

function requireKindMesh(group, part, kind) {
  const mesh = group.children.find(
    (child) =>
      child instanceof InstancedMesh &&
      child.userData.role === part &&
      child.userData.kind === kind
  );
  assert.ok(mesh instanceof InstancedMesh, `expected ${kind} ${part} instanced mesh`);
  return mesh;
}

function collectTotalInstances(group, role) {
  return group.children.reduce((sum, child) => {
    if (!(child instanceof InstancedMesh) || child.userData.role !== role) {
      return sum;
    }
    return sum + child.count;
  }, 0);
}

function collectScaleY(mesh) {
  const matrix = new Matrix4();
  const position = new Vector3();
  const quaternion = new Quaternion();
  const scale = new Vector3();
  const values = [];

  for (let index = 0; index < mesh.count; index += 1) {
    mesh.getMatrixAt(index, matrix);
    matrix.decompose(position, quaternion, scale);
    values.push(scale.y);
  }

  return values;
}

test("plant geometry set covers five biodiversity kinds with distinct silhouettes", () => {
  assert.deepEqual(PLANT_KINDS, [
    "conifer",
    "umbrella-pine",
    "broadleaf",
    "bamboo-cluster",
    "bush"
  ]);

  const conifer = buildPlantGeometrySet("conifer");
  const umbrella = buildPlantGeometrySet("umbrella-pine");
  const broadleaf = buildPlantGeometrySet("broadleaf");
  const bamboo = buildPlantGeometrySet("bamboo-cluster");
  const bush = buildPlantGeometrySet("bush");

  const coniferTrunkSize = geometrySize(conifer.trunkGeometry);
  const umbrellaLeafSize = geometrySize(umbrella.leafGeometry);
  const broadleafLeafSize = geometrySize(broadleaf.leafGeometry);
  const bambooTrunkSize = geometrySize(bamboo.trunkGeometry);
  const bushLeafSize = geometrySize(bush.leafGeometry);

  assert.ok(coniferTrunkSize.y > 0.09 && coniferTrunkSize.y < 0.13);
  assert.ok(umbrellaLeafSize.x > umbrellaLeafSize.y * 2.5);
  assert.ok(Math.abs(broadleafLeafSize.x - broadleafLeafSize.y) < 0.08);
  assert.ok(bambooTrunkSize.y > 1.3);
  assert.ok(bambooTrunkSize.x > 0.09);
  assert.equal(bush.trunkGeometry, null);
  assert.ok(bushLeafSize.y < bushLeafSize.x);
});

test("plant kind distribution follows altitude and biome rules", () => {
  const highAltitude = countKinds(0.62, "warm-temperate-humid");
  assert.ok(highAltitude.conifer > 820, `expected alpine conifer dominance, got ${JSON.stringify(highAltitude)}`);
  assert.ok(highAltitude.bush > 40 && highAltitude.bush < 180);

  const midAltitude = countKinds(0.38, "warm-temperate-humid");
  assert.ok(midAltitude["umbrella-pine"] > midAltitude.conifer);
  assert.ok(midAltitude.conifer > midAltitude.broadleaf);
  assert.ok(midAltitude.broadleaf > 60);
  assert.ok(midAltitude.bush < 120);

  const basin = countKinds(0.18, "subtropical-humid");
  assert.ok(basin.broadleaf > 420, `expected lowland broadleaf dominance, got ${JSON.stringify(basin)}`);
  assert.ok(basin["bamboo-cluster"] > 90);
  assert.ok(basin.bush > basin["umbrella-pine"]);

  const plain = countKinds(0.18, "warm-temperate-semiarid");
  assert.equal(plain["bamboo-cluster"], 0);
  assert.ok(plain.broadleaf > plain["umbrella-pine"]);
});

test("lowland scenery emits separate instanced meshes per plant kind", () => {
  const scenery = createChunkScenery(
    makeFlatScenerySampler({
      normalizedHeight: 0.18,
      slope: 0.08,
      river: 0.16,
      bounds: { west: 106, east: 108, south: 34.8, north: 35.2 }
    }),
    qinlingRuntimeBudget.scenery,
    undefined,
    "summer"
  );

  for (const kind of PLANT_KINDS) {
    requireKindMesh(scenery, "leaf", kind);
  }

  assert.ok(collectTotalInstances(scenery, "leaf") > 0);
  assert.ok(collectTotalInstances(scenery, "trunk") > 0);

  const broadleafLeaves = requireKindMesh(scenery, "leaf", "broadleaf");
  const bushLeaves = requireKindMesh(scenery, "leaf", "bush");
  const bambooTrunks = requireKindMesh(scenery, "trunk", "bamboo-cluster");

  assert.ok(broadleafLeaves.count > 0, "expected some broadleaf trees in lowland chunk");
  assert.ok(bushLeaves.count > 0, "expected some shrub instances in lowland chunk");
  assert.ok(bambooTrunks.count >= 0, "bamboo mesh should exist even if this chunk spawns none");

  const bushScaleY = collectScaleY(bushLeaves);
  assert.ok(bushScaleY.every((scaleY) => scaleY < 1.1), "bush canopies should stay compact");
});

test("grass geometry uses tapered seven-blade tuft with jittered heights and bent tips", () => {
  // Audit-fix B2 (2026-05-11): R10a 5-blade rectangle 还像葱。重做为 7 片三角形 taper +
  // 高度 jitter (0.35-0.62) + 顶部弯向某随机方向 + 角度乱不均匀分布。
  const geometry = sharedGrassGeometry;
  const position = geometry.getAttribute("position");
  geometry.computeBoundingBox();
  const size = geometry.boundingBox.getSize(new Vector3());

  // 7 blades × PlaneGeometry(1, 4) → (1+1)*(4+1)=10 verts indexed → 4 cells × 6 verts = 24 verts non-indexed
  // 7 × 24 = 168 verts.
  assert.equal(position.count, 168, "seven segmented non-indexed blades should produce 168 vertices");
  assert.ok(size.y > 0.45 && size.y < 0.75, `grass height should jitter around 0.35-0.62 with vertex ramp, got ${size.y}`);
  assert.ok(size.x > 0.08, `tuft should spread across X (with bend), got ${size.x}`);
  assert.ok(size.z > 0.08, `tuft should spread across Z (with bend), got ${size.z}`);
});

function countKinds(height, biomeId, sampleCount = 1000) {
  const counts = {
    conifer: 0,
    "umbrella-pine": 0,
    broadleaf: 0,
    "bamboo-cluster": 0,
    bush: 0
  };

  for (let seed = 1; seed <= sampleCount; seed += 1) {
    counts[plantKindForCell(height, biomeId, seed)] += 1;
  }

  return counts;
}
