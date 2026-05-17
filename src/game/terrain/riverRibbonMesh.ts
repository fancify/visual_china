// riverRibbonMesh.ts —
//
// 把 polyline 折线转成 ribbon (quad strip) 几何, 用于 riverWaterMaterial.
//
// 算法:
//   1. lon/lat -> world XZ
//   2. Catmull-Rom 插值平滑
//   3. 每个 smoothed 点采样地形 Y (sampler 缓存版, 不触发 DEM 预取)
//   4. 沿 land/lake mask 切分成多个连续 "run" (每个 run 是一段无 break 的折线)
//      - shore 跨界处 binary-search 找精确岸线点 (现有 findShoreClipT 逻辑)
//      - lake mask 命中处硬断 (上游归一段, 下游归一段)
//   5. 每个 run 沿切线 ±width/2 偏移生 L/R 顶点
//      UV.x = 0 (左岸) / 1 (右岸), UV.y = 沿河累计弧长 (世界单位)
//   6. 相邻 4 顶点拼 2 个三角形, push 到 index buffer
//
// 切线计算用 forward-difference (端点) + central-difference (中段),
// 不平滑切线本身 -- centripetal Catmull-Rom 已经够柔.

import { CatmullRomCurve3, Vector3 } from "three";

import { projectGeoToWorld, unprojectWorldToGeo } from "../mapOrientation.js";
import {
  qinlingRegionBounds,
  qinlingRegionWorld
} from "../../data/qinlingRegion.js";
import type { RiverPolyline } from "./pyramidTypes.js";
import type { PyramidSampler } from "./pyramidSampler.js";
import type { LandMaskSampler } from "./landMaskRenderer.js";
import type { LakeMaskSampler } from "./lakeRenderer.js";

const SPLINE_SUBDIV = 5;
const SHORE_CLIP_ITERATIONS = 8;
const Y_BIAS = 0.005;  // 5mm, 仅做最小 z-fight 兜底, 主防御靠 material.polygonOffset

export interface RibbonMasks {
  landMaskSampler?: LandMaskSampler | null;
  excludeWaterSampler?: LakeMaskSampler | null;
}

/** 输出缓冲. 调用方负责 push 进 BufferAttribute. */
export interface RibbonBuffers {
  positions: number[];  // [x,y,z, ...]
  uvs: number[];        // [u,v, ...]
  indices: number[];    // 三角形顶点索引
}

export function createRibbonBuffers(): RibbonBuffers {
  return { positions: [], uvs: [], indices: [] };
}

/**
 * 把一条 polyline 追加到 ribbon buffers.
 * @param poly      原始折线 (lon/lat 坐标)
 * @param sampler   地形高度采样器 (cached, 不触发 DEM 预取)
 * @param width     ribbon 宽度 (world units)
 * @param buf       目标缓冲
 * @param masks     可选 mask (海岸 / 湖面)
 */
export function appendPolylineRibbon(
  poly: RiverPolyline,
  sampler: PyramidSampler,
  width: number,
  buf: RibbonBuffers,
  masks: RibbonMasks = {}
): void {
  if (poly.coords.length < 2) return;

  // 1. lon/lat -> world XZ
  const sourceXZ: Vector3[] = poly.coords.map(([lon, lat]) => {
    const w = projectGeoToWorld({ lat, lon }, qinlingRegionBounds, qinlingRegionWorld);
    return new Vector3(w.x, 0, w.z);
  });

  // 2. Catmull-Rom 平滑
  let smoothed: Vector3[];
  if (sourceXZ.length >= 2) {
    const curve = new CatmullRomCurve3(sourceXZ, false, "centripetal", 0.5);
    const totalPts = Math.max(4, sourceXZ.length * SPLINE_SUBDIV);
    smoothed = curve.getPoints(totalPts);
  } else {
    smoothed = sourceXZ;
  }
  if (smoothed.length < 2) return;

  // 3. Y sample + moving-avg smooth
  const rawY: number[] = smoothed.map((p) => {
    const y = sampler.sampleHeightWorldCached(p.x, p.z);
    return Number.isFinite(y) ? y : NaN;
  });
  for (let i = 0; i < rawY.length; i += 1) {
    if (!Number.isFinite(rawY[i])) {
      let prev = i - 1;
      while (prev >= 0 && !Number.isFinite(rawY[prev])) prev -= 1;
      let next = i + 1;
      while (next < rawY.length && !Number.isFinite(rawY[next])) next += 1;
      if (prev >= 0 && next < rawY.length) rawY[i] = (rawY[prev] + rawY[next]) / 2;
      else if (prev >= 0) rawY[i] = rawY[prev];
      else if (next < rawY.length) rawY[i] = rawY[next];
      else rawY[i] = 0;
    }
  }
  const SMOOTH_K = 7;
  const half = Math.floor(SMOOTH_K / 2);
  const smoothY: number[] = new Array(rawY.length);
  for (let i = 0; i < rawY.length; i += 1) {
    let s = 0;
    let n = 0;
    for (let k = -half; k <= half; k += 1) {
      const j = Math.max(0, Math.min(rawY.length - 1, i + k));
      s += rawY[j];
      n += 1;
    }
    smoothY[i] = s / n;
  }

  // 4. 切成 runs (mask 处理)
  const runs: Vector3[][] = [];
  let current: Vector3[] = [];

  const isInLake = (x: number, z: number): boolean => {
    if (!masks.excludeWaterSampler) return false;
    const g = unprojectWorldToGeo({ x, z }, qinlingRegionBounds, qinlingRegionWorld);
    return masks.excludeWaterSampler.isWater(g.lon, g.lat);
  };
  const isOnLand = (x: number, z: number): boolean => {
    if (!masks.landMaskSampler) return true;
    const g = unprojectWorldToGeo({ x, z }, qinlingRegionBounds, qinlingRegionWorld);
    return masks.landMaskSampler.isLand(g.lon, g.lat);
  };
  const pointValid = (x: number, z: number): boolean => isOnLand(x, z) && !isInLake(x, z);

  const flushRun = () => {
    if (current.length >= 2) runs.push(current);
    current = [];
  };

  for (let i = 0; i < smoothed.length - 1; i += 1) {
    const a = smoothed[i];
    const b = smoothed[i + 1];
    const ay = smoothY[i];
    const by = smoothY[i + 1];
    const aValid = pointValid(a.x, a.z);
    const bValid = pointValid(b.x, b.z);

    if (!aValid && !bValid) {
      flushRun();
      continue;
    }

    if (aValid && bValid) {
      if (current.length === 0) current.push(new Vector3(a.x, ay + Y_BIAS, a.z));
      current.push(new Vector3(b.x, by + Y_BIAS, b.z));
      continue;
    }

    // 跨界 — 用 land mask binary-search 找岸线
    if (masks.landMaskSampler) {
      const aLand = isOnLand(a.x, a.z);
      const bLand = isOnLand(b.x, b.z);
      if (aLand !== bLand) {
        const t = findShoreClipT(masks.landMaskSampler, a.x, a.z, aLand, b.x, b.z);
        const sx = a.x + (b.x - a.x) * t;
        const sz = a.z + (b.z - a.z) * t;
        const sy = ay + (by - ay) * t;
        if (aValid) {
          if (current.length === 0) current.push(new Vector3(a.x, ay + Y_BIAS, a.z));
          current.push(new Vector3(sx, sy + Y_BIAS, sz));
          flushRun();  // 出岸断开
        } else {
          flushRun();  // 防御性
          current.push(new Vector3(sx, sy + Y_BIAS, sz));
          current.push(new Vector3(b.x, by + Y_BIAS, b.z));
        }
        continue;
      }
    }

    // 没 land mask 但 lake mask 跨界 — 硬断
    flushRun();
    if (bValid) current.push(new Vector3(b.x, by + Y_BIAS, b.z));
  }
  flushRun();

  // 5. 每个 run -> ribbon vertices + indices
  for (const run of runs) {
    appendRunRibbon(run, width, sampler, buf);
  }
}

function appendRunRibbon(
  points: Vector3[],
  width: number,
  sampler: PyramidSampler,
  buf: RibbonBuffers
): void {
  const n = points.length;
  if (n < 2) return;

  // 累计弧长 (XZ only)
  const along: number[] = new Array(n);
  along[0] = 0;
  for (let i = 1; i < n; i += 1) {
    const dx = points[i].x - points[i - 1].x;
    const dz = points[i].z - points[i - 1].z;
    along[i] = along[i - 1] + Math.hypot(dx, dz);
  }

  // 预先算每个点的 (L, R) XZ 位置 + sample 各自 terrain Y
  // 这样水面跟着地形扭, 不会"探出"高岸 → 不再有阶梯 facet
  const lPos: { x: number; z: number; y: number }[] = new Array(n);
  const rPos: { x: number; z: number; y: number }[] = new Array(n);
  const halfW = width * 0.5;

  for (let i = 0; i < n; i += 1) {
    // 切线 (XZ): 端点 forward-diff, 中段 central-diff
    let tx: number;
    let tz: number;
    if (i === 0) {
      tx = points[1].x - points[0].x;
      tz = points[1].z - points[0].z;
    } else if (i === n - 1) {
      tx = points[n - 1].x - points[n - 2].x;
      tz = points[n - 1].z - points[n - 2].z;
    } else {
      tx = points[i + 1].x - points[i - 1].x;
      tz = points[i + 1].z - points[i - 1].z;
    }
    const len = Math.hypot(tx, tz) || 1;
    tx /= len;
    tz /= len;
    // 法向 (XZ rotate 90 CCW): (-tz, tx)
    const nx = -tz;
    const nz = tx;

    const p = points[i];
    const lx = p.x + nx * halfW;
    const lz = p.z + nz * halfW;
    const rx = p.x - nx * halfW;
    const rz = p.z - nz * halfW;
    // p.y 已是 centerline terrain Y + Y_BIAS (run 构造时加的). 这里岸边重新采样,
    // sampler.sampleHeightWorldCached 返回纯 terrain Y, 再加同样的 Y_BIAS 兜住 z-fight.
    const lyRaw = sampler.sampleHeightWorldCached(lx, lz);
    const ryRaw = sampler.sampleHeightWorldCached(rx, rz);
    // sampler 返回 NaN 时 fallback 到 centerline Y (已含 Y_BIAS)
    const ly = Number.isFinite(lyRaw) ? lyRaw + Y_BIAS : p.y;
    const ry = Number.isFinite(ryRaw) ? ryRaw + Y_BIAS : p.y;
    lPos[i] = { x: lx, z: lz, y: ly };
    rPos[i] = { x: rx, z: rz, y: ry };
  }

  // 同一岸沿河向 moving-avg 平滑 Y, 抹平 DEM tile 拼接处的小台阶
  const SMOOTH_K = 5;
  const half = Math.floor(SMOOTH_K / 2);
  const ySmooth = (arr: { y: number }[]) => {
    const out = new Array<number>(arr.length);
    for (let i = 0; i < arr.length; i += 1) {
      let s = 0;
      let m = 0;
      for (let k = -half; k <= half; k += 1) {
        const j = Math.max(0, Math.min(arr.length - 1, i + k));
        s += arr[j].y;
        m += 1;
      }
      out[i] = s / m;
    }
    return out;
  };
  const lYSmooth = ySmooth(lPos);
  const rYSmooth = ySmooth(rPos);

  const baseIdx = buf.positions.length / 3;
  for (let i = 0; i < n; i += 1) {
    buf.positions.push(lPos[i].x, lYSmooth[i], lPos[i].z);
    buf.uvs.push(0, along[i]);
    buf.positions.push(rPos[i].x, rYSmooth[i], rPos[i].z);
    buf.uvs.push(1, along[i]);
  }

  // Triangles: 顶点 idx = baseIdx + 2i (L), baseIdx + 2i+1 (R)
  for (let i = 0; i < n - 1; i += 1) {
    const a = baseIdx + 2 * i;      // L_i
    const b = a + 1;                 // R_i
    const c = a + 2;                 // L_{i+1}
    const d = a + 3;                 // R_{i+1}
    buf.indices.push(a, b, d);
    buf.indices.push(a, d, c);
  }
}

function findShoreClipT(
  sampler: LandMaskSampler,
  ax: number,
  az: number,
  landA: boolean,
  bx: number,
  bz: number
): number {
  let tLow = landA ? 0 : 1;
  let tHigh = landA ? 1 : 0;
  for (let i = 0; i < SHORE_CLIP_ITERATIONS; i += 1) {
    const tMid = (tLow + tHigh) / 2;
    const x = ax + (bx - ax) * tMid;
    const z = az + (bz - az) * tMid;
    const geo = unprojectWorldToGeo({ x, z }, qinlingRegionBounds, qinlingRegionWorld);
    if (sampler.isLand(geo.lon, geo.lat)) tLow = tMid;
    else tHigh = tMid;
  }
  return (tLow + tHigh) / 2;
}
