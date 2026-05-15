import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  advancePyramidTimePreset,
  PYRAMID_TIME_PRESETS,
  pyramidTimePresetAfter
} from "../src/game/pyramidEnvironmentControls.ts";

test("pyramid demo cycles a fixed set of sky times from key 1", () => {
  assert.deepEqual(
    PYRAMID_TIME_PRESETS.map((preset) => preset.label),
    ["深夜", "黎明", "清晨", "正午", "黄昏", "初夜"]
  );
  assert.equal(pyramidTimePresetAfter(17.8).label, "初夜");
  assert.equal(pyramidTimePresetAfter(20.5).label, "深夜");
  assert.equal(pyramidTimePresetAfter(23.2).label, "深夜");
  assert.equal(pyramidTimePresetAfter(0).label, "黎明");
});

test("advancePyramidTimePreset updates the environment clock without advancing weather", () => {
  const environment = {
    state: {
      timeOfDay: 17.8,
      weather: "clear"
    },
    transition: {
      to: "rain"
    }
  };

  const preset = advancePyramidTimePreset(environment);
  assert.equal(preset.label, "初夜");
  assert.equal(environment.state.timeOfDay, 20.5);
  assert.equal(environment.state.weather, "clear");
  assert.equal(environment.transition.to, "rain");
});

// 2026-05-15: control redesign — 1/2/3 散键迁到 T/L/K 主键位 + InputManager 订阅。
// 旧契约 (e.key === "1"/"2"/"3") 已废，替换为 action-based 契约。
test("pyramid demo exposes T/L/K keys for time, season, and weather via InputManager", async () => {
  const html = await readFile(
    new URL("../pyramid-demo.html", import.meta.url),
    "utf8"
  );
  const source = await readFile(
    new URL("../src/pyramid-demo.ts", import.meta.url),
    "utf8"
  );

  assert.match(html, /T:\s*时辰/);
  assert.match(html, /L:\s*季节/);
  assert.match(html, /K:\s*天气/);
  assert.match(source, /inputManager\.on\("world\.cycleTime"/);
  assert.match(source, /inputManager\.on\("world\.cycleSeason"/);
  assert.match(source, /inputManager\.on\("world\.cycleWeather"/);
});

test("pyramid environment runtime stays independent from terrain shader enhancements", async () => {
  const source = await readFile(
    new URL("../src/game/pyramidEnvironmentRuntime.ts", import.meta.url),
    "utf8"
  );

  assert.doesNotMatch(source, /terrainShaderEnhancer/);
  assert.doesNotMatch(source, /attachTerrainShaderEnhancements/);
  assert.doesNotMatch(source, /positionLod0|positionLod1/);
});

test("pyramid environment runtime includes clouds but not precipitation in phase two", async () => {
  const source = await readFile(
    new URL("../src/game/pyramidEnvironmentRuntime.ts", import.meta.url),
    "utf8"
  );

  assert.match(source, /updateCloudLayer/);
  assert.match(source, /PyramidCloudEnvironmentTarget/);
  assert.doesNotMatch(source, /createPrecipitationLayer|PrecipitationHandle/);
});

test("pyramid environment runtime consumes climate context without terrain shader coupling", async () => {
  const source = await readFile(
    new URL("../src/game/pyramidEnvironmentRuntime.ts", import.meta.url),
    "utf8"
  );

  assert.match(source, /climateContextForWorldPosition/);
  assert.match(source, /computeVisuals\(\{\s*climate/);
  assert.doesNotMatch(source, /updateTerrainShaderHsl|cloudCookieTexture/);
});

test("pyramid environment runtime rotates stars and aligns sky warmth to the dome sun", async () => {
  const source = await readFile(
    new URL("../src/game/pyramidEnvironmentRuntime.ts", import.meta.url),
    "utf8"
  );

  assert.match(source, /northernCelestialPole/);
  assert.match(source, /starDomeSiderealAngle/);
  assert.match(source, /starDome\.setRotationFromAxisAngle/);
  assert.match(source, /skySunDirection/);
  assert.match(source, /sunDirection:\s*skySunDirection/);
});

test("pyramid demo keeps Line B query debugging and wind-manager cloud direction", async () => {
  const source = await readFile(
    new URL("../src/pyramid-demo.ts", import.meta.url),
    "utf8"
  );

  assert.match(source, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(source, /query\.get\("time"\)/);
  assert.match(source, /query\.get\("weather"\)/);
  assert.match(source, /query\.get\("season"\)/);
  assert.match(source, /new WindManager\(\)/);
  assert.match(source, /windManager\.update\(dt,\s*environmentController\.getWindState\(\)\)/);
});

test("pyramid preload keeps a white translucent veil over dynamic sky colors", async () => {
  const source = await readFile(
    new URL("../pyramid-demo.html", import.meta.url),
    "utf8"
  );

  assert.match(source, /rgba\(246,\s*249,\s*244,\s*0\.[1-9]/);
  assert.doesNotMatch(source, /rgba\(246,\s*249,\s*244,\s*0\)/);
});
