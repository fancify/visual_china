import {
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  MeshPhongMaterial,
  Object3D,
  Path,
  Shape
} from "three";

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
): ExtrudeGeometry {
  const half = outerSide * 0.5;
  const innerHalf = innerSide * 0.5;

  // ExtrudeGeometry 默认在 XY plane 画 shape，沿 +Z 方向 extrude；
  // 我们要让 "口" 平放在地面（XZ plane）、向上长高。所以画在 XY 平面，
  // extrude 0..height，最后旋转 -PI/2 让 Z 轴变 Y 轴。
  const shape = new Shape();
  shape.moveTo(-half, -half);
  shape.lineTo(half, -half);
  shape.lineTo(half, half);
  shape.lineTo(-half, half);
  shape.lineTo(-half, -half);

  const hole = new Path();
  hole.moveTo(-innerHalf, -innerHalf);
  hole.lineTo(innerHalf, -innerHalf);
  hole.lineTo(innerHalf, innerHalf);
  hole.lineTo(-innerHalf, innerHalf);
  hole.lineTo(-innerHalf, -innerHalf);
  shape.holes.push(hole);

  const geom = new ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
    curveSegments: 1
  });
  // rotateX(-PI/2) 把 (x, y, z) 映射成 (x, z, -y)。原本 z=0..height 的
  // extrusion 旋转后变成 y=0..height（在地表之上向上长），原 shape 的
  // y 维度（-outerHalf..+outerHalf）旋转后变 z（同范围），刚好是俯视的
  // "口"字型。base 已经在 y=0，**不要**再 translate（codex d90c5e7 P1
  // 抓到的：之前再 +height 把整圈墙抬高了一档，看上去是飘在地上）。
  geom.rotateX(-Math.PI / 2);
  return geom;
}

interface TierGeometry {
  geom: ExtrudeGeometry;
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
      // 用 triangular interp（跟 GPU PlaneGeometry 一致），避免雕刻河谷
      // 边的城市被 bilinear vs triangle 高差埋进 mesh（用户："特定角度下，
      // 城市看不见"）
      const terrainY = sampler.sampleSurfaceHeight(worldPoint.x, worldPoint.z);

      // geom 已经从 base y=0 长到 y=height，所以放到 (x, terrainY, z) 即可。
      dummy.position.set(worldPoint.x, terrainY, worldPoint.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      wallMesh.setMatrixAt(index, dummy.matrix);
    });

    wallMesh.instanceMatrix.needsUpdate = true;
    // ⚠ Three.js InstancedMesh frustum culling 默认只看 geometry 的
    // boundingSphere（几米半径，绕原点），不看 instance matrices。所以
    // 当原点在视锥外（玩家镜头转向某些角度）时整组城市会被一起裁掉，
    // 即使个别 instance 还在画面里——这就是用户反馈的"近的城市镜头一
    // 转就消失再转回来又出现"。computeBoundingSphere 会 walk 所有 instance
    // 位置算出真正包围 sphere，让 culling 跟实际视锥对得上。
    wallMesh.computeBoundingSphere();
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
