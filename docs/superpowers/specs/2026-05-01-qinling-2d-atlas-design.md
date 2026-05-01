# Qinling 2D Atlas Design

## Summary

The Qinling slice needs a 2D atlas-first pipeline. The atlas is the authoritative information design layer for geography, water, routes, settlements, passes, and narrative POIs. The 3D scene consumes this data rather than inventing separate visual markers.

## Requirements

- Preserve strict geographic coordinate conversion between overview map and 3D world.
- Keep the default map readable by showing only core layers.
- Explicitly model visible water systems: 渭河、汉水、嘉陵江、褒水、斜水。
- Include historically and spatially important landforms, cities, passes, and roads.
- Give every feature gameplay-facing semantics: terrain role, visual rule, short copy, and display priority.
- Reduce debug-like yellow route surfaces in 3D.
- Add a first visible 3D water layer so the terrain no longer feels waterless.

## Architecture

- `src/game/qinlingAtlas.js` holds the atlas features and layer policy as pure data.
- `src/game/atlasRender.js` holds pure render helpers for filtering visible layers and projecting world coordinates onto the overview canvas.
- `src/main.ts` draws the overview from Atlas data and renders water/route guide layers into 3D.
- Tests cover atlas completeness, layer visibility policy, coordinate projection, and route overlay style.

## Data Flow

1. DEM and region content load as before.
2. Atlas data provides map information independently from the DEM.
3. Overview canvas renders DEM relief first, then atlas layers in order: landform, water, road, city, pass.
4. 3D scene receives water polylines as narrow blue ground ribbons and route polylines as weak guide overlays.
5. Future interaction can read the same Atlas feature objects for click cards and route/layer filtering.

## Out Of Scope For This Pass

- Fully accurate hydrological extraction from DEM.
- Final cartographic label collision avoidance.
- Full layer-toggle UI and clickable atlas cards.
- Production-grade 3D river materials.

## Validation

- `npm test` must include atlas coverage and render policy tests.
- `npm run build` must pass.
- Browser must load `http://127.0.0.1:5173/` and show the overview drawer without crashing.
