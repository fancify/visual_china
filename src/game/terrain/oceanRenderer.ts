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

import {
  Color,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry
} from "three";
import { projectGeoToWorld } from "../mapOrientation.js";
import {
  qinlingRegionBounds,
  qinlingRegionWorld
} from "../../data/qinlingRegion.js";

const OCEAN_COLOR = new Color(0.26, 0.40, 0.52);
const OCEAN_OPACITY = 0.92;

export interface OceanPlaneOptions {
  /** 海面 world Y。默认 0 (sea level) */
  seaLevelY?: number;
  /** plane 略大于 China slice，让边缘隐入 fog */
  padding?: number;
}

export function createOceanPlane(opts: OceanPlaneOptions = {}): Mesh {
  // 把 ocean 压到 -0.3 — 陆地 NaN cell fallback 是 0，刚好遮住 ocean
  // 真海洋区域陆地完全没 chunk，所以 ocean 露出
  const seaLevelY = opts.seaLevelY ?? -0.3;
  const padding = opts.padding ?? 200;

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
  const width = Math.abs(se.x - nw.x) + padding * 2;
  const depth = Math.abs(se.z - nw.z) + padding * 2;
  const centerX = (nw.x + se.x) / 2;
  const centerZ = (nw.z + se.z) / 2;

  const geometry = new PlaneGeometry(width, depth, 2, 2);
  geometry.rotateX(-Math.PI / 2);

  const material = new MeshBasicMaterial({
    color: OCEAN_COLOR,
    transparent: true,
    opacity: OCEAN_OPACITY,
    depthWrite: false,
    fog: true
  });

  const mesh = new Mesh(geometry, material);
  mesh.position.set(centerX, seaLevelY, centerZ);
  mesh.name = "ocean-plane";
  mesh.renderOrder = -10;

  return mesh;
}
