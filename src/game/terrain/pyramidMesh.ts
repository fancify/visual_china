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

const VERTICAL_EXAGGERATION = 1.07;
const VERTICAL_SCALE = 110; // elevation_m / 110 = world Y units (跟 demSampler.ts 同)
const SEA_LEVEL_FALLBACK = 0;

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

  // PlaneGeometry: (width, depth, widthSegments, depthSegments)
  // 256×256 cells → 255×255 segments
  const geometry = new PlaneGeometry(
    worldWidth,
    worldDepth,
    cellsPerChunk - 1,
    cellsPerChunk - 1
  );
  geometry.rotateX(-Math.PI / 2);

  // Lift each vertex Y by sampled heights
  const positionAttr = geometry.attributes.position as BufferAttribute;
  // PlaneGeometry vertex order after rotateX:
  //   row 0 at -depth/2 (north in world? need to check)
  //   vertex(c, r) at index r * cellsPerChunk + c
  //
  // PlaneGeometry default: y axis points up; widthSegments along x, heightSegments along original y
  // After rotateX(-PI/2): original y axis becomes z; row 0 is at -depth/2 (south after rotate),
  // row last at +depth/2.
  // But chunk heights[r=0] is the NORTH cell. So we flip row index:
  for (let r = 0; r < cellsPerChunk; r += 1) {
    for (let c = 0; c < cellsPerChunk; c += 1) {
      const vertIdx = r * cellsPerChunk + c;
      // chunk heights row 0 = north; mesh vertex row 0 after rotateX(-PI/2) = ?
      // PlaneGeometry segments y goes from -depth/2 to +depth/2 (before rotate).
      // After rotateX(-π/2): y → -z (rotation -π/2 around X turns +Y into +Z? actually into -Z).
      // Reset: rotateX(-π/2) maps (x, y, 0) to (x, 0, -y). So original y=+depth/2 → world z=-depth/2 (north).
      // So vertex row 0 (smallest original y = -depth/2) → world z=+depth/2 = south. We need to flip.
      const chunkRow = cellsPerChunk - 1 - r; // flip
      const chunkCol = c;
      const elev = heights[chunkRow * cellsPerChunk + chunkCol];
      const worldY = Number.isFinite(elev)
        ? (elev / VERTICAL_SCALE) * VERTICAL_EXAGGERATION
        : SEA_LEVEL_FALLBACK;
      positionAttr.setY(vertIdx, worldY);
    }
  }
  positionAttr.needsUpdate = true;
  geometry.computeVertexNormals();

  // Default vertex colors based on elevation (placeholder; material shader will replace)
  const colorAttr = new BufferAttribute(new Float32Array(positionAttr.count * 3), 3);
  const baseLow = new Color(0.55, 0.62, 0.45); // 平原绿
  const baseMid = new Color(0.66, 0.58, 0.42); // 丘陵土黄
  const baseHigh = new Color(0.88, 0.86, 0.82); // 雪山白
  const tmp = new Color();
  for (let i = 0; i < positionAttr.count; i += 1) {
    const y = positionAttr.getY(i);
    const t = Math.max(0, Math.min(1, y / 30)); // 0 at sea, 1 at ~3300m
    if (t < 0.5) {
      tmp.copy(baseLow).lerp(baseMid, t * 2);
    } else {
      tmp.copy(baseMid).lerp(baseHigh, (t - 0.5) * 2);
    }
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
