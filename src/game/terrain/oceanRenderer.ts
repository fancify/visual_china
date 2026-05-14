// terrain/oceanRenderer.ts —
//
// Ocean filler plane for B7 "海洋漫灌" fix.
//
// 设计:
//   - FABDEM 不覆盖海洋 → 海洋区 chunks 在 pyramid 里不存在 → P3 renderer 不画
//   - 因此海洋区现在是 fog 背景色（裸露）
// 解法:
//   - 一面 PlaneGeometry at Y=0, 覆盖整个 China slice
//   - 陆地 chunks (Y > 0) 天然遮挡 ocean plane
//   - 海洋区域 ocean plane 露出 — FABDEM 覆盖范围本身就是 mask
// 视觉:
//   - 浅蓝绿色 + transparent + fog-aware
//   - depthWrite false 防止 z-fight 河流
//   - renderOrder -10 让它在 chunks 之下
//   - sunGlintStrength=0 — BotW 风, 海面不画 Phong specular 高光斑
//   - 浅水/深水 visual 现在做在 terrain 顶点 (pyramidMesh.ts coast tint), 不做在 ocean shader

import { Mesh, PlaneGeometry } from "three";
import { projectGeoToWorld } from "../mapOrientation.js";
import { createWaterSurfaceMaterial } from "../waterSurfaceShader.js";
import {
  qinlingRegionBounds,
  qinlingRegionWorld
} from "../../data/qinlingRegion.js";
import {
  OCEAN_WATER_COLOR,
  OCEAN_WATER_OPACITY,
  OCEAN_WATER_SHIMMER
} from "./waterStyle.js";

export interface OceanPlaneOptions {
  /** 海面 world Y。默认 0 (sea level) */
  seaLevelY?: number;
  /** plane 略大于 China slice，让边缘隐入 fog */
  padding?: number;
}

function regionPlane(padding = 0): {
  centerX: number;
  centerZ: number;
  width: number;
  depth: number;
} {
  const nw = projectGeoToWorld(
    { lat: qinlingRegionBounds.north, lon: qinlingRegionBounds.west },
    qinlingRegionBounds,
    qinlingRegionWorld
  );
  const se = projectGeoToWorld(
    { lat: qinlingRegionBounds.south, lon: qinlingRegionBounds.east },
    qinlingRegionBounds,
    qinlingRegionWorld
  );
  return {
    width: Math.abs(se.x - nw.x) + padding * 2,
    depth: Math.abs(se.z - nw.z) + padding * 2,
    centerX: (nw.x + se.x) / 2,
    centerZ: (nw.z + se.z) / 2
  };
}

export function createOceanPlane(opts: OceanPlaneOptions = {}): Mesh {
  // 把 ocean 压到 -0.3 — 陆地 NaN cell fallback 是 0，刚好遮住 ocean
  // 真海洋区域陆地完全没 chunk，所以 ocean 露出
  const seaLevelY = opts.seaLevelY ?? -0.3;
  const padding = opts.padding ?? 8000;
  const plane = regionPlane(padding);

  const geometry = new PlaneGeometry(plane.width, plane.depth, 2, 2);
  geometry.rotateX(-Math.PI / 2);

  const waterSurface = createWaterSurfaceMaterial({
    baseColor: OCEAN_WATER_COLOR,
    opacity: OCEAN_WATER_OPACITY,
    shimmerStrength: OCEAN_WATER_SHIMMER,
    highlightColor: 0x9bcbd2,
    coastColorStrength: 0,
    // BotW 风：ocean 完全关掉 sun glint specular（lakes 默认 1.0 保留）
    sunGlintStrength: 0
  });

  const mesh = new Mesh(geometry, waterSurface.material);
  mesh.position.set(plane.centerX, seaLevelY, plane.centerZ);
  mesh.name = "ocean-plane";
  mesh.renderOrder = -10;
  mesh.userData.waterSurface = waterSurface;

  return mesh;
}
