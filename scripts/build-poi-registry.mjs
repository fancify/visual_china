#!/usr/bin/env node
/**
 * POI Registry 构建脚本
 *
 * 从 docs/05-epoch/tang-755/**\/*.md 自动 derive 一个完整的 POI registry,
 * 输出到 public/data/poi-registry.json (运行时加载).
 *
 * 每条 entry 含:
 *   - id (filename without .md)
 *   - archetype + size + variant (由 archetype 推断函数决定)
 *   - position {lat, lon} (frontmatter geo)
 *   - visualHierarchy (frontmatter)
 *   - displayName (Tang name = id)
 *   - oneLiner (## 一句话 段第一段)
 *   - docPath (相对路径)
 *   - aliases (frontmatter)
 *   - category (frontmatter)
 *
 * Archetype 推断逻辑与 src/game/poi/archetype.ts keep in sync —
 * 当前两边各自维护; 后续如修改, 须同步两文件.
 *
 * Usage: node scripts/build-poi-registry.mjs
 */

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DOCS_DIR = path.join(ROOT, "docs/05-epoch/tang-755");
const OUT_PATH = path.join(ROOT, "public/data/poi-registry.json");
const SUBFOLDERS = ["cities", "scenic", "relics", "transport"];

// ============================================================
// Archetype 推断 (与 src/game/poi/archetype.ts 同步)
// ============================================================

const OVERRIDES = {
  周原: { archetype: "ruin" },
  隆中: { archetype: "temple", variant: "small_temple" },
  五丈原: { archetype: "ruin" },
  鹿门别业: { archetype: "mountain" },
  兰亭: { archetype: "mountain" },
  楼观台: { archetype: "temple", variant: "taoist" },
  王屋山阳台宫: { archetype: "temple", variant: "taoist" },
  天台山: { archetype: "mountain" },
  巍山祖庭: { archetype: "temple", variant: "grand" },
  大昭寺红山宫: { archetype: "temple", variant: "grand" },
  雍布拉康藏王陵: { archetype: "mausoleum", variant: "imperial" },
  武川镇: { archetype: "ruin" },
  龙城: { archetype: "ruin" },
  统万城: { archetype: "ruin" },
  三门峡砥柱: { archetype: "ruin" },
  赤岭碑: { archetype: "ruin" },
};

function inferCitySize(visualHierarchy) {
  if (visualHierarchy === "gravity" || visualHierarchy === "large") return "large";
  if (visualHierarchy === "medium") return "medium";
  return "small";
}

function inferPassVariant(visualHierarchy) {
  return visualHierarchy === "large" || visualHierarchy === "gravity" ? "major" : "minor";
}

function inferMausoleumVariant(fileName) {
  if (
    fileName.includes("帝陵") ||
    fileName.includes("帝墓") ||
    fileName.includes("泰陵") ||
    /^唐(献|昭|乾|桥|定|惠|庄|建|端|崇|丰|景|光|齐|温|靖|章)陵$/.test(fileName)
  ) {
    return "imperial";
  }
  if (fileName.includes("陵群")) return "imperial";
  return "tomb";
}

function inferNodeVariant(fileName) {
  if (fileName.includes("桥")) return "bridge";
  if (fileName.includes("渡") || fileName.includes("津")) return "ferry";
  if (fileName.includes("港") || fileName.includes("市舶")) return "port";
  if (fileName.includes("楼") || fileName.includes("阁") || fileName.includes("台")) return "tower";
  return "ferry";
}

function inferTempleVariant(fileName, visualHierarchy) {
  if (fileName.includes("观") || fileName.endsWith("宫") || fileName.includes("祖庭")) {
    return "taoist";
  }
  if (visualHierarchy === "large" || visualHierarchy === "gravity") return "grand";
  return "small_temple";
}

function inferArchetype(filePath, fileName, _category, visualHierarchy) {
  if (OVERRIDES[fileName]) return OVERRIDES[fileName];

  if (filePath.includes("/cities/")) {
    return { archetype: "city", size: inferCitySize(visualHierarchy) };
  }
  if (filePath.includes("/scenic/")) {
    return { archetype: "mountain" };
  }
  if (filePath.includes("/transport/")) {
    if (fileName.includes("关")) {
      return { archetype: "pass", variant: inferPassVariant(visualHierarchy) };
    }
    if (fileName.includes("道")) {
      return { archetype: "node", variant: "ferry" };
    }
    return { archetype: "node", variant: inferNodeVariant(fileName) };
  }
  if (filePath.includes("/relics/")) {
    if (fileName.includes("陵") || fileName.includes("墓")) {
      return { archetype: "mausoleum", variant: inferMausoleumVariant(fileName) };
    }
    if (fileName.includes("石窟")) return { archetype: "cave" };
    if (fileName.includes("关")) {
      return { archetype: "pass", variant: inferPassVariant(visualHierarchy) };
    }
    if (
      fileName.includes("寺") || fileName.includes("庵") || fileName.includes("庙") ||
      fileName.includes("观") || fileName.endsWith("宫") || fileName.includes("祖庭")
    ) {
      return { archetype: "temple", variant: inferTempleVariant(fileName, visualHierarchy) };
    }
    if (fileName.includes("楼") || fileName.includes("阁") || fileName.includes("台")) {
      return { archetype: "node", variant: "tower" };
    }
    if (fileName.includes("桥") || fileName.includes("渡") || fileName.includes("津")) {
      return { archetype: "node", variant: inferNodeVariant(fileName) };
    }
    if (fileName.includes("港") || fileName.includes("市舶")) {
      return { archetype: "node", variant: "port" };
    }
    return { archetype: "ruin" };
  }
  return { archetype: "ruin" };
}

// ============================================================
// Frontmatter parser (轻量, 不引外部 dep)
// ============================================================

/**
 * 简单的 YAML frontmatter parser, 处理本项目实际用到的字段:
 *   - geo: {lat: X, lon: Y}  (inline object)
 *   - visual_hierarchy: gravity | large | medium | small
 *   - aliases: [a, b, c]      (inline array)
 *   - tags: [...]
 *   - category: city | relic | scenic | transport
 *   - extinction_tier: A1-A4
 *
 * 不支持嵌套 list (provenance), 但这些字段我们不需要.
 */
function parseFrontmatter(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const yaml = m[1];
  const result = {};
  const lines = yaml.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // skip nested list items (start with "  -" or "    ")
    if (line.startsWith("  ")) continue;

    const colonIdx = trimmed.indexOf(":");
    if (colonIdx < 0) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    let value = trimmed.slice(colonIdx + 1).trim();

    // skip if value is empty (multi-line list follows)
    if (!value) continue;

    // inline object: {lat: X, lon: Y}
    if (value.startsWith("{") && value.endsWith("}")) {
      const obj = {};
      const inner = value.slice(1, -1);
      for (const pair of inner.split(",")) {
        const [k, v] = pair.split(":").map((s) => s.trim());
        const num = Number(v);
        obj[k] = Number.isFinite(num) ? num : v;
      }
      result[key] = obj;
      continue;
    }

    // inline array: [a, b, c]
    if (value.startsWith("[") && value.endsWith("]")) {
      const inner = value.slice(1, -1);
      result[key] = inner
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
      continue;
    }

    // strip surrounding quotes
    value = value.replace(/^["']|["']$/g, "");
    result[key] = value;
  }

  return result;
}

/**
 * 提取 "## 一句话" 段第一段非空文字 (作为 tooltip oneLiner).
 * 不含 markdown 加粗 / 链接标记 (简单 strip).
 */
function extractOneLiner(md) {
  // 找 "## 一句话" 段
  const m = md.match(/^## 一句话\s*\n+([\s\S]*?)(?:\n##|\n---|$)/m);
  if (!m) return "";

  // 段第一段 (双换行分段)
  const para = m[1].split(/\n\n/)[0]?.trim() ?? "";

  // strip markdown: **bold** / *italic* / [text](url) / \n
  return para
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ============================================================
// Main
// ============================================================

async function main() {
  const entries = [];
  const stats = {
    byArchetype: {},
    byCategory: {},
    bySubfolder: {},
    missing_geo: [],
    missing_oneliner: [],
    missing_visual_hierarchy: [],
  };

  for (const sub of SUBFOLDERS) {
    const subPath = path.join(DOCS_DIR, sub);
    let files;
    try {
      files = await fs.readdir(subPath);
    } catch {
      continue;
    }

    stats.bySubfolder[sub] = 0;

    for (const file of files) {
      if (!file.endsWith(".md")) continue;
      const fileName = file.replace(/\.md$/, "");
      const fullPath = path.join(subPath, file);
      const relPath = path.relative(ROOT, fullPath);
      const md = await fs.readFile(fullPath, "utf8");

      const fm = parseFrontmatter(md);
      const oneLiner = extractOneLiner(md);
      const result = inferArchetype(relPath, fileName, fm.category, fm.visual_hierarchy);

      // 校验
      if (!fm.geo || typeof fm.geo.lat !== "number" || typeof fm.geo.lon !== "number") {
        stats.missing_geo.push(fileName);
      }
      if (!oneLiner) stats.missing_oneliner.push(fileName);
      if (!fm.visual_hierarchy) stats.missing_visual_hierarchy.push(fileName);

      const entry = {
        id: fileName,
        archetype: result.archetype,
        ...(result.size && { size: result.size }),
        ...(result.variant && { variant: result.variant }),
        position: fm.geo ?? { lat: 0, lon: 0 },
        visualHierarchy: fm.visual_hierarchy ?? "medium",
        displayName: fileName,
        oneLiner,
        docPath: relPath,
        category: fm.category ?? "",
        ...(fm.aliases && fm.aliases.length > 0 && { aliases: fm.aliases }),
        ...(fm.extinction_tier && { extinctionTier: fm.extinction_tier }),
      };

      entries.push(entry);
      stats.bySubfolder[sub]++;
      stats.byArchetype[result.archetype] = (stats.byArchetype[result.archetype] || 0) + 1;
      stats.byCategory[fm.category || "(missing)"] =
        (stats.byCategory[fm.category || "(missing)"] || 0) + 1;
    }
  }

  // 排序: 按 archetype 然后 displayName
  entries.sort((a, b) =>
    a.archetype === b.archetype
      ? a.displayName.localeCompare(b.displayName, "zh")
      : a.archetype.localeCompare(b.archetype)
  );

  // 输出
  const registry = {
    epoch: "tang-tianbao-14",
    epochYear: 755,
    generatedAt: new Date().toISOString(),
    totalEntries: entries.length,
    stats: {
      byArchetype: stats.byArchetype,
      bySubfolder: stats.bySubfolder,
    },
    entries,
  };

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(OUT_PATH, JSON.stringify(registry, null, 2));

  console.log(`\n✅ POI Registry built: ${entries.length} entries`);
  console.log(`   Output: ${path.relative(ROOT, OUT_PATH)}`);
  console.log(`\n📊 Archetype distribution:`);
  for (const [a, n] of Object.entries(stats.byArchetype).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${a.padEnd(12)} ${n}`);
  }
  console.log(`\n📁 Subfolder distribution:`);
  for (const [s, n] of Object.entries(stats.bySubfolder)) {
    console.log(`   ${s.padEnd(12)} ${n}`);
  }
  console.log(`\n📁 Category (frontmatter) distribution:`);
  for (const [c, n] of Object.entries(stats.byCategory)) {
    console.log(`   ${c.padEnd(12)} ${n}`);
  }
  if (stats.missing_geo.length > 0) {
    console.log(`\n⚠️  Missing geo (${stats.missing_geo.length}):`);
    stats.missing_geo.slice(0, 10).forEach((f) => console.log(`     - ${f}`));
    if (stats.missing_geo.length > 10) console.log(`     ... +${stats.missing_geo.length - 10} more`);
  }
  if (stats.missing_oneliner.length > 0) {
    console.log(`\n⚠️  Missing '## 一句话' (${stats.missing_oneliner.length}):`);
    stats.missing_oneliner.slice(0, 10).forEach((f) => console.log(`     - ${f}`));
    if (stats.missing_oneliner.length > 10)
      console.log(`     ... +${stats.missing_oneliner.length - 10} more`);
  }
}

main().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
