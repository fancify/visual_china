import assert from "node:assert/strict";
import test from "node:test";

import {
  celestialCycle,
  celestialVisibilityModifiers,
  rainbowPotential
} from "../src/game/celestial.js";
import { EnvironmentController } from "../src/game/environment.ts";

function luminance(color) {
  return color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;
}

test("clear night stays readable and exposes moon, stars, and clouds", () => {
  const visuals = celestialCycle({
    timeOfDay: 23,
    weatherSunCut: 0,
    fogBoost: 0,
    windStrength: 0.28
  });

  assert.ok(visuals.nightReadability >= 0.55);
  assert.ok(visuals.terrainLightnessFloor >= 1.12);
  assert.ok(visuals.moonOpacity >= 0.5);
  assert.ok(visuals.starOpacity >= 0.55);
  assert.ok(visuals.cloudOpacity >= 0.18);
  assert.ok(visuals.sunDiscOpacity < 0.1);
});

test("clear night lifts land readability without flattening it into daytime", () => {
  const controller = new EnvironmentController();

  controller.state.timeOfDay = 0;
  const midnight = controller.computeVisuals();
  controller.state.timeOfDay = 12;
  const noon = controller.computeVisuals();

  assert.ok(midnight.ambientIntensity >= 1.36, "midnight ambient floor should be readable");
  assert.ok(luminance(midnight.ambientColor) >= 0.28, "midnight ambient color should carry visible blue fill");
  assert.ok(midnight.terrainLightnessMul >= 1.4, "terrain colors need a night readability lift");
  assert.ok(midnight.ambientIntensity < noon.ambientIntensity, "night must remain dimmer than day");
  assert.ok(luminance(midnight.ambientColor) < luminance(noon.ambientColor), "night color must remain below daylight");
});

test("daytime shows sun and keeps clouds visible", () => {
  const visuals = celestialCycle({
    timeOfDay: 13,
    weatherSunCut: 0,
    fogBoost: 0,
    windStrength: 0.28
  });

  assert.ok(visuals.sunDiscOpacity >= 0.65);
  assert.ok(visuals.moonOpacity < 0.2);
  assert.ok(visuals.cloudOpacity >= 0.14);
});

test("sunset keeps stars hidden until the sun is meaningfully below the horizon", () => {
  const sunset = celestialCycle({
    timeOfDay: 18,
    weatherSunCut: 0,
    fogBoost: 0,
    windStrength: 0.28
  });
  const lateDusk = celestialCycle({
    timeOfDay: 19,
    weatherSunCut: 0,
    fogBoost: 0,
    windStrength: 0.28
  });

  assert.ok(sunset.starOpacity <= 0.05, "sunset should not reveal stars yet");
  assert.ok(lateDusk.starOpacity > sunset.starOpacity, "stars should rise after sunset, not at it");
});

test("sunrise clears stars quickly and deep night allows an opaque moon", () => {
  const sunrise = celestialCycle({
    timeOfDay: 6,
    weatherSunCut: 0,
    fogBoost: 0,
    windStrength: 0.28
  });
  const predawn = celestialCycle({
    timeOfDay: 5,
    weatherSunCut: 0,
    fogBoost: 0,
    windStrength: 0.28
  });
  const midnight = celestialCycle({
    timeOfDay: 0,
    weatherSunCut: 0,
    fogBoost: 0,
    windStrength: 0.28
  });

  assert.ok(sunrise.starOpacity <= 0.05, "sunrise should collapse star visibility");
  assert.ok(predawn.starOpacity > sunrise.starOpacity, "predawn should still carry visible stars");
  assert.equal(midnight.moonOpacity, 1, "deep night moon should be fully opaque");
});

test("default climate context is neutral and bounded", async () => {
  const climate = await import("../src/game/climateContext.ts");
  const context = climate.defaultClimateContext();

  assert.equal(context.zone, "temperate-inland");
  assert.equal(context.latitude, 34.3);
  assert.equal(context.elevationMeters, 600);
  assert.ok(context.humidity >= 0 && context.humidity <= 1);
  assert.ok(context.aridity >= 0 && context.aridity <= 1);
  assert.ok(context.waterProximity >= 0 && context.waterProximity <= 1);
});

test("climate modifiers make wet regions mistier and dry regions clearer", async () => {
  const climate = await import("../src/game/climateContext.ts");

  const wet = climate.climateVisualModifiers({
    zone: "jiangnan-water",
    latitude: 30.2,
    elevationMeters: 20,
    waterProximity: 0.95,
    humidity: 0.9,
    aridity: 0.08
  });
  const dry = climate.climateVisualModifiers({
    zone: "western-dryland",
    latitude: 42.8,
    elevationMeters: 900,
    waterProximity: 0.05,
    humidity: 0.18,
    aridity: 0.86
  });

  assert.ok(wet.fogDensityMul > dry.fogDensityMul);
  assert.ok(wet.mistOpacityAdd > dry.mistOpacityAdd);
  assert.ok(dry.dryHazeAdd > wet.dryHazeAdd);
  assert.ok(wet.cloudOpacityAdd > dry.cloudOpacityAdd);
});

test("geo climate helper separates Jiangnan, western dryland, plateau, and north China", async () => {
  const climate = await import("../src/game/climateContext.ts");

  const jiangnan = climate.climateContextForGeo(30.2, 120.2, { waterProximity: 0.7 });
  const western = climate.climateContextForGeo(40.0, 88.0, { elevationMeters: 900 });
  const plateau = climate.climateContextForGeo(32.0, 91.0, { elevationMeters: 4100 });
  const north = climate.climateContextForGeo(38.5, 115.5, { elevationMeters: 80 });

  assert.equal(jiangnan.zone, "jiangnan-water");
  assert.equal(western.zone, "western-dryland");
  assert.equal(plateau.zone, "tibetan-plateau");
  assert.equal(north.zone, "north-china-plain");
  assert.ok(jiangnan.humidity > north.humidity);
  assert.ok(western.aridity > north.aridity);
  assert.ok(plateau.elevationMeters >= 4100);
});

test("celestial visibility favors dry high places over humid lowlands", () => {
  const dryHigh = celestialVisibilityModifiers({
    cloudOpacity: 0.18,
    humidity: 0.15,
    elevationMeters: 4200,
    moonPhase: 0.02
  });
  const wetLow = celestialVisibilityModifiers({
    cloudOpacity: 0.48,
    humidity: 0.9,
    elevationMeters: 20,
    moonPhase: 0.52
  });

  assert.ok(dryHigh.starVisibilityMul > wetLow.starVisibilityMul);
  assert.ok(dryHigh.milkyWayVisibilityMul > wetLow.milkyWayVisibilityMul);
  assert.ok(wetLow.moonGlareCut > dryHigh.moonGlareCut);
});

test("rainbow potential requires moisture and low sun", () => {
  const afterRainLowSun = rainbowPotential({
    solarAltitude: 0.18,
    precipitationOpacity: 0.45,
    humidity: 0.78,
    cloudOpacity: 0.25
  });
  const dryNoon = rainbowPotential({
    solarAltitude: 0.86,
    precipitationOpacity: 0,
    humidity: 0.16,
    cloudOpacity: 0.1
  });

  assert.ok(afterRainLowSun > 0.2);
  assert.equal(dryNoon, 0);
});

test("manual snow requests are rejected outside winter", () => {
  const controller = new EnvironmentController();

  controller.state.dayOfYear = 198;
  controller.state.season = "summer";
  controller.setWeather("snow", 0);
  assert.notEqual(controller.state.weather, "snow");

  controller.state.dayOfYear = 17.5;
  controller.state.season = "winter";
  controller.setWeather("snow", 0);
  assert.equal(controller.state.weather, "snow");
});
