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

// 千里江山图 vertex color palette
const COLOR_LOW_GREEN = new Color(0.35, 0.55, 0.36);  // 平原青绿 (草、田)
const COLOR_MID_WARM = new Color(0.62, 0.55, 0.40);   // 丘陵赭石 (土、林)
const COLOR_HIGH_STONE = new Color(0.58, 0.55, 0.52); // 高山岩灰 (石)
const COLOR_SNOW = new Color(0.92, 0.92, 0.88);       // 雪线
const COLOR_STEEP = new Color(0.48, 0.42, 0.36);      // 陡坡岩

function colorForVertex(out: Color, y: number, ny: number): void {
  const slopeT = Math.max(0, Math.min(1, (1 - ny) * 2.2));
  const elevT = Math.max(0, Math.min(1, y / 25));
  if (y > 28) {
    out.copy(COLOR_SNOW);
  } else if (elevT < 0.35) {
    out.copy(COLOR_LOW_GREEN).lerp(COLOR_MID_WARM, elevT / 0.35);
  } else if (elevT < 0.75) {
    out.copy(COLOR_MID_WARM).lerp(COLOR_HIGH_STONE, (elevT - 0.35) / 0.4);
  } else {
    out.copy(COLOR_HIGH_STONE).lerp(COLOR_SNOW, (elevT - 0.75) / 0.25);
  }
  out.lerp(COLOR_STEEP, slopeT * 0.55);
}

/**
 * 重新计算 vertex colors. 不传 indices → 全 chunk; 传 → 只更新指定 vertex.
 * Normal harmonization 改了边界 normal 后必须调用此函数刷新边界 vertex 颜色,
 * 否则边界仍显旧 slope 颜色 (盆地平坦区会暴露成可见格子).
 */
export function refreshVertexColors(
  handle: Pick<PyramidMeshHandle, "geometry">,
  indices?: number[]
): void {
  const positionAttr = handle.geometry.attributes.position as BufferAttribute;
  const normalAttr = handle.geometry.attributes.normal as BufferAttribute | undefined;
  const colorAttr = handle.geometry.attributes.color as BufferAttribute | undefined;
  if (!colorAttr || !normalAttr) return;
  const tmp = new Color();
  const range = indices ?? null;
  const count = range ? range.length : positionAttr.count;
  for (let k = 0; k < count; k += 1) {
    const i = range ? range[k] : k;
    colorForVertex(tmp, positionAttr.getY(i), normalAttr.getY(i));
    colorAttr.setXYZ(i, tmp.r, tmp.g, tmp.b);
  }
  colorAttr.needsUpdate = true;
}

export interface PyramidMeshOptions {
  /** 默认 MeshPhongMaterial；外部可传共享 material */
  material?: MeshPhongMaterial;
  /** flatShading 默认 false (smooth, 类山水画风); chunk 远景可 true */
  flatShading?: boolean;
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
  geometry.computeVertexNormals();

  // Vertex colors: 千里江山图 调色板（详 colorForVertex / refreshVertexColors）
  const colorAttr = new BufferAttribute(new Float32Array(positionAttr.count * 3), 3);
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
