import {
  BoxGeometry,
  BufferGeometry,
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
 * prism。三档用尺寸差区分：
 *   capital（京城）= 外 4.4 内 3.0、墙厚 0.7、高 1.4（最大）
 *   prefecture（州府）= 外 3.4 内 2.4、墙厚 0.5、高 1.1
 *   county（县城）= 外 2.4 内 1.6、墙厚 0.4、高 0.8（最矮）
 *
 * 用 InstancedMesh：每档 1 个 mesh，共 3 个 instanced mesh（之前 base+
 * roof 6 个减半）。28 个 instance，draw call 3。
 *
 * 用户反馈："base + roof 太丑、太高，应该矮一点 + 像小城的样子，
 * 口字型或类似造型"——所以删掉 prism roof，让墙体本身代表城。
 */

function makeWalledCompoundGeometry(
  outerSide: number,
  innerSide: number,
  height: number
): BufferGeometry {
  // 用户："应该是回字形"。回 = 外环城墙 + 内块城核 (两层 concentric)。
  // 之前 "口" (空心环) 看穿；纯实心 box 太单调。回 shape 同时解决这两个：
  //   - 外环: ExtrudeGeometry "口" 字 (中空，让外墙形态可见)
  //   - 内核: BoxGeometry 实心 (填中间空洞，避免 see-through)
  //   - 内核 height 更高 (× 1.4) 让视觉层级有"中央台/宫城"感
  // 用 BufferGeometryUtils.mergeGeometries 把两段合一以保 InstancedMesh
  // 单 mesh，不增 draw call.
  const half = outerSide * 0.5;
  const innerHalf = innerSide * 0.5;

  // 外环：ExtrudeGeometry with hole
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
  // 旋转后 y 范围 = -height..0；translate 让 base=0, top=height
  ringGeom.translate(0, height, 0);

  // 内核：实心 box, 比外墙稍矮 (0.7×) 让外墙仍是主体形态
  const coreSide = innerSide * 0.85;
  const coreHeight = height * 0.7;
  const coreGeom = new BoxGeometry(coreSide, coreHeight, coreSide);
  coreGeom.translate(0, coreHeight * 0.5, 0);

  // 合并成单 BufferGeometry. mergeGeometries 要求 attributes 一致；
  // ExtrudeGeometry 默认有 position+normal+uv, BoxGeometry 也有，OK.
  const merged = BufferGeometryUtils.mergeGeometries([ringGeom, coreGeom]);
  if (!merged) {
    // fallback 极少触发；保险起见直接退化到 ring 单形
    return ringGeom;
  }
  return merged;
}

interface TierGeometry {
  geom: BufferGeometry;
  height: number;
}

const TIER_GEOMETRY: Record<CityTier, TierGeometry> = {
  county: {
    geom: makeWalledCompoundGeometry(2.4, 1.6, 0.8),
    height: 0.8
  },
  prefecture: {
    geom: makeWalledCompoundGeometry(3.4, 2.4, 1.1),
    height: 1.1
  },
  capital: {
    geom: makeWalledCompoundGeometry(4.4, 3.0, 1.4),
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

      // geom 已经从 base y=0 长到 y=height，所以放到 (x, terrainY, z) 即可。
      dummy.position.set(worldPoint.x, terrainY, worldPoint.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
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
