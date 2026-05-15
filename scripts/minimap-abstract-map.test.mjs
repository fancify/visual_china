import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  abstractMinimapTerrainKindForGeo,
  minimapTerrainColorForSample,
  minimapNightOverlayForTime,
  minimapPoiVisibleInMode
} from "../src/game/terrain/minimap.ts";

test("abstract minimap terrain separates ocean, plains, and mountain regions", () => {
  assert.equal(abstractMinimapTerrainKindForGeo(38.8, 122.4), "ocean");
  assert.equal(abstractMinimapTerrainKindForGeo(34.3, 114.0), "lowland");
  assert.equal(abstractMinimapTerrainKindForGeo(34.2, 107.5), "mountain");
  assert.equal(abstractMinimapTerrainKindForGeo(31.5, 91.0), "plateau");
});

test("abstract minimap keeps major sea basins as ocean", () => {
  assert.equal(abstractMinimapTerrainKindForGeo(39.0, 119.6), "ocean", "Bohai Bay should be ocean");
  assert.equal(abstractMinimapTerrainKindForGeo(34.0, 123.0), "ocean", "Yellow Sea should be ocean");
  assert.equal(abstractMinimapTerrainKindForGeo(20.9, 108.5), "ocean", "Beibu Gulf should be ocean");
  assert.equal(abstractMinimapTerrainKindForGeo(19.5, 91.5), "ocean", "Bay of Bengal edge should be ocean");
});

test("compact minimap only shows the four requested cities", () => {
  assert.equal(minimapPoiVisibleInMode({ id: "changan", hierarchy: "gravity" }, "compact", 1), true);
  assert.equal(minimapPoiVisibleInMode({ id: "taiyuan", hierarchy: "gravity" }, "compact", 1), true);
  assert.equal(minimapPoiVisibleInMode({ id: "yangzhou", hierarchy: "gravity" }, "compact", 1), true);
  assert.equal(minimapPoiVisibleInMode({ id: "yizhou", hierarchy: "gravity" }, "compact", 1), true);
  assert.equal(minimapPoiVisibleInMode({ id: "luoyang", hierarchy: "gravity" }, "compact", 1), false);
  assert.equal(minimapPoiVisibleInMode({ id: "huashan", hierarchy: "large" }, "compact", 1), false);
});

test("DEM minimap color ramp reads as ocean, lowland, mountain, and river", () => {
  const ocean = minimapTerrainColorForSample({ height: 0, river: 0, shade: 0.5, fallbackKind: "ocean" });
  const lowland = minimapTerrainColorForSample({ height: 260, river: 0, shade: 0.5, fallbackKind: "lowland" });
  const mountain = minimapTerrainColorForSample({ height: 2600, river: 0, shade: 0.72, fallbackKind: "mountain" });
  const river = minimapTerrainColorForSample({ height: 220, river: 0.8, shade: 0.5, fallbackKind: "lowland" });

  assert.ok(ocean.b > ocean.r, "ocean should be blue-leaning");
  assert.ok(lowland.g >= lowland.r, "lowland should lean green");
  assert.ok(mountain.r >= lowland.r, "high terrain should warm and brighten against lowland");
  assert.ok(river.b > lowland.b, "river overlay should push water blue into land samples");
});

test("minimap night overlay darkens after dusk and clears by day", () => {
  assert.equal(minimapNightOverlayForTime(12).alpha, 0);
  assert.equal(minimapNightOverlayForTime(0).alpha, 0.42);
  assert.ok(minimapNightOverlayForTime(20).alpha > minimapNightOverlayForTime(18).alpha);
  assert.ok(minimapNightOverlayForTime(5.5).alpha > minimapNightOverlayForTime(7).alpha);
});


test("fullscreen minimap preserves existing POI progression", () => {
  assert.equal(minimapPoiVisibleInMode({ id: "changan", hierarchy: "gravity" }, "fullscreen", 1), true);
  assert.equal(minimapPoiVisibleInMode({ id: "huashan", hierarchy: "large" }, "fullscreen", 1), true);
  assert.equal(minimapPoiVisibleInMode({ id: "taishan", hierarchy: "medium" }, "fullscreen", 1.4), false);
  assert.equal(minimapPoiVisibleInMode({ id: "taishan", hierarchy: "medium" }, "fullscreen", 1.6), true);
  assert.equal(minimapPoiVisibleInMode({ id: "baima-si", hierarchy: "small" }, "fullscreen", 2.9), false);
  assert.equal(minimapPoiVisibleInMode({ id: "baima-si", hierarchy: "small" }, "fullscreen", 3.1), true);
});

test("minimap source draws a DEM atlas before POI markers with abstract fallback", async () => {
  const source = await readFile(
    new URL("../src/game/terrain/minimap.ts", import.meta.url),
    "utf8"
  );

  assert.match(source, /loadMinimapTerrainAtlas/);
  assert.match(source, /drawTerrainAtlas/);
  assert.match(source, /drawAbstractTerrainMap/);
  assert.match(source, /drawMountainBrushes/);
  assert.doesNotMatch(source, /drawCoastStroke/);
  assert.doesNotMatch(source, /drawSeaTexture/);
  assert.match(source, /COMPACT_CITY_IDS/);
  assert.ok(source.indexOf("drawTerrainBaseMap();") < source.indexOf("for (const poi of POI_REGISTRY)"));
});
