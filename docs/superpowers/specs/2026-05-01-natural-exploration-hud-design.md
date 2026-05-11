---
type: reference
status: reference
tags: [doc]
updated: 2026-05-01
---

# Natural Exploration HUD Design

## Goal

The default Qinling slice should prioritize natural environment reading and free roaming. Terrain, water, vegetation, sky, weather, and movement should occupy the player's attention; UI should behave like a lightweight map overlay rather than a game quest dashboard.

## Default Hidden Chrome

- Hide view-mode switching in normal play. The scene stays in the natural terrain view by default.
- Hide journey, mainline, story progress, collection status, and journal panels by default.
- Hide development wording such as Atlas Workbench from the player-facing full-screen map.
- Do not expose military, livelihood, culture, or story interpretation as default 3D labels.

## Default Visible Chrome

- Keep a compact title/loading pill only while the prototype needs load feedback.
- Keep a small floating map pill. The map can expand locally or open full-screen with `M`.
- Keep a collapsed operation hint pill for movement, camera, map, time, weather, and season controls.
- Keep toast support for short transient feedback, but do not use it as a persistent quest UI.

## Full-Screen Map Direction

The full-screen map is the main geographic reading surface, similar in spirit to a Google Maps overlay: large canvas first, controls and explanatory text second. It should support zooming, panning, feature selection, and layer checks without covering the actual map with heavy panels.

## Current Scope

This design only cleans up the interface and default visibility. It does not remove the underlying story, journal, route, or atlas data systems, because those will still be useful later as optional layers after the natural environment is readable.
