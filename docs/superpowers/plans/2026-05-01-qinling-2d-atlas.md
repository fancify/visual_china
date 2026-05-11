---
type: reference
status: reference
tags: [doc]
updated: 2026-05-01
---

# Qinling 2D Atlas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 2D atlas-first foundation that makes the Qinling slice geographically readable before projecting information into 3D.

**Architecture:** Atlas features live in a pure data module. Rendering policy lives in a small helper module. The 3D scene consumes water and route features from the atlas instead of hand-authored debug markers.

**Tech Stack:** Vite, TypeScript, Three.js, Node test runner.

---

### Task 1: Atlas Data Contract

**Files:**
- Create: `src/game/qinlingAtlas.js`
- Create: `src/game/qinlingAtlas.d.ts`
- Create: `scripts/qinling-atlas-coverage.test.mjs`
- Modify: `package.json`

- [x] Write a failing Node test that imports `qinlingAtlasFeatures`, `qinlingAtlasLayers`, `qinlingAtlasPolicy`, `qinlingAtlasRequiredNames`, and `qinlingWaterSystem`.
- [x] Assert required default layers: `landform`, `water`, `city`, `pass`, `road`, `military`, `livelihood`, `culture`.
- [x] Assert required geography names include key landforms, rivers, cities, passes, and roads.
- [x] Implement the atlas module as pure JavaScript data with TypeScript declarations.
- [x] Run `node --test scripts/qinling-atlas-coverage.test.mjs` and confirm it passes.

### Task 2: Overview Render Policy

**Files:**
- Create: `src/game/atlasRender.js`
- Create: `src/game/atlasRender.d.ts`
- Create: `scripts/atlas-render-policy.test.mjs`
- Modify: `package.json`

- [x] Write a failing test for default visible layers, layer draw order, and strict world-to-canvas projection.
- [x] Implement `atlasVisibleFeatures`, `worldPointToOverviewPixel`, and `featureWorldPoints`.
- [x] Run `node --test scripts/atlas-render-policy.test.mjs` and confirm it passes.

### Task 3: Runtime Integration

**Files:**
- Modify: `src/main.ts`
- Modify: `src/game/routeRibbon.js`
- Modify: `scripts/route-ribbon.test.mjs`

- [x] Replace hard-coded overview route/landform drawing with Atlas-driven drawing.
- [x] Render landforms, water, roads, cities, and passes from the same feature list.
- [x] Add 3D water-system visuals as narrow blue terrain-following ribbons.
- [x] Reduce route ribbon width and opacity so it reads as a guide overlay instead of opaque terrain.
- [x] Run `npm test` and `npm run build`.

### Task 4: Documentation

**Files:**
- Create: `docs/qinling-2d-atlas-pipeline.md`
- Create: `docs/superpowers/specs/2026-05-01-qinling-2d-atlas-design.md`
- Create: `docs/superpowers/plans/2026-05-01-qinling-2d-atlas.md`

- [x] Document the 2D atlas-first pipeline and current layer inventory.
- [x] Document what is intentionally out of scope for this pass.
- [x] Record the next implementation steps for layer UI, feature cards, water terrain styling, variable terrain granularity, and movement effects.
