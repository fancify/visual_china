import {
  BoxGeometry,
  BufferGeometry,
  ConeGeometry,
  Group,
  InstancedMesh,
  MeshPhongMaterial,
  Object3D
} from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";

import type { CityTier, RealCity } from "../data/realCities.js";
import type { TerrainSampler } from "./demSampler";
import type { DemBounds, DemWorld } from "./demSampler";
import { projectGeoToWorld } from "./mapOrientation.js";

/**
 * 在 3D 场景里把真实城市坐标摆出来。
 *
 * 造型 = "口"字型城墙 + 分级中央建筑。三档不仅尺寸不同，结构也分级：
 *   capital（京城）= 外环 + 4 角楼 + 两层庑殿顶小楼
 *   prefecture（州府）= 外环 + 4 角楼 + 单层歇山顶厅堂
 *   county（县城）= 外环
 *
 * 三档尺寸：
 *   capital（京城）= 外 4.4 内 3.6、墙厚 0.4、高 0.9（最大）
 *   prefecture（州府）= 外 3.4 内 2.6、墙厚 0.4、高 0.7
 *   county（县城）= 外 2.4 内 1.6、墙厚 0.4、高 0.5（最矮）
 *
 * 用 InstancedMesh：每档 1 个 mesh，共 3 个 instanced mesh（之前 base+
 * roof 6 个减半）。29 个 instance，draw call 3。
 *
 * 用户这轮要求：三档主要靠城墙面积 + 中央建筑层级区分，不再用零碎屋舍
 * 堆住人感。county 保持中空，prefecture / capital 用不同屋顶轮廓一眼区分。
 */

export type GateSide = "north" | "south" | "east" | "west";
export type CentralBuildingType = "hip-roof-palace" | "xie-shan-hall" | null;

export interface CityTierSpec {
  outerSide: number;
  innerSide: number;
  height: number;
  cornerTowers: boolean;
  centralBuilding: CentralBuildingType;
  houses: number;
  gateOnSide: GateSide;
}

const HOUSE_BODY_SIZE = Object.freeze({
  x: 0.3,
  y: 0.4,
  z: 0.3
});
const HOUSE_ROOF_RADIUS = 0.22;
const HOUSE_ROOF_HEIGHT = 0.18;
const DEFAULT_GATE_WIDTH = 0.4;

export const CITY_TIER_SPECS: Record<CityTier, CityTierSpec> = {
  county: {
    outerSide: 2.4,
    innerSide: 1.6,
    height: 0.5,
    cornerTowers: false,
    centralBuilding: null,
    houses: 0,
    gateOnSide: "south"
  },
  prefecture: {
    outerSide: 3.4,
    innerSide: 2.6,
    height: 0.7,
    cornerTowers: true,
    centralBuilding: "xie-shan-hall",
    houses: 0,
    gateOnSide: "south"
  },
  capital: {
    outerSide: 4.4,
    innerSide: 3.6,
    height: 0.9,
    cornerTowers: true,
    centralBuilding: "hip-roof-palace",
    houses: 0,
    gateOnSide: "south"
  }
};

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

function houseSlots(innerSide: number, count: number): Array<[number, number]> {
  const spread = Math.max(innerSide * 0.28, 0.26);
  const slots: Array<[number, number]> = [
    [-spread, -spread * 0.68],
    [spread, -spread * 0.68],
    [-spread * 0.9, spread * 0.6],
    [spread * 0.9, spread * 0.6],
    [-spread * 0.2, spread * 1.08],
    [spread * 0.2, spread * 1.08]
  ];
  return slots.slice(0, Math.max(0, count));
}

function buildHipRoofPalace(width: number, totalHeight: number): BufferGeometry[] {
  const body1Height = totalHeight * 0.4;
  const eave1Height = totalHeight * 0.04;
  const body2Height = totalHeight * 0.3;
  const roofHeight = totalHeight * 0.26;

  const eave1Y = body1Height;
  const body2Y = body1Height + eave1Height;
  const roofY = body2Y + body2Height;

  const roof = prepareForMerge(new ConeGeometry(width * 0.6, roofHeight, 4));
  roof.rotateY(Math.PI / 4);
  roof.translate(0, roofY + roofHeight * 0.5, 0);

  return [
    translatedBox(width, body1Height, width, 0, body1Height * 0.5, 0),
    translatedBox(width * 1.1, eave1Height, width * 1.1, 0, eave1Y + eave1Height * 0.5, 0),
    translatedBox(width * 0.78, body2Height, width * 0.78, 0, body2Y + body2Height * 0.5, 0),
    roof
  ];
}

function buildXieShanHall(width: number, totalHeight: number): BufferGeometry[] {
  const bodyHeight = totalHeight * 0.55;
  const eaveHeight = totalHeight * 0.05;
  const roofHeight = totalHeight * 0.3;
  const gableHeight = totalHeight * 0.1;

  const eaveY = bodyHeight;
  const roofY = eaveY + eaveHeight;

  const roof = prepareForMerge(new ConeGeometry(width * 0.62, roofHeight, 4));
  roof.rotateY(Math.PI / 4);
  roof.translate(0, roofY + roofHeight * 0.5, 0);

  return [
    translatedBox(width, bodyHeight, width, 0, bodyHeight * 0.5, 0),
    translatedBox(width * 1.12, eaveHeight, width * 1.12, 0, eaveY + eaveHeight * 0.5, 0),
    roof,
    translatedBox(width * 0.7, gableHeight, width * 0.4, 0, roofY + roofHeight * 0.7, 0)
  ];
}

function makeWalledRingGeometry(
  outerSide: number,
  innerSide: number,
  height: number,
  options: {
    houses?: number;
    gateOnSide?: GateSide;
  } = {}
): BufferGeometry {
  const wallThickness = (outerSide - innerSide) * 0.5;
  const half = outerSide * 0.5;
  const wallCenter = half - wallThickness * 0.5;
  const gateOnSide = options.gateOnSide;
  const gateWidth = DEFAULT_GATE_WIDTH;
  const parts: BufferGeometry[] = [];
  const addWall = (
    side: GateSide,
    x: number,
    z: number,
    length: number
  ): void => {
    if (length <= 0.001) {
      return;
    }
    const isNorthSouth = side === "north" || side === "south";
    parts.push(
      translatedBox(
        isNorthSouth ? length : wallThickness,
        height,
        isNorthSouth ? wallThickness : length,
        x,
        height * 0.5,
        z
      )
    );
  };
  const addSideWalls = (side: GateSide): void => {
    if (gateOnSide !== side) {
      if (side === "north" || side === "south") {
        addWall(side, 0, side === "north" ? wallCenter : -wallCenter, outerSide);
      } else {
        addWall(side, side === "east" ? wallCenter : -wallCenter, 0, outerSide);
      }
      return;
    }

    const segmentLength = (outerSide - gateWidth) * 0.5;
    const segmentOffset = gateWidth * 0.5 + segmentLength * 0.5;
    if (side === "north" || side === "south") {
      const wallZ = side === "north" ? wallCenter : -wallCenter;
      addWall(side, -segmentOffset, wallZ, segmentLength);
      addWall(side, segmentOffset, wallZ, segmentLength);
      return;
    }
    const wallX = side === "east" ? wallCenter : -wallCenter;
    addWall(side, wallX, -segmentOffset, segmentLength);
    addWall(side, wallX, segmentOffset, segmentLength);
  };

  addSideWalls("north");
  addSideWalls("south");
  addSideWalls("east");
  addSideWalls("west");

  const houses = options.houses ?? 0;
  if (houses > 0) {
    const slots = houseSlots(innerSide, houses);
    slots.forEach(([x, z]) => {
      parts.push(
        translatedBox(
          HOUSE_BODY_SIZE.x,
          HOUSE_BODY_SIZE.y,
          HOUSE_BODY_SIZE.z,
          x,
          HOUSE_BODY_SIZE.y * 0.5,
          z
        )
      );
      const roof = prepareForMerge(
        new ConeGeometry(HOUSE_ROOF_RADIUS, HOUSE_ROOF_HEIGHT, 4)
      );
      roof.rotateY(Math.PI / 4);
      roof.translate(x, HOUSE_BODY_SIZE.y + HOUSE_ROOF_HEIGHT * 0.5, z);
      parts.push(roof);
    });
  }

  const merged = BufferGeometryUtils.mergeGeometries(parts);
  if (!merged) {
    return parts[0]!;
  }
  merged.computeVertexNormals();
  return merged;
}

function prepareForMerge(geometry: BufferGeometry): BufferGeometry {
  return geometry.index ? geometry.toNonIndexed() : geometry.clone();
}

function makeTierWallGeometry(
  spec: CityTierSpec
): BufferGeometry {
  const parts: BufferGeometry[] = [
    prepareForMerge(
      makeWalledRingGeometry(spec.outerSide, spec.innerSide, spec.height, {
        houses: spec.houses,
        gateOnSide: spec.gateOnSide
      })
    )
  ];

  if (spec.cornerTowers) {
    const towerSide = spec.outerSide * 0.1;
    const towerHeight = spec.height * 1.2;
    const towerY = towerHeight * 0.5;
    const offset = spec.outerSide * 0.5;
    const corners: Array<[number, number]> = [
      [-offset, -offset],
      [offset, -offset],
      [-offset, offset],
      [offset, offset]
    ];
    corners.forEach(([x, z]) => {
      const cornerGeom = prepareForMerge(new BoxGeometry(towerSide, towerHeight, towerSide));
      cornerGeom.translate(x, towerY, z);
      parts.push(cornerGeom);
    });
  }

  if (spec.centralBuilding === "hip-roof-palace") {
    parts.push(...buildHipRoofPalace(spec.outerSide * 0.6, spec.height * 1.6));
  } else if (spec.centralBuilding === "xie-shan-hall") {
    parts.push(...buildXieShanHall(spec.outerSide * 0.5, spec.height * 1.2));
  }

  const merged = BufferGeometryUtils.mergeGeometries(parts);
  if (!merged) {
    return parts[0];
  }
  merged.computeVertexNormals();
  return merged;
}

function hashStr(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

interface TierGeometry {
  geom: BufferGeometry;
  height: number;
}

const TIER_GEOMETRY: Record<CityTier, TierGeometry> = {
  county: {
    geom: makeTierWallGeometry(CITY_TIER_SPECS.county),
    height: CITY_TIER_SPECS.county.height
  },
  prefecture: {
    geom: makeTierWallGeometry(CITY_TIER_SPECS.prefecture),
    height: CITY_TIER_SPECS.prefecture.height
  },
  capital: {
    geom: makeTierWallGeometry(CITY_TIER_SPECS.capital),
    height: CITY_TIER_SPECS.capital.height
  }
};

// 城墙灰偏暖（夯土 / 砖石）。
const WALL_COLOR = 0x8b8276;

// 每档独立 material，让 LOD 距离淡入 / 淡出可以分档控制 opacity——
// county 远了先 fade，prefecture 中距 fade，capital 始终可见。
function makeWallMaterial(): MeshPhongMaterial {
  return new MeshPhongMaterial({
    color: WALL_COLOR,
    flatShading: true,
    shininess: 6,
    transparent: true,
    // 注意：solid wall 必须 depthWrite=true，否则同一实例内 4 面墙互相
    // 看穿（用户："建筑透视有点问题，像透明的"）。仅在 fade 透明阶段
    // 不该写 depth，但材质级别没法区分 fading vs solid。trade-off：保留
    // depthWrite=true 以保 solid 视觉，接受 fade 时可能轻微 z-fight。
    opacity: 1
  });
}

export interface CityMarkersHandle {
  group: Group;
  cities: RealCity[];
  byTier: Record<CityTier, RealCity[]>;
  tierMeshes: Partial<Record<CityTier, InstancedMesh>>;
  /** 每档独立 material，外部按距离调 opacity 实现 LOD fade。 */
  tierMaterials: Record<CityTier, MeshPhongMaterial>;
}

export function cityFromMarkerIntersection(
  handle: CityMarkersHandle,
  object: Object3D,
  instanceId: number | undefined
): RealCity | null {
  if (!(object instanceof InstancedMesh) || instanceId === undefined || instanceId < 0) {
    return null;
  }

  const tierEntry = (Object.keys(handle.tierMeshes) as CityTier[]).find(
    (tier) => handle.tierMeshes[tier] === object
  );
  if (!tierEntry) {
    return null;
  }

  return handle.byTier[tierEntry][instanceId] ?? null;
}

export function createCityMarkers(
  cities: RealCity[],
  bounds: DemBounds,
  world: DemWorld,
  sampler: TerrainSampler
): CityMarkersHandle {
  const group = new Group();
  group.name = "city-markers";

  const byTier: Record<CityTier, RealCity[]> = {
    capital: [],
    prefecture: [],
    county: []
  };
  for (const city of cities) {
    byTier[city.tier].push(city);
  }

  const dummy = new Object3D();
  const tierMeshes: Partial<Record<CityTier, InstancedMesh>> = {};

  const tierMaterials: Record<CityTier, MeshPhongMaterial> = {
    capital: makeWallMaterial(),
    prefecture: makeWallMaterial(),
    county: makeWallMaterial()
  };

  (Object.keys(byTier) as CityTier[]).forEach((tier) => {
    const tierCities = byTier[tier];
    if (tierCities.length === 0) return;

    const tierGeom = TIER_GEOMETRY[tier];
    const wallMesh = new InstancedMesh(tierGeom.geom, tierMaterials[tier], tierCities.length);
    wallMesh.name = `city-walls-${tier}`;
    tierMeshes[tier] = wallMesh;

    tierCities.forEach((city, index) => {
      const worldPoint = projectGeoToWorld(
        { lat: city.lat, lon: city.lon },
        bounds,
        world
      );
      // 2026-05 codex 调查："特定角度看不见城市" 根因：city wall 用 region
      // sampler 取 Y，但 chunk mesh 渲染时 setTerrainMeshWorldPosition 给
      // 整个 chunk 加了 +0.12 yOffset (避免 chunk 流式加载视觉硬跳)。
      // 城市 placed at Y = region_height，chunk 视觉表面在 Y = chunk_height
      // + 0.12 ≈ region_height + 0.12 → wall base 卡在 chunk 表面以下
      // ~0.12 unit，矮的 county wall (0.8 unit 高) 大半身 沉进 mesh。
      // CHUNK_Y_OFFSET 跟 main.ts setTerrainMeshWorldPosition(...0.12) 同步。
      const CHUNK_Y_OFFSET = 0.12;
      const terrainY = sampler.sampleSurfaceHeight(worldPoint.x, worldPoint.z) + CHUNK_Y_OFFSET;
      const cityIdHash = hashStr(city.id);
      const scaleVar = 0.92 + (cityIdHash % 100) / 1000;
      const rotVar = ((cityIdHash >> 7) & 3) * (Math.PI / 2);

      // geom 现在保证 base y=0、top y=height，所以放到 (x, terrainY, z) 即可。
      dummy.position.set(worldPoint.x, terrainY, worldPoint.z);
      dummy.rotation.set(0, rotVar, 0);
      dummy.scale.set(scaleVar, scaleVar, scaleVar);
      dummy.updateMatrix();
      wallMesh.setMatrixAt(index, dummy.matrix);
    });

    wallMesh.instanceMatrix.needsUpdate = true;
    // ⚠ Three.js InstancedMesh frustum culling 有持续性 bug：computeBoundingSphere
    // 算出的 sphere 是包整组 instance 的大圆，但镜头某些倾斜角度下整组仍被
    // 误裁。安全做法：直接关掉 frustumCulled — 整组 city wall 实例数 < 30,
    // 渲染开销可忽略，比间歇消失体验好。
    wallMesh.computeBoundingSphere();
    wallMesh.frustumCulled = false;
    group.add(wallMesh);
  });

  return { group, cities, byTier, tierMeshes, tierMaterials };
}

export function disposeCityMarkers(handle: CityMarkersHandle): void {
  // TIER_GEOMETRY 是模块级共享，不要 dispose。tierMaterials 是 per-handle
  // 创建的，必须 dispose 否则每次 region 重建都漏一组 MeshPhongMaterial。
  handle.group.traverse((child) => {
    if (child instanceof InstancedMesh) {
      child.dispose();
    }
  });
  Object.values(handle.tierMaterials).forEach((m) => m.dispose());
}
