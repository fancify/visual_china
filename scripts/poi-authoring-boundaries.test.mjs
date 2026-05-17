import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { POI_REGISTRY } from "../src/data/poiRegistry.generated.ts";
import { POI_VISUAL_OVERRIDES } from "../src/data/poiVisualOverrides.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const POI_DOC_ROOT = path.join(ROOT, "docs", "05-epoch", "tang-755");

const LINE_B_FORBIDDEN_VISUAL_FIELDS = new Set([
  "modelId",
  "modelHeight",
  "modelYOffset",
  "yOffset",
  "scale",
  "rotation",
  "rotationY",
  "worldOffset",
  "renderOrder",
  "lodDistance",
  "visibilityTier",
  "anchorPolicy"
]);

const LINE_A_FORBIDDEN_FACT_FIELDS = new Set([
  "name",
  "category",
  "lat",
  "lon",
  "geo",
  "historicalSummary",
  "sourceRefs",
  "sourceQuality",
  "epochId",
  "docPath"
]);

async function listMarkdownFiles(dir) {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...await listMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      out.push(fullPath);
    }
  }
  return out;
}

function parseFrontmatterKeys(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return [];
  return match[1]
    .split("\n")
    .map((line) => line.match(/^([A-Za-z_][A-Za-z0-9_]*):/))
    .filter(Boolean)
    .map((match_) => match_[1]);
}

function walkObjectKeys(value, visit) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item) => walkObjectKeys(item, visit));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    visit(key);
    walkObjectKeys(child, visit);
  }
}

test("Line B POI docs do not contain Line A 3D presentation fields", async () => {
  const files = await listMarkdownFiles(POI_DOC_ROOT);
  const violations = [];
  for (const file of files) {
    const raw = await fs.readFile(file, "utf8");
    for (const key of parseFrontmatterKeys(raw)) {
      if (LINE_B_FORBIDDEN_VISUAL_FIELDS.has(key)) {
        violations.push(`${path.relative(ROOT, file)}:${key}`);
      }
    }
  }

  assert.deepEqual(violations, []);
});

test("Line A POI visual overrides do not contain historical fact fields", () => {
  const violations = [];
  walkObjectKeys(POI_VISUAL_OVERRIDES, (key) => {
    if (LINE_A_FORBIDDEN_FACT_FIELDS.has(key)) {
      violations.push(key);
    }
  });

  assert.deepEqual(violations, []);
});

test("Line A POI visual overrides only target known Line B POI ids", () => {
  const knownIds = new Set(POI_REGISTRY.map((poi) => poi.id));
  const unknownIds = Object.keys(POI_VISUAL_OVERRIDES)
    .filter((id) => !knownIds.has(id))
    .sort();

  assert.deepEqual(unknownIds, []);
});
