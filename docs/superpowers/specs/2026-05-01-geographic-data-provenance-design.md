---
type: reference
status: reference
tags: [doc]
updated: 2026-05-01
---

# Geographic Data Provenance Design

## Goal

Every visible geographic feature must be traceable to a real data source or explicitly treated as an unverified draft. The map must not present LLM-derived or hand-sketched geometry as factual geography.

## Default Rule

- DEM raster relief may remain visible as the base landform evidence.
- Imported vector data may render by default when it carries source metadata, such as `openstreetmap-overpass`.
- Hand-drawn landform polygons, early curated river skeletons, ancient route sketches, and narrative/cultural interpretation layers are `unverified` by default.
- Unverified features stay in the repository for QA and future replacement, but the runtime does not draw them as player-facing facts.

## Current Impact

- The guessed basin/plain polygons are no longer rendered as atlas facts.
- The early hand-drawn Qinling water skeleton is no longer rendered as a factual water layer.
- Hand-drawn ancient road corridors and route-affinity movement bonuses are disabled by default until those routes are rebuilt from verified historical/geographic sources.
- City, pass, and road layers default to hidden until each point/line receives source-backed coordinates.

## Next Data Work

1. Use OSM/Natural Earth or official administrative/geographic vector data for modern cities, rivers, lakes, and terrain reference labels.
2. Derive landform regions from DEM analysis or import authoritative geomorphology datasets instead of drawing rectangles by hand.
3. Treat historical roads, passes, and era-specific layers as separate scholarly datasets with source citations and uncertainty ranges.
