// EpochManifest — S4 (2026-05-11)
//
// 时间切片 manifest：让"现代版"和"唐天宝十四年 (755)"等不同 epoch 在同一
// 运行时下切换。地形 (DEM) 复用现代 1800m 母版，但 hydrography/settlements/
// routes/poi/visualProfile/landmarkHierarchy 全部按 epoch 独立 author。
//
// 设计原则 (codex × Claude round 2):
//   - SurfaceProvider 是 epoch schema 的输入；切 epoch 切的是 manifest 后的数据
//   - LandmarkHierarchy 把 BotW Triangle Rule (gravityWell/large/medium/small) 数据化
//   - VisualProfile 按 biome × weather × season cross product 调色，不做 24 套独立 shader
//
// S4a (本 commit): schema 定义 + modern/tang-tianbao-14 manifest skeleton + 测试
// S4b: 填 Tang 实际水系 (黄河北流/济水独流/隋唐运河/淮河) + 唐代 POI/驿道
// S4c (optional): qinling* 文件 → region* rename

// ─── 基础类型 ─────────────────────────────────────────────────────

export interface GeoBounds {
  west: number;
  east: number;
  south: number;
  north: number;
}

export interface WorldDimensions {
  width: number;
  depth: number;
}

export interface ProjectionSpec {
  bounds: GeoBounds;
  world: WorldDimensions;
  /** "strict-geographic" — lat/lon × constant；与 mapOrientation 契约一致 */
  policy: "strict-geographic";
}

// ─── Layer specs (用 path references 而非 inline 数据) ─────────────────

export interface TerrainLayerSpec {
  /** region manifest path — runtime fetch 后递归加载 chunk manifest + POI manifest */
  manifest: string;
  /** 整区底图 LOD asset (slice DEM) */
  baseLod?: string;
}

export interface HydrographyLayerSpec {
  /** 主水系 features (curated)；polylines + lake polygons */
  primary: string;
  /** OSM 现代水系导入层（modern epoch only）；Tang epoch 可省 */
  osmEvidence?: string;
  /** Tang 特定水系：黄河故道、济水、隋唐运河、淮河独流 (S4b 填充) */
  tangOverrides?: string;
}

export interface SettlementLayerSpec {
  /** 城市列表 (lat/lon + tier + Tang-correct name)；S4b 把 tang-cities 单独迁 JSON */
  cities: string;
}

export interface RouteLayerSpec {
  /** 古道/驿道 polyline 集合 + label anchor + revealIntent */
  routes: string;
}

export interface PoiLayerSpec {
  /** POI manifest (景点/考古/民生)；epoch 切换时整套换 */
  manifest: string;
  /** 富文本/历史描述内容；可选 */
  content?: string;
}

// ─── LandmarkHierarchy (BotW Triangle Rule, codex round 3) ─────────

export type LandmarkVisualForm =
  | "peak" | "ridge" | "tower" | "city-wall"
  | "pass" | "tree" | "temple";

export type LandmarkVisibility = "far" | "mid" | "near";

export type LandmarkRevealRole =
  | "anchor"          // 永远可见的导航锚 (gravityWell)
  | "occluder"        // 用于 partial occlusion 制造渐进揭示
  | "reward"          // 玩家走到该看的目标
  | "turning-point";  // 改变玩家路径方向的拐点

export interface LandmarkRef {
  /** id 引用 cities/poi/routes 里的某个 entry */
  id: string;
  /** display label，可与 entry 默认不同 */
  label?: string;
}

export interface LandmarkNode extends LandmarkRef {
  geo: { lat: number; lon: number };
  visualForm: LandmarkVisualForm;
  hierarchy: "gravity" | "large" | "medium" | "small";
  visibilityBand: LandmarkVisibility;
  revealRole?: LandmarkRevealRole;
  /** BotW 风：triangle / cone / ridge / vertical 偏好 (用于 silhouette 渲染) */
  preferredSilhouette?: "triangle" | "cone" | "ridge" | "vertical";
}

export interface LandmarkHierarchy {
  /** 'gravity well'：玩家走到哪里都看得见的导航锚（如长安、泰山） */
  gravityWell?: LandmarkRef;
  /** 远景导航地标 (visibilityBand=far)：秦岭主脊、终南山主峰、剑门关 */
  large: LandmarkNode[];
  /** 路线尺度地标 (mid)：关隘、州府、山口 */
  medium: LandmarkNode[];
  /** 局部揭示地标 (near)：桥、寺、碑、湖湾 */
  small: LandmarkNode[];
}

// ─── VisualProfile (codex round 2/3, biome × epoch × weather 色调 LUT) ──

export interface VisualProfileColor {
  /** RGB 0..1 三个分量 */
  r: number;
  g: number;
  b: number;
}

export interface VisualProfileSpec {
  /** 风格命名：modern / tang-pilgrimage / tang-autumn-dusk-rain etc. */
  id: string;
  label: string;
  /** 全局色温偏移 -1..1 (冷↔暖) */
  warmth: number;
  /** 远景大气底色 (BotW mie scattering 输入) */
  atmosphericFar: VisualProfileColor;
  /** 主光源色温 (sunDirection 上去前先乘) */
  sunTint: VisualProfileColor;
  /** Ambient 地表色 */
  ambientGround: VisualProfileColor;
  /** 水面反光 base (sampleWater 时配合 reflectivity 用) */
  waterTint: VisualProfileColor;
  /** 雾密度 0..1 (codex round 3 A2 fog inscatter 用) */
  fogDensity: number;
  /** 天气 override（非必填；只覆盖特定 weather 子集） */
  weatherOverrides?: Partial<Record<
    "clear" | "windy" | "rain" | "storm" | "snow" | "mist",
    Partial<VisualProfileSpec>
  >>;
  /** 季节 override（同上） */
  seasonOverrides?: Partial<Record<
    "spring" | "summer" | "autumn" | "winter",
    Partial<VisualProfileSpec>
  >>;
}

// ─── Source quality / metadata ────────────────────────────────────

export type SourceConfidence = "high" | "medium" | "low" | "speculative";

export interface SourceQualityReport {
  /** 数据准确度评估：哪些 layer 是 verified，哪些是 speculative */
  terrain: SourceConfidence;
  hydrography: SourceConfidence;
  settlements: SourceConfidence;
  routes: SourceConfidence;
  poi: SourceConfidence;
  /** 主要数据来源说明（旧唐书/CHGIS/OSM 等） */
  primarySources: string[];
  /** 已知的数据缺口 (S4b 填实数据后清单更新) */
  knownGaps: string[];
}

// ─── EpochManifest 顶层 schema ─────────────────────────────────────

export interface EpochManifest {
  /** schema 版本 — 改 breaking 时 bump */
  schemaVersion: "visual-china.epoch-manifest.v1";
  /** "china" 全国 / "tarim" 西域 等 */
  worldId: string;
  /** "qinling" 当前主 region；未来多 region 时区分 */
  regionId: string;
  /** "modern" / "tang-tianbao-14" / "han-yuanshou-2" 等 */
  epochId: string;
  /** 人类可读 label */
  label: string;
  /** 年份 (epoch 内代表年；BCE 用负数) */
  year: number;
  /** 一句话历史背景，用于 UI 切换确认 */
  description: string;
  projection: ProjectionSpec;
  terrain: TerrainLayerSpec;
  hydrography: HydrographyLayerSpec;
  settlements: SettlementLayerSpec;
  routes: RouteLayerSpec;
  poi: PoiLayerSpec;
  visualProfile: VisualProfileSpec;
  landmarkHierarchy: LandmarkHierarchy;
  sourceQuality: SourceQualityReport;
}

// ─── Cache key (codex round 2 决) ────────────────────────────────────

/**
 * S5 chunk cache key — 让 epoch 切换时 chunk 重新加载而不撞 cache。
 * Format: `${worldId}:${regionId}:${epochId}:${lod}:${chunkId}`
 */
export function epochChunkCacheKey(
  manifest: Pick<EpochManifest, "worldId" | "regionId" | "epochId">,
  lod: number,
  chunkId: string
): string {
  return `${manifest.worldId}:${manifest.regionId}:${manifest.epochId}:${lod}:${chunkId}`;
}

// ─── 已知 epoch URL（运行时切换入口；S4 已 ship 这两个 epoch） ────────

export const KNOWN_EPOCHS = {
  modern: "/data/epochs/modern/manifest.json",
  "tang-tianbao-14": "/data/epochs/tang-tianbao-14/manifest.json"
} as const;

export type KnownEpochId = keyof typeof KNOWN_EPOCHS;

/**
 * 浏览器端：fetch + parse + validate 一个 epoch manifest。
 * Tests/node 端用 parseEpochManifest(已 parsed JSON) 直接 validate。
 */
export async function loadEpochManifest(url: string): Promise<EpochManifest> {
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`failed to fetch epoch manifest ${url}: HTTP ${resp.status}`);
  }
  const raw = await resp.json();
  const result = validateEpochManifest(raw);
  if (!result.ok || !result.manifest) {
    throw new Error(
      `epoch manifest ${url} failed validation:\n` +
        result.issues.map((i) => `  ${i.path}: ${i.message}`).join("\n")
    );
  }
  return result.manifest;
}

/**
 * 浏览器端便捷：按 known epoch id 加载（typo-safe，TS 自动补全）。
 */
export function loadKnownEpoch(id: KnownEpochId): Promise<EpochManifest> {
  return loadEpochManifest(KNOWN_EPOCHS[id]);
}

// ─── Schema validation (runtime check, 防止 manifest 漂离 schema) ────

export interface ValidationIssue {
  path: string;
  message: string;
}

export function validateEpochManifest(raw: unknown): {
  ok: boolean;
  issues: ValidationIssue[];
  manifest: EpochManifest | null;
} {
  const issues: ValidationIssue[] = [];
  if (!raw || typeof raw !== "object") {
    return { ok: false, issues: [{ path: "$", message: "manifest must be object" }], manifest: null };
  }
  const m = raw as Record<string, unknown>;

  function req(path: string, value: unknown, type: "string" | "number" | "object"): void {
    if (type === "object") {
      if (!value || typeof value !== "object") {
        issues.push({ path, message: `required object missing/invalid` });
      }
    } else if (typeof value !== type) {
      issues.push({ path, message: `required ${type} missing/invalid` });
    }
  }

  req("schemaVersion", m.schemaVersion, "string");
  if (m.schemaVersion !== "visual-china.epoch-manifest.v1") {
    issues.push({ path: "schemaVersion", message: `unknown schema version: ${m.schemaVersion}` });
  }
  req("worldId", m.worldId, "string");
  req("regionId", m.regionId, "string");
  req("epochId", m.epochId, "string");
  req("label", m.label, "string");
  req("year", m.year, "number");
  req("description", m.description, "string");
  req("projection", m.projection, "object");
  req("terrain", m.terrain, "object");
  req("hydrography", m.hydrography, "object");
  req("settlements", m.settlements, "object");
  req("routes", m.routes, "object");
  req("poi", m.poi, "object");
  req("visualProfile", m.visualProfile, "object");
  req("landmarkHierarchy", m.landmarkHierarchy, "object");
  req("sourceQuality", m.sourceQuality, "object");

  // Projection 内部字段
  const proj = m.projection as Record<string, unknown> | undefined;
  if (proj && typeof proj === "object") {
    const bounds = proj.bounds as Record<string, unknown> | undefined;
    if (!bounds || typeof bounds.west !== "number" || typeof bounds.east !== "number" ||
        typeof bounds.south !== "number" || typeof bounds.north !== "number") {
      issues.push({ path: "projection.bounds", message: "需要 {west, east, south, north}: number" });
    }
    const world = proj.world as Record<string, unknown> | undefined;
    if (!world || typeof world.width !== "number" || typeof world.depth !== "number") {
      issues.push({ path: "projection.world", message: "需要 {width, depth}: number" });
    }
  }

  // LandmarkHierarchy 形状
  const lh = m.landmarkHierarchy as Record<string, unknown> | undefined;
  if (lh && typeof lh === "object") {
    for (const tier of ["large", "medium", "small"] as const) {
      const arr = lh[tier];
      if (!Array.isArray(arr)) {
        issues.push({ path: `landmarkHierarchy.${tier}`, message: "必须是 LandmarkNode[]" });
      }
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues, manifest: null };
  }
  return { ok: true, issues: [], manifest: m as unknown as EpochManifest };
}
