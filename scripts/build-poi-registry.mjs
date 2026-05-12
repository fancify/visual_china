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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const POI_CATEGORIES = ["city", "relic", "scenic", "transport"];
const POI_DIRS = ["cities", "relics", "scenic", "transport"]; // 注意 cities 是复数

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
    out[kv[1]] = kv[2].trim();
  }

  // 单行 geo: {lat: X, lon: Y}
  if (typeof out.geo === "string") {
    const g = out.geo.match(/lat:\s*([-\d.]+),\s*lon:\s*([-\d.]+)/);
    if (g) {
      out.geo = { lat: parseFloat(g[1]), lon: parseFloat(g[2]) };
    }
  }

  return out;
}

async function scanDocs() {
  const entries = [];
  const docsRoot = path.join(ROOT, "docs", "05-epoch", "tang-755");

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
      if (!POI_CATEGORIES.includes(fm.category)) {
        console.warn(`  skip ${id}: bad category ${fm.category}`);
        continue;
      }
      if (!fm.geo || typeof fm.geo.lat !== "number" || typeof fm.geo.lon !== "number") {
        console.warn(`  skip ${id}: missing geo`);
        continue;
      }

      entries.push({
        id,
        category: fm.category,
        lat: fm.geo.lat,
        lon: fm.geo.lon,
        hierarchy: fm.visual_hierarchy ?? "medium",
        docPath: `docs/05-epoch/tang-755/${dir}/${f}`
      });
    }
  }

  return entries;
}

function renderTypeScript(entries) {
  const sorted = entries.slice().sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.id.localeCompare(b.id);
  });

  const lines = [];
  lines.push("// SSOT: derived from docs/05-epoch/tang-755/**/*.md frontmatter.");
  lines.push("// DO NOT EDIT — regenerate via: node scripts/build-poi-registry.mjs");
  lines.push(`// Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("export type PoiCategory = \"city\" | \"relic\" | \"scenic\" | \"transport\";");
  lines.push("export type PoiHierarchy = \"gravity\" | \"large\" | \"medium\" | \"small\";");
  lines.push("");
  lines.push("export interface PoiEntry {");
  lines.push("  /** Filename stem from docs/05-epoch/tang-755/<category>/<id>.md (Tang-era romanization) */");
  lines.push("  id: string;");
  lines.push("  category: PoiCategory;");
  lines.push("  lat: number;");
  lines.push("  lon: number;");
  lines.push("  /** Visual tier — gravity (T1) > large > medium > small */");
  lines.push("  hierarchy: PoiHierarchy;");
  lines.push("  /** Path to authoring markdown (for hover/link UIs). */");
  lines.push("  docPath: string;");
  lines.push("}");
  lines.push("");
  lines.push(`export const POI_REGISTRY: readonly PoiEntry[] = [`);
  for (const e of sorted) {
    lines.push(`  { id: ${JSON.stringify(e.id)}, category: ${JSON.stringify(e.category)}, lat: ${e.lat}, lon: ${e.lon}, hierarchy: ${JSON.stringify(e.hierarchy)}, docPath: ${JSON.stringify(e.docPath)} },`);
  }
  lines.push("] as const;");
  lines.push("");
  lines.push("export function poisByCategory(category: PoiCategory): readonly PoiEntry[] {");
  lines.push("  return POI_REGISTRY.filter((p) => p.category === category);");
  lines.push("}");
  lines.push("");
  lines.push("export function poiById(id: string): PoiEntry | undefined {");
  lines.push("  return POI_REGISTRY.find((p) => p.id === id);");
  lines.push("}");
  lines.push("");

  return lines.join("\n");
}

async function main() {
  console.log("Scanning POI docs...");
  const entries = await scanDocs();
  console.log(`Found ${entries.length} POI entries:`);
  const byCat = {};
  for (const e of entries) byCat[e.category] = (byCat[e.category] ?? 0) + 1;
  for (const cat of POI_CATEGORIES) {
    console.log(`  ${cat}: ${byCat[cat] ?? 0}`);
  }

  const ts = renderTypeScript(entries);
  const out = path.join(ROOT, "src", "data", "poiRegistry.generated.ts");
  await fs.writeFile(out, ts, "utf8");
  console.log(`\nWrote ${out}`);
}

await main();
