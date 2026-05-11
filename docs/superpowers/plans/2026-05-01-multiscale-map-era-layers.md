---
type: reference
status: reference
tags: [doc]
updated: 2026-05-01
---

# Multiscale Map Era Layers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a future-proof multiscale map architecture where the current Qinling map acts as an Overworld, gate nodes can lead to future local scenes, and historical era overlays are represented as future data layers while modern terrain remains the current base.

**Architecture:** Keep the current modern Qinling DEM and Atlas as the source of truth. Add small, testable data contracts for gate entrances and era overlays before adding any real scene switching. Implement visible gate stubs first, then add local scene manifests and era overlay selection only when the Atlas basics are stable.

**Tech Stack:** Vite, TypeScript, Three.js, Node test runner, JSON region assets, existing `qinlingAtlas` feature model.

---

## File Structure

- Create `src/game/mapScaleModel.js`: pure data helpers for map scale, gate availability, and era overlay policy.
- Create `src/game/mapScaleModel.d.ts`: TypeScript declarations for the pure helpers.
- Create `scripts/map-scale-model.test.mjs`: regression tests for modern base policy, gate stubs, and era overlay metadata.
- Modify `src/game/qinlingAtlas.js`: add `gate` layer and a small first batch of stub entrance features.
- Modify `src/game/qinlingAtlas.d.ts`: extend layer and feature typings for gate metadata.
- Modify `src/game/hud.ts`: render gate cards with “未来可进入局部场景” language.
- Modify `src/main.ts`: draw gate nodes in Atlas and select them through existing hit testing.
- Modify `docs/development-task-list.md`: add multiscale map tasks without moving current Atlas zoom/water/POI work out of priority.

## Task 1: Pure Multiscale Data Contract

**Files:**

- Create: `src/game/mapScaleModel.js`
- Create: `src/game/mapScaleModel.d.ts`
- Create: `scripts/map-scale-model.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the failing test**

```js
import assert from "node:assert/strict";
import test from "node:test";

import {
  createModernEraOverlay,
  gateEntranceLabel,
  isGateEnterable
} from "../src/game/mapScaleModel.js";

test("modern era overlay keeps modern DEM as the base terrain", () => {
  const modern = createModernEraOverlay();

  assert.equal(modern.eraId, "modern");
  assert.equal(modern.baseTerrainPolicy, "modern-dem");
  assert.deepEqual(modern.features, []);
});

test("gate stubs are visible but not enterable yet", () => {
  const gate = {
    availability: "stub",
    targetSceneId: "local-guanzhong-plain"
  };

  assert.equal(isGateEnterable(gate), false);
  assert.equal(gateEntranceLabel(gate), "未来可进入局部场景");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/map-scale-model.test.mjs`

Expected: fail because `src/game/mapScaleModel.js` does not exist.

- [ ] **Step 3: Write minimal implementation**

```js
export function createModernEraOverlay() {
  return {
    eraId: "modern",
    label: "现代基础地形",
    baseTerrainPolicy: "modern-dem",
    features: []
  };
}

export function isGateEnterable(gate) {
  return gate.availability === "enterable";
}

export function gateEntranceLabel(gate) {
  return isGateEnterable(gate) ? "进入局部场景" : "未来可进入局部场景";
}
```

- [ ] **Step 4: Add declarations**

```ts
export type GateAvailability = "stub" | "enterable" | "locked";

export interface GateEntranceLike {
  availability: GateAvailability;
  targetSceneId: string;
}

export interface EraOverlay {
  eraId: string;
  label: string;
  baseTerrainPolicy: "modern-dem" | "modern-dem-with-overlay";
  features: string[];
}

export function createModernEraOverlay(): EraOverlay;
export function isGateEnterable(gate: GateEntranceLike): boolean;
export function gateEntranceLabel(gate: GateEntranceLike): string;
```

- [ ] **Step 5: Add test script to `npm test`**

Add `scripts/map-scale-model.test.mjs` to the existing `test` command in `package.json`.

- [ ] **Step 6: Run focused test**

Run: `node --test scripts/map-scale-model.test.mjs`

Expected: 2 passing tests.

## Task 2: Gate Layer In Atlas Data

**Files:**

- Modify: `src/game/qinlingAtlas.js`
- Modify: `src/game/qinlingAtlas.d.ts`
- Modify: `scripts/qinling-atlas-coverage.test.mjs`

- [ ] **Step 1: Write failing coverage test**

```js
test("Qinling atlas exposes first gate entrance stubs", () => {
  const gateNames = qinlingAtlasFeatures
    .filter((feature) => feature.layer === "gate")
    .map((feature) => feature.name);

  assert.ok(gateNames.includes("进入关中平原"));
  assert.ok(gateNames.includes("进入陈仓道"));
  assert.ok(gateNames.includes("进入剑门关"));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/qinling-atlas-coverage.test.mjs`

Expected: fail because no `gate` layer/features exist.

- [ ] **Step 3: Extend layer type**

Add `"gate"` to `QinlingAtlasLayerId` in `src/game/qinlingAtlas.d.ts`.

- [ ] **Step 4: Add gate layer**

Add this layer after `pass`:

```js
{
  id: "gate",
  name: "入口",
  defaultVisible: true,
  description: "从总览地图进入未来局部场景的地理入口。"
}
```

- [ ] **Step 5: Add first gate features**

Add point features using existing strict world coordinates:

```js
const gateSymbol = {
  symbol: "scene-gate",
  color: "#f0d37d",
  emphasis: "local-scene-entry"
};
```

Use feature metadata:

```js
feature({
  id: "gate-guanzhong-plain",
  name: "进入关中平原",
  layer: "gate",
  geometry: "point",
  world: point(78, 72),
  displayPriority: 10,
  terrainRole: "plain-entry",
  summary: "未来从这里进入更细的关中平原局部场景，观察城市、农田、水渠和山前道路。",
  visualRule: gateSymbol,
  themes: ["terrain", "livelihood"],
  gate: {
    targetSceneId: "local-guanzhong-plain",
    entryType: "plain",
    availability: "stub"
  }
})
```

Repeat for `gate-chencang-road` and `gate-jianmen-pass`.

- [ ] **Step 6: Run Atlas coverage test**

Run: `node --test scripts/qinling-atlas-coverage.test.mjs`

Expected: all Atlas coverage tests pass.

## Task 3: Render Gate Nodes In Atlas

**Files:**

- Modify: `src/main.ts`
- Modify: `src/game/hud.ts`
- Test: existing `scripts/atlas-render-policy.test.mjs` and `scripts/atlas-workbench-state.test.mjs`

- [ ] **Step 1: Add gate draw order test**

In `scripts/atlas-render-policy.test.mjs`, assert gate appears after pass and before military:

```js
assert.ok(atlasLayerDrawOrder.indexOf("gate") > atlasLayerDrawOrder.indexOf("pass"));
assert.ok(atlasLayerDrawOrder.indexOf("gate") < atlasLayerDrawOrder.indexOf("military"));
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/atlas-render-policy.test.mjs`

Expected: fail until `gate` is added to draw order.

- [ ] **Step 3: Update draw order**

Add `"gate"` to `atlasLayerDrawOrder` in `src/game/atlasRender.js`.

- [ ] **Step 4: Draw gate symbols**

In `drawAtlasFeature`, treat `feature.layer === "gate"` point features as diamond or doorway symbols with warm outline, visually distinct from city dots and pass squares.

- [ ] **Step 5: Render gate-specific card copy**

In `src/game/hud.ts`, when `feature.layer === "gate"` and `feature.gate?.availability === "stub"`, append:

```html
<span>入口状态：未来可进入局部场景</span>
```

- [ ] **Step 6: Run focused tests and build**

Run:

```bash
node --test scripts/atlas-render-policy.test.mjs scripts/qinling-atlas-coverage.test.mjs
npm run build
```

Expected: tests pass and production build succeeds.

## Task 4: Document Era Overlay As Future-Only

**Files:**

- Modify: `docs/context-summary.md`
- Modify: `docs/development-task-list.md`
- Modify: `docs/next-phase-plan.md`

- [ ] **Step 1: Update context summary**

Add a short architecture note:

```md
- 多尺度地图：当前秦岭切片是 Overworld Atlas；入口节点未来连接 Local Scene。
- 历史年代层：近期不填充内容，以现代 DEM 为基础，未来通过 Era Overlay 表达河道、湖泽、关隘和城市意义变化。
```

- [ ] **Step 2: Update task list**

Add P3 tasks:

```md
| P3-7 | Gate Entrance stubs | 待执行 | 总览地图可显示局部场景入口，但暂不切换场景 |
| P3-8 | Local Scene manifest contract | 待执行 | 可描述局部场景范围、入口、返回点和资产 |
| P3-9 | Era Overlay contract | 待执行 | 现代为基础，历史要素作为 overlay 数据层 |
```

- [ ] **Step 3: Run markdown/diff verification**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors and only intended files modified.

## Final Verification

- [ ] Run `npm test`.
- [ ] Run `npm run verify:dem`.
- [ ] Run `npm run build`.
- [ ] Open the app in the in-app browser.
- [ ] Press `M` to open Atlas Workbench.
- [ ] Confirm gate layer is visible and gate cards say they are future local-scene entrances.
- [ ] Commit with `feat: add multiscale map gate architecture`.
