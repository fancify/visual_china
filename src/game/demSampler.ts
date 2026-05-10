import { findZoneAt } from "./cityFlattenZones.js";

export interface DemBounds {
  west: number;
  east: number;
  south: number;
  north: number;
}

export interface DemWorld {
  width: number;
  depth: number;
}

export interface DemWorldBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface DemGrid {
  columns: number;
  rows: number;
}

export interface DemLodHeightGrid {
  grid: DemGrid;
  heights: number[];
}

export interface DemLodHeights {
  L1?: DemLodHeightGrid;
  L2?: DemLodHeightGrid;
  L3?: DemLodHeightGrid;
}

export interface DemPresentation {
  waterLevel?: number;
  underpaintLevel?: number;
  globalMinHeight?: number;
  globalMaxHeight?: number;
  realPeakMeters?: number;
  visualIntent?: string;
}

export interface DemAsset {
  schemaVersion?: number;
  id?: string;
  type?: string;
  version?: number;
  regionId?: string;
  lod?: string;
  name: string;
  sourceType: string;
  generatedAt: string;
  bounds?: DemBounds;
  world: DemWorld;
  worldBounds?: DemWorldBounds;
  grid: DemGrid;
  minHeight: number;
  maxHeight: number;
  presentation?: DemPresentation;
  heights: number[];
  lodHeights?: DemLodHeights;
  riverMask: number[];
  passMask: number[];
  settlementMask: number[];
  notes?: string[];
}

interface DemAssetReference {
  id: string;
  file: string;
  grid: DemGrid;
}

interface RegionChunking {
  enabled: boolean;
  chunkColumns: number;
  chunkRows: number;
  chunkManifest: string;
}

export interface ExperienceProfile {
  coordinatePolicy: "strict-geographic";
  travelSpeedMultiplier: number;
  cameraScaleMultiplier: number;
  detailDensityMultiplier: number;
  eventDensityMultiplier: number;
}

export interface RegionManifestLike {
  id: string;
  type: "region-manifest" | "world-manifest";
  displayName?: string;
  bounds: DemBounds;
  world: DemWorld;
  lods: DemAssetReference[];
  densityClass?: string;
  coordinatePolicy?: "strict-geographic";
  geographicFootprintKm?: {
    width: number;
    depth: number;
  };
  experienceScaleMultiplier?: number;
  experienceProfile?: ExperienceProfile;
  chunking?: RegionChunking;
  poiManifest?: string;
}

export interface LoadedDemAsset {
  asset: DemAsset;
  label: string;
  requestUrl: string;
  resolvedAssetUrl: string;
  sourceKind: "asset" | "manifest";
  manifest?: RegionManifestLike;
}

type ChannelName = "heights" | "riverMask" | "passMask" | "settlementMask";

// Phase 3 全国 0.9 km：grid 升到 6225×4316 = 26.87M cells。继续用 4096 / 8M
// 会在运行期直接拒收合法资产。上限放宽到覆盖当前全国 slice，同时仍保留对
// 失控输入（譬如把 6225 写成 62250000）的硬防护。
const MAX_GRID_COLUMNS = 8192;
const MAX_GRID_ROWS = 8192;
const MAX_TOTAL_CELLS = 32 * 1024 * 1024;

// 千里江山图风格垂直夸张系数。在 sampleHeight 里统一应用，让 mesh、
// player.y、scenery、label 全部一致使用夸张后的高度，避免漂浮 / 下沉。
// 用户："地形夸张再高一倍"。1.6 → 3.2，山形比 1:1 真实拔高 220%。
// 用户："夸张程度再少一半"。2.13 / 2 ≈ 1.07，接近原始高度（无夸张）。
export const TERRAIN_VERTICAL_EXAGGERATION = 1.07;

/**
 * 把 chunk asset 的 grid 缩成 1/N（N=2 → 1.8 km/cell）。
 * world.width/depth 不变（同样面积），只是顶点变稀。
 * heights 用 2×2 average（地形平滑），mask 用 max（保留河/关隘特征）。
 *
 * 用户："Chunks 分辨率可以再调低一倍。0.9 km → 1.8 km"。运行时下采样
 * 不重建源文件——chunk JSON 还是 51×51，loaded 后 reduce 成 26×26。
 * 三角数 ~5000 → ~1300/chunk，GPU 压力大幅降。
 */
export function downsampleChunkAsset(asset: DemAsset, factor = 2): DemAsset {
  if (factor <= 1) return asset;
  const srcCols = asset.grid.columns;
  const srcRows = asset.grid.rows;
  const dstCols = Math.max(2, Math.ceil(srcCols / factor));
  const dstRows = Math.max(2, Math.ceil(srcRows / factor));

  const newHeights = new Array<number>(dstCols * dstRows);
  const newRiver = new Array<number>(dstCols * dstRows);
  const newPass = new Array<number>(dstCols * dstRows);
  const newSettle = new Array<number>(dstCols * dstRows);

  for (let row = 0; row < dstRows; row += 1) {
    const r0 = row * factor;
    const r1 = Math.min(srcRows, r0 + factor);
    for (let col = 0; col < dstCols; col += 1) {
      const c0 = col * factor;
      const c1 = Math.min(srcCols, c0 + factor);
      let hSum = 0;
      let n = 0;
      let rMax = 0;
      let pMax = 0;
      let sMax = 0;
      for (let rr = r0; rr < r1; rr += 1) {
        for (let cc = c0; cc < c1; cc += 1) {
          const idx = rr * srcCols + cc;
          hSum += asset.heights[idx]!;
          n += 1;
          rMax = Math.max(rMax, asset.riverMask[idx]!);
          pMax = Math.max(pMax, asset.passMask[idx]!);
          sMax = Math.max(sMax, asset.settlementMask[idx]!);
        }
      }
      const dstIdx = row * dstCols + col;
      newHeights[dstIdx] = n > 0 ? hSum / n : 0;
      newRiver[dstIdx] = rMax;
      newPass[dstIdx] = pMax;
      newSettle[dstIdx] = sMax;
    }
  }

  return {
    ...asset,
    grid: { columns: dstCols, rows: dstRows },
    heights: newHeights,
    lodHeights:
      asset.lodHeights === undefined
        ? undefined
        : buildRuntimeLodHeights(newHeights, dstCols, dstRows),
    riverMask: newRiver,
    passMask: newPass,
    settlementMask: newSettle
  };
}

function downsampleHeightsForLod(
  heights: number[],
  srcCols: number,
  srcRows: number,
  factor: number
): DemLodHeightGrid {
  const dstCols = Math.max(2, Math.ceil(srcCols / factor));
  const dstRows = Math.max(2, Math.ceil(srcRows / factor));
  const out = new Array<number>(dstCols * dstRows);

  for (let row = 0; row < dstRows; row += 1) {
    const r0 = row * factor;
    const r1 = Math.min(srcRows, r0 + factor);
    for (let col = 0; col < dstCols; col += 1) {
      const c0 = col * factor;
      const c1 = Math.min(srcCols, c0 + factor);
      let hSum = 0;
      let n = 0;
      for (let rr = r0; rr < r1; rr += 1) {
        for (let cc = c0; cc < c1; cc += 1) {
          hSum += heights[rr * srcCols + cc] ?? 0;
          n += 1;
        }
      }
      out[row * dstCols + col] = n > 0 ? hSum / n : 0;
    }
  }

  return {
    grid: { columns: dstCols, rows: dstRows },
    heights: out
  };
}

function buildRuntimeLodHeights(
  heights: number[],
  columns: number,
  rows: number
): DemLodHeights {
  return {
    L1: downsampleHeightsForLod(heights, columns, rows, 2),
    L2: downsampleHeightsForLod(heights, columns, rows, 4),
    L3: downsampleHeightsForLod(heights, columns, rows, 8)
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asFiniteNumber(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`DEM asset field "${fieldName}" must be a finite number.`);
  }

  return value;
}

function asString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`DEM asset field "${fieldName}" must be a non-empty string.`);
  }

  return value;
}

function validateBounds(raw: unknown, fieldName: string): DemBounds {
  if (!isRecord(raw)) {
    throw new Error(`DEM asset field "${fieldName}" must be an object.`);
  }

  const west = asFiniteNumber(raw.west, `${fieldName}.west`);
  const east = asFiniteNumber(raw.east, `${fieldName}.east`);
  const south = asFiniteNumber(raw.south, `${fieldName}.south`);
  const north = asFiniteNumber(raw.north, `${fieldName}.north`);

  if (west >= east || south >= north) {
    throw new Error(`DEM asset field "${fieldName}" has invalid geographic bounds.`);
  }

  return { west, east, south, north };
}

function validateWorld(raw: unknown): DemWorld {
  if (!isRecord(raw)) {
    throw new Error('DEM asset field "world" must be an object.');
  }

  const width = asFiniteNumber(raw.width, "world.width");
  const depth = asFiniteNumber(raw.depth, "world.depth");

  if (width <= 0 || depth <= 0) {
    throw new Error('DEM asset field "world" must use positive dimensions.');
  }

  return { width, depth };
}

function validateWorldBounds(raw: unknown, fieldName: string): DemWorldBounds {
  if (!isRecord(raw)) {
    throw new Error(`DEM asset field "${fieldName}" must be an object.`);
  }

  const minX = asFiniteNumber(raw.minX, `${fieldName}.minX`);
  const maxX = asFiniteNumber(raw.maxX, `${fieldName}.maxX`);
  const minZ = asFiniteNumber(raw.minZ, `${fieldName}.minZ`);
  const maxZ = asFiniteNumber(raw.maxZ, `${fieldName}.maxZ`);

  if (minX >= maxX || minZ >= maxZ) {
    throw new Error(`DEM asset field "${fieldName}" has invalid world bounds.`);
  }

  return { minX, maxX, minZ, maxZ };
}

function validateGrid(raw: unknown): DemGrid {
  if (!isRecord(raw)) {
    throw new Error('DEM asset field "grid" must be an object.');
  }

  const columns = asFiniteNumber(raw.columns, "grid.columns");
  const rows = asFiniteNumber(raw.rows, "grid.rows");

  if (!Number.isInteger(columns) || !Number.isInteger(rows)) {
    throw new Error('DEM asset field "grid" must use integer dimensions.');
  }

  if (columns < 2 || rows < 2) {
    throw new Error('DEM asset field "grid" must be at least 2 x 2.');
  }

  if (columns > MAX_GRID_COLUMNS || rows > MAX_GRID_ROWS) {
    throw new Error(
      `DEM asset grid is too large for the browser runtime (${columns} x ${rows}).`
    );
  }

  if (columns * rows > MAX_TOTAL_CELLS) {
    throw new Error(
      `DEM asset grid exceeds the supported browser budget (${columns * rows} cells).`
    );
  }

  return { columns, rows };
}

function validateNumericChannel(
  raw: unknown,
  fieldName: ChannelName | "lodHeights",
  expectedLength: number
): number[] {
  if (!Array.isArray(raw)) {
    throw new Error(`DEM asset field "${fieldName}" must be an array.`);
  }

  if (raw.length !== expectedLength) {
    throw new Error(
      `DEM asset field "${fieldName}" has ${raw.length} values, expected ${expectedLength}.`
    );
  }

  return raw.map((value, index) =>
    asFiniteNumber(value, `${fieldName}[${index}]`)
  );
}

function validateOptionalLodHeights(raw: unknown): DemLodHeights | undefined {
  if (raw === undefined) {
    return undefined;
  }

  if (!isRecord(raw)) {
    throw new Error('DEM asset field "lodHeights" must be an object.');
  }

  const result: DemLodHeights = {};
  for (const key of ["L1", "L2", "L3"] as const) {
    const entry = raw[key];
    if (entry === undefined) {
      continue;
    }
    if (!isRecord(entry)) {
      throw new Error(`DEM asset field "lodHeights.${key}" must be an object.`);
    }
    const grid = validateGrid(entry.grid);
    result[key] = {
      grid,
      heights: validateNumericChannel(
        entry.heights,
        "lodHeights",
        grid.columns * grid.rows
      )
    };
  }

  return result;
}

function validateOptionalNotes(raw: unknown): string[] | undefined {
  if (raw === undefined) {
    return undefined;
  }

  if (!Array.isArray(raw) || raw.some((entry) => typeof entry !== "string")) {
    throw new Error('DEM asset field "notes" must be an array of strings.');
  }

  return raw as string[];
}

function validateOptionalPresentation(raw: unknown): DemPresentation | undefined {
  if (raw === undefined) {
    return undefined;
  }

  if (!isRecord(raw)) {
    throw new Error('DEM asset field "presentation" must be an object.');
  }

  return {
    waterLevel:
      raw.waterLevel === undefined
        ? undefined
        : asFiniteNumber(raw.waterLevel, "presentation.waterLevel"),
    underpaintLevel:
      raw.underpaintLevel === undefined
        ? undefined
        : asFiniteNumber(raw.underpaintLevel, "presentation.underpaintLevel"),
    globalMinHeight:
      raw.globalMinHeight === undefined
        ? undefined
        : asFiniteNumber(raw.globalMinHeight, "presentation.globalMinHeight"),
    globalMaxHeight:
      raw.globalMaxHeight === undefined
        ? undefined
        : asFiniteNumber(raw.globalMaxHeight, "presentation.globalMaxHeight"),
    realPeakMeters:
      raw.realPeakMeters === undefined
        ? undefined
        : asFiniteNumber(raw.realPeakMeters, "presentation.realPeakMeters"),
    visualIntent:
      typeof raw.visualIntent === "string" ? raw.visualIntent : undefined
  };
}

function validateDemAsset(raw: unknown): DemAsset {
  if (!isRecord(raw)) {
    throw new Error("DEM asset response must be a JSON object.");
  }

  const name = asString(raw.name, "name");
  const sourceType = asString(raw.sourceType, "sourceType");
  const generatedAt = asString(raw.generatedAt, "generatedAt");
  const world = validateWorld(raw.world);
  const grid = validateGrid(raw.grid);
  const expectedLength = grid.columns * grid.rows;
  const minHeight = asFiniteNumber(raw.minHeight, "minHeight");
  const maxHeight = asFiniteNumber(raw.maxHeight, "maxHeight");

  if (minHeight > maxHeight) {
    throw new Error('DEM asset fields "minHeight" and "maxHeight" are inconsistent.');
  }

  const heights = validateNumericChannel(raw.heights, "heights", expectedLength);
  const riverMask = validateNumericChannel(
    raw.riverMask,
    "riverMask",
    expectedLength
  );
  const passMask = validateNumericChannel(raw.passMask, "passMask", expectedLength);
  const settlementMask = validateNumericChannel(
    raw.settlementMask,
    "settlementMask",
    expectedLength
  );

  const firstHeight = heights[0];

  if (firstHeight !== undefined && heights.every((value) => value === firstHeight)) {
    throw new Error(
      'DEM asset "heights" channel is constant. This usually indicates a broken export.'
    );
  }

  return {
    schemaVersion:
      typeof raw.schemaVersion === "number" ? raw.schemaVersion : undefined,
    id: typeof raw.id === "string" ? raw.id : undefined,
    type: typeof raw.type === "string" ? raw.type : undefined,
    version: typeof raw.version === "number" ? raw.version : undefined,
    regionId: typeof raw.regionId === "string" ? raw.regionId : undefined,
    lod: typeof raw.lod === "string" ? raw.lod : undefined,
    name,
    sourceType,
    generatedAt,
    bounds: raw.bounds === undefined ? undefined : validateBounds(raw.bounds, "bounds"),
    world,
    worldBounds:
      raw.worldBounds === undefined
        ? undefined
        : validateWorldBounds(raw.worldBounds, "worldBounds"),
    grid,
    minHeight,
    maxHeight,
    presentation: validateOptionalPresentation(raw.presentation),
    heights,
    lodHeights: validateOptionalLodHeights(raw.lodHeights),
    riverMask,
    passMask,
    settlementMask,
    notes: validateOptionalNotes(raw.notes)
  };
}

function isManifestLike(raw: unknown): raw is RegionManifestLike {
  if (!isRecord(raw)) {
    return false;
  }

  return (
    (raw.type === "region-manifest" || raw.type === "world-manifest") &&
    Array.isArray(raw.lods)
  );
}

function validateManifest(raw: unknown): RegionManifestLike {
  if (!isManifestLike(raw)) {
    throw new Error("Unsupported DEM manifest format.");
  }

  const id = asString(raw.id, "id");
  const bounds = validateBounds(raw.bounds, "bounds");
  const world = validateWorld(raw.world);

  const lods = raw.lods.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`Manifest lod entry ${index} must be an object.`);
    }

    return {
      id: asString(entry.id, `lods[${index}].id`),
      file: asString(entry.file, `lods[${index}].file`),
      grid: validateGrid(entry.grid)
    };
  });

  if (lods.length === 0) {
    throw new Error("DEM manifest must contain at least one lod entry.");
  }

  return {
    id,
    type: raw.type,
    displayName:
      typeof raw.displayName === "string" && raw.displayName.trim().length > 0
        ? raw.displayName
        : undefined,
    bounds,
    world,
    lods,
    densityClass:
      typeof raw.densityClass === "string" ? raw.densityClass : undefined,
    coordinatePolicy:
      raw.coordinatePolicy === "strict-geographic" ? raw.coordinatePolicy : undefined,
    geographicFootprintKm:
      isRecord(raw.geographicFootprintKm) &&
      typeof raw.geographicFootprintKm.width === "number" &&
      typeof raw.geographicFootprintKm.depth === "number"
        ? {
            width: raw.geographicFootprintKm.width,
            depth: raw.geographicFootprintKm.depth
          }
        : undefined,
    experienceScaleMultiplier:
      typeof raw.experienceScaleMultiplier === "number"
        ? raw.experienceScaleMultiplier
        : undefined,
    experienceProfile:
      isRecord(raw.experienceProfile) &&
      raw.experienceProfile.coordinatePolicy === "strict-geographic" &&
      typeof raw.experienceProfile.travelSpeedMultiplier === "number" &&
      typeof raw.experienceProfile.cameraScaleMultiplier === "number" &&
      typeof raw.experienceProfile.detailDensityMultiplier === "number" &&
      typeof raw.experienceProfile.eventDensityMultiplier === "number"
        ? {
            coordinatePolicy: "strict-geographic",
            travelSpeedMultiplier: raw.experienceProfile.travelSpeedMultiplier,
            cameraScaleMultiplier: raw.experienceProfile.cameraScaleMultiplier,
            detailDensityMultiplier: raw.experienceProfile.detailDensityMultiplier,
            eventDensityMultiplier: raw.experienceProfile.eventDensityMultiplier
          }
        : undefined,
    chunking:
      isRecord(raw.chunking) &&
      typeof raw.chunking.enabled === "boolean" &&
      typeof raw.chunking.chunkColumns === "number" &&
      typeof raw.chunking.chunkRows === "number" &&
      typeof raw.chunking.chunkManifest === "string"
        ? {
            enabled: raw.chunking.enabled,
            chunkColumns: raw.chunking.chunkColumns,
            chunkRows: raw.chunking.chunkRows,
            chunkManifest: raw.chunking.chunkManifest
          }
        : undefined,
    poiManifest: typeof raw.poiManifest === "string" ? raw.poiManifest : undefined
  };
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to load terrain JSON from ${url} (${response.status}).`);
  }

  return (await response.json()) as unknown;
}

function resolveRelativeUrl(baseUrl: string, relativePath: string): string {
  return new URL(relativePath, new URL(baseUrl, window.location.href)).toString();
}

export function resolveTerrainAssetRequest(
  locationSearch: string,
  fallbackUrl: string
): string {
  const params = new URLSearchParams(locationSearch);
  const requested = params.get("dem");

  if (!requested) {
    return fallbackUrl;
  }

  return requested.trim() || fallbackUrl;
}

export async function loadDemAsset(requestUrl: string): Promise<LoadedDemAsset> {
  const raw = await fetchJson(requestUrl);

  if (isManifestLike(raw)) {
    const manifest = validateManifest(raw);
    const primaryLod = manifest.lods[0]!;
    const assetUrl = resolveRelativeUrl(requestUrl, primaryLod.file);
    const asset = validateDemAsset(await fetchJson(assetUrl));

    return {
      asset,
      label: manifest.displayName ?? manifest.id,
      requestUrl,
      resolvedAssetUrl: assetUrl,
      sourceKind: "manifest",
      manifest
    };
  }

  const asset = validateDemAsset(raw);

  return {
    asset,
    label: asset.name,
    requestUrl,
    resolvedAssetUrl: requestUrl,
    sourceKind: "asset"
  };
}

/**
 * 共同接口：TerrainSampler 和 CompositeTerrainSampler 都实现。
 * 工具函数应接收这个 union，让 caller 想用哪种 sampler 都行。
 */
export interface TerrainSamplerLike {
  readonly asset: DemAsset;
  sampleHeight(x: number, z: number): number;
  sampleHeightLod(x: number, z: number, lod: 0 | 1 | 2 | 3): number;
  sampleSurfaceHeight(x: number, z: number): number;
  sampleRiver(x: number, z: number): number;
  samplePass(x: number, z: number): number;
  sampleSettlement(x: number, z: number): number;
  sampleSlope(x: number, z: number): number;
  setHeightOverride(
    fn: ((originalY: number, x: number, z: number) => number) | null
  ): void;
  worldPositionForSample(x: number, z: number): { x: number; z: number };
}

export class TerrainSampler {
  readonly asset: DemAsset;
  private heightOverride: ((originalY: number, x: number, z: number) => number) | null = null;

  constructor(asset: DemAsset) {
    this.asset = asset;
  }

  sampleHeight(x: number, z: number): number {
    const rawY = this.sampleChannel("heights", x, z);
    const overridden = this.applyHeightOverride(rawY, x, z);
    // Phase 2 全国扩张：5600×3900 km 画幅下，绝对 game height（~12 单位）
    // 相对世界尺寸（1711 单位）显得过低，山墙感丢失。1.6× 垂直夸张同时
    // 抬升 player.y / scenery / label，让所有渲染层保持一致。
    // 改这个常量同步影响：mesh, player.position.y, 树/城贴地, 标签高度。
    return overridden * TERRAIN_VERTICAL_EXAGGERATION;
  }

  /**
   * 按指定 LOD 采样高度。lod=0 是 full mesh；lod=1/2/3 使用 chunk
   * asset schema v2 的 lodHeights。旧 schema 没有 lodHeights 时回退 L0。
   */
  sampleHeightLod(x: number, z: number, lod: 0 | 1 | 2 | 3): number {
    if (lod === 0) {
      return this.sampleHeight(x, z);
    }

    const grid = this.lodGrid(lod);
    if (!grid) {
      return this.sampleHeight(x, z);
    }

    const rawY = this.sampleHeightGrid(grid, x, z);
    return this.applyHeightOverride(rawY, x, z) * TERRAIN_VERTICAL_EXAGGERATION;
  }

  // 跟 Three.js PlaneGeometry 一致的 triangular interp。
  // bilinear (sampleHeight 用的) 用 4 个 corner，但 GPU 渲染一个 cell 只用
  // 它的 2 个三角形 (3 corner)。河谷雕刻把单 cell 强压低后，bilinear 跟
  // triangular 在同一 (x,z) 可以差 0.3-0.8 单元 → trees 飘 / cities 沉。
  // 树 / 城 / 牌位 / 任何想"贴在 mesh 表面"的物件应该用这个，不用 sampleHeight。
  //
  // PlaneGeometry 三角剖分（src 实测）：每 cell 对角线 (0,1)→(1,0)，
  // 上三角 = a,b,d = (0,0)(0,1)(1,0)；下三角 = b,c,d = (0,1)(1,1)(1,0)。
  sampleSurfaceHeight(x: number, z: number): number {
    const data = this.asset.heights;
    const { columns, rows } = this.asset.grid;
    const halfWidth = this.asset.world.width * 0.5;
    const halfDepth = this.asset.world.depth * 0.5;
    const u = clamp((x + halfWidth) / this.asset.world.width, 0, 1);
    const v = clamp((z + halfDepth) / this.asset.world.depth, 0, 1);
    const gx = u * (columns - 1);
    const gy = v * (rows - 1);
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const x1 = Math.min(x0 + 1, columns - 1);
    const y1 = Math.min(y0 + 1, rows - 1);
    const tx = gx - x0;
    const ty = gy - y0;
    const A = data[y0 * columns + x0] ?? 0; // (0,0)
    const B = data[y1 * columns + x0] ?? A; // (0,1)
    const C = data[y1 * columns + x1] ?? A; // (1,1)
    const D = data[y0 * columns + x1] ?? A; // (1,0)
    let raw;
    if (tx + ty <= 1) {
      // 上三角 a,b,d = (0,0)(0,1)(1,0)
      raw = (1 - tx - ty) * A + ty * B + tx * D;
    } else {
      // 下三角 b,c,d = (0,1)(1,1)(1,0)
      raw = (1 - tx) * B + (tx + ty - 1) * C + (1 - ty) * D;
    }
    // 跟 sampleHeight 同步应用垂直夸张，让贴地物（树/城/牌位）跟 mesh 一致。
    return this.applyHeightOverride(raw, x, z) * TERRAIN_VERTICAL_EXAGGERATION;
  }

  sampleRiver(x: number, z: number): number {
    const world = this.worldPositionForSample(x, z);
    if (findZoneAt(world.x, world.z)) {
      return 0;
    }
    return this.sampleChannel("riverMask", x, z);
  }

  samplePass(x: number, z: number): number {
    return this.sampleChannel("passMask", x, z);
  }

  sampleSettlement(x: number, z: number): number {
    return this.sampleChannel("settlementMask", x, z);
  }

  sampleSlope(x: number, z: number): number {
    const delta = 0.75;
    const dx = this.sampleHeight(x + delta, z) - this.sampleHeight(x - delta, z);
    const dz = this.sampleHeight(x, z + delta) - this.sampleHeight(x, z - delta);
    return Math.min(Math.hypot(dx, dz) / 4.2, 1);
  }

  setHeightOverride(fn: ((originalY: number, x: number, z: number) => number) | null): void {
    this.heightOverride = fn;
  }

  worldPositionForSample(x: number, z: number): { x: number; z: number } {
    const worldBounds = this.asset.worldBounds;
    if (!worldBounds) {
      return { x, z };
    }

    return {
      x: x + (worldBounds.minX + worldBounds.maxX) * 0.5,
      z: z + (worldBounds.minZ + worldBounds.maxZ) * 0.5
    };
  }

  private applyHeightOverride(originalY: number, x: number, z: number): number {
    if (!this.heightOverride) {
      return originalY;
    }

    const world = this.worldPositionForSample(x, z);
    return this.heightOverride(originalY, world.x, world.z);
  }

  private sampleChannel(channel: ChannelName, x: number, z: number): number {
    const data = this.asset[channel];
    const { columns, rows } = this.asset.grid;
    return this.sampleGrid(data, columns, rows, x, z);
  }

  private lodGrid(lod: 1 | 2 | 3): DemLodHeightGrid | null {
    const key = `L${lod}` as keyof DemLodHeights;
    return this.asset.lodHeights?.[key] ?? null;
  }

  private sampleHeightGrid(grid: DemLodHeightGrid, x: number, z: number): number {
    return this.sampleGrid(grid.heights, grid.grid.columns, grid.grid.rows, x, z);
  }

  private sampleGrid(
    data: number[],
    columns: number,
    rows: number,
    x: number,
    z: number
  ): number {
    const halfWidth = this.asset.world.width * 0.5;
    const halfDepth = this.asset.world.depth * 0.5;

    const u = clamp((x + halfWidth) / this.asset.world.width, 0, 1);
    // 新 mapOrientation 契约：北 = -Z，所以 z 越小 → row 越小（DEM 第 0 行 = 最北）。
    const v = clamp((z + halfDepth) / this.asset.world.depth, 0, 1);

    const gx = u * (columns - 1);
    const gy = v * (rows - 1);

    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const x1 = Math.min(x0 + 1, columns - 1);
    const y1 = Math.min(y0 + 1, rows - 1);

    const tx = gx - x0;
    const ty = gy - y0;

    const a = data[y0 * columns + x0] ?? 0;
    const b = data[y0 * columns + x1] ?? a;
    const c = data[y1 * columns + x0] ?? a;
    const d = data[y1 * columns + x1] ?? a;

    return lerp(lerp(a, b, tx), lerp(c, d, tx), ty);
  }
}

interface ChunkSamplerEntry {
  sampler: TerrainSampler;
  bounds: DemWorldBounds;
  centerX: number;
  centerZ: number;
}

/**
 * 复合地形 sampler：base（L1/L2）+ 已装载 chunks 的统一查询门面。
 *
 * 调用 sampleHeight(worldX, worldZ) 时：
 *   1. 遍历 chunks，找出 worldX/worldZ 落在哪个 chunk 的 worldBounds 内
 *   2. 命中：world 坐标转 chunk-local 后调 chunk.sampler.sample*
 *   3. 没命中：回落 base.sampler
 *
 * 解决"建筑/水/POI 用 L1 sampler 算高度，跟 chunks 实际渲染 mesh 不对齐"
 * 的核心。所有外部消费者用 composite 后，无论 chunks 装/卸，sample 都返回
 * 当前可见的最高分辨率高度。
 *
 * `setHeightOverride` 仍走 base（city flatten zones 是全局逻辑，不该被 chunk 切碎）。
 * `worldPositionForSample` 走 base（POI ID hash 等需要稳定坐标）。
 */
// extends TerrainSampler 让 composite 在结构上 = TerrainSampler，
// 所有现有 `function f(sampler: TerrainSampler)` 都接受 composite。
// 覆盖 sample 方法走 chunk-aware 路径，未覆盖的（asset / private 内部）走 super。
export class CompositeTerrainSampler extends TerrainSampler {
  readonly base: TerrainSampler;
  private chunkEntries = new Map<string, ChunkSamplerEntry>();
  private lastHitChunk: ChunkSamplerEntry | null = null;
  private debugResolveHits = 0;
  private debugResolveMisses = 0;
  private debugLastLogMs = 0;

  constructor(base: TerrainSampler) {
    super(base.asset);
    this.base = base;
  }

  registerChunk(
    chunkId: string,
    sampler: TerrainSampler,
    bounds: DemWorldBounds
  ): void {
    const centerX = (bounds.minX + bounds.maxX) * 0.5;
    const centerZ = (bounds.minZ + bounds.maxZ) * 0.5;
    this.chunkEntries.set(chunkId, { sampler, bounds, centerX, centerZ });
  }

  unregisterChunk(chunkId: string): void {
    const entry = this.chunkEntries.get(chunkId) ?? null;
    this.chunkEntries.delete(chunkId);
    if (entry && this.lastHitChunk === entry) {
      this.lastHitChunk = null;
    }
  }

  /** 查 (worldX, worldZ) 是否在某个已装载 chunk 内，返回 chunk entry 或 null。 */
  private resolveChunk(worldX: number, worldZ: number): ChunkSamplerEntry | null {
    if (this.lastHitChunk && chunkEntryContains(this.lastHitChunk, worldX, worldZ)) {
      this.debugResolveHits += 1;
      this.maybeLogResolveCacheStats();
      return this.lastHitChunk;
    }

    for (const entry of this.chunkEntries.values()) {
      if (chunkEntryContainsHalfOpen(entry, worldX, worldZ)) {
        this.lastHitChunk = entry;
        this.debugResolveMisses += 1;
        this.maybeLogResolveCacheStats();
        return entry;
      }
    }
    for (const entry of this.chunkEntries.values()) {
      if (chunkEntryContains(entry, worldX, worldZ)) {
        this.lastHitChunk = entry;
        this.debugResolveMisses += 1;
        this.maybeLogResolveCacheStats();
        return entry;
      }
    }
    this.lastHitChunk = null;
    this.debugResolveMisses += 1;
    this.maybeLogResolveCacheStats();
    return null;
  }

  private maybeLogResolveCacheStats(): void {
    if (!isDemSamplerDevMode()) {
      return;
    }
    const now = performance.now();
    if (now - this.debugLastLogMs < 5000) {
      return;
    }
    const total = this.debugResolveHits + this.debugResolveMisses;
    if (total === 0) {
      return;
    }
    console.info(
      `[terrain] resolveChunk lastHit cache: ${this.debugResolveHits}/${total} hits ` +
        `(${Math.round((this.debugResolveHits / total) * 100)}%)`
    );
    this.debugResolveHits = 0;
    this.debugResolveMisses = 0;
    this.debugLastLogMs = now;
  }

  sampleHeight(x: number, z: number): number {
    const chunk = this.resolveChunk(x, z);
    if (chunk) {
      return chunk.sampler.sampleHeight(x - chunk.centerX, z - chunk.centerZ);
    }
    return this.base.sampleHeight(x, z);
  }

  sampleHeightLod(x: number, z: number, lod: 0 | 1 | 2 | 3): number {
    const chunk = this.resolveChunk(x, z);
    if (chunk) {
      return chunk.sampler.sampleHeightLod(x - chunk.centerX, z - chunk.centerZ, lod);
    }
    return this.base.sampleHeightLod(x, z, lod);
  }

  sampleSurfaceHeight(x: number, z: number): number {
    const chunk = this.resolveChunk(x, z);
    if (chunk) {
      return chunk.sampler.sampleSurfaceHeight(x - chunk.centerX, z - chunk.centerZ);
    }
    return this.base.sampleSurfaceHeight(x, z);
  }

  sampleRiver(x: number, z: number): number {
    const chunk = this.resolveChunk(x, z);
    if (chunk) {
      return chunk.sampler.sampleRiver(x - chunk.centerX, z - chunk.centerZ);
    }
    return this.base.sampleRiver(x, z);
  }

  samplePass(x: number, z: number): number {
    const chunk = this.resolveChunk(x, z);
    if (chunk) {
      return chunk.sampler.samplePass(x - chunk.centerX, z - chunk.centerZ);
    }
    return this.base.samplePass(x, z);
  }

  sampleSettlement(x: number, z: number): number {
    const chunk = this.resolveChunk(x, z);
    if (chunk) {
      return chunk.sampler.sampleSettlement(x - chunk.centerX, z - chunk.centerZ);
    }
    return this.base.sampleSettlement(x, z);
  }

  sampleSlope(x: number, z: number): number {
    const delta = 0.75;
    const dx =
      this.sampleHeight(x + delta, z) - this.sampleHeight(x - delta, z);
    const dz =
      this.sampleHeight(x, z + delta) - this.sampleHeight(x, z - delta);
    return Math.min(Math.hypot(dx, dz) / 4.2, 1);
  }

  setHeightOverride(
    fn: ((originalY: number, x: number, z: number) => number) | null
  ): void {
    this.base.setHeightOverride(fn);
  }

  worldPositionForSample(x: number, z: number): { x: number; z: number } {
    return this.base.worldPositionForSample(x, z);
  }
}

function chunkEntryContains(
  entry: ChunkSamplerEntry,
  worldX: number,
  worldZ: number
): boolean {
  return (
    worldX >= entry.bounds.minX &&
    worldX <= entry.bounds.maxX &&
    worldZ >= entry.bounds.minZ &&
    worldZ <= entry.bounds.maxZ
  );
}

function chunkEntryContainsHalfOpen(
  entry: ChunkSamplerEntry,
  worldX: number,
  worldZ: number
): boolean {
  return (
    worldX >= entry.bounds.minX &&
    worldX < entry.bounds.maxX &&
    worldZ >= entry.bounds.minZ &&
    worldZ < entry.bounds.maxZ
  );
}

function isDemSamplerDevMode(): boolean {
  return globalThis.window?.HUD_DEBUG === true;
}
