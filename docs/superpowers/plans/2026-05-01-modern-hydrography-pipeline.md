---
type: reference
status: reference
tags: [doc]
updated: 2026-05-01
---

# Modern Hydrography Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn modern river and water-system data into a first-class, validated asset pipeline for the Qinling Atlas and future 3D terrain presentation.

**Architecture:** Keep modern hydrography separate from hand-authored Atlas features. Build a pure model for water features, LOD filtering, source/confidence metadata, and DEM relationship checks before wiring it into rendering. Historical hydrography remains an `Era Overlay` concern and is not populated in this phase.

**Tech Stack:** Vite, TypeScript, Three.js, Node test runner, JSON region assets, existing DEM sampler and Atlas render modules.

---

## File Structure

- Create `src/game/hydrographyModel.js`: pure helpers for water feature normalization, LOD filtering, source metadata, and route/POI relation fields.
- Create `src/game/hydrographyModel.d.ts`: TypeScript declarations.
- Create `scripts/hydrography-model.test.mjs`: model tests.
- Create `public/data/regions/qinling/hydrography/modern.json`: curated first modern hydrography asset for Qinling.
- Create `scripts/qinling-hydrography-asset.test.mjs`: asset coverage tests for required modern rivers.
- Modify `package.json`: add tests to `npm test`.
- Modify `src/game/qinlingAtlas.js`: keep compatibility exports but prepare to derive water features from hydrography asset later.
- Modify `docs/development-task-list.md`, `docs/context-summary.md`, and `docs/next-phase-plan.md`: make modern hydrography a named priority.

## Task 1: Hydrography Pure Model

**Files:**

- Create: `src/game/hydrographyModel.js`
- Create: `src/game/hydrographyModel.d.ts`
- Create: `scripts/hydrography-model.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the failing test**

```js
import assert from "node:assert/strict";
import test from "node:test";

import {
  hydrographyFeatureKey,
  hydrographyVisibleAtLod,
  normalizeHydrographyFeature
} from "../src/game/hydrographyModel.js";

test("normalizes a modern river with required source metadata", () => {
  const feature = normalizeHydrographyFeature({
    id: "river-hanjiang",
    name: "汉江/汉水",
    kind: "river",
    rank: 1,
    basin: "长江流域",
    eraId: "modern",
    source: { name: "curated-modern-qinling", confidence: "medium" },
    geometry: { points: [{ x: 0, y: 0 }, { x: 10, y: 5 }] }
  });

  assert.equal(feature.eraId, "modern");
  assert.equal(feature.source.confidence, "medium");
  assert.equal(hydrographyFeatureKey(feature), "modern:river-hanjiang");
});

test("filters hydrography by lod and river rank", () => {
  const river = normalizeHydrographyFeature({
    id: "river-weihe",
    name: "渭河",
    kind: "river",
    rank: 1,
    basin: "黄河流域",
    eraId: "modern",
    source: { name: "curated-modern-qinling", confidence: "medium" },
    geometry: { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] }
  });
  const stream = normalizeHydrographyFeature({
    id: "stream-xieshui",
    name: "斜水",
    kind: "stream",
    rank: 3,
    basin: "黄河流域",
    eraId: "modern",
    source: { name: "curated-modern-qinling", confidence: "medium" },
    geometry: { points: [{ x: 0, y: 0 }, { x: 2, y: 3 }] }
  });

  assert.equal(hydrographyVisibleAtLod(river, "l0"), true);
  assert.equal(hydrographyVisibleAtLod(stream, "l0"), false);
  assert.equal(hydrographyVisibleAtLod(stream, "l1"), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/hydrography-model.test.mjs`

Expected: fail because `src/game/hydrographyModel.js` does not exist.

- [ ] **Step 3: Write minimal implementation**

```js
const LOD_MAX_RANK = {
  l0: 1,
  l1: 3,
  l2: 6
};

export function normalizeHydrographyFeature(raw) {
  return {
    aliases: [],
    relations: [],
    ...raw,
    eraId: raw.eraId ?? "modern",
    source: {
      name: raw.source.name,
      confidence: raw.source.confidence
    }
  };
}

export function hydrographyFeatureKey(feature) {
  return `${feature.eraId}:${feature.id}`;
}

export function hydrographyVisibleAtLod(feature, lod) {
  return feature.rank <= LOD_MAX_RANK[lod];
}
```

- [ ] **Step 4: Add declarations**

```ts
export type HydrographyKind =
  | "river"
  | "stream"
  | "canal"
  | "lake"
  | "wetland"
  | "reservoir"
  | "confluence";

export type HydrographyConfidence = "high" | "medium" | "low";
export type HydrographyLod = "l0" | "l1" | "l2";

export interface HydrographyPoint {
  x: number;
  y: number;
}

export interface HydrographyFeature {
  id: string;
  name: string;
  aliases: string[];
  kind: HydrographyKind;
  rank: number;
  basin: string;
  eraId: string;
  source: {
    name: string;
    confidence: HydrographyConfidence;
  };
  relations: string[];
  geometry: {
    points: HydrographyPoint[];
  };
}

export function normalizeHydrographyFeature(
  raw: Omit<HydrographyFeature, "aliases" | "relations"> &
    Partial<Pick<HydrographyFeature, "aliases" | "relations">>
): HydrographyFeature;

export function hydrographyFeatureKey(feature: HydrographyFeature): string;
export function hydrographyVisibleAtLod(
  feature: HydrographyFeature,
  lod: HydrographyLod
): boolean;
```

- [ ] **Step 5: Add test to package script**

Add `scripts/hydrography-model.test.mjs` to the existing `npm test` command.

- [ ] **Step 6: Run focused test**

Run: `node --test scripts/hydrography-model.test.mjs`

Expected: 2 passing tests.

## Task 2: Qinling Modern Hydrography Asset

**Files:**

- Create: `public/data/regions/qinling/hydrography/modern.json`
- Create: `scripts/qinling-hydrography-asset.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write failing asset coverage test**

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const asset = JSON.parse(
  await readFile("public/data/regions/qinling/hydrography/modern.json", "utf8")
);

test("Qinling modern hydrography asset declares modern base metadata", () => {
  assert.equal(asset.regionId, "qinling");
  assert.equal(asset.eraId, "modern");
  assert.equal(asset.basePolicy, "modern-hydrography");
});

test("Qinling modern hydrography includes first required river skeleton", () => {
  const names = asset.features.map((feature) => feature.name);

  ["渭河", "汉江/汉水", "嘉陵江", "褒河", "斜水"].forEach((name) => {
    assert.ok(names.includes(name), `${name} must be present`);
  });
});

test("all hydrography features have source confidence and at least two points", () => {
  asset.features.forEach((feature) => {
    assert.ok(["high", "medium", "low"].includes(feature.source.confidence));
    assert.ok(feature.geometry.points.length >= 2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/qinling-hydrography-asset.test.mjs`

Expected: fail because `modern.json` does not exist.

- [ ] **Step 3: Create first curated asset**

Create `public/data/regions/qinling/hydrography/modern.json`:

```json
{
  "schema": "visual-china.region-hydrography.v1",
  "regionId": "qinling",
  "eraId": "modern",
  "basePolicy": "modern-hydrography",
  "notes": [
    "First curated modern hydrography skeleton for Qinling Atlas.",
    "Coordinates are current project world coordinates and must be replaced or corrected by imported vector sources in later pipeline steps."
  ],
  "features": [
    {
      "id": "river-weihe",
      "name": "渭河",
      "kind": "river",
      "rank": 1,
      "basin": "黄河流域",
      "eraId": "modern",
      "source": { "name": "curated-modern-qinling", "confidence": "medium" },
      "relations": ["city-changan", "city-xianyang", "city-baoji-chencang"],
      "geometry": { "points": [{ "x": 24, "y": 72 }, { "x": 48, "y": 70 }, { "x": 70, "y": 69 }, { "x": 90, "y": 68 }] }
    },
    {
      "id": "river-hanjiang",
      "name": "汉江/汉水",
      "aliases": ["汉水"],
      "kind": "river",
      "rank": 1,
      "basin": "长江流域",
      "eraId": "modern",
      "source": { "name": "curated-modern-qinling", "confidence": "medium" },
      "relations": ["city-hanzhong", "road-jinniu-jianmen"],
      "geometry": { "points": [{ "x": -8, "y": 3 }, { "x": 14, "y": 8 }, { "x": 26, "y": 9 }, { "x": 42, "y": 7 }, { "x": 62, "y": 0 }] }
    },
    {
      "id": "river-jialingjiang",
      "name": "嘉陵江",
      "kind": "river",
      "rank": 1,
      "basin": "长江流域",
      "eraId": "modern",
      "source": { "name": "curated-modern-qinling", "confidence": "medium" },
      "relations": ["city-guangyuan", "city-zhaohua", "pass-jianmen"],
      "geometry": { "points": [{ "x": -8, "y": 3 }, { "x": -12, "y": -20 }, { "x": -10, "y": -28 }, { "x": -8, "y": -64 }] }
    },
    {
      "id": "stream-baohe",
      "name": "褒河",
      "kind": "stream",
      "rank": 3,
      "basin": "汉江流域",
      "eraId": "modern",
      "source": { "name": "curated-modern-qinling", "confidence": "medium" },
      "relations": ["road-baoxie", "military-shimen"],
      "geometry": { "points": [{ "x": 24, "y": 11 }, { "x": 30, "y": 18 }, { "x": 34, "y": 28 }, { "x": 38, "y": 39 }] }
    },
    {
      "id": "stream-xieshui",
      "name": "斜水",
      "kind": "stream",
      "rank": 3,
      "basin": "黄河流域",
      "eraId": "modern",
      "source": { "name": "curated-modern-qinling", "confidence": "medium" },
      "relations": ["road-baoxie"],
      "geometry": { "points": [{ "x": 58, "y": 70 }, { "x": 51, "y": 58 }, { "x": 44, "y": 48 }, { "x": 38, "y": 39 }] }
    }
  ]
}
```

- [ ] **Step 4: Add asset test to package script**

Add `scripts/qinling-hydrography-asset.test.mjs` to `npm test`.

- [ ] **Step 5: Run focused test**

Run: `node --test scripts/qinling-hydrography-asset.test.mjs`

Expected: 3 passing tests.

## Task 3: Hydrography-To-Atlas Conversion

**Files:**

- Create: `src/game/hydrographyAtlas.js`
- Create: `src/game/hydrographyAtlas.d.ts`
- Create: `scripts/hydrography-atlas.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write failing conversion test**

```js
import assert from "node:assert/strict";
import test from "node:test";

import { hydrographyFeatureToAtlasFeature } from "../src/game/hydrographyAtlas.js";

test("converts a modern river to an atlas water feature", () => {
  const atlasFeature = hydrographyFeatureToAtlasFeature({
    id: "river-weihe",
    name: "渭河",
    aliases: [],
    kind: "river",
    rank: 1,
    basin: "黄河流域",
    eraId: "modern",
    source: { name: "curated-modern-qinling", confidence: "medium" },
    relations: ["city-changan"],
    geometry: { points: [{ x: 0, y: 0 }, { x: 10, y: 1 }] }
  });

  assert.equal(atlasFeature.layer, "water");
  assert.equal(atlasFeature.geometry, "polyline");
  assert.equal(atlasFeature.visualRule.emphasis, "main-river");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/hydrography-atlas.test.mjs`

Expected: fail because `src/game/hydrographyAtlas.js` does not exist.

- [ ] **Step 3: Implement converter**

```js
export function hydrographyFeatureToAtlasFeature(feature) {
  const mainRiver = feature.rank <= 1;

  return {
    id: `water-${feature.id}`,
    name: feature.name,
    layer: "water",
    geometry: feature.kind === "lake" || feature.kind === "wetland" ? "area" : "polyline",
    world: feature.geometry,
    displayPriority: mainRiver ? 10 : 7,
    terrainRole: mainRiver ? "main-river" : "tributary-river",
    themes: ["terrain", "livelihood"],
    copy: {
      summary: `${feature.name}是${feature.basin}的${mainRiver ? "主干水系" : "支流水系"}，用于解释地貌、聚落和道路关系。`
    },
    visualRule: {
      symbol: mainRiver ? "main-river-line" : "tributary-line",
      color: "#5eb8c9",
      emphasis: mainRiver ? "main-river" : "tributary"
    }
  };
}
```

- [ ] **Step 4: Add declarations**

Declare `hydrographyFeatureToAtlasFeature(feature: HydrographyFeature): QinlingAtlasFeature`.

- [ ] **Step 5: Run conversion test**

Run: `node --test scripts/hydrography-atlas.test.mjs`

Expected: conversion test passes.

## Task 4: Documentation And Priority Update

**Files:**

- Modify: `docs/context-summary.md`
- Modify: `docs/development-task-list.md`
- Modify: `docs/next-phase-plan.md`
- Modify: `docs/README.md`

- [ ] **Step 1: Update context summary**

Add:

```md
- 现代水系：已提升为独立事实层规划，近期优先做准现代河网；历史河道进入未来 Era Overlay。
```

- [ ] **Step 2: Update task list**

Add P2.6:

```md
## P2.6 现代水系准确化

| ID | 任务 | 状态 | 验收标准 |
| --- | --- | --- | --- |
| P2.6-1 | Hydrography 数据模型 | 待执行 | 水系 feature 有名称、等级、流域、来源、可信度和关系字段 |
| P2.6-2 | 秦岭现代水系资产 | 待执行 | 渭河、汉江/汉水、嘉陵江、褒河、斜水进入独立 hydrography asset |
| P2.6-3 | 水系 LOD 规则 | 待执行 | L0/L1/L2 能按 rank 控制显示密度 |
| P2.6-4 | 水系 DEM 校验 | 待执行 | 能报告河线与低地/谷地不吻合的位置 |
```

- [ ] **Step 3: Update README docs index**

Link the design and plan under architecture documents.

- [ ] **Step 4: Run diff check**

Run: `git diff --check`

Expected: no whitespace errors.

## Final Verification

- [ ] Run `npm test`.
- [ ] Run `npm run verify:dem`.
- [ ] Run `npm run build`.
- [ ] Open Atlas Workbench and confirm existing water layer still renders.
- [ ] Commit with `docs: define modern hydrography pipeline` for documentation-only work, or `feat: add modern hydrography asset` if implementation tasks are included.
