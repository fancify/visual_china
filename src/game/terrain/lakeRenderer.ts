// terrain/lakeRenderer.ts —
//
// Loads filtered China lakes (Natural Earth 10m) and renders flat polygon Meshes.
// 每个 lake mesh 位 Y 由 sampler 查询 terrain 海拔后定位 (青海湖 ~6.8u, 鄱阳湖 ~0.03u
// 等). Sampler 返回 NaN 时 fallback Y=0 暂时浮空, 等对应 chunk 加载后异步刷新.
//
// Source: public/data/lakes/china-lakes.json
//          (built by scripts/build-china-lakes.mjs from data/natural-earth/ne_10m_lakes.geojson)

import {
  DoubleSide,
  Group,
  Mesh,
  Shape,
  ShapeGeometry
} from "three";
import { projectGeoToWorld } from "../mapOrientation.js";
import { createWaterSurfaceMaterial } from "../waterSurfaceShader.js";
import {
  qinlingRegionBounds,
  qinlingRegionWorld
} from "../../data/qinlingRegion.js";
import type { PyramidSampler } from "./pyramidSampler.js";
import {
  LAKE_WATER_COLOR,
  LAKE_WATER_OPACITY,
  LAKE_WATER_SHIMMER
} from "./waterStyle.js";

interface LakeFeature {
  type: "Feature";
  properties: { name: string | null; nameAlt: string | null; scalerank: number | null };
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
}

interface LakeBundle {
  features: LakeFeature[];
}

export interface LakeMaskSampler {
  isWater(lon: number, lat: number): boolean;
}

export interface LakeRendererOptions {
  baseUrl?: string;
  /** sampler 用来查 terrain 海拔. 不传则全 lake fallback 海平面 Y=0 */
  sampler?: PyramidSampler;
  /** fallback Y 当 sampler 返回 NaN (chunk 未加载) — 默认 0 (海平面) */
  fallbackY?: number;
  /** lake 海拔再加这个常量, 略浮在地形上避免 Z-fighting — 默认 +0.05u (~25m) */
  surfaceLift?: number;
  /** lake fill color (Tang/Wikipedia "lake blue") */
  color?: number;
  /** opacity 0-1, default 0.85 */
  opacity?: number;
}

export interface LakeRendererHandle {
  group: Group;
  lakeCount: number;
  waterMaskSampler: LakeMaskSampler;
  /** 推进湖面细微波光时间。 */
  setTime(time: number): void;
  /** 异步刷新所有 lake Y — 调用此函数当 terrain chunks 加载完, sampler 能返回有效值 */
  refreshSurfaceY(): void;
  dispose(): void;
}

interface LakeMeshEntry {
  mesh: Mesh;
  /** 用 first ring 的 centroid 算 — 用于 sampler 查 Y */
  centroidLon: number;
  centroidLat: number;
}

interface IndexedLakePolygon {
  bbox: { west: number; east: number; south: number; north: number };
  rings: number[][][];
}

function ringBbox(ring: number[][]): IndexedLakePolygon["bbox"] {
  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  for (const [lon, lat] of ring) {
    west = Math.min(west, lon);
    east = Math.max(east, lon);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  return { west, east, south, north };
}

function pointInRing(lon: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersects =
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInPolygon(lon: number, lat: number, rings: number[][][]): boolean {
  if (!rings.length || !pointInRing(lon, lat, rings[0])) return false;
  for (let i = 1; i < rings.length; i += 1) {
    if (pointInRing(lon, lat, rings[i])) return false;
  }
  return true;
}

export function createLakeMaskSamplerFromBundle(bundle: LakeBundle): LakeMaskSampler {
  const polygons: IndexedLakePolygon[] = [];
  for (const feature of bundle.features) {
    const polys = feature.geometry.type === "Polygon"
      ? [feature.geometry.coordinates as number[][][]]
      : (feature.geometry.coordinates as number[][][][]);
    for (const rings of polys) {
      if (!rings.length || rings[0].length < 3) continue;
      polygons.push({ bbox: ringBbox(rings[0]), rings });
    }
  }

  return {
    isWater(lon: number, lat: number): boolean {
      for (const polygon of polygons) {
        const b = polygon.bbox;
        if (lon < b.west || lon > b.east || lat < b.south || lat > b.north) continue;
        if (pointInPolygon(lon, lat, polygon.rings)) return true;
      }
      return false;
    }
  };
}

export async function createLakeRenderer(
  opts: LakeRendererOptions = {}
): Promise<LakeRendererHandle> {
  const baseUrl = opts.baseUrl ?? "/data/lakes";
  const sampler = opts.sampler;
  const fallbackY = opts.fallbackY ?? 0;
  const surfaceLift = opts.surfaceLift ?? 0.05;
  const color = opts.color ?? LAKE_WATER_COLOR.getHex();
  const opacity = opts.opacity ?? LAKE_WATER_OPACITY;

  const resp = await fetch(`${baseUrl}/china-lakes.json`);
  if (!resp.ok) throw new Error(`lake bundle fetch failed: HTTP ${resp.status}`);
  const bundle = (await resp.json()) as LakeBundle;

  const group = new Group();
  group.name = "lakes";

  const waterSurface = createWaterSurfaceMaterial({
    baseColor: color,
    opacity,
    shimmerStrength: LAKE_WATER_SHIMMER
  });
  const material = waterSurface.material;
  material.side = DoubleSide;
  group.userData.waterSurface = waterSurface;

  function toWorldXZ(lon: number, lat: number): { x: number; z: number } {
    return projectGeoToWorld({ lat, lon }, qinlingRegionBounds, qinlingRegionWorld);
  }

  function ringCentroid(ring: number[][]): { lon: number; lat: number } {
    let sx = 0;
    let sy = 0;
    for (const p of ring) {
      sx += p[0];
      sy += p[1];
    }
    return { lon: sx / ring.length, lat: sy / ring.length };
  }

  const entries: LakeMeshEntry[] = [];

  function buildLake(rings: number[][][]): LakeMeshEntry | null {
    if (!rings || rings.length === 0) return null;
    const outer = rings[0];
    if (outer.length < 3) return null;
    const shape = new Shape();
    for (let i = 0; i < outer.length; i += 1) {
      const w = toWorldXZ(outer[i][0], outer[i][1]);
      if (i === 0) shape.moveTo(w.x, w.z);
      else shape.lineTo(w.x, w.z);
    }
    for (let h = 1; h < rings.length; h += 1) {
      const hole = rings[h];
      if (hole.length < 3) continue;
      const holeShape = new Shape();
      for (let i = 0; i < hole.length; i += 1) {
        const w = toWorldXZ(hole[i][0], hole[i][1]);
        if (i === 0) holeShape.moveTo(w.x, w.z);
        else holeShape.lineTo(w.x, w.z);
      }
      shape.holes.push(holeShape);
    }
    const geom = new ShapeGeometry(shape);
    // 注意: rotateX(+π/2) 不是 -π/2. ShapeGeometry vertex 存 (X, Y=worldZ, 0),
    // -π/2 会让 new Z = -worldZ → 全湖南北翻 (Tai Hu 31°N 翻到 41°N 北京附近 bug).
    // +π/2 旋转矩阵: new Z = +worldZ, 保留 lat 方向.
    geom.rotateX(Math.PI / 2);
    const mesh = new Mesh(geom, material);
    mesh.renderOrder = 5;

    const c = ringCentroid(outer);
    let surfaceY = fallbackY;
    if (sampler) {
      const y = sampler.sampleHeightWorld(toWorldXZ(c.lon, c.lat).x, toWorldXZ(c.lon, c.lat).z);
      if (Number.isFinite(y)) surfaceY = y + surfaceLift;
    }
    mesh.position.y = surfaceY;
    return { mesh, centroidLon: c.lon, centroidLat: c.lat };
  }

  for (const f of bundle.features) {
    const polys = f.geometry.type === "Polygon"
      ? [f.geometry.coordinates as number[][][]]
      : (f.geometry.coordinates as number[][][][]);
    for (const poly of polys) {
      const entry = buildLake(poly);
      if (!entry) continue;
      entry.mesh.name = f.properties.name ?? "lake";
      // store scalerank for camera-altitude LOD filter (鸟瞰只显示 rank ≤ 2 等)
      entry.mesh.userData.scalerank = f.properties.scalerank ?? 99;
      group.add(entry.mesh);
      entries.push(entry);
    }
  }

  function refreshSurfaceY(): void {
    if (!sampler) return;
    for (const e of entries) {
      const wp = toWorldXZ(e.centroidLon, e.centroidLat);
      const y = sampler.sampleHeightWorld(wp.x, wp.z);
      if (Number.isFinite(y)) {
        e.mesh.position.y = y + surfaceLift;
      }
    }
  }

  function dispose(): void {
    group.traverse((obj) => {
      const m = obj as Mesh;
      m.geometry?.dispose();
    });
    material.dispose();
  }

  return {
    group,
    lakeCount: entries.length,
    waterMaskSampler: createLakeMaskSamplerFromBundle(bundle),
    setTime(time) {
      waterSurface.setTime(time);
    },
    refreshSurfaceY,
    dispose
  };
}
