import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  MeshPhongMaterial,
  Object3D,
  Path,
  Shape
} from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";

import type { CityTier, RealCity } from "../data/realCities.js";
import type { TerrainSampler } from "./demSampler";
import type { DemBounds, DemWorld } from "./demSampler";
import { projectGeoToWorld } from "./mapOrientation.js";

/**
 * 在 3D 场景里把真实城市坐标摆出来。
 *
 * 造型 = "口"字型城墙 (extrude 一个带洞的方形 shape)：矮、贴地、no roof
 * prism。三档不仅尺寸不同，结构也分级：
 *   capital（京城）= 外环 + 4 角楼 + 中央城楼
 *   prefecture（州府）= 外环 + 4 角楼
 *   county（县城）= 仅外环
 *
 * 三档尺寸：
 *   capital（京城）= 外 4.4 内 3.0、墙厚 0.7、高 1.4（最大）
 *   prefecture（州府）= 外 3.4 内 2.4、墙厚 0.5、高 1.1
 *   county（县城）= 外 2.4 内 1.6、墙厚 0.4、高 0.8（最矮）
 *
 * 用 InstancedMesh：每档 1 个 mesh，共 3 个 instanced mesh（之前 base+
 * roof 6 个减半）。29 个 instance，draw call 3。
 *
 * 用户这轮明确要求："回" 是误读，应该改回 "口"。所以中心保持中空；
 * 某些视角看穿中间是预期效果，不再加内核回填。
 */

function makeWalledRingGeometry(
  outerSide: number,
  innerSide: number,
  height: number
): BufferGeometry {
  const half = outerSide * 0.5;
  const innerHalf = innerSide * 0.5;

  const ringShape = new Shape();
  ringShape.moveTo(-half, -half);
  ringShape.lineTo(half, -half);
  ringShape.lineTo(half, half);
  ringShape.lineTo(-half, half);
  ringShape.lineTo(-half, -half);
  const hole = new Path();
  hole.moveTo(-innerHalf, -innerHalf);
  hole.lineTo(innerHalf, -innerHalf);
  hole.lineTo(innerHalf, innerHalf);
  hole.lineTo(-innerHalf, innerHalf);
  hole.lineTo(-innerHalf, -innerHalf);
  ringShape.holes.push(hole);
  const ringGeom = new ExtrudeGeometry(ringShape, {
    depth: height,
    bevelEnabled: false,
    curveSegments: 1
  });
  ringGeom.rotateX(-Math.PI / 2);
  ringGeom.computeVertexNormals();
  return ringGeom;
}

function prepareForMerge(geometry: BufferGeometry): BufferGeometry {
  return geometry.index ? geometry.toNonIndexed() : geometry.clone();
}

function makeTierWallGeometry(
  outerSide: number,
  innerSide: number,
  height: number,
  options: { cornerTowers: boolean; centralTower: boolean }
): BufferGeometry {
  const parts: BufferGeometry[] = [
    prepareForMerge(makeWalledRingGeometry(outerSide, innerSide, height))
  ];

  if (options.cornerTowers) {
    const towerSide = outerSide * 0.18;
    const towerHeight = height * 1.2;
    const towerY = towerHeight * 0.5;
    const offset = outerSide * 0.5;
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

  if (options.centralTower) {
    const towerGeom = prepareForMerge(
      new CylinderGeometry(outerSide * 0.16, outerSide * 0.18, height * 1.5, 8)
    );
    towerGeom.translate(0, height * 0.75, 0);
    parts.push(towerGeom);
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
    geom: makeTierWallGeometry(2.4, 1.6, 0.8, {
      cornerTowers: false,
      centralTower: false
    }),
    height: 0.8
  },
  prefecture: {
    geom: makeTierWallGeometry(3.4, 2.4, 1.1, {
      cornerTowers: true,
      centralTower: false
    }),
    height: 1.1
  },
  capital: {
    geom: makeTierWallGeometry(4.4, 3.0, 1.4, {
      cornerTowers: true,
      centralTower: true
    }),
    height: 1.4
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
  /** 每档独立 material，外部按距离调 opacity 实现 LOD fade。 */
  tierMaterials: Record<CityTier, MeshPhongMaterial>;
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

  return { group, cities, tierMaterials };
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
