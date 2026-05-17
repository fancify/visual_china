// build-poi-registry.mjs
//
// 从 docs/05-epoch/tang-755/{cities,relics,scenic,transport}/*.md frontmatter
// 派生出 src/data/poiRegistry.generated.ts —— minimap / 3D / debug overlay 共用 POI 索引。
//
// SSOT-by-design (feedback_ssot_by_design.md 原则 2):
//   - Authoring source: docs/05-epoch/tang-755/**/*.md frontmatter (Line B 维护)
//   - Generated artifact: src/data/poiRegistry.generated.ts (本脚本输出, 禁止手改)
//   - 每次 doc 变化 → 跑 npm run build:poi-registry → 更新 .generated.ts
//
// 用法:
//   node scripts/build-poi-registry.mjs

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { inferArchetype } from "../src/game/poi/archetype.ts";
import { inferPoiFounded, stripPoiMarkdown } from "../src/game/poiFacts.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const POI_CATEGORIES = ["city", "relic", "scenic", "transport"];
const POI_DIRS = ["cities", "relics", "scenic", "transport"]; // 注意 cities 是复数
const SOURCE_QUALITY = ["verified", "likely", "speculative"];
const CATEGORY_ALIASES = new Map([
  ["cities", "city"],
  ["relics", "relic"],
  ["scenics", "scenic"],
  ["transportation", "transport"]
]);
const HIERARCHY_ALIASES = new Map([
  ["high", "large"],
  ["low", "small"],
  ["t1", "gravity"],
  ["t2", "large"],
  ["t3", "medium"],
  ["t4", "small"]
]);

const TANG_DAO_ALIASES = new Map([
  ["shannan-xi", "shannan-west"],
  ["shannan-xidao", "shannan-west"],
  ["shannan-dong", "shannan-east"],
  ["shannan-dongdao", "shannan-east"],
  ["jiangnanxi", "jiangnan-west"],
  ["jiangnan-xi", "jiangnan-west"],
  ["jiangnan-dong", "jiangnan-east"],
  ["anxi", "anxi-duhufu"],
  ["beiting", "beiting-duhufu"],
  ["ji-mi", "jimi-duhufu"]
]);

const TANG_NAV_GROUPS = [
  { id: "guannei", name: "关内道", order: 10 },
  { id: "henan", name: "河南道", order: 20 },
  { id: "hedong", name: "河东道", order: 30 },
  { id: "hebei", name: "河北道", order: 40 },
  { id: "longyou", name: "陇右道", order: 50 },
  { id: "shannan-east", name: "山南东道", order: 60 },
  { id: "shannan-west", name: "山南西道", order: 70 },
  { id: "jiannan", name: "剑南道", order: 80 },
  { id: "huainan", name: "淮南道", order: 90 },
  { id: "jiangnan-east", name: "江南东道", order: 100 },
  { id: "jiangnan-west", name: "江南西道", order: 110 },
  { id: "qianzhong", name: "黔中道", order: 120 },
  { id: "lingnan", name: "岭南道", order: 130 },
  { id: "ancient-roads", name: "古道", order: 140 },
  { id: "jimi-duhufu", name: "羁縻与都护", order: 150 },
  { id: "outer-lands", name: "域外诸地", order: 160 },
  { id: "non-tang-direct", name: "非唐直辖", order: 170 },
  { id: "uncategorized", name: "未分组", order: 999 }
];

const STABLE_ID_BY_TANG_NAME = new Map([
  ["长安", "changan"],
  ["洛阳", "luoyang"],
  ["太原", "taiyuan"],
  ["扬州", "yangzhou"],
  ["益州", "yizhou"],
  ["幽州", "youzhou"],
  ["凉州", "liangzhou"],
  ["灵州", "lingwu"],
  ["陕州", "shanzhou"],
  ["华山", "huashan"],
  ["庐山", "lushan"],
  ["嵩山", "songshan"],
  ["太白山", "taibaishan"],
  ["泰山", "taishan"],
  ["终南山", "zhongnan-shan"],
  ["白马寺", "baima-si"],
  ["法门寺", "famen-si"],
  ["龙门石窟", "longmen-shiku"],
  ["莫高窟", "mogao-caves"],
  ["辋川别业", "wangchuan-bieye"],
  ["兴教寺", "xingjiao-si"],
  ["陈仓道", "chencang-dao"],
  ["金牛道", "jinniu-dao"],
  ["米仓道", "micang-dao"],
  ["祁山道", "qishan-dao"],
  ["傥骆道", "tangluo-dao"],
  ["子午道", "ziwu-dao"],
  ["褒斜道", "baoxie-dao"],
  ["荔枝道", "lizhi-dao"]
]);

function isCliEntrypoint() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

function resolvePoiDocsRoot(sourceRoot = ROOT) {
  return path.join(path.resolve(sourceRoot), "docs", "05-epoch", "tang-755");
}

function parseFrontmatter(raw) {
  // 提取 --- ... --- 之间内容
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const body = match[1];
  const out = {};

  // 简单 key: value 一行一对 (不支持嵌套块)
  for (const line of body.split("\n")) {
    const kv = line.match(/^(\w+):\s*(.+)$/);
    if (!kv) continue;
    out[kv[1]] = parseFrontmatterValue(stripInlineComment(kv[2].trim()));
  }

  // 单行 geo/foundation/elevation: {key: value, ...}
  if (typeof out.geo === "string") {
    out.geo = parseInlineObject(out.geo);
  }
  if (typeof out.foundation === "string") {
    out.foundation = parseInlineObject(out.foundation);
  }
  if (typeof out.elevation === "string" && out.elevation.trim().startsWith("{")) {
    out.elevation = parseInlineObject(out.elevation);
  }
  for (const key of ["elevation_m", "altitude_m"]) {
    if (typeof out[key] === "string" && /^-?\d+(?:\.\d+)?$/.test(out[key])) {
      out[key] = Number(out[key]);
    }
  }

  return out;
}

function stripInlineComment(value) {
  return value.replace(/\s+#.*$/, "").trim();
}

function parseFrontmatterValue(value) {
  if (value === "null" || value === "~") return null;
  if (value.startsWith("[") && value.endsWith("]")) return parseInlineArray(value);
  if (value.startsWith("{") && value.endsWith("}")) return parseInlineObject(value);
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  return value;
}

function parseInlineArray(value) {
  return value
    .trim()
    .replace(/^\[\s*/, "")
    .replace(/\s*\]$/, "")
    .split(",")
    .map((item) => cleanFrontmatterScalar(item))
    .filter(Boolean);
}

function parseInlineObject(value) {
  if (typeof value !== "string" || !value.trim().startsWith("{")) return value;
  const out = {};
  const body = value.trim().replace(/^\{\s*/, "").replace(/\s*\}$/, "");
  for (const match of body.matchAll(/(\w+):\s*("(?:[^"\\]|\\.)*"|[^,}]+)/g)) {
    const rawValue = match[2].trim();
    if (/^".*"$/.test(rawValue)) {
      try {
        out[match[1]] = JSON.parse(rawValue);
      } catch {
        out[match[1]] = rawValue.slice(1, -1);
      }
    } else if (/^-?\d+(?:\.\d+)?$/.test(rawValue)) {
      out[match[1]] = Number(rawValue);
    } else {
      out[match[1]] = rawValue;
    }
  }
  return out;
}

function extractHeadingName(raw, fallback) {
  const match = raw.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : fallback;
}

function extractSectionText(raw, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = raw.match(new RegExp(`^##\\s+${escaped}\\s*$\\n+([\\s\\S]*?)(?=\\n##\\s+|$)`, "m"));
  if (!match) return "";
  return match[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith(">") && !line.startsWith("#"))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildPoiDetailText(raw) {
  return raw
    .replace(/^---\n[\s\S]*?\n---\s*/, "")
    .trim();
}

function cleanFactLabel(value) {
  return stripPoiMarkdown(String(value ?? ""))
    .replace(/^["']|["']$/g, "")
    .trim();
}

function cleanFrontmatterScalar(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  return String(value).replace(/^["']|["']$/g, "").trim() || fallback;
}

function markdownAnchor(title, index) {
  const slug = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return slug ? `${index + 1}-${slug}` : `section-${index + 1}`;
}

function extractDetailSections(detail) {
  return [...detail.matchAll(/^(#{1,6})\s+(.+)$/gm)]
    .map((match, index) => {
      const title = stripPoiMarkdown(match[2]).trim();
      return {
        level: match[1].length,
        title,
        anchor: markdownAnchor(title, index)
      };
    })
    .filter((section) => section.title);
}

async function loadPoiTaxonomy(sourceRoot = ROOT) {
  const taxonomyPath = path.join(resolvePoiDocsRoot(sourceRoot), "poi-taxonomy.json");
  try {
    const raw = await fs.readFile(taxonomyPath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      regions: Array.isArray(parsed.regions) ? parsed.regions : [],
      kinds: Array.isArray(parsed.kinds) ? parsed.kinds : []
    };
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.warn(`Failed to read POI taxonomy at ${taxonomyPath}: ${error.message}`);
    }
    return { regions: [], kinds: [] };
  }
}

function foundedFromLineB(fm, text) {
  if (fm.foundation && typeof fm.foundation === "object" && typeof fm.foundation.label === "string") {
    const label = cleanFactLabel(fm.foundation.label);
    if (label) return label;
  }
  return inferPoiFounded(text);
}

function elevationFromLineB(fm, text) {
  const direct = fm.elevation_m ?? fm.altitude_m;
  if (Number.isFinite(direct)) {
    return {
      elevation: `海拔 ${direct} 米`,
      elevationMeters: direct
    };
  }

  if (fm.elevation && typeof fm.elevation === "object") {
    const meters = fm.elevation.meters ?? fm.elevation.m ?? fm.elevation.value;
    const label = typeof fm.elevation.label === "string"
      ? cleanFactLabel(fm.elevation.label)
      : "";
    if (label) {
      return {
        elevation: label,
        elevationMeters: Number.isFinite(meters) ? meters : undefined
      };
    }
    if (Number.isFinite(meters)) {
      return {
        elevation: `海拔 ${meters} 米`,
        elevationMeters: meters
      };
    }
  }

  if (typeof fm.elevation === "string") {
    const label = cleanFactLabel(fm.elevation);
    if (label) return { elevation: label };
  }

  const normalized = stripPoiMarkdown(text);
  const match = normalized.match(/海拔(?:约|約)?[^，。；、\n]{0,40}米/);
  if (!match) return {};
  return { elevation: match[0].trim() };
}

function sourceQualityFromFrontmatter(raw) {
  const confidences = [...raw.matchAll(/confidence:\s*([A-Za-z_-]+)/g)]
    .map((match) => match[1]);
  for (const quality of SOURCE_QUALITY) {
    if (confidences.includes(quality)) return quality;
  }
  return "speculative";
}

function stablePoiId(name, filenameStem) {
  return STABLE_ID_BY_TANG_NAME.get(name) ?? STABLE_ID_BY_TANG_NAME.get(filenameStem) ?? filenameStem;
}

function normalizeCategory(category) {
  return CATEGORY_ALIASES.get(category) ?? category;
}

function normalizeHierarchy(hierarchy) {
  const value = (hierarchy ?? "medium").toLowerCase();
  return HIERARCHY_ALIASES.get(value) ?? value;
}

function normalizeTangScalar(value) {
  const cleaned = cleanFrontmatterScalar(value);
  if (!cleaned || cleaned === "null" || cleaned === "~") return null;
  return cleaned;
}

function normalizeTangValue(value) {
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) {
    const items = value.map(normalizeTangScalar).filter(Boolean);
    return items.length > 0 ? items : null;
  }
  return normalizeTangScalar(value);
}

function tangDaoList(tangDao) {
  if (!tangDao) return [];
  const values = Array.isArray(tangDao) ? tangDao : [tangDao];
  return values
    .map((value) => cleanFrontmatterScalar(value).toLowerCase())
    .filter(Boolean)
    .map((value) => TANG_DAO_ALIASES.get(value) ?? value);
}

function isAncientRoadEntry(entry) {
  return entry.category === "transport" && (
    entry.kind === "route" ||
    entry.name.includes("道") ||
    entry.name.includes("路") ||
    entry.name.includes("驰道")
  );
}

function tangNavGroupForEntry(entry) {
  if (isAncientRoadEntry(entry)) return "ancient-roads";

  const daoIds = tangDaoList(entry.tangDao);
  const polity = cleanFrontmatterScalar(entry.tangPolity).toLowerCase();
  const admin = Array.isArray(entry.tangAdmin)
    ? entry.tangAdmin.join(" ").toLowerCase()
    : cleanFrontmatterScalar(entry.tangAdmin).toLowerCase();

  if (entry.region === "overseas" || entry.subregion === "outer-lands") {
    return "outer-lands";
  }
  if (polity && polity !== "tang") {
    return "non-tang-direct";
  }
  if (daoIds.some((dao) => dao === "tubo" || dao === "nanzhao")) {
    return "non-tang-direct";
  }
  if (
    daoIds.some((dao) => dao === "anxi-duhufu" || dao === "beiting-duhufu" || dao === "jimi-duhufu") ||
    /duhufu|daduhufu|都护|羁縻/.test(admin)
  ) {
    return "jimi-duhufu";
  }
  if (daoIds.length > 0 && !daoIds[0].startsWith("cross-")) {
    return daoIds[0];
  }
  return "uncategorized";
}

export async function scanPoiDocs(sourceRoot = ROOT) {
  const entries = [];
  const docsRoot = resolvePoiDocsRoot(sourceRoot);
  const taxonomy = await loadPoiTaxonomy(sourceRoot);
  const regionById = new Map(taxonomy.regions.map((region) => [region.id, region]));
  const kindById = new Map(taxonomy.kinds.map((kind) => [kind.id, kind]));

  for (const dir of POI_DIRS) {
    const dirPath = path.join(docsRoot, dir);
    let files;
    try {
      files = await fs.readdir(dirPath);
    } catch {
      console.warn(`(no ${dirPath})`);
      continue;
    }

    for (const f of files) {
      if (!f.endsWith(".md")) continue;
      const filePath = path.join(dirPath, f);
      const id = f.replace(/\.md$/, "");
      const raw = await fs.readFile(filePath, "utf8");
      const fm = parseFrontmatter(raw);
      if (!fm) {
        console.warn(`  skip ${id}: no frontmatter`);
        continue;
      }
      if (fm.type !== "poi") {
        // 跳过非 POI 类 (polity / dao 等)
        continue;
      }
      const category = normalizeCategory(fm.category);
      if (!POI_CATEGORIES.includes(category)) {
        console.warn(`  skip ${id}: bad category ${fm.category}`);
        continue;
      }
      if (!fm.geo || typeof fm.geo.lat !== "number" || typeof fm.geo.lon !== "number") {
        console.warn(`  skip ${id}: missing geo`);
        continue;
      }

      const name = extractHeadingName(raw, id);
      const summary = extractSectionText(raw, "一句话");
      const detail = buildPoiDetailText(raw);
      const founded = foundedFromLineB(fm, `${summary} ${detail}`);
      const elevation = elevationFromLineB(fm, `${summary} ${detail}`);
      const tangPolity = normalizeTangScalar(fm.tang_polity);
      const tangDao = normalizeTangValue(fm.tang_dao);
      const tangAdmin = normalizeTangValue(fm.tang_admin);
      const tangPolityName = cleanFrontmatterScalar(fm.tang_polity_name, tangPolity);
      const tangDaoName = cleanFrontmatterScalar(fm.tang_dao_name, null);
      const tangAdminName = cleanFrontmatterScalar(fm.tang_admin_name, null);
      const model = inferArchetype(
        `docs/05-epoch/tang-755/${dir}/${f}`,
        id,
        category,
        fm.visual_hierarchy
      );
      const entry = {
        id: stablePoiId(name, id),
        name,
        category,
        region: cleanFrontmatterScalar(fm.region, "uncategorized"),
        regionName: cleanFrontmatterScalar(fm.region_name, regionById.get(fm.region)?.name ?? "未分区"),
        regionOrder: Number.isFinite(regionById.get(fm.region)?.order) ? regionById.get(fm.region).order : 999,
        subregion: cleanFrontmatterScalar(fm.subregion, "uncategorized"),
        subregionName: cleanFrontmatterScalar(fm.subregion_name, "未分区"),
        kind: cleanFrontmatterScalar(fm.kind, category),
        kindName: cleanFrontmatterScalar(fm.kind_name, kindById.get(fm.kind)?.name ?? category),
        kindOrder: Number.isFinite(kindById.get(fm.kind)?.order) ? kindById.get(fm.kind).order : 999,
        tangPolity,
        tangPolityName,
        tangDao,
        tangDaoName,
        tangAdmin,
        tangAdminName,
        lat: fm.geo.lat,
        lon: fm.geo.lon,
        hierarchy: normalizeHierarchy(fm.visual_hierarchy),
        archetype: model.archetype,
        summary,
        founded,
        ...elevation,
        detail,
        detailSections: extractDetailSections(detail),
        sourceQuality: sourceQualityFromFrontmatter(raw),
        docPath: `docs/05-epoch/tang-755/${dir}/${f}`
      };
      entry.tangNavGroup = tangNavGroupForEntry(entry);
      if (model.size) entry.size = model.size;
      if (model.variant) entry.variant = model.variant;
      entries.push(entry);
    }
  }

  return entries;
}

export function renderPoiRegistryTypeScript(entries) {
  const sorted = entries.slice().sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.id.localeCompare(b.id);
  });
  const regions = [...new Map(entries.map((entry) => [
    entry.region,
    {
      id: entry.region,
      name: entry.regionName,
      order: entry.regionOrder
    }
  ])).values()].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "zh-Hans-CN"));
  const kinds = [...new Map(entries.map((entry) => [
    entry.kind,
    {
      id: entry.kind,
      name: entry.kindName,
      order: entry.kindOrder
    }
  ])).values()].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "zh-Hans-CN"));
  const tangNavGroups = TANG_NAV_GROUPS
    .filter((group) => entries.some((entry) => entry.tangNavGroup === group.id))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "zh-Hans-CN"));

  const lines = [];
  lines.push("// SSOT: derived from docs/05-epoch/tang-755/**/*.md frontmatter.");
  lines.push("// DO NOT EDIT — regenerate via: node scripts/build-poi-registry.mjs");
  lines.push(`// Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("export type PoiCategory = \"city\" | \"relic\" | \"scenic\" | \"transport\";");
  lines.push("export type PoiHierarchy = \"gravity\" | \"large\" | \"medium\" | \"small\";");
  lines.push("export type PoiSourceQuality = \"verified\" | \"likely\" | \"speculative\";");
  lines.push("export type PoiModelArchetype = \"city\" | \"mountain\" | \"mausoleum\" | \"ruin\" | \"pass\" | \"temple\" | \"cave\" | \"node\";");
  lines.push("export type PoiModelSize = \"small\" | \"medium\" | \"large\";");
  lines.push("export type PoiModelVariant = \"imperial\" | \"tomb\" | \"minor\" | \"major\" | \"small_temple\" | \"grand\" | \"taoist\" | \"bridge\" | \"ferry\" | \"port\" | \"tower\";");
  lines.push("export type PoiTangValue = string | readonly string[] | null;");
  lines.push("");
  lines.push("export interface PoiTaxonomyItem {");
  lines.push("  id: string;");
  lines.push("  name: string;");
  lines.push("  order: number;");
  lines.push("}");
  lines.push("");
  lines.push("export interface PoiDetailSection {");
  lines.push("  level: number;");
  lines.push("  title: string;");
  lines.push("  anchor: string;");
  lines.push("}");
  lines.push("");
  lines.push("export interface PoiEntry {");
  lines.push("  /** Stable runtime id; legacy core ids are preserved across Line B filename changes. */");
  lines.push("  id: string;");
  lines.push("  /** Tang-era display name from the authoring document H1. */");
  lines.push("  name: string;");
  lines.push("  category: PoiCategory;");
  lines.push("  /** Line B geographic macro-region used by the fullscreen POI index. */");
  lines.push("  region: string;");
  lines.push("  regionName: string;");
  lines.push("  regionOrder: number;");
  lines.push("  subregion: string;");
  lines.push("  subregionName: string;");
  lines.push("  /** Line B content kind used below region in the fullscreen POI index. */");
  lines.push("  kind: string;");
  lines.push("  kindName: string;");
  lines.push("  kindOrder: number;");
  lines.push("  /** Tang 755 polity marker from Line B frontmatter, usually `tang` or a non-direct polity id. */");
  lines.push("  tangPolity: string | null;");
  lines.push("  /** Chinese display label for tangPolity when Line B provides it. */");
  lines.push("  tangPolityName: string | null;");
  lines.push("  /** Tang administrative circuit / protectorate id. Cross-road routes may carry multiple values. */");
  lines.push("  tangDao: PoiTangValue;");
  lines.push("  /** Chinese display label for tangDao when Line B provides it. */");
  lines.push("  tangDaoName: string | null;");
  lines.push("  /** Tang prefecture / commandery / protectorate string from Line B frontmatter. */");
  lines.push("  tangAdmin: PoiTangValue;");
  lines.push("  /** Chinese display label for tangAdmin when Line B provides it. */");
  lines.push("  tangAdminName: string | null;");
  lines.push("  /** Left-nav grouping for the Tang administrative view. Ancient roads and non-direct polities are bucketed explicitly. */");
  lines.push("  tangNavGroup: string;");
  lines.push("  lat: number;");
  lines.push("  lon: number;");
  lines.push("  /** Visual tier — gravity (T1) > large > medium > small */");
  lines.push("  hierarchy: PoiHierarchy;");
  lines.push("  /** Line B model family used by the Three.js POI model registry. */");
  lines.push("  archetype: PoiModelArchetype;");
  lines.push("  size?: PoiModelSize;");
  lines.push("  variant?: PoiModelVariant;");
  lines.push("  /** Short description extracted from the `## 一句话` section. */");
  lines.push("  summary: string;");
  lines.push("  /** Founding / first-attested date phrase inferred from Line B prose. */");
  lines.push("  founded: string;");
  lines.push("  /** Elevation phrase from Line B frontmatter or prose, e.g. `海拔 2154 米`. */");
  lines.push("  elevation?: string;");
  lines.push("  /** Numeric elevation in meters when Line B provides a structured value. */");
  lines.push("  elevationMeters?: number;");
  lines.push("  /** Full authoring markdown body from the Line B POI document. */");
  lines.push("  detail: string;");
  lines.push("  /** Markdown heading index extracted from detail for section navigation. */");
  lines.push("  detailSections: readonly PoiDetailSection[];");
  lines.push("  sourceQuality: PoiSourceQuality;");
  lines.push("  /** Path to authoring markdown (for hover/link UIs). */");
  lines.push("  docPath: string;");
  lines.push("}");
  lines.push("");
  lines.push(`export const POI_REGISTRY: readonly PoiEntry[] = [`);
  for (const e of sorted) {
    const modelFields = [
      `archetype: ${JSON.stringify(e.archetype)}`,
      e.size ? `size: ${JSON.stringify(e.size)}` : null,
      e.variant ? `variant: ${JSON.stringify(e.variant)}` : null
    ].filter(Boolean).join(", ");
    const elevationFields = [
      e.elevation ? `elevation: ${JSON.stringify(e.elevation)}` : null,
      Number.isFinite(e.elevationMeters) ? `elevationMeters: ${e.elevationMeters}` : null
    ].filter(Boolean).join(", ");
    const elevationPart = elevationFields ? `, ${elevationFields}` : "";
    lines.push(`  { id: ${JSON.stringify(e.id)}, name: ${JSON.stringify(e.name)}, category: ${JSON.stringify(e.category)}, region: ${JSON.stringify(e.region)}, regionName: ${JSON.stringify(e.regionName)}, regionOrder: ${e.regionOrder}, subregion: ${JSON.stringify(e.subregion)}, subregionName: ${JSON.stringify(e.subregionName)}, kind: ${JSON.stringify(e.kind)}, kindName: ${JSON.stringify(e.kindName)}, kindOrder: ${e.kindOrder}, tangPolity: ${JSON.stringify(e.tangPolity)}, tangPolityName: ${JSON.stringify(e.tangPolityName)}, tangDao: ${JSON.stringify(e.tangDao)}, tangDaoName: ${JSON.stringify(e.tangDaoName)}, tangAdmin: ${JSON.stringify(e.tangAdmin)}, tangAdminName: ${JSON.stringify(e.tangAdminName)}, tangNavGroup: ${JSON.stringify(e.tangNavGroup)}, lat: ${e.lat}, lon: ${e.lon}, hierarchy: ${JSON.stringify(e.hierarchy)}, ${modelFields}, summary: ${JSON.stringify(e.summary)}, founded: ${JSON.stringify(e.founded)}${elevationPart}, detail: ${JSON.stringify(e.detail)}, detailSections: ${JSON.stringify(e.detailSections)}, sourceQuality: ${JSON.stringify(e.sourceQuality)}, docPath: ${JSON.stringify(e.docPath)} },`);
  }
  lines.push("] as const;");
  lines.push("");
  lines.push(`export const POI_TAXONOMY: { readonly regions: readonly PoiTaxonomyItem[]; readonly kinds: readonly PoiTaxonomyItem[]; readonly tangNavGroups: readonly PoiTaxonomyItem[] } = ${JSON.stringify({ regions, kinds, tangNavGroups }, null, 2)} as const;`);
  lines.push("");
  lines.push("export function poisByCategory(category: PoiCategory): readonly PoiEntry[] {");
  lines.push("  return POI_REGISTRY.filter((p) => p.category === category);");
  lines.push("}");
  lines.push("");
  lines.push("export function poisByRegion(region: string): readonly PoiEntry[] {");
  lines.push("  return POI_REGISTRY.filter((p) => p.region === region);");
  lines.push("}");
  lines.push("");
  lines.push("export function poisByKind(kind: string): readonly PoiEntry[] {");
  lines.push("  return POI_REGISTRY.filter((p) => p.kind === kind);");
  lines.push("}");
  lines.push("");
  lines.push("export function poisByTangNavGroup(tangNavGroup: string): readonly PoiEntry[] {");
  lines.push("  return POI_REGISTRY.filter((p) => p.tangNavGroup === tangNavGroup);");
  lines.push("}");
  lines.push("");
  lines.push("export function poiById(id: string): PoiEntry | undefined {");
  lines.push("  return POI_REGISTRY.find((p) => p.id === id);");
  lines.push("}");
  lines.push("");

  return lines.join("\n");
}

async function main() {
  const sourceRoot = process.env.LINE_B_POI_ROOT
    ? path.resolve(process.env.LINE_B_POI_ROOT)
    : ROOT;
  console.log("Scanning POI docs...");
  console.log(`Source root: ${sourceRoot}`);
  const entries = await scanPoiDocs(sourceRoot);
  console.log(`Found ${entries.length} POI entries:`);
  const byCat = {};
  for (const e of entries) byCat[e.category] = (byCat[e.category] ?? 0) + 1;
  for (const cat of POI_CATEGORIES) {
    console.log(`  ${cat}: ${byCat[cat] ?? 0}`);
  }

  const ts = renderPoiRegistryTypeScript(entries);
  const out = path.join(ROOT, "src", "data", "poiRegistry.generated.ts");
  await fs.writeFile(out, ts, "utf8");
  console.log(`\nWrote ${out}`);
}

if (isCliEntrypoint()) {
  await main();
}
