import {
  CanvasTexture,
  Color,
  DoubleSide,
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  Texture
} from "three";
import { projectGeoToWorld } from "../mapOrientation.js";
import {
  qinlingRegionBounds,
  qinlingRegionWorld
} from "../../data/qinlingRegion.js";

type LonLat = [number, number];
type PolygonRings = LonLat[][];
type Canvas2D = CanvasRenderingContext2D;

export interface LandMaskData {
  schema: "visual-china.land-mask.v1";
  polygons: PolygonRings[];
}

export interface LandMaskOptions {
  y?: number;
  color?: Color | string | number;
}

export interface LandMaskSampler {
  isLand(lon: number, lat: number): boolean;
}

const LAND_MASK_Y = -2.92;
const LAND_MASK_COLOR = new Color(0.43, 0.50, 0.32);
const LAND_MASK_TEXTURE_WIDTH = 4096;
const LAND_MASK_TEXTURE_HEIGHT = 2304;
const VECTOR_INDEX_BIN_DEG = 0.25;
const RING_EDGE_BIN_DEG = 0.25;

export function landMaskCanvasPoint(
  lon: number,
  lat: number,
  width: number,
  height: number
): [number, number] {
  const x =
    ((lon - qinlingRegionBounds.west) /
      (qinlingRegionBounds.east - qinlingRegionBounds.west)) *
    width;
  const y =
    ((qinlingRegionBounds.north - lat) /
      (qinlingRegionBounds.north - qinlingRegionBounds.south)) *
    height;
  return [x, y];
}

function worldPlaneForRegion(): { centerX: number; centerZ: number; width: number; depth: number } {
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
    centerX: (nw.x + se.x) / 2,
    centerZ: (nw.z + se.z) / 2,
    width: Math.abs(se.x - nw.x),
    depth: Math.abs(se.z - nw.z)
  };
}

function drawRing(
  context: Canvas2D,
  ring: LonLat[],
  width: number,
  height: number
): void {
  if (ring.length < 3) return;
  for (let i = 0; i < ring.length; i += 1) {
    const [x, y] = landMaskCanvasPoint(ring[i][0], ring[i][1], width, height);
    if (i === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
}

function colorToCss(color: Color | string | number): string {
  return new Color(color).getStyle();
}

function ringBounds(ring: LonLat[]): { west: number; east: number; south: number; north: number } {
  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  for (const [lon, lat] of ring) {
    if (lon < west) west = lon;
    if (lon > east) east = lon;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }
  return { west, east, south, north };
}

function containsBounds(
  bounds: { west: number; east: number; south: number; north: number },
  lon: number,
  lat: number
): boolean {
  return lon >= bounds.west && lon <= bounds.east && lat >= bounds.south && lat <= bounds.north;
}

interface IndexedEdge {
  xi: number;
  yi: number;
  xj: number;
  yj: number;
}

function pointInEdges(lon: number, lat: number, edges: IndexedEdge[]): boolean {
  let inside = false;
  for (const { xi, yi, xj, yj } of edges) {
    const intersects =
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

interface IndexedRing {
  points: LonLat[];
  bounds: { west: number; east: number; south: number; north: number };
  edgeBins: Map<number, IndexedEdge[]>;
}

interface IndexedPolygon {
  outer: IndexedRing;
  holes: IndexedRing[];
  bounds: { west: number; east: number; south: number; north: number };
}

function indexRing(ring: LonLat[]): IndexedRing {
  const edgeBins = new Map<number, IndexedEdge[]>();
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi === yj) continue;
    const edge = { xi, yi, xj, yj };
    const y0 = Math.floor(Math.min(yi, yj) / RING_EDGE_BIN_DEG);
    const y1 = Math.floor(Math.max(yi, yj) / RING_EDGE_BIN_DEG);
    for (let y = y0; y <= y1; y += 1) {
      const bucket = edgeBins.get(y);
      if (bucket) bucket.push(edge);
      else edgeBins.set(y, [edge]);
    }
  }
  return { points: ring, bounds: ringBounds(ring), edgeBins };
}

function pointInIndexedRing(lon: number, lat: number, ring: IndexedRing): boolean {
  const edges = ring.edgeBins.get(Math.floor(lat / RING_EDGE_BIN_DEG));
  return edges ? pointInEdges(lon, lat, edges) : false;
}

function createVectorLandMaskSampler(data: LandMaskData): LandMaskSampler {
  const polygons: IndexedPolygon[] = data.polygons
    .filter((rings) => rings.length > 0 && rings[0].length >= 3)
    .map((rings) => {
      const outer = indexRing(rings[0]);
      return {
        outer,
        holes: rings
          .slice(1)
          .filter((ring) => ring.length >= 3)
          .map(indexRing),
        bounds: outer.bounds
      };
    });
  const bins = new Map<string, IndexedPolygon[]>();
  const binKey = (x: number, y: number) => `${x}:${y}`;

  for (const polygon of polygons) {
    const x0 = Math.floor(polygon.bounds.west / VECTOR_INDEX_BIN_DEG);
    const x1 = Math.floor(polygon.bounds.east / VECTOR_INDEX_BIN_DEG);
    const y0 = Math.floor(polygon.bounds.south / VECTOR_INDEX_BIN_DEG);
    const y1 = Math.floor(polygon.bounds.north / VECTOR_INDEX_BIN_DEG);
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        const key = binKey(x, y);
        const bucket = bins.get(key);
        if (bucket) bucket.push(polygon);
        else bins.set(key, [polygon]);
      }
    }
  }

  return {
    isLand(lon: number, lat: number): boolean {
      const x = Math.floor(lon / VECTOR_INDEX_BIN_DEG);
      const y = Math.floor(lat / VECTOR_INDEX_BIN_DEG);
      const candidates = bins.get(binKey(x, y));
      if (!candidates) return false;
      for (const polygon of candidates) {
        if (!containsBounds(polygon.bounds, lon, lat)) continue;
        if (!pointInIndexedRing(lon, lat, polygon.outer)) continue;
        let inHole = false;
        for (const hole of polygon.holes) {
          if (containsBounds(hole.bounds, lon, lat) && pointInIndexedRing(lon, lat, hole)) {
            inHole = true;
            break;
          }
        }
        if (!inHole) return true;
      }
      return false;
    }
  };
}

function createLandMaskTexture(
  data: LandMaskData,
  color: Color | string | number = "#ffffff"
): Texture | null {
  const canvas = drawLandMaskCanvas(data, LAND_MASK_TEXTURE_WIDTH, LAND_MASK_TEXTURE_HEIGHT, color);
  if (!canvas) return null;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function drawLandMaskCanvas(
  data: LandMaskData,
  width: number,
  height: number,
  color: Color | string | number
): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = colorToCss(color);

  for (const polygon of data.polygons) {
    if (polygon.length === 0) continue;
    context.beginPath();
    for (const ring of polygon) {
      drawRing(context, ring, canvas.width, canvas.height);
    }
    context.fill("evenodd");
  }

  return canvas;
}

export function createLandMaskSamplerFromData(data: LandMaskData): LandMaskSampler | null {
  if (data.polygons.length === 0) return null;
  return createVectorLandMaskSampler(data);
}

export function createLandMaskGroupFromData(
  data: LandMaskData,
  opts: LandMaskOptions = {}
): Group {
  const group = new Group();
  group.name = "land-mask-underlay";
  const y = opts.y ?? LAND_MASK_Y;
  const color = opts.color ?? LAND_MASK_COLOR;
  const texture = createLandMaskTexture(data, color);
  const plane = worldPlaneForRegion();
  const geometry = new PlaneGeometry(plane.width, plane.depth, 1, 1);
  geometry.rotateX(-Math.PI / 2);

  const material = new MeshBasicMaterial({
    alphaTest: texture ? 0.02 : 0,
    color: texture ? 0xffffff : color,
    depthWrite: false,
    fog: false,
    map: texture,
    opacity: texture ? 1 : 0.96,
    side: DoubleSide,
    transparent: true
  });

  const mesh = new Mesh(geometry, material);
  mesh.name = "land-mask-texture";
  mesh.position.set(plane.centerX, y, plane.centerZ);
  mesh.renderOrder = -6;
  group.add(mesh);

  return group;
}

export async function createLandMaskRenderer(
  opts: LandMaskOptions & { baseUrl?: string } = {}
): Promise<Group> {
  const data = await loadLandMaskData(opts.baseUrl);
  return createLandMaskGroupFromData(data, opts);
}

export async function loadLandMaskData(baseUrl = "/data/china"): Promise<LandMaskData> {
  const response = await fetch(`${baseUrl}/land-mask.json`);
  if (!response.ok) {
    throw new Error(`failed to load land mask: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as LandMaskData;
}
