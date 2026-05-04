import {
  BoxGeometry,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshPhongMaterial,
  Object3D,
  SphereGeometry
} from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { biomeWeightsAt, type BiomeWeights } from "./biomeZones.js";
import type { TerrainSampler } from "./demSampler.js";
import { unprojectWorldToGeo } from "./mapOrientation.js";

export type WildlifeKind = "deer" | "goat" | "rabbit" | "crane";

export interface WildlifeSpawn {
  kind: WildlifeKind;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  scale: number;
  normalizedHeight: number;
  slope: number;
  river: number;
  seed: number;
}

export interface WildlifeInstance {
  kind: WildlifeKind;
  centerX: number;
  centerZ: number;
  phaseOffset: number;
  wanderRadius: number;
  speed: number;
  scale: number;
  rotationBias: number;
  sampler: TerrainSampler;
  worldOffsetX: number;
  worldOffsetZ: number;
}

export interface WildlifePose {
  position: { x: number; y: number; z: number };
  rotationY: number;
  scale: number;
  groundY: number;
  localX: number;
  localZ: number;
}

export interface WildlifeHandle {
  group: Group;
  totalInstances: number;
  perKindCounts: Record<WildlifeKind, number>;
  instancesByKind: Record<WildlifeKind, WildlifeInstance[]>;
  meshesByKind: Record<WildlifeKind, InstancedMesh>;
}

const WILDLIFE_KINDS: WildlifeKind[] = ["deer", "goat", "rabbit", "crane"];
export const MAX_WILDLIFE_PER_CHUNK = 2;

const SPAWN_CHANCE_PER_CHUNK = 0.4;
const MULTI_CHANCE = 0.15;
const WILDLIFE_GROUND_OFFSET = 0.02;
const WANDER_NOISE_FREQUENCY = 0.8;

function pseudoRandom(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function normalizedHeight(height: number, sampler: TerrainSampler): number {
  const minHeight = sampler.asset.presentation?.globalMinHeight ?? sampler.asset.minHeight;
  const maxHeight = sampler.asset.presentation?.globalMaxHeight ?? sampler.asset.maxHeight;

  return (height - minHeight) / (maxHeight - minHeight || 1);
}

function prepareForMerge(geometry: BufferGeometry): BufferGeometry {
  return geometry.index ? geometry.toNonIndexed() : geometry.clone();
}

function translatedBox(
  width: number,
  height: number,
  depth: number,
  x: number,
  y: number,
  z: number
): BufferGeometry {
  const geometry = prepareForMerge(new BoxGeometry(width, height, depth));
  geometry.translate(x, y, z);
  return geometry;
}

function translatedCylinder(
  radius: number,
  height: number,
  x: number,
  y: number,
  z: number
): BufferGeometry {
  const geometry = prepareForMerge(new CylinderGeometry(radius, radius, height, 6));
  geometry.translate(x, y, z);
  return geometry;
}

function translatedCone(
  radius: number,
  height: number,
  x: number,
  y: number,
  z: number,
  rotationX = 0,
  rotationY = 0,
  rotationZ = 0
): BufferGeometry {
  const geometry = prepareForMerge(new ConeGeometry(radius, height, 5));
  if (rotationX !== 0) {
    geometry.rotateX(rotationX);
  }
  if (rotationY !== 0) {
    geometry.rotateY(rotationY);
  }
  if (rotationZ !== 0) {
    geometry.rotateZ(rotationZ);
  }
  geometry.translate(x, y, z);
  return geometry;
}

function translatedSphere(
  radius: number,
  x: number,
  y: number,
  z: number,
  scaleX = 1,
  scaleY = 1,
  scaleZ = 1
): BufferGeometry {
  const geometry = prepareForMerge(new SphereGeometry(radius, 8, 7));
  geometry.scale(scaleX, scaleY, scaleZ);
  geometry.translate(x, y, z);
  return geometry;
}

function mergeParts(parts: BufferGeometry[]): BufferGeometry {
  const merged = BufferGeometryUtils.mergeGeometries(parts.map(prepareForMerge));
  if (!merged) {
    return parts[0]!;
  }
  merged.computeVertexNormals();
  return merged;
}

function buildDeerSilhouette(): BufferGeometry {
  return mergeParts([
    translatedBox(0.22, 0.22, 0.55, 0, 0.34, 0),
    translatedBox(0.12, 0.16, 0.14, 0, 0.44, 0.26),
    translatedSphere(0.09, 0, 0.45, 0.39, 1, 0.9, 1.15),
    translatedBox(0.05, 0.26, 0.05, -0.08, 0.13, -0.16),
    translatedBox(0.05, 0.26, 0.05, 0.08, 0.13, -0.16),
    translatedBox(0.05, 0.28, 0.05, -0.08, 0.14, 0.16),
    translatedBox(0.05, 0.28, 0.05, 0.08, 0.14, 0.16),
    translatedCone(0.03, 0.14, -0.03, 0.58, 0.43),
    translatedCone(0.03, 0.14, 0.03, 0.58, 0.43),
    translatedCone(0.02, 0.12, 0, 0.47, -0.31, -Math.PI * 0.72, 0, Math.PI)
  ]);
}

function buildGoatSilhouette(): BufferGeometry {
  return mergeParts([
    translatedBox(0.2, 0.2, 0.42, 0, 0.29, 0),
    translatedSphere(0.1, 0, 0.38, 0.28, 0.95, 0.9, 1.05),
    translatedBox(0.05, 0.24, 0.05, -0.07, 0.12, -0.12),
    translatedBox(0.05, 0.24, 0.05, 0.07, 0.12, -0.12),
    translatedBox(0.05, 0.24, 0.05, -0.07, 0.12, 0.12),
    translatedBox(0.05, 0.24, 0.05, 0.07, 0.12, 0.12),
    translatedCone(0.025, 0.16, -0.04, 0.53, 0.28, 0.08, 0, 0.2),
    translatedCone(0.025, 0.16, 0.04, 0.53, 0.28, 0.08, 0, -0.2),
    translatedCone(0.018, 0.1, 0, 0.33, -0.24, -Math.PI * 0.72, 0, Math.PI)
  ]);
}

function buildRabbitSilhouette(): BufferGeometry {
  return mergeParts([
    translatedSphere(0.16, 0, 0.17, 0, 1.05, 0.92, 1.32),
    translatedSphere(0.1, 0, 0.21, 0.2, 1, 0.95, 1.05),
    translatedBox(0.05, 0.12, 0.05, -0.08, 0.06, -0.06),
    translatedBox(0.05, 0.12, 0.05, 0.08, 0.06, -0.06),
    translatedBox(0.05, 0.11, 0.05, -0.08, 0.055, 0.08),
    translatedBox(0.05, 0.11, 0.05, 0.08, 0.055, 0.08),
    translatedCone(0.024, 0.22, -0.03, 0.42, 0.24),
    translatedCone(0.024, 0.22, 0.03, 0.42, 0.24),
    translatedSphere(0.04, 0, 0.14, -0.17)
  ]);
}

function buildCraneSilhouette(): BufferGeometry {
  return mergeParts([
    translatedBox(0.14, 0.12, 0.34, 0, 0.66, 0),
    translatedBox(0.024, 0.72, 0.024, -0.04, 0.36, -0.03),
    translatedBox(0.024, 0.72, 0.024, 0.04, 0.36, 0.03),
    translatedCylinder(0.028, 0.46, 0, 1.04, 0.08),
    translatedSphere(0.07, 0, 1.28, 0.17, 0.95, 1, 1.08),
    translatedCone(0.016, 0.2, 0, 1.27, 0.31, Math.PI * 0.5),
    translatedCone(0.024, 0.16, 0, 0.7, -0.24, -Math.PI * 0.55, 0, Math.PI),
    translatedBox(0.28, 0.03, 0.12, 0, 0.67, 0)
  ]);
}

export const sharedWildlifeGeometries: Record<WildlifeKind, BufferGeometry> = {
  deer: buildDeerSilhouette(),
  goat: buildGoatSilhouette(),
  rabbit: buildRabbitSilhouette(),
  crane: buildCraneSilhouette()
};

const WILDLIFE_MATERIALS: Record<WildlifeKind, MeshPhongMaterial> = {
  deer: new MeshPhongMaterial({
    color: 0x8c6b4f,
    flatShading: true,
    shininess: 5,
    transparent: true,
    depthWrite: false,
    opacity: 1
  }),
  goat: new MeshPhongMaterial({
    color: 0x8f8374,
    flatShading: true,
    shininess: 5,
    transparent: true,
    depthWrite: false,
    opacity: 1
  }),
  rabbit: new MeshPhongMaterial({
    color: 0xcabfae,
    flatShading: true,
    shininess: 5,
    transparent: true,
    depthWrite: false,
    opacity: 1
  }),
  crane: new MeshPhongMaterial({
    color: 0xd7ddd7,
    flatShading: true,
    shininess: 5,
    transparent: true,
    depthWrite: false,
    opacity: 1
  })
};

export const sharedWildlifeMaterials = Object.values(WILDLIFE_MATERIALS);

function computeChunkSeed(sampler: TerrainSampler): number {
  const chunkBounds = sampler.asset.worldBounds;
  const chunkSeedOffsetX = chunkBounds ? Math.floor(chunkBounds.minX) : 0;
  const chunkSeedOffsetZ = chunkBounds ? Math.floor(chunkBounds.minZ) : 0;

  return (
    4000 +
    sampler.asset.world.width * 19 +
    sampler.asset.world.depth * 11 +
    chunkSeedOffsetX * 61 +
    chunkSeedOffsetZ * 97
  );
}

function chooseWildlifeKind(
  seed: number,
  h: number,
  slope: number,
  river: number,
  biome: BiomeWeights | null
): WildlifeKind | null {
  if (slope > 0.68) {
    return null;
  }

  if (h > 0.4 && slope < 0.55) {
    return pseudoRandom(seed + 13) < 0.5 ? "deer" : "goat";
  }

  if (h < 0.25 && slope < 0.28) {
    if (biome?.biomeId === "subtropical-humid" && river > 0.1 && pseudoRandom(seed + 29) < 0.3) {
      return "crane";
    }
    return "rabbit";
  }

  if (h >= 0.25 && h <= 0.4 && slope < 0.5) {
    return pseudoRandom(seed + 43) < 0.6 ? "deer" : "rabbit";
  }

  return null;
}

function scaleForKind(kind: WildlifeKind, seed: number): number {
  const jitter = 0.94 + pseudoRandom(seed + 211) * 0.18;

  switch (kind) {
    case "deer":
      return 1.02 * jitter;
    case "goat":
      return 0.96 * jitter;
    case "rabbit":
      return 0.9 * jitter;
    case "crane":
      return 1.04 * jitter;
    default:
      return jitter;
  }
}

function wanderRadiusForKind(kind: WildlifeKind, seed: number): number {
  const jitter = pseudoRandom(seed + 307);

  switch (kind) {
    case "deer":
      return 2.2 + jitter * 0.7;
    case "goat":
      return 1.9 + jitter * 0.6;
    case "rabbit":
      return 1.5 + jitter * 0.4;
    case "crane":
      return 1.8 + jitter * 0.7;
    default:
      return 1.8 + jitter * 0.4;
  }
}

function speedForKind(kind: WildlifeKind, seed: number): number {
  const jitter = pseudoRandom(seed + 331);

  switch (kind) {
    case "deer":
      return 0.14 + jitter * 0.08;
    case "goat":
      return 0.13 + jitter * 0.07;
    case "rabbit":
      return 0.18 + jitter * 0.07;
    case "crane":
      return 0.1 + jitter * 0.06;
    default:
      return 0.1 + jitter * 0.1;
  }
}

function samplerWorldOffset(sampler: TerrainSampler): { x: number; z: number } {
  const worldBounds = sampler.asset.worldBounds;
  if (!worldBounds) {
    return { x: 0, z: 0 };
  }

  return {
    x: (worldBounds.minX + worldBounds.maxX) * 0.5,
    z: (worldBounds.minZ + worldBounds.maxZ) * 0.5
  };
}

export function buildWildlifeChunk(
  sampler: TerrainSampler,
  biomeOverride?: BiomeWeights | null
): WildlifeSpawn[] {
  const chunkSeed = computeChunkSeed(sampler);
  if (pseudoRandom(chunkSeed + 701) >= SPAWN_CHANCE_PER_CHUNK) {
    return [];
  }

  const targetCount = pseudoRandom(chunkSeed + 719) < MULTI_CHANCE ? 2 : 1;
  const candidates: Array<WildlifeSpawn & { selectionOrder: number }> = [];
  const bounds = sampler.asset.bounds;
  const { width, depth } = sampler.asset.world;
  const columns = 3;
  const rows = 3;

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const seed = chunkSeed + row * columns + column;
      const jitterX = (pseudoRandom(seed + 11) - 0.5) * (width / columns) * 0.58;
      const jitterZ = (pseudoRandom(seed + 29) - 0.5) * (depth / rows) * 0.58;
      const x = -width * 0.5 + ((column + 0.5) / columns) * width + jitterX;
      const z = -depth * 0.5 + ((row + 0.5) / rows) * depth + jitterZ;
      const height = sampler.sampleSurfaceHeight(x, z);
      const h = normalizedHeight(height, sampler);
      const slope = sampler.sampleSlope(x, z);
      const river = sampler.sampleRiver(x, z);
      const biome =
        biomeOverride ??
        (bounds
          ? biomeWeightsAt(unprojectWorldToGeo({ x, z }, bounds, sampler.asset.world))
          : null);
      const kind = chooseWildlifeKind(seed, h, slope, river, biome);

      if (!kind) {
        continue;
      }

      candidates.push({
        kind,
        x,
        y: height + WILDLIFE_GROUND_OFFSET,
        z,
        rotationY: pseudoRandom(seed + 233) * Math.PI * 2,
        scale: scaleForKind(kind, seed),
        normalizedHeight: h,
        slope,
        river,
        seed,
        selectionOrder: pseudoRandom(seed + 271)
      });
    }
  }

  return candidates
    .sort((a, b) => a.selectionOrder - b.selectionOrder)
    .slice(0, targetCount)
    .map(({ selectionOrder: _selectionOrder, ...spawn }) => spawn);
}

function buildKindMesh(
  geometry: BufferGeometry,
  material: MeshPhongMaterial,
  count: number
): InstancedMesh {
  const mesh = new InstancedMesh(geometry, material, Math.max(1, count));
  mesh.count = count;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.frustumCulled = false;
  mesh.userData.sharedResources = true;
  return mesh;
}

function wildlifeInstanceFromSpawn(
  spawn: WildlifeSpawn,
  sampler: TerrainSampler
): WildlifeInstance {
  const offset = samplerWorldOffset(sampler);

  return {
    kind: spawn.kind,
    centerX: spawn.x,
    centerZ: spawn.z,
    phaseOffset: pseudoRandom(spawn.seed + 353) * Math.PI * 2,
    wanderRadius: wanderRadiusForKind(spawn.kind, spawn.seed),
    speed: speedForKind(spawn.kind, spawn.seed),
    scale: spawn.scale,
    rotationBias: 0,
    sampler,
    worldOffsetX: offset.x,
    worldOffsetZ: offset.z
  };
}

export function computeWildlifePose(
  instance: Omit<WildlifeInstance, "sampler" | "worldOffsetX" | "worldOffsetZ" | "rotationBias"> &
    Partial<Pick<WildlifeInstance, "sampler" | "worldOffsetX" | "worldOffsetZ" | "rotationBias">>,
  elapsedSeconds: number,
  samplerOverride?: TerrainSampler
): WildlifePose {
  const sampler = samplerOverride ?? instance.sampler;
  if (!sampler) {
    throw new Error("computeWildlifePose requires a terrain sampler.");
  }

  const phase = elapsedSeconds * instance.speed + instance.phaseOffset;
  const localX = instance.centerX + Math.cos(phase) * instance.wanderRadius;
  const localZ =
    instance.centerZ + Math.sin(phase * WANDER_NOISE_FREQUENCY) * instance.wanderRadius;
  const tangentX = -Math.sin(phase) * instance.wanderRadius * instance.speed;
  const tangentZ =
    Math.cos(phase * WANDER_NOISE_FREQUENCY) *
    instance.wanderRadius *
    WANDER_NOISE_FREQUENCY *
    instance.speed;
  const groundY = sampler.sampleSurfaceHeight(localX, localZ);

  return {
    position: {
      x: localX + (instance.worldOffsetX ?? 0),
      y: groundY + WILDLIFE_GROUND_OFFSET,
      z: localZ + (instance.worldOffsetZ ?? 0)
    },
    rotationY: Math.atan2(tangentX, tangentZ) + (instance.rotationBias ?? 0),
    scale: instance.scale,
    groundY,
    localX,
    localZ
  };
}

function applyPoseToDummy(dummy: Object3D, pose: WildlifePose): Matrix4 {
  dummy.position.set(pose.position.x, pose.position.y, pose.position.z);
  dummy.rotation.set(0, pose.rotationY, 0);
  dummy.scale.setScalar(pose.scale);
  dummy.updateMatrix();
  return dummy.matrix;
}

export function createWildlifeHandle(samplers: TerrainSampler[]): WildlifeHandle {
  const group = new Group();
  const instancesByKind = Object.fromEntries(
    WILDLIFE_KINDS.map((kind) => [kind, [] as WildlifeInstance[]])
  ) as Record<WildlifeKind, WildlifeInstance[]>;
  const perKindCounts = {
    deer: 0,
    goat: 0,
    rabbit: 0,
    crane: 0
  } satisfies Record<WildlifeKind, number>;
  const meshesByKind = {} as Record<WildlifeKind, InstancedMesh>;

  samplers.forEach((sampler) => {
    buildWildlifeChunk(sampler).forEach((spawn) => {
      instancesByKind[spawn.kind].push(wildlifeInstanceFromSpawn(spawn, sampler));
      perKindCounts[spawn.kind] += 1;
    });
  });

  WILDLIFE_KINDS.forEach((kind) => {
    const mesh = buildKindMesh(
      sharedWildlifeGeometries[kind],
      WILDLIFE_MATERIALS[kind],
      instancesByKind[kind].length
    );
    meshesByKind[kind] = mesh;
    group.add(mesh);
  });

  const handle: WildlifeHandle = {
    group,
    totalInstances: WILDLIFE_KINDS.reduce((sum, kind) => sum + perKindCounts[kind], 0),
    perKindCounts,
    instancesByKind,
    meshesByKind
  };

  updateWildlifeFrame(handle, 0);
  return handle;
}

export function updateWildlifeFrame(
  handle: WildlifeHandle,
  elapsedSeconds: number
): void {
  const dummy = new Object3D();

  WILDLIFE_KINDS.forEach((kind) => {
    const mesh = handle.meshesByKind[kind];
    const instances = handle.instancesByKind[kind];
    mesh.count = instances.length;

    instances.forEach((instance, index) => {
      const pose = computeWildlifePose(instance, elapsedSeconds);
      mesh.setMatrixAt(index, applyPoseToDummy(dummy, pose));
    });

    mesh.instanceMatrix.needsUpdate = true;
  });
}

export function disposeWildlife(handle: WildlifeHandle): void {
  handle.group.traverse((child) => {
    if (child instanceof InstancedMesh) {
      child.dispose();
    } else if (child instanceof Mesh) {
      child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach((entry) => entry.dispose());
      } else {
        child.material.dispose();
      }
    }
  });
}
