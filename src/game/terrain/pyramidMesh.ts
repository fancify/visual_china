// terrain/pyramidMesh.ts — 把一个 LoadedChunk 编译成 Three.js Mesh
//
// 输入: LoadedChunk (256×256 cells, Float32 heights in meters)
// 输出: Three.js Mesh with PlaneGeometry + 顶点 Y = height × verticalScale × exaggeration
//
// 关键设计:
//   - chunk 中心 = world(centerX, centerZ) — 由 projectGeoToWorld 计算
//   - PlaneGeometry 大小 = chunk 物理尺寸 (world units)
//   - 顶点排列 right-handed: x → east, z → south (跟项目 mapOrientation 一致)
//   - 每 chunk 一个 Mesh；多 chunk 共享 material (节省 GPU state)
//
// 不做的:
//   - LOD morph (留给 morphShader.ts)
//   - 跨 chunk seam stitching (chunks 边界 cell 重叠 — 数学上 align)
//   - 河流 ribbon (riverRenderer.ts)
//   - 海面 (oceanRenderer.ts)

import {
  BufferAttribute,
  Color,
  Mesh,
  MeshPhongMaterial,
  PlaneGeometry,
  Vector3
} from "three";
import { projectGeoToWorld } from "../mapOrientation.js";
import {
  qinlingRegionBounds,
  qinlingRegionWorld
} from "../../data/qinlingRegion.js";
import type { LoadedChunk } from "./pyramidTypes.js";
import type { LandMaskSampler } from "./landMaskRenderer.js";

// vertical scale 调优历史:
// - 110 (太尖刺) → 180 → 260 (BotW/原神风, ~13.5× 夸张, 千里江山图)
// - 260 → 500 (2026-05-13 改 7× 夸张, 接近 Skyrim/Horizon Zero Dawn 地面 RPG 尺度)
// 夸张倍数 = (水平 m/unit) / (垂直 m/unit) = 3275 / (SCALE/EXAGGERATION)
//   3275 = world.width 1711u × cos(35.5°) × 111km / 62°
//   SCALE 500 / 1.07 ≈ 467 m/unit → 夸张 ≈ 7.0×
const VERTICAL_EXAGGERATION = 1.07;
const VERTICAL_SCALE = 500;
// NaN cell (chunk 边缘 / FABDEM hole) fallback 到 -3, 跟 ocean plane Y=-3 齐平
// 让 ocean plane 自然吃掉 hole, 而非伪造 Y=0 陆地
const SEA_LEVEL_FALLBACK = -3;

// Mesh-clip 边界 vertex 精确定位 — sub-cell binary search.
// 每条混合 edge 跑 6 轮二分 (2^6 = 64 sub-divisions) 通过 landMaskSampler 找
// 精确陆海临界 t ∈ [0,1]. 比起 t=0.5 中点定位 (产出 45° 阶梯), 二分让
// boundary 顶点贴合 polygon 实际位置 → 任意角度曲线.
// 6 轮就够了 — 4096×2304 sampler raster 1 px ≈ 0.015°，cell 跨度 0.004°,
// 一个 cell 内 sampler pixel 只覆盖 1/4 个，6 轮已超 sub-pixel 精度.
const SHORE_BISECT_ITERATIONS = 6;

function findShoreT(
  sampler: LandMaskSampler,
  lonA: number, latA: number, inA: number,
  lonB: number, latB: number, _inB: number
): number {
  // tLow 始终对应 land 侧, tHigh 对应 ocean. inA 决定起始方向.
  let tLow = inA ? 0 : 1;
  let tHigh = inA ? 1 : 0;
  for (let i = 0; i < SHORE_BISECT_ITERATIONS; i += 1) {
    const tMid = (tLow + tHigh) / 2;
    const lon = lonA + (lonB - lonA) * tMid;
    const lat = latA + (latB - latA) * tMid;
    if (sampler.isLand(lon, lat)) tLow = tMid;
    else tHigh = tMid;
  }
  return (tLow + tHigh) / 2;
}

// 海岸 proximity 算法常量
// 2 cells ≈ 860m，只做贴岸窄色带，不改变海岸线视觉轮廓。
const COAST_K_CELLS = 2;
// 早 cut: elev > 200m 跳过 sampler 查询. COAST_BAND_WORLD_Y_MAX=0.18 worldY ≈ 85m elev,
// 覆盖中国大部分沿海平原 (Bohai 5-30m, 长江口 0-10m, Shandong 海岸丘陵 50-100m).
// 200m 留 ~2x margin 给搜索范围内可能更高的 vertex.
const COAST_ELEV_GATE_M = 200;

const COAST_DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1]
];

function computeCoastProximityArray(
  smoothed: Float32Array,
  isNaNVertex: Uint8Array,
  N: number,
  bounds: { west: number; east: number; south: number; north: number },
  sampler: LandMaskSampler | null
): Float32Array {
  const proximity = new Float32Array(N * N);
  if (!sampler) return proximity; // 全 0 — colorForVertex 行为同改前
  const cellLonStep = (bounds.east - bounds.west) / (N - 1);
  const cellLatStep = (bounds.north - bounds.south) / (N - 1);
  for (let r = 0; r < N; r += 1) {
    for (let c = 0; c < N; c += 1) {
      const idx = r * N + c;
      // NaN vertex 本身 (海洋区) 跳过, hole-punch 不渲染
      if (isNaNVertex[idx]) continue;
      const elev = smoothed[idx];
      if (!Number.isFinite(elev) || elev > COAST_ELEV_GATE_M) continue;
      const lon = bounds.west + c * cellLonStep;
      const lat = bounds.north - r * cellLatStep;
      let minDist = COAST_K_CELLS + 1;
      for (let d = 0; d < COAST_DIRS.length; d += 1) {
        const [dlat, dlon] = COAST_DIRS[d];
        for (let k = 1; k <= COAST_K_CELLS && k < minDist; k += 1) {
          const sLon = lon + dlon * k * cellLonStep;
          const sLat = lat + dlat * k * cellLatStep;
          if (!sampler.isLand(sLon, sLat)) {
            if (k < minDist) minDist = k;
            break;
          }
        }
      }
      if (minDist <= COAST_K_CELLS) {
        // 距离=1 → 最近邻就是海 → proximity=1
        // 距离=K → 最远才碰到海 → proximity=1/K
        proximity[idx] = 1 - (minDist - 1) / COAST_K_CELLS;
      }
    }
  }
  return proximity;
}

// BotW × 千里江山图 × 长安三万里:
// blue-green land base, warm golden pigment in hills, gray rock, bright snow.
// Keep land greener than soil while preserving red/yellow pigment to separate
// it from the teal-blue water palette.
const COLOR_LOW_GREEN = new Color(0.43, 0.62, 0.34);  // 平原青绿草地
const COLOR_MID_WARM = new Color(0.58, 0.62, 0.38);   // 丘陵青绿 + 暖金
const COLOR_HIGH_STONE = new Color(0.46, 0.50, 0.43); // 高山冷灰岩
const COLOR_SNOW = new Color(0.94, 0.93, 0.88);       // 雪线
const COLOR_STEEP = new Color(0.38, 0.40, 0.30);      // 陡坡暗岩草

// BotW 风海岸调色 — 见 feedback_botw_coast_palette
const COLOR_BEACH = new Color(0.83, 0.76, 0.60);          // 沙带 muted khaki，不要亮黄
const COLOR_COASTAL_CLIFF = new Color(0.50, 0.46, 0.42);  // 滨海岩崖 灰褐，比内陆 STEEP 更湿冷
const COLOR_COASTAL_GRASS = new Color(0.42, 0.62, 0.40);  // 海边草甸，比内陆 LOW_GREEN 略饱和

// 海岸 tint 适用的 worldY 上限。VERTICAL_SCALE=500 / EXAG=1.07 → 1 worldY ≈ 467m elev。
// 0.18 worldY ≈ 85m 海拔；覆盖中国沿海平原 (渤海/长江/珠江口都在此带内)。
// 超过此高度完全无 coast tint, 山地海岸由 slope cliff 颜色处理。
const COAST_BAND_WORLD_Y_MAX = 0.18;

function colorForVertex(
  out: Color,
  y: number,
  ny: number,
  coastProximity: number = 0
): void {
  const slopeT = Math.max(0, Math.min(1, (1 - ny) * 2.2));
  const elevT = Math.max(0, Math.min(1, y / 18));
  const snowT = Math.max(0, Math.min(1, (y - 7.4) / 2.8));
  if (snowT >= 1) {
    out.copy(COLOR_SNOW);
  } else if (elevT < 0.35) {
    out.copy(COLOR_LOW_GREEN).lerp(COLOR_MID_WARM, elevT / 0.35);
  } else if (elevT < 0.75) {
    out.copy(COLOR_MID_WARM).lerp(COLOR_HIGH_STONE, (elevT - 0.35) / 0.4);
  } else {
    out.copy(COLOR_HIGH_STONE);
  }
  out.lerp(COLOR_SNOW, snowT * 0.9);
  out.lerp(COLOR_STEEP, slopeT * 0.55);

  // 海岸 tint —— 只在低海拔 + 接近 land mask 边缘的 vertex 上施加。
  // BotW slope-aware：平地→沙、陡坡→灰岩、中间→海边草。
  if (coastProximity > 0 && y < COAST_BAND_WORLD_Y_MAX) {
    const elevFactor = 1 - y / COAST_BAND_WORLD_Y_MAX;  // 0 海拔=1，COAST_BAND 顶=0
    const tintStrength = elevFactor * coastProximity;
    // slope buckets: ny>0.92 平地 → beach；ny<0.65 陡 → cliff；中间 → grass
    let coastCol: Color;
    if (ny > 0.92) {
      coastCol = COLOR_BEACH;
    } else if (ny < 0.65) {
      coastCol = COLOR_COASTAL_CLIFF;
    } else {
      // 平滑过渡：BEACH (ny=0.92) → GRASS (ny=0.78) → CLIFF (ny=0.65)
      if (ny > 0.78) {
        const t = (0.92 - ny) / (0.92 - 0.78);
        coastCol = new Color().copy(COLOR_BEACH).lerp(COLOR_COASTAL_GRASS, t);
      } else {
        const t = (0.78 - ny) / (0.78 - 0.65);
        coastCol = new Color().copy(COLOR_COASTAL_GRASS).lerp(COLOR_COASTAL_CLIFF, t);
      }
    }
    out.lerp(coastCol, tintStrength * 0.35);
  }
}

/**
 * 重新计算 vertex colors. 不传 indices → 全 chunk; 传 → 只更新指定 vertex.
 * Normal harmonization 改了边界 normal 后必须调用此函数刷新边界 vertex 颜色,
 * 否则边界仍显旧 slope 颜色 (盆地平坦区会暴露成可见格子).
 *
 * 读 geometry.userData.coastProximity (Float32Array, per-vertex 0..1) 来上海岸 tint.
 * 没有该 userData 等价于 coastProximity=0 — 行为跟改造前完全一致.
 */
export function refreshVertexColors(
  handle: Pick<PyramidMeshHandle, "geometry">,
  indices?: number[]
): void {
  const positionAttr = handle.geometry.attributes.position as BufferAttribute;
  const normalAttr = handle.geometry.attributes.normal as BufferAttribute | undefined;
  const colorAttr = handle.geometry.attributes.color as BufferAttribute | undefined;
  if (!colorAttr || !normalAttr) return;
  const coastProx = handle.geometry.userData?.coastProximity as Float32Array | undefined;
  const tmp = new Color();
  const range = indices ?? null;
  const count = range ? range.length : positionAttr.count;
  for (let k = 0; k < count; k += 1) {
    const i = range ? range[k] : k;
    const cp = coastProx ? coastProx[i] : 0;
    colorForVertex(tmp, positionAttr.getY(i), normalAttr.getY(i), cp);
    colorAttr.setXYZ(i, tmp.r, tmp.g, tmp.b);
  }
  colorAttr.needsUpdate = true;
}

export interface PyramidMeshOptions {
  /** 默认 MeshPhongMaterial；外部可传共享 material */
  material?: MeshPhongMaterial;
  /** flatShading 默认 false (smooth, 类山水画风); chunk 远景可 true */
  flatShading?: boolean;
  /** Optional vector land mask used to discard DEM cells that fall in ocean. */
  landMaskSampler?: LandMaskSampler | null;
  /** Whether NaN/invalid DEM vertices should cut holes in the mesh. Default true. */
  clipInvalidHeights?: boolean;
  /** Whether coastal land vertices receive a subtle beach color tint. */
  beachTintEnabled?: boolean;
}

export interface PyramidMeshHandle {
  mesh: Mesh;
  geometry: PlaneGeometry;
  material: MeshPhongMaterial;
  chunk: LoadedChunk;
}

/** Build a Three.js Mesh for a single chunk. */
export function createPyramidChunkMesh(
  chunk: LoadedChunk,
  opts: PyramidMeshOptions = {}
): PyramidMeshHandle {
  const { cellsPerChunk, heights, bounds, ghostWidth: gw0 } = chunk;
  const ghostWidth = gw0 ?? 0;
  const arraySide = cellsPerChunk + 2 * ghostWidth;

  // World bounds for this chunk
  const nw = projectGeoToWorld(
    { lat: bounds.north, lon: bounds.west },
    qinlingRegionBounds,
    qinlingRegionWorld
  );
  const se = projectGeoToWorld(
    { lat: bounds.south, lon: bounds.east },
    qinlingRegionBounds,
    qinlingRegionWorld
  );
  const worldWidth = Math.abs(se.x - nw.x);
  const worldDepth = Math.abs(se.z - nw.z);
  const centerX = (nw.x + se.x) / 2;
  const centerZ = (nw.z + se.z) / 2;

  // PlaneGeometry: 物理大小严格 = chunk geographic bounds 投影 (无 overlap)
  // 之前 OVERLAP 1.025 + chunk 内部 box blur 让相邻 chunks 边缘 Y 各算各的 mean,
  // 在 chunk 接缝处出现"陡崖条带" seam. 撤掉 overlap, 让 chunks 边缘 vertex 严格按
  // raw FABDEM cell 值 — 边缘 cell 两边 chunk 都用同一个底层 raster，自然对齐.
  const geometry = new PlaneGeometry(
    worldWidth,
    worldDepth,
    cellsPerChunk - 1,
    cellsPerChunk - 1
  );
  geometry.rotateX(-Math.PI / 2);

  // Smooth 策略 (2026-05-13 v4 — ghost cells):
  //   - ghostWidth=1 (v2 bake): chunk 数据多带 1-cell ghost ring, 跨 chunk smoothing
  //     完全 symmetric. boundary cell 用 (-1, 0, +1) 三向邻居, 包含邻 chunk 的 cell.
  //     两 chunks 在 boundary 处计算同一个 smoothed 值, 几何 + 法线自然一致.
  //   - ghostWidth=0 (v1 bake): legacy, 沿用 BLEND_WIDTH 渐变作 fallback.
  //   - NaN cell: 5×5 邻居 mean inpaint.
  const smoothed = new Float32Array(cellsPerChunk * cellsPerChunk);
  const BLEND_WIDTH_V1 = 4; // 仅 v1 fallback 用

  for (let r = 0; r < cellsPerChunk; r += 1) {
    for (let c = 0; c < cellsPerChunk; c += 1) {
      // 数组 index (考虑 ghost offset)
      const ar = r + ghostWidth;
      const ac = c + ghostWidth;
      const center = heights[ar * arraySide + ac];

      if (Number.isFinite(center)) {
        // 3×3 box blur, 用 ghost cells 时所有方向都能取到 (boundary 也包括 ghost ring)
        let sum = 0;
        let count = 0;
        for (let dr = -1; dr <= 1; dr += 1) {
          for (let dc = -1; dc <= 1; dc += 1) {
            const rr = ar + dr;
            const cc = ac + dc;
            if (rr < 0 || rr >= arraySide || cc < 0 || cc >= arraySide) continue;
            const v = heights[rr * arraySide + cc];
            if (Number.isFinite(v)) {
              sum += v;
              count += 1;
            }
          }
        }
        const blur = count > 0 ? sum / count : center;

        if (ghostWidth > 0) {
          // 有 ghost: 全 cell uniform smooth, boundary cell 已 symmetric.
          smoothed[r * cellsPerChunk + c] = blur;
        } else {
          // 无 ghost: blend gradient, 外圈保 raw 对齐邻 chunk.
          const distEdge = Math.min(r, c, cellsPerChunk - 1 - r, cellsPerChunk - 1 - c);
          const w = Math.max(0, Math.min(1, distEdge / BLEND_WIDTH_V1));
          smoothed[r * cellsPerChunk + c] = center * (1 - w) + blur * w;
        }
      } else {
        // NaN — 5×5 邻居 mean inpaint (用 array 空间, 自动包括 ghost)
        let sum = 0;
        let count = 0;
        for (let dr = -2; dr <= 2; dr += 1) {
          for (let dc = -2; dc <= 2; dc += 1) {
            const rr = ar + dr;
            const cc = ac + dc;
            if (rr < 0 || rr >= arraySide || cc < 0 || cc >= arraySide) continue;
            const v = heights[rr * arraySide + cc];
            if (Number.isFinite(v)) {
              sum += v;
              count += 1;
            }
          }
        }
        smoothed[r * cellsPerChunk + c] = count > 0 ? sum / count : Number.NaN;
      }

      // smoothed 只处理 DEM 高度；真正陆海裁剪在下面的 mesh-clip 阶段用
      // GSHHG vector landMaskSampler 覆盖 DEM/ETOPO 的粗陆海分类。
    }
  }
  if (opts.clipInvalidHeights === false) {
    for (let i = 0; i < smoothed.length; i += 1) {
      if (!Number.isFinite(smoothed[i])) smoothed[i] = 0;
    }
  }

  // Lift each vertex Y by smoothed heights.
  // PlaneGeometry rotateX(-π/2) 后 vertex row 0 = NORTH (local Y=+H/2 → world Z=-H/2),
  // chunk heights row 0 也 = NORTH (bake 用 lat = bounds.north - row/N * span).
  // 两侧约定一致, 不需 flip. (之前 flip 导致 chunk 内部 N-S 颠倒 → 跨 chunk N-S seam
  // 显陡崖条带, root cause; E-W seam 因 flip 对称不受影响. 2026-05-12 修.)
  const positionAttr = geometry.attributes.position as BufferAttribute;
  for (let r = 0; r < cellsPerChunk; r += 1) {
    for (let c = 0; c < cellsPerChunk; c += 1) {
      const vertIdx = r * cellsPerChunk + c;
      const elev = smoothed[r * cellsPerChunk + c];
      const worldY = Number.isFinite(elev)
        ? (elev / VERTICAL_SCALE) * VERTICAL_EXAGGERATION
        : SEA_LEVEL_FALLBACK;
      positionAttr.setY(vertIdx, worldY);
    }
  }
  positionAttr.needsUpdate = true;

  // NaN cell mesh-clip (2026-05-14, 替换 2026-05-13 hole-punch):
  //   旧版: 含 NaN vertex 的 cell 整个跳, 海岸是 1° DEM cell 直角阶梯
  //         (你能看到 "minecraft 海岸" 的方块感, 用户 V1 反馈核心痛点)
  //   新版: 先用高精度 landMaskSampler 标记海侧 vertex，再对跨 land/ocean
  //         边界的 cell 跑 marching-squares 风:
  //         按周长走 (a→b→cc→d), 在 land/ocean 切换的 edge 上插入 midpoint,
  //         fan-triangulate 得到的多边形. boundary 顶点 worldY=0 (sea level),
  //         位置 = 两端 vertex 的 local XZ 中点 (与 PlaneGeometry 初始坐标系对齐).
  //   全 land cell 沿用旧 winding (a,b,d)+(b,cc,d) — 中间面积无差别, 不动.
  //   全 ocean cell 跳 — 跟旧版一样.
  //   PlaneGeometry index: 每 cell 4 vertex a=(r,c) b=(r+1,c) cc=(r+1,c+1) d=(r,c+1)
  const sampler = opts.landMaskSampler ?? null;
  const isNaNVertex = new Uint8Array(cellsPerChunk * cellsPerChunk);
  const cellLonStepBoundary = (bounds.east - bounds.west) / (cellsPerChunk - 1);
  const cellLatStepBoundary = (bounds.north - bounds.south) / (cellsPerChunk - 1);
  if (opts.clipInvalidHeights !== false) {
    for (let i = 0; i < smoothed.length; i += 1) {
      if (!Number.isFinite(smoothed[i])) isNaNVertex[i] = 1;
    }
  }
  if (sampler) {
    for (let r = 0; r < cellsPerChunk; r += 1) {
      const lat = bounds.north - r * cellLatStepBoundary;
      for (let c = 0; c < cellsPerChunk; c += 1) {
        const lon = bounds.west + c * cellLonStepBoundary;
        const idx = r * cellsPerChunk + c;
        if (!sampler.isLand(lon, lat)) isNaNVertex[idx] = 1;
      }
    }
  }
  const segs = cellsPerChunk - 1;
  const baseVertexCount = positionAttr.count; // = N*N
  const newIndices: number[] = [];
  const boundaryPositions: number[] = []; // flat [x, y, z, x, y, z, ...] for new boundary verts
  let boundaryVertCount = 0;

  // 给一条混合 edge 加 boundary vertex，返回它在合并 buffer 里的 vertex index.
  // 用 binary search 找精确陆海临界 t ∈ [0..1] (sampler 存在时), 没 sampler 退化到 t=0.5.
  // local XZ 在 chunk PlaneGeometry 坐标系内按 t lerp (lat/lon → XZ 是线性映射, lerp t 等价).
  // Y=0 = ocean plane 平面, land 顶点的高度自然下落到海平面.
  const addEdgeBoundary = (
    idxA: number, idxB: number,
    lonA: number, latA: number, inA: number,
    lonB: number, latB: number, inB: number
  ): number => {
    const t = sampler
      ? findShoreT(sampler, lonA, latA, inA, lonB, latB, inB)
      : 0.5;
    const xA = positionAttr.getX(idxA);
    const zA = positionAttr.getZ(idxA);
    const xB = positionAttr.getX(idxB);
    const zB = positionAttr.getZ(idxB);
    boundaryPositions.push(
      xA + (xB - xA) * t,
      0,
      zA + (zB - zA) * t
    );
    const idx = baseVertexCount + boundaryVertCount;
    boundaryVertCount += 1;
    return idx;
  };

  for (let r = 0; r < segs; r += 1) {
    for (let c = 0; c < segs; c += 1) {
      const a = r * cellsPerChunk + c;
      const b = (r + 1) * cellsPerChunk + c;
      const cc = (r + 1) * cellsPerChunk + (c + 1);
      const d = r * cellsPerChunk + (c + 1);
      const inA = isNaNVertex[a] ? 0 : 1;
      const inB = isNaNVertex[b] ? 0 : 1;
      const inCC = isNaNVertex[cc] ? 0 : 1;
      const inD = isNaNVertex[d] ? 0 : 1;
      const cfg = inA | (inB << 1) | (inCC << 2) | (inD << 3);
      if (cfg === 0) continue;
      if (cfg === 0b1111) {
        // 全 land — 沿用旧 winding
        newIndices.push(a, b, d, b, cc, d);
        continue;
      }
      // 混合 cell — corner lat/lon + 周长 walk + fan triangulate
      const lonA = bounds.west + c * cellLonStepBoundary;
      const latA = bounds.north - r * cellLatStepBoundary;
      const lonB = lonA;
      const latB = bounds.north - (r + 1) * cellLatStepBoundary;
      const lonCC = bounds.west + (c + 1) * cellLonStepBoundary;
      const latCC = latB;
      const lonD = lonCC;
      const latD = latA;
      const walk: number[] = [];
      if (inA) walk.push(a);
      if (inA !== inB) walk.push(addEdgeBoundary(a, b, lonA, latA, inA, lonB, latB, inB));
      if (inB) walk.push(b);
      if (inB !== inCC) walk.push(addEdgeBoundary(b, cc, lonB, latB, inB, lonCC, latCC, inCC));
      if (inCC) walk.push(cc);
      if (inCC !== inD) walk.push(addEdgeBoundary(cc, d, lonCC, latCC, inCC, lonD, latD, inD));
      if (inD) walk.push(d);
      if (inD !== inA) walk.push(addEdgeBoundary(d, a, lonD, latD, inD, lonA, latA, inA));
      if (walk.length < 3) continue;
      for (let i = 1; i < walk.length - 1; i += 1) {
        newIndices.push(walk[0], walk[i], walk[i + 1]);
      }
    }
  }

  // 把 boundary midpoint 顶点 append 到 position buffer
  // ⚠ 同时必须 extend UV attribute！否则 Three.js shader 拿 vUv 变量时
  // index 越界会刷 "Vertex buffer is not big enough" GL warning 飞起.
  // (computeVertexNormals 会自动 resize normal; color 我们另起 totalCount 大小, 不用 extend)
  if (boundaryVertCount > 0) {
    const newCount = baseVertexCount + boundaryVertCount;
    const newPositions = new Float32Array(newCount * 3);
    newPositions.set(positionAttr.array as Float32Array);
    for (let i = 0; i < boundaryPositions.length; i += 1) {
      newPositions[baseVertexCount * 3 + i] = boundaryPositions[i];
    }
    geometry.setAttribute("position", new BufferAttribute(newPositions, 3));
    // UV: boundary 顶点 UV = (0, 0); material 不用 texture 但 Three.js shader 仍 declare vUv
    const oldUv = geometry.attributes.uv as BufferAttribute | undefined;
    if (oldUv) {
      const newUv = new Float32Array(newCount * 2);
      newUv.set(oldUv.array as Float32Array);
      // boundary verts default Float32Array fill = 0, 不需手动 set
      geometry.setAttribute("uv", new BufferAttribute(newUv, 2));
    }
  }

  geometry.setIndex(newIndices);
  // ⚠ computeVertexNormals 在本 three.js 版本不 auto-resize normal — 只 reset existing.
  // 如果之前 normal.count != position.count (因为我们 extend 了 position) 必须先删掉,
  // 让 computeVertexNormals 自己建一个正确大小的. 否则 GL 会刷 vertex buffer too small.
  if (boundaryVertCount > 0) {
    geometry.deleteAttribute("normal");
  }
  geometry.computeVertexNormals();

  // 海岸 proximity per-vertex (0..1) — 用 landMaskSampler 在 vertex lat/lon 周围 K 格
  // 8 方向扫描最近"非陆地"距离, 跨 chunk 一致 (sampler 是全局的).
  // 只对低海拔 vertex 算 (early-out 内陆山地) → 总开销 O(coastal-low-elev * 24 lookups).
  // 跟着 mesh 一起存在 geometry.userData; refreshVertexColors 读它再 blend coast 调色.
  //
  const baseCoastProx =
    sampler && boundaryVertCount > 0
      ? computeCoastProximityArray(smoothed, isNaNVertex, cellsPerChunk, bounds, sampler)
      : new Float32Array(cellsPerChunk * cellsPerChunk);
  // boundary midpoint 顶点只定义裁剪几何，不参与沙滩 tint；
  // 否则海岸线本身会被染粗，看起来像形状被色带改了。
  const totalCount = baseVertexCount + boundaryVertCount;
  const coastProximity = new Float32Array(totalCount);
  coastProximity.set(baseCoastProx);
  geometry.userData.coastProximityBase = coastProximity;
  geometry.userData.coastProximity = coastProximity;
  if (opts.beachTintEnabled === false) {
    geometry.userData.coastProximity = new Float32Array(totalCount);
  }

  // Vertex colors: 千里江山图 调色板（详 colorForVertex / refreshVertexColors）
  const colorAttr = new BufferAttribute(new Float32Array(totalCount * 3), 3);
  geometry.setAttribute("color", colorAttr);
  refreshVertexColors({ geometry });

  const material = opts.material ?? new MeshPhongMaterial({
    vertexColors: true,
    flatShading: opts.flatShading ?? false,
    shininess: 6
  });

  const mesh = new Mesh(geometry, material);
  mesh.position.set(centerX, 0, centerZ);
  mesh.name = `pyramid-chunk-${chunk.tier}-${chunk.chunkX}-${chunk.chunkZ}`;
  const tierNum = Number(chunk.tier.slice(1));
  mesh.renderOrder = 10 - tierNum;

  return { mesh, geometry, material, chunk };
}

/** Dispose mesh resources (geometry, attributes). Material shared—don't dispose. */
export function disposePyramidChunkMesh(handle: PyramidMeshHandle): void {
  handle.geometry.dispose();
  // Don't dispose material if shared
}

/**
 * 跨 chunk 边界法线统一 (root cause of "陡崖条带" image 2 / 新报告):
 * 每个 chunk 各自 computeVertexNormals() 只看本 chunk 三角形, 边界顶点法线
 * 缺少邻居那半边贡献 → 邻 chunk 法线方向不同 → Phong shading 在 chunk 边界
 * 显示亮度断阶 (即使 elevation 完全对齐).
 *
 * 此函数: 把 a 的指定边 vertex normal 跟 b 的对应边平均, 回写两边都用平均值.
 * edgeOfA 是 a 这一侧的边方向:
 *   'east'  → a.col=N-1 (东) 对 b.col=0 (b 在 a 东侧)
 *   'south' → a.row=N-1 (南) 对 b.row=0 (b 在 a 南侧)
 * 反向 (west/north) 直接调换 a/b 即可, 不在此处单独处理.
 */
export function harmonizeBoundaryNormals(
  a: PyramidMeshHandle,
  b: PyramidMeshHandle,
  edgeOfA: "east" | "south"
): void {
  const N = a.chunk.cellsPerChunk;
  if (b.chunk.cellsPerChunk !== N) return;
  const pA = a.geometry.attributes.position as BufferAttribute;
  const pB = b.geometry.attributes.position as BufferAttribute;
  const nA = a.geometry.attributes.normal as BufferAttribute;
  const nB = b.geometry.attributes.normal as BufferAttribute;

  const edgeIndicesA: number[] = [];
  const edgeIndicesB: number[] = [];

  for (let i = 0; i < N; i += 1) {
    let idxA: number;
    let idxB: number;
    if (edgeOfA === "east") {
      // a 东边 col=N-1; b 西边 col=0; 同 row
      idxA = i * N + (N - 1);
      idxB = i * N + 0;
    } else {
      // a 南边 row=N-1; b 北边 row=0; 同 col
      idxA = (N - 1) * N + i;
      idxB = 0 * N + i;
    }
    edgeIndicesA.push(idxA);
    edgeIndicesB.push(idxB);

    // 1. 位置 Y 平均 — 修边界 micro-gap (root cause 山脊跨 chunk 显蓝青色细缝:
    //    v3 blend 后两 chunk 同 XZ 但 Y 差 0.05-0.14u, 低俯角穿透到天空背景)
    const yA = pA.getY(idxA);
    const yB = pB.getY(idxB);
    const yAvg = (yA + yB) / 2;
    pA.setY(idxA, yAvg);
    pB.setY(idxB, yAvg);

    // 2. 法线方向平均 — 修 Phong shading 接缝
    const ax = nA.getX(idxA);
    const ay = nA.getY(idxA);
    const az = nA.getZ(idxA);
    const bx = nB.getX(idxB);
    const by = nB.getY(idxB);
    const bz = nB.getZ(idxB);
    let sx = ax + bx;
    let sy = ay + by;
    let sz = az + bz;
    const len = Math.sqrt(sx * sx + sy * sy + sz * sz);
    if (len > 1e-6) {
      sx /= len;
      sy /= len;
      sz /= len;
    } else {
      sx = 0;
      sy = 1;
      sz = 0;
    }
    nA.setXYZ(idxA, sx, sy, sz);
    nB.setXYZ(idxB, sx, sy, sz);
  }
  pA.needsUpdate = true;
  pB.needsUpdate = true;
  nA.needsUpdate = true;
  nB.needsUpdate = true;

  // Bbox 需要重算 (Y 改了, frustum culling 可能受影响)
  a.geometry.computeBoundingBox();
  a.geometry.computeBoundingSphere();
  b.geometry.computeBoundingBox();
  b.geometry.computeBoundingSphere();

  // 边界 vertex 法线变了, 同步刷新两侧 vertex colors
  refreshVertexColors(a, edgeIndicesA);
  refreshVertexColors(b, edgeIndicesB);
}

/**
 * 4-way 角点法线汇总. 每个 chunk 角点最多被 4 个 chunk 共享 (本 + 两个 axis 邻 + 1
 * diagonal 邻). pairwise harmonizeBoundaryNormals 只能两两平均, 角点处迭代不收敛
 * (max angle 30° 残留, 平坦盆地里成可见格子点).
 *
 * 此函数: 收集传入的所有 handle 在指定角点位置的 normal, 4-way 平均, 回写所有.
 * 同步 refresh 该顶点 vertex color (slope-based, 跟着 normal 更新).
 */
export function harmonizeCorner(
  entries: { handle: PyramidMeshHandle; corner: "NW" | "NE" | "SW" | "SE" }[]
): void {
  if (entries.length < 2) return;
  const N0 = entries[0].handle.chunk.cellsPerChunk;
  const cornerIdx = (corner: "NW" | "NE" | "SW" | "SE", N: number): number => {
    if (corner === "NW") return 0;
    if (corner === "NE") return N - 1;
    if (corner === "SW") return (N - 1) * N;
    return (N - 1) * N + (N - 1);
  };

  // Pass 1: 4-way average for both Y position AND normal direction
  let sumY = 0;
  let yCount = 0;
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (const { handle, corner } of entries) {
    const N = handle.chunk.cellsPerChunk;
    if (N !== N0) continue;
    const idx = cornerIdx(corner, N);
    const p = handle.geometry.attributes.position as BufferAttribute;
    const n = handle.geometry.attributes.normal as BufferAttribute;
    sumY += p.getY(idx);
    yCount += 1;
    nx += n.getX(idx);
    ny += n.getY(idx);
    nz += n.getZ(idx);
  }
  const avgY = yCount > 0 ? sumY / yCount : 0;
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
  if (len > 1e-6) {
    nx /= len;
    ny /= len;
    nz /= len;
  } else {
    nx = 0;
    ny = 1;
    nz = 0;
  }

  // Pass 2: write back to all chunks at corner
  for (const { handle, corner } of entries) {
    const N = handle.chunk.cellsPerChunk;
    if (N !== N0) continue;
    const idx = cornerIdx(corner, N);
    const p = handle.geometry.attributes.position as BufferAttribute;
    const n = handle.geometry.attributes.normal as BufferAttribute;
    p.setY(idx, avgY);
    n.setXYZ(idx, nx, ny, nz);
    p.needsUpdate = true;
    n.needsUpdate = true;
    handle.geometry.computeBoundingBox();
    handle.geometry.computeBoundingSphere();
    refreshVertexColors(handle, [idx]);
  }
}
