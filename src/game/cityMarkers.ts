import {
  BoxGeometry,
  Group,
  InstancedMesh,
  MeshPhongMaterial,
  Object3D
} from "three";

import type { CityTier, RealCity } from "../data/realCities";
import type { TerrainSampler } from "./demSampler";
import type { DemBounds, DemWorld } from "./demSampler";
import { projectGeoToWorld } from "./mapOrientation.js";

/**
 * 在 3D 场景里把真实城市坐标摆出来。三档建筑：
 *   capital（京城）= 高 4 单元、底 3.6×3.6，叠一个红屋顶
 *   prefecture（州府）= 高 2.8 单元、底 2.8×2.8，叠红屋顶
 *   county（县城）= 高 1.6 单元、底 2.0×2.0，叠红屋顶
 *
 * 用 InstancedMesh：每档（base + roof）= 2 mesh，共 6 个 instanced mesh。
 * 28 个 instance 总，draw call 增 6，性能可忽略。
 *
 * 渲染高度直接 sample 地形（不再像之前 settlementMask 那样靠合成 mask
 * 决定有无建筑）。位置用 mapOrientation 的 projectGeoToWorld，跟 atlas
 * / hydrography 同一个投影（不会 mismatch）。
 */

interface TierGeometry {
  base: BoxGeometry;
  roof: BoxGeometry;
  baseHeight: number;
  roofHeight: number;
}

function makeTierGeometry(
  baseW: number,
  baseH: number,
  roofExtra: number,
  roofH: number
): TierGeometry {
  return {
    base: new BoxGeometry(baseW, baseH, baseW),
    roof: new BoxGeometry(baseW + roofExtra, roofH, baseW + roofExtra),
    baseHeight: baseH,
    roofHeight: roofH
  };
}

const TIER_GEOMETRY: Record<CityTier, TierGeometry> = {
  county: makeTierGeometry(2.0, 1.6, 0.4, 0.4),
  prefecture: makeTierGeometry(2.8, 2.4, 0.6, 0.5),
  capital: makeTierGeometry(3.6, 3.2, 0.8, 0.7)
};

// 城墙灰偏暖（夯土 / 砖石），屋顶用古建筑暗红（瓦色）。
const WALL_COLOR = 0x8b8276;
const ROOF_COLOR = 0x6b3a2c;

const wallMaterial = new MeshPhongMaterial({
  color: WALL_COLOR,
  flatShading: true,
  shininess: 6
});
const roofMaterial = new MeshPhongMaterial({
  color: ROOF_COLOR,
  flatShading: true,
  shininess: 4
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

    const geom = TIER_GEOMETRY[tier];
    const baseMesh = new InstancedMesh(geom.base, wallMaterial, tierCities.length);
    const roofMesh = new InstancedMesh(geom.roof, roofMaterial, tierCities.length);
    baseMesh.name = `city-base-${tier}`;
    roofMesh.name = `city-roof-${tier}`;

    tierCities.forEach((city, index) => {
      const worldPoint = projectGeoToWorld(
        { lat: city.lat, lon: city.lon },
        bounds,
        world
      );
      const terrainY = sampler.sampleHeight(worldPoint.x, worldPoint.z);

      // base：站在地形上，中心抬高 baseHeight/2
      dummy.position.set(worldPoint.x, terrainY + geom.baseHeight / 2, worldPoint.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      baseMesh.setMatrixAt(index, dummy.matrix);

      // roof：贴在 base 顶端，中心 = base 顶 + roof 半高
      dummy.position.set(
        worldPoint.x,
        terrainY + geom.baseHeight + geom.roofHeight / 2,
        worldPoint.z
      );
      dummy.updateMatrix();
      roofMesh.setMatrixAt(index, dummy.matrix);
    });

    baseMesh.instanceMatrix.needsUpdate = true;
    roofMesh.instanceMatrix.needsUpdate = true;
    group.add(baseMesh);
    group.add(roofMesh);
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
