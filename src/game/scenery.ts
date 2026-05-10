import {
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  MathUtils,
  Matrix4,
  Mesh,
  MeshPhongMaterial,
  Object3D,
  PlaneGeometry,
  Quaternion,
  SphereGeometry
} from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { biomeWeightsAt } from "./biomeZones.js";
import { findZoneAt } from "./cityFlattenZones.js";
import { TerrainSampler } from "./demSampler.js";
import { unprojectWorldToGeo } from "./mapOrientation.js";
import type { RuntimePerformanceBudget } from "./performanceBudget.js";
import type { BiomeId, SeasonalBlend } from "./biomeZones.js";
import type { Season } from "./environment";
import { attachSceneryShaderEnhancements } from "./sceneryShaderEnhancer.js";
import {
  GRASS_DENSITY_MULTIPLIER,
  grassDensityAt
} from "./grassBiome.js";

export type PlantKind =
  | "conifer"
  | "umbrella-pine"
  | "broadleaf"
  | "bamboo-cluster"
  | "bush";

export const PLANT_KINDS: PlantKind[] = [
  "conifer",
  "umbrella-pine",
  "broadleaf",
  "bamboo-cluster",
  "bush"
];

export interface SeasonalLeafStyle {
  /** 叶子主色 */
  leafColor: number;
  /** 干色（基本不变） */
  trunkColor: number;
  /** 0..1 — 落叶概率（冬季偏北高） */
  bareChance: number;
  /** 0..1 — 是否长花（春季） */
  bloomChance: number;
  /** 花色（如果有） */
  bloomColor: number;
}

export interface PlantGeometrySet {
  trunkGeometry: BufferGeometry | null;
  leafGeometry: BufferGeometry;
}

interface PlantPrototype extends PlantGeometrySet {
  trunkHeight: number;
  leafHeight: number;
  bareScaleY: number;
  bareScaleXZ: number;
}

interface PlantInstanceState {
  kind: PlantKind;
  seed: number;
  lat: number;
  biomeId: BiomeId | null;
  trunkMatrix: Matrix4;
  leafMatrix: Matrix4;
  bareLeafMatrix: Matrix4;
}

interface GrassInstanceState {
  matrix: Matrix4;
  seed: number;
}

interface PlantKindColorHandle {
  kind: PlantKind;
  trunkMesh: InstancedMesh;
  leafMesh: InstancedMesh;
  plants: PlantInstanceState[];
}

type PlantMeshPair = {
  trunk: InstancedMesh;
  leaf: InstancedMesh;
};

export interface SceneryHandle {
  group: Group;
  meshesByKind: Record<PlantKind, PlantMeshPair>;
  colorHandlesByKind: Record<PlantKind, PlantKindColorHandle>;
  grassMesh: InstancedMesh;
}

const SCENERY_HANDLE_KEY = "sceneryHandle";
const CONIFER_TRUNK_HEIGHT = 0.11;
const DEFAULT_TREE_LAT = 33;
const EMPTY_TRUNK_GEOMETRY = new BufferGeometry();

// 共享 geometry / material：scenery 在每个 chunk 加载时被频繁创建/卸载，
// 共享资源避免重复 GPU 上传和材质实例数膨胀。transparent + 默认 opacity:1
// 让外部能按距离 fade 树（保持 LOD 渐进淡入的统一手感）。
// depthWrite=false：fade 中（半透明）的树不该写 depth，否则会 silently 挡住
// 后面的物体（codex hygiene 建议）。
export const sharedTreeMaterial = new MeshPhongMaterial({
  color: 0xffffff,
  flatShading: true,
  shininess: 5,
  transparent: true,
  depthWrite: false,
  opacity: 1,
  vertexColors: true
});
attachSceneryShaderEnhancements(sharedTreeMaterial, {
  enableCelShading: false,
  enableRim: false,
  enableWindSway: false, // TODO: Phase 5 启用草/树叶风摆。
  enableSeasonalTint: false
});

export const sharedGrassMaterial = new MeshPhongMaterial({
  color: 0xa7c86b,
  flatShading: true,
  shininess: 3,
  transparent: true,
  depthWrite: false,
  opacity: 1,
  vertexColors: true
});
attachSceneryShaderEnhancements(sharedGrassMaterial, {
  enableCelShading: false,
  enableRim: false,
  enableWindSway: true,
  enableSeasonalTint: false
});

const sharedPlantPrototypes = createSharedPlantPrototypes();
const sharedGrassGeometry = createGrassGeometry();

// settlement markers（5 棱柱褐色块）已移除：用户反馈"看不出含义"，
// 而且位置是 chunk 内伪随机，并不对应真实城镇。P4 城市存在感会换成
// 真实坐标的 instanced 建筑簇，这里先把误导性的几何体清掉。

function pseudoRandom(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function normalizedHeight(height: number, sampler: TerrainSampler): number {
  const minHeight = sampler.asset.presentation?.globalMinHeight ?? sampler.asset.minHeight;
  const maxHeight = sampler.asset.presentation?.globalMaxHeight ?? sampler.asset.maxHeight;

  return (height - minHeight) / (maxHeight - minHeight || 1);
}

function worldPointForSampler(
  sampler: TerrainSampler,
  x: number,
  z: number
): { x: number; z: number } {
  if (typeof sampler.worldPositionForSample === "function") {
    return sampler.worldPositionForSample(x, z);
  }

  const worldBounds = sampler.asset.worldBounds;
  if (!worldBounds) {
    return { x, z };
  }

  return {
    x: x + (worldBounds.minX + worldBounds.maxX) * 0.5,
    z: z + (worldBounds.minZ + worldBounds.maxZ) * 0.5
  };
}

function applyVerticalVertexRamp(
  geometry: BufferGeometry,
  bottomScalar: number,
  topScalar: number
): BufferGeometry {
  const position = geometry.getAttribute("position");
  const colors = new Float32Array(position.count * 3);

  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < position.count; index += 1) {
    const y = position.getY(index);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  const range = maxY - minY || 1;
  for (let index = 0; index < position.count; index += 1) {
    const y = position.getY(index);
    const t = (y - minY) / range;
    const shade = MathUtils.lerp(bottomScalar, topScalar, t);
    colors[index * 3] = shade;
    colors[index * 3 + 1] = shade;
    colors[index * 3 + 2] = shade;
  }

  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  return geometry;
}

function createMergedGeometry(parts: BufferGeometry[]): BufferGeometry {
  const merged = BufferGeometryUtils.mergeGeometries(parts, false);
  if (!merged) {
    throw new Error("Failed to merge plant geometry.");
  }
  merged.computeVertexNormals();
  return merged;
}

function createGrassGeometry(): BufferGeometry {
  const bladeA = new PlaneGeometry(0.11, 0.62, 1, 2);
  bladeA.translate(0, 0.31, 0);
  const bladeB = bladeA.clone();
  bladeB.rotateY(Math.PI / 2);
  const merged = BufferGeometryUtils.mergeGeometries([bladeA.toNonIndexed(), bladeB.toNonIndexed()]);
  if (!merged) {
    throw new Error("Failed to merge grass geometry.");
  }
  applyVerticalVertexRamp(merged, 0.72, 1.12);
  merged.computeVertexNormals();
  return merged;
}

function createSharedPlantPrototypes(): Record<PlantKind, PlantPrototype> {
  return {
    conifer: createConiferPrototype(),
    "umbrella-pine": createUmbrellaPinePrototype(),
    broadleaf: createBroadleafPrototype(),
    "bamboo-cluster": createBambooClusterPrototype(),
    bush: createBushPrototype()
  };
}

function createConiferPrototype(): PlantPrototype {
  return {
    trunkGeometry: applyVerticalVertexRamp(
      new CylinderGeometry(0.075, 0.11, CONIFER_TRUNK_HEIGHT, 5),
      0.76,
      0.98
    ),
    leafGeometry: applyVerticalVertexRamp(new ConeGeometry(0.4, 1.1, 6), 0.82, 1.04),
    trunkHeight: CONIFER_TRUNK_HEIGHT,
    leafHeight: 1.1,
    bareScaleY: 0.62,
    bareScaleXZ: 0.76
  };
}

function createUmbrellaPinePrototype(): PlantPrototype {
  // 用户反馈"露出来的根部都跟最开始一样矮"——油松 trunk 0.55 → 0.11，跟 conifer 看齐。
  return {
    trunkGeometry: applyVerticalVertexRamp(
      new CylinderGeometry(0.1, 0.13, 0.11, 6),
      0.78,
      0.98
    ),
    leafGeometry: applyVerticalVertexRamp(new ConeGeometry(0.55, 0.32, 8), 0.84, 1.03),
    trunkHeight: 0.11,
    leafHeight: 0.32,
    bareScaleY: 0.76,
    bareScaleXZ: 0.84
  };
}

function createBroadleafPrototype(): PlantPrototype {
  const leafGeometry = new SphereGeometry(0.42, 8, 6);
  leafGeometry.computeVertexNormals();

  // 阔叶树 trunk 0.28 → 0.11，跟 conifer / umbrella-pine 一样只露小根。
  return {
    trunkGeometry: applyVerticalVertexRamp(
      new CylinderGeometry(0.08, 0.1, 0.11, 5),
      0.78,
      0.98
    ),
    leafGeometry: applyVerticalVertexRamp(leafGeometry, 0.84, 1.03),
    trunkHeight: 0.11,
    leafHeight: 0.84,
    bareScaleY: 0.44,
    bareScaleXZ: 0.6
  };
}

function createBambooClusterPrototype(): PlantPrototype {
  const trunkOffsets = [
    [0, -0.05],
    [0, 0.05],
    [0.05, 0],
    [-0.05, 0]
  ];
  const trunkParts = trunkOffsets.map(([x, z]) => {
    const culm = new CylinderGeometry(0.025, 0.025, 1.4, 5);
    culm.translate(x, 0, z);
    return culm;
  });
  const leafGeometry = new SphereGeometry(0.23, 7, 5);
  leafGeometry.scale(1.18, 0.78, 1.18);
  leafGeometry.computeVertexNormals();

  return {
    trunkGeometry: applyVerticalVertexRamp(createMergedGeometry(trunkParts), 0.84, 1.02),
    leafGeometry: applyVerticalVertexRamp(leafGeometry, 0.86, 1.03),
    trunkHeight: 1.4,
    leafHeight: 0.3588,
    bareScaleY: 0.82,
    bareScaleXZ: 0.88
  };
}

function createBushPrototype(): PlantPrototype {
  const leafGeometry = new SphereGeometry(0.22, 7, 5);
  leafGeometry.scale(1, 0.6, 1);
  leafGeometry.computeVertexNormals();

  return {
    trunkGeometry: null,
    leafGeometry: applyVerticalVertexRamp(leafGeometry, 0.82, 1.02),
    trunkHeight: 0,
    leafHeight: 0.264,
    bareScaleY: 0.46,
    bareScaleXZ: 0.68
  };
}

export function buildPlantGeometrySet(kind: PlantKind): PlantGeometrySet {
  const prototype = sharedPlantPrototypes[kind];
  return {
    trunkGeometry: prototype.trunkGeometry?.clone() ?? null,
    leafGeometry: prototype.leafGeometry.clone()
  };
}

function ensureInstanceColorBuffer(mesh: InstancedMesh, count: number): void {
  mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(count * 3), 3);
}

function clamp01(value: number): number {
  return MathUtils.clamp(value, 0, 1);
}

function offsetHex(hex: number, hue: number, saturation: number, lightness: number): number {
  return new Color(hex).offsetHSL(hue, saturation, lightness).getHex();
}

function mixHex(from: number, to: number, t: number): number {
  return new Color(from).lerp(new Color(to), t).getHex();
}

function sceneryBiomeZone(biomeId: BiomeId | null): "south-humid" | "north-humid" | "north-dry" {
  if (biomeId === "warm-temperate-semiarid") {
    return "north-dry";
  }

  if (biomeId === "subtropical-humid") {
    return "south-humid";
  }

  return "north-humid";
}

function seasonalLeafStyleForBiome(
  season: Season,
  lat: number,
  biomeId: BiomeId | null
): SeasonalLeafStyle {
  const base = seasonalLeafStyle(season, lat);
  const zone = sceneryBiomeZone(biomeId);

  if (zone === "south-humid") {
    return {
      leafColor: offsetHex(base.leafColor, -0.012, 0.08, 0.02),
      trunkColor: offsetHex(base.trunkColor, -0.005, 0.02, 0.03),
      bareChance: clamp01(base.bareChance * 0.72),
      bloomChance: clamp01(base.bloomChance + (season === "spring" ? 0.05 : 0)),
      bloomColor: offsetHex(base.bloomColor, -0.01, 0.05, 0.03)
    };
  }

  if (zone === "north-dry") {
    return {
      leafColor:
        season === "autumn"
          ? mixHex(base.leafColor, 0xc6571f, 0.32)
          : offsetHex(base.leafColor, 0.008, -0.08, -0.03),
      trunkColor: offsetHex(base.trunkColor, 0.006, -0.02, -0.01),
      bareChance: clamp01(base.bareChance + (season === "winter" ? 0.08 : 0.03)),
      bloomChance: clamp01(base.bloomChance - (season === "spring" ? 0.05 : 0)),
      bloomColor: offsetHex(base.bloomColor, 0.01, -0.05, -0.02)
    };
  }

  return {
    leafColor: offsetHex(base.leafColor, -0.004, 0.02, 0.01),
    trunkColor: base.trunkColor,
    bareChance: clamp01(base.bareChance),
    bloomChance: clamp01(base.bloomChance),
    bloomColor: base.bloomColor
  };
}

function plantStyleForKind(
  kind: PlantKind,
  season: Season,
  lat: number,
  biomeId: BiomeId | null
): SeasonalLeafStyle {
  const biomeStyle = seasonalLeafStyleForBiome(season, lat, biomeId);

  if (kind === "conifer") {
    return {
      leafColor: mixHex(0x325f35, biomeStyle.leafColor, season === "winter" ? 0.15 : 0.08),
      trunkColor: mixHex(biomeStyle.trunkColor, 0x4d3824, 0.45),
      bareChance: clamp01(biomeStyle.bareChance * 0.08),
      bloomChance: 0,
      bloomColor: 0xffffff
    };
  }

  if (kind === "umbrella-pine") {
    return {
      leafColor: mixHex(0x3f6632, biomeStyle.leafColor, season === "winter" ? 0.18 : 0.1),
      trunkColor: mixHex(biomeStyle.trunkColor, 0x584028, 0.5),
      bareChance: clamp01(biomeStyle.bareChance * 0.06),
      bloomChance: 0,
      bloomColor: 0xffffff
    };
  }

  if (kind === "bamboo-cluster") {
    return {
      leafColor: mixHex(0x96b348, biomeStyle.leafColor, 0.12),
      trunkColor: mixHex(0x7a8f4a, biomeStyle.trunkColor, 0.2),
      bareChance: clamp01(biomeStyle.bareChance * 0.02),
      bloomChance: 0,
      bloomColor: 0xffffff
    };
  }

  if (kind === "bush") {
    return {
      leafColor: offsetHex(biomeStyle.leafColor, 0, -0.15, -0.03),
      trunkColor: mixHex(biomeStyle.trunkColor, 0x5f4a33, 0.4),
      bareChance: clamp01(biomeStyle.bareChance * 1.08 + (season === "winter" ? 0.04 : 0)),
      bloomChance: clamp01(biomeStyle.bloomChance * 0.55),
      bloomColor: mixHex(biomeStyle.bloomColor, 0xf3d3d0, 0.35)
    };
  }

  return biomeStyle;
}

function matrixForTreePart(
  x: number,
  y: number,
  z: number,
  rotationY: number,
  scaleX: number,
  scaleY: number,
  scaleZ: number
): Matrix4 {
  const quaternion = new Quaternion().setFromEuler(new Object3D().rotation.set(0, rotationY, 0));
  return new Matrix4().compose(
    new Object3D().position.set(x, y, z),
    quaternion,
    new Object3D().scale.set(scaleX, scaleY, scaleZ)
  );
}

function setPlantMatrices(
  trunkMesh: InstancedMesh,
  leafMesh: InstancedMesh,
  plants: PlantInstanceState[]
): void {
  plants.forEach((plant, index) => {
    trunkMesh.setMatrixAt(index, plant.trunkMatrix);
    leafMesh.setMatrixAt(index, plant.leafMatrix);
  });
  trunkMesh.instanceMatrix.needsUpdate = true;
  leafMesh.instanceMatrix.needsUpdate = true;
}

function setGrassMatrices(grassMesh: InstancedMesh, grasses: GrassInstanceState[]): void {
  grasses.forEach((grass, index) => {
    grassMesh.setMatrixAt(index, grass.matrix);
    const color = new Color(0x9fbd63).offsetHSL(
      (pseudoRandom(grass.seed + 19) - 0.5) * 0.025,
      (pseudoRandom(grass.seed + 23) - 0.5) * 0.12,
      (pseudoRandom(grass.seed + 29) - 0.5) * 0.1
    );
    grassMesh.setColorAt(index, color);
  });
  grassMesh.instanceMatrix.needsUpdate = true;
  if (grassMesh.instanceColor) {
    grassMesh.instanceColor.needsUpdate = true;
  }
}

function applySeasonToKindHandle(handle: PlantKindColorHandle, season: Season): void {
  handle.plants.forEach((plant, index) => {
    const style = plantStyleForKind(handle.kind, season, plant.lat, plant.biomeId);
    const trunkColor = new Color(style.trunkColor).offsetHSL(
      0,
      0,
      (pseudoRandom(plant.seed + 173) - 0.5) * 0.06
    );
    const baseLeafColor = new Color(style.leafColor).offsetHSL(
      (pseudoRandom(plant.seed + 71) - 0.5) * 0.025,
      (pseudoRandom(plant.seed + 89) - 0.5) * 0.08,
      (pseudoRandom(plant.seed + 107) - 0.5) * 0.08
    );
    const isBare = pseudoRandom(plant.seed + 1) < style.bareChance;
    const isBlooming = !isBare && pseudoRandom(plant.seed + 2) < style.bloomChance;
    const leafColor = isBare
      ? trunkColor.clone()
      : isBlooming
        ? baseLeafColor.lerp(new Color(style.bloomColor), 0.6)
        : baseLeafColor;

    handle.trunkMesh.setColorAt(index, trunkColor);
    handle.leafMesh.setColorAt(index, leafColor);
    handle.leafMesh.setMatrixAt(index, isBare ? plant.bareLeafMatrix : plant.leafMatrix);
  });

  handle.trunkMesh.instanceColor!.needsUpdate = true;
  handle.leafMesh.instanceColor!.needsUpdate = true;
  handle.leafMesh.instanceMatrix.needsUpdate = true;
}

function attachSharedInstancedMeshState(
  mesh: InstancedMesh,
  role: "trunk" | "leaf",
  kind: PlantKind
): void {
  mesh.computeBoundingSphere();
  mesh.frustumCulled = false;
  mesh.userData.sharedResources = true;
  mesh.userData.role = role;
  mesh.userData.kind = kind;
}

function emptyPlantStateRecord<T>(factory: () => T): Record<PlantKind, T> {
  return {
    conifer: factory(),
    "umbrella-pine": factory(),
    broadleaf: factory(),
    "bamboo-cluster": factory(),
    bush: factory()
  };
}

function plantScale(kind: PlantKind, seed: number): number {
  const jitter = pseudoRandom(seed + 43);

  if (kind === "bamboo-cluster") {
    return 0.82 + jitter * 0.34;
  }

  if (kind === "bush") {
    return 0.78 + jitter * 0.3;
  }

  if (kind === "umbrella-pine") {
    return 0.74 + jitter * 0.44;
  }

  if (kind === "broadleaf") {
    return 0.76 + jitter * 0.42;
  }

  return 0.72 + jitter * 0.46;
}

export function plantKindForCell(
  h: number,
  biomeId: BiomeId | null,
  seed: number
): PlantKind {
  const r = pseudoRandom(seed);

  if (h > 0.5) {
    return r < 0.9 ? "conifer" : "bush";
  }

  if (h > 0.3) {
    if (r < 0.5) return "umbrella-pine";
    if (r < 0.8) return "conifer";
    if (r < 0.95) return "broadleaf";
    return "bush";
  }

  if (biomeId === "subtropical-humid" && r < 0.15) {
    return "bamboo-cluster";
  }
  if (r < 0.6) return "broadleaf";
  if (r < 0.8) return "bush";
  if (r < 0.95) return "umbrella-pine";
  return "broadleaf";
}

function createPlantState(
  kind: PlantKind,
  x: number,
  height: number,
  z: number,
  rotationY: number,
  scale: number,
  lat: number,
  biomeId: BiomeId | null,
  seed: number
): PlantInstanceState {
  const prototype = sharedPlantPrototypes[kind];
  const trunkY =
    kind === "bush"
      ? height
      : height + prototype.trunkHeight * 0.5 * scale;
  const leafBaseY =
    kind === "bush"
      ? height + prototype.leafHeight * 0.5 * scale
      : height + (prototype.trunkHeight + prototype.leafHeight * 0.5) * scale;

  return {
    kind,
    seed,
    lat,
    biomeId,
    trunkMatrix: matrixForTreePart(
      x,
      trunkY,
      z,
      rotationY,
      kind === "bush" ? 0.0001 : scale,
      kind === "bush" ? 0.0001 : scale,
      kind === "bush" ? 0.0001 : scale
    ),
    leafMatrix: matrixForTreePart(x, leafBaseY, z, rotationY, scale, scale, scale),
    bareLeafMatrix: matrixForTreePart(
      x,
      kind === "bush"
        ? height + prototype.leafHeight * 0.5 * prototype.bareScaleY * scale
        : height + (prototype.trunkHeight + prototype.leafHeight * 0.5 * prototype.bareScaleY) * scale,
      z,
      rotationY,
      scale * prototype.bareScaleXZ,
      scale * prototype.bareScaleY,
      scale * prototype.bareScaleXZ
    )
  };
}

function createGrassState(
  x: number,
  height: number,
  z: number,
  rotationY: number,
  scale: number,
  seed: number
): GrassInstanceState {
  return {
    seed,
    matrix: matrixForTreePart(x, height + 0.01, z, rotationY, scale, scale, scale)
  };
}

function buildSceneryHandle(
  group: Group,
  plantsByKind: Record<PlantKind, PlantInstanceState[]>,
  grasses: GrassInstanceState[]
): SceneryHandle {
  const meshesByKind = {} as Record<PlantKind, PlantMeshPair>;
  const colorHandlesByKind = {} as Record<PlantKind, PlantKindColorHandle>;

  for (const kind of PLANT_KINDS) {
    const prototype = sharedPlantPrototypes[kind];
    const plants = plantsByKind[kind];
    const instanceCount = Math.max(1, plants.length);
    const trunkMesh = new InstancedMesh(
      prototype.trunkGeometry ?? EMPTY_TRUNK_GEOMETRY,
      sharedTreeMaterial,
      instanceCount
    );
    const leafMesh = new InstancedMesh(prototype.leafGeometry, sharedTreeMaterial, instanceCount);

    trunkMesh.count = plants.length;
    leafMesh.count = plants.length;
    ensureInstanceColorBuffer(trunkMesh, instanceCount);
    ensureInstanceColorBuffer(leafMesh, instanceCount);
    setPlantMatrices(trunkMesh, leafMesh, plants);
    attachSharedInstancedMeshState(trunkMesh, "trunk", kind);
    attachSharedInstancedMeshState(leafMesh, "leaf", kind);

    meshesByKind[kind] = { trunk: trunkMesh, leaf: leafMesh };
    colorHandlesByKind[kind] = {
      kind,
      trunkMesh,
      leafMesh,
      plants
    };

    group.add(trunkMesh);
    group.add(leafMesh);
  }

  const grassInstanceCount = Math.max(1, grasses.length);
  const grassMesh = new InstancedMesh(
    sharedGrassGeometry,
    sharedGrassMaterial,
    grassInstanceCount
  );
  grassMesh.count = grasses.length;
  ensureInstanceColorBuffer(grassMesh, grassInstanceCount);
  setGrassMatrices(grassMesh, grasses);
  grassMesh.computeBoundingSphere();
  grassMesh.frustumCulled = false;
  grassMesh.userData.sharedResources = true;
  grassMesh.userData.role = "grass";
  group.add(grassMesh);

  return {
    group,
    meshesByKind,
    colorHandlesByKind,
    grassMesh
  };
}

function applySeasonToHandle(handle: SceneryHandle, season: Season): void {
  for (const kind of PLANT_KINDS) {
    applySeasonToKindHandle(handle.colorHandlesByKind[kind], season);
  }
}

export function seasonalLeafStyle(season: Season, lat: number): SeasonalLeafStyle {
  // 南扩到 22-28.5 之后，低纬亚热带/热带区域不该继续按"32 以下都一样"处理。
  // 22N → 0（更常绿），35N → 1（关中及更北）。
  const northness = MathUtils.clamp((lat - 22) / 13, 0, 1);

  // 用户反馈"颜色太重抢戏"——叶色全部往浅一档调，干色也提亮（avoid 黑黢黢
  // 一片）。每条 leaf/trunk 颜色比之前亮 ~20-30%。
  if (season === "spring") {
    return {
      leafColor: 0x9bc77a,    // 旧 0x6fb04a 浅一档（嫩绿）
      trunkColor: 0x7a5c3e,   // 旧 0x553c25 提亮（暖棕）
      bareChance: 0,
      bloomChance: 0.18,
      bloomColor: 0xfdd6d8
    };
  }

  if (season === "summer") {
    return {
      leafColor: 0x82ba62,    // 旧 0x4f9237 浅一档（中绿）
      trunkColor: 0x705438,   // 提亮
      bareChance: 0,
      bloomChance: 0,
      bloomColor: 0xffffff
    };
  }

  if (season === "autumn") {
    return {
      leafColor: northness > 0.5 ? 0xd09250 : 0xc7b256,  // 旧 0xb86b27/0xa9982a 浅一档
      trunkColor: 0x705438,
      bareChance: 0.05 * northness,
      bloomChance: 0,
      bloomColor: 0xffffff
    };
  }

  return {
    leafColor: 0x82926a,      // 旧 0x556b3c 浅一档（冬残绿）
    trunkColor: 0x705438,
    bareChance: 0.05 + 0.4 * northness,
    bloomChance: 0,
    bloomColor: 0xffffff
  };
}

export function createChunkScenery(
  sampler: TerrainSampler,
  budget: RuntimePerformanceBudget["scenery"],
  seasonalBlend?: SeasonalBlend,
  season: Season = "summer"
): Group {
  const group = new Group();
  const plantsByKind = emptyPlantStateRecord<PlantInstanceState[]>(() => []);
  const grasses: GrassInstanceState[] = [];
  let totalPlants = 0;
  const bounds = sampler.asset.bounds;
  const { width, depth } = sampler.asset.world;
  const columns = 12;
  const rows = 12;
  // 每个 chunk 用自己的 worldBounds 偏移作为 seed 基量，确保相邻 chunk
  // 的 12x12 候选树位不会完全重合（codex d180823 review 抓到的"相邻盆
  // 地 chunk 树位 45/46 一致"问题）。整张 region asset（无 chunk 划分）
  // 走默认 0 偏移。
  const chunkBounds = sampler.asset.worldBounds;
  const chunkSeedOffsetX = chunkBounds ? Math.floor(chunkBounds.minX) : 0;
  const chunkSeedOffsetZ = chunkBounds ? Math.floor(chunkBounds.minZ) : 0;

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const seed =
        row * columns +
        column +
        width * 13 +
        depth * 7 +
        chunkSeedOffsetX * 31 +
        chunkSeedOffsetZ * 53;
      const jitterX = (pseudoRandom(seed) - 0.5) * (width / columns) * 0.8;
      const jitterZ = (pseudoRandom(seed + 17) - 0.5) * (depth / rows) * 0.8;
      const x = -width * 0.5 + ((column + 0.5) / columns) * width + jitterX;
      const z = -depth * 0.5 + ((row + 0.5) / rows) * depth + jitterZ;
      const world = worldPointForSampler(sampler, x, z);
      if (findZoneAt(world.x, world.z)) {
        continue;
      }

      // sampleSurfaceHeight 跟 GPU triangulation 一致 — 树底面跟 mesh
      // 表面同一个 Y，绝不悬空，也不被雕刻河谷误埋。bilinear sampleHeight
      // 在雕刻 cell 边缘会跟 GPU 渲染面差 0.3-0.8 单元，是之前"树飘"
      // 跟"城市消失"的根因。
      const height = sampler.sampleSurfaceHeight(x, z);
      const h = normalizedHeight(height, sampler);
      const slope = sampler.sampleSlope(x, z);
      const river = sampler.sampleRiver(x, z);
      // sampleSettlement 也是合成出来的（高程 + 坡度 + 湿度），不对应真实
      // 城镇。一并不再用作"空树"过滤——否则盆地会出现大片明显空地暗示
      // 子虚乌有的聚落（codex 1af1fe7 review 抓到）。基本盆地实际历史上
      // 是农田 + 村落，长树合理。
      const forestBand = Math.max(0, 1 - Math.abs(h - 0.46) / 0.34);
      const lowlandGreen = Math.max(0, 1 - h / 0.44) * Math.max(0, 1 - slope / 0.72);
      const geo = bounds
        ? unprojectWorldToGeo({ x: world.x, z: world.z }, bounds, sampler.asset.world)
        : null;
      const biome = geo ? biomeWeightsAt(geo) : null;
      const baseVegetationChance =
        0.12 + river * 0.22 + forestBand * 0.24 + lowlandGreen * 0.16;
      const vegetationChance = Math.min(1, baseVegetationChance);
      const inBasin = h < 0.18;
      const basinDensity = inBasin
        ? MathUtils.lerp(0.004, 0.08, MathUtils.smoothstep(h, 0.05, 0.18))
        : 1.0;
      const adjustedChance = Math.min(
        1,
        vegetationChance * (biome?.vegetationDensity ?? 1) * basinDensity
      );

      if (
        totalPlants < budget.maxTreesPerChunk &&
        h > 0.05 &&
        h < 0.78 &&
        slope < 0.62 &&
        pseudoRandom(seed + 31) < adjustedChance
      ) {
        const kind = plantKindForCell(h, biome?.biomeId ?? null, seed + 97);
        const scale = plantScale(kind, seed);
        const rotationY = pseudoRandom(seed + 59) * Math.PI * 2;
        const lat = geo?.lat ?? DEFAULT_TREE_LAT;

        plantsByKind[kind].push(
          createPlantState(kind, x, height, z, rotationY, scale, lat, biome?.biomeId ?? null, seed)
        );
        totalPlants += 1;
      }

      if (geo && h > 0.04 && slope < 0.72 && river < 0.82) {
        const density = grassDensityAt(world.x, world.z, height, geo.lat, geo.lon);
        const densityMultiplier = GRASS_DENSITY_MULTIPLIER[density];
        const grassChance = Math.min(
          1,
          (0.46 + forestBand * 0.2 + lowlandGreen * 0.24) * densityMultiplier
        );
        if (pseudoRandom(seed + 211) < grassChance) {
          const tuftCount = density === "lush" ? 3 : density === "normal" ? 2 : 1;
          for (let tuft = 0; tuft < tuftCount; tuft += 1) {
            const tuftSeed = seed + tuft * 37;
            const gx = x + (pseudoRandom(tuftSeed + 3) - 0.5) * (width / columns) * 0.5;
            const gz = z + (pseudoRandom(tuftSeed + 5) - 0.5) * (depth / rows) * 0.5;
            const gy = sampler.sampleSurfaceHeight(gx, gz);
            grasses.push(
              createGrassState(
                gx,
                gy,
                gz,
                pseudoRandom(tuftSeed + 7) * Math.PI * 2,
                0.55 + pseudoRandom(tuftSeed + 11) * 0.55,
                tuftSeed
              )
            );
          }
        }
      }
    }
  }

  void seasonalBlend;

  const handle = buildSceneryHandle(group, plantsByKind, grasses);
  group.userData[SCENERY_HANDLE_KEY] = handle;
  applySeasonToHandle(handle, season);
  return group;
}

export function updateSceneryColors(group: Group, season: Season): void {
  const handle = group.userData[SCENERY_HANDLE_KEY] as SceneryHandle | undefined;
  if (!handle) {
    return;
  }

  applySeasonToHandle(handle, season);
}

export function disposeScenery(group: Group): void {
  // geometry / material 是模块级共享资源，不能 dispose；
  // InstancedMesh 自身的 instanceMatrix buffer 由 GC 回收。
  group.traverse((child) => {
    if (child instanceof InstancedMesh) {
      // 释放 instance 缓冲，避免 GPU 端孤儿 buffer 累积。
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
