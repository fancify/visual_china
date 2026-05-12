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

// vertical scale 调优 (2026-05-12)
// 测试发现 elevation_m/110 在 256×256 grid + 1° chunk 下显得过于尖刺。
// FABDEM 30m raw bilinear 下采样到 444m/cell 后高频信号被放大；
// 改为 elevation_m/180 让山势更平缓，接近千里江山图横看远山的比例。
const VERTICAL_EXAGGERATION = 1.07;
// scale 180 → 260: 平原区高频起伏被压回真实比例。秦岭 3000m → ~12u 而非 18u
const VERTICAL_SCALE = 260;
// NaN cell (chunk 边缘 / FABDEM hole) fallback 到 -3, 跟 ocean plane Y=-3 齐平
// 让 ocean plane 自然吃掉 hole, 而非伪造 Y=0 陆地
const SEA_LEVEL_FALLBACK = -3;

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
  const { cellsPerChunk, heights, bounds } = chunk;

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

  // Smooth 策略 — 区分 chunk 边缘 vs 内部, 防 seam:
  //   - chunk 边界 2 行 / 2 列 cells: 直接用 raw FABDEM 值 (不动), 保证相邻 chunks
  //     边缘对齐 (它们共享同一 raster overlap, raw 值天然一致)
  //   - chunk 内部 cells: 3×3 box blur, anti-alias 高频
  //   - NaN cell (任何位置): 5×5 邻居 mean inpaint
  const smoothed = new Float32Array(cellsPerChunk * cellsPerChunk);
  const BORDER = 2; // chunk 边 2 行/列保 raw 不 smooth
  for (let r = 0; r < cellsPerChunk; r += 1) {
    for (let c = 0; c < cellsPerChunk; c += 1) {
      const center = heights[r * cellsPerChunk + c];
      const isBorder =
        r < BORDER || r >= cellsPerChunk - BORDER ||
        c < BORDER || c >= cellsPerChunk - BORDER;

      if (Number.isFinite(center)) {
        if (isBorder) {
          // 边缘 — raw 不动, 保 seam alignment
          smoothed[r * cellsPerChunk + c] = center;
        } else {
          // 内部 — 3×3 box blur
          let sum = 0;
          let count = 0;
          for (let dr = -1; dr <= 1; dr += 1) {
            for (let dc = -1; dc <= 1; dc += 1) {
              const v = heights[(r + dr) * cellsPerChunk + (c + dc)];
              if (Number.isFinite(v)) {
                sum += v;
                count += 1;
              }
            }
          }
          smoothed[r * cellsPerChunk + c] = count > 0 ? sum / count : center;
        }
      } else {
        // NaN — 5×5 邻居 mean inpaint
        let sum = 0;
        let count = 0;
        for (let dr = -2; dr <= 2; dr += 1) {
          for (let dc = -2; dc <= 2; dc += 1) {
            const rr = r + dr;
            const cc = c + dc;
            if (rr < 0 || rr >= cellsPerChunk || cc < 0 || cc >= cellsPerChunk) continue;
            const v = heights[rr * cellsPerChunk + cc];
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

  // Vertex colors based on elevation + slope (千里江山图 调色板):
  //   低海拔平地: 青绿 (草、田)
  //   中海拔丘陵: 赭石黄褐 (土、林)
  //   高海拔山脊: 灰白 (石)
  //   雪线以上: 雪白
  //   陡坡 (slope > 0.4 rad ~ 23°): 偏石灰岩
  const colorAttr = new BufferAttribute(new Float32Array(positionAttr.count * 3), 3);
  const baseLowGreen = new Color(0.35, 0.55, 0.36);  // 平原青绿
  const baseMidWarm = new Color(0.62, 0.55, 0.40);   // 丘陵赭石
  const baseHighStone = new Color(0.58, 0.55, 0.52); // 高山岩灰
  const baseSnow = new Color(0.92, 0.92, 0.88);      // 雪线
  const baseSteep = new Color(0.48, 0.42, 0.36);     // 陡坡岩
  const tmp = new Color();
  const normalAttr = geometry.attributes.normal as BufferAttribute;
  for (let i = 0; i < positionAttr.count; i += 1) {
    const y = positionAttr.getY(i);
    // slope = acos(normal.y) — flat ground normal.y ≈ 1
    const ny = normalAttr.getY(i);
    const slopeT = Math.max(0, Math.min(1, (1 - ny) * 2.2));

    // base color by elevation tier
    const elevT = Math.max(0, Math.min(1, y / 25));
    if (y > 28) {
      tmp.copy(baseSnow);
    } else if (elevT < 0.35) {
      tmp.copy(baseLowGreen).lerp(baseMidWarm, elevT / 0.35);
    } else if (elevT < 0.75) {
      tmp.copy(baseMidWarm).lerp(baseHighStone, (elevT - 0.35) / 0.4);
    } else {
      tmp.copy(baseHighStone).lerp(baseSnow, (elevT - 0.75) / 0.25);
    }
    // mix in 陡坡岩 by slope
    tmp.lerp(baseSteep, slopeT * 0.55);
    colorAttr.setXYZ(i, tmp.r, tmp.g, tmp.b);
  }
  geometry.setAttribute("color", colorAttr);

  const material = opts.material ?? new MeshPhongMaterial({
    vertexColors: true,
    flatShading: opts.flatShading ?? false,
    shininess: 6
  });

  const mesh = new Mesh(geometry, material);
  mesh.position.set(centerX, 0, centerZ);
  mesh.name = `pyramid-chunk-${chunk.tier}-${chunk.chunkX}-${chunk.chunkZ}`;
  // Renderer ordering: lower tiers (closer/finer) render on top
  const tierNum = Number(chunk.tier.slice(1)); // "L0" → 0
  mesh.renderOrder = 10 - tierNum;

  return { mesh, geometry, material, chunk };
}

/** Dispose mesh resources (geometry, attributes). Material shared—don't dispose. */
export function disposePyramidChunkMesh(handle: PyramidMeshHandle): void {
  handle.geometry.dispose();
  // Don't dispose material if shared
}
