import {
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  MeshPhongMaterial,
  Object3D,
  Path,
  Shape
} from "three";

import type { CityTier, RealCity } from "../data/realCities";
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
  geom.rotateX(-Math.PI / 2);
  // 经过 rotateX(-PI/2)，原本 (x, y, z) 变成 (x, z, -y)。
  // shape 原本 z=0..height 朝 +Z extrude，rotate 后变成 y=0..-height（向下）。
  // 所以再 translate +height 让墙站在 y=0 之上。
  geom.translate(0, height, 0);
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

const wallMaterial = new MeshPhongMaterial({
  color: WALL_COLOR,
  flatShading: true,
  shininess: 6
});

export interface CityMarkersHandle {
  group: Group;
  cities: RealCity[];
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

  (Object.keys(byTier) as CityTier[]).forEach((tier) => {
    const tierCities = byTier[tier];
    if (tierCities.length === 0) return;

    const tierGeom = TIER_GEOMETRY[tier];
    const wallMesh = new InstancedMesh(tierGeom.geom, wallMaterial, tierCities.length);
    wallMesh.name = `city-walls-${tier}`;

    tierCities.forEach((city, index) => {
      const worldPoint = projectGeoToWorld(
        { lat: city.lat, lon: city.lon },
        bounds,
        world
      );
      const terrainY = sampler.sampleHeight(worldPoint.x, worldPoint.z);

      // geom 已经从 base y=0 长到 y=height，所以放到 (x, terrainY, z) 即可。
      dummy.position.set(worldPoint.x, terrainY, worldPoint.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      wallMesh.setMatrixAt(index, dummy.matrix);
    });

    wallMesh.instanceMatrix.needsUpdate = true;
    group.add(wallMesh);
  });

  return { group, cities };
}

export function disposeCityMarkers(handle: CityMarkersHandle): void {
  // wallMaterial / roofMaterial / TIER_GEOMETRY 都是模块级共享，不要 dispose。
  handle.group.traverse((child) => {
    if (child instanceof InstancedMesh) {
      child.dispose();
    }
  });
}
