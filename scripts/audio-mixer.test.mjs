import assert from "node:assert/strict";
import test from "node:test";

import { createAmbientMixer } from "../src/game/audio/ambientMixer.ts";
import {
  createRuntime,
  gainEventsForTrack
} from "./audio-test-helpers.mjs";

function lastRampValue(events) {
  const ramp = [...events].reverse().find((event) => event.type === "ramp");
  return ramp?.value ?? 0;
}

test("ambient mixer enables the expected forest day layer", () => {
  const { runtime, context } = createRuntime([
    "ambient_forest_birds",
    "ambient_insects_night",
    "ambient_wind_plain",
    "ambient_mountain_wind",
    "ambient_rain_heavy",
    "ambient_stream_water",
    "ambient_river_large"
  ]);
  const mixer = createAmbientMixer(runtime);

  mixer.setContext({
    biome: "forest",
    isNight: false,
    weather: "clear",
    altitudeBand: "mid",
    riverProximity: 0,
    largeRiverProximity: 0
  });

  assert.equal(lastRampValue(gainEventsForTrack(context, "ambient_forest_birds")), 0.6);
  assert.equal(lastRampValue(gainEventsForTrack(context, "ambient_insects_night")), 0);
});

test("ambient mixer crossfades old and new biome layers", () => {
  const { runtime, context } = createRuntime([
    "ambient_forest_birds",
    "ambient_wind_plain",
    "ambient_rain_heavy",
    "ambient_stream_water",
    "ambient_river_large"
  ]);
  const mixer = createAmbientMixer(runtime);

  mixer.setContext({
    biome: "forest",
    isNight: false,
    weather: "clear",
    altitudeBand: "mid",
    riverProximity: 0,
    largeRiverProximity: 0
  });
  context.currentTime = 2;
  mixer.setContext({
    biome: "plain",
    isNight: false,
    weather: "clear",
    altitudeBand: "low",
    riverProximity: 0,
    largeRiverProximity: 0
  });

  assert.equal(lastRampValue(gainEventsForTrack(context, "ambient_forest_birds")), 0);
  assert.equal(lastRampValue(gainEventsForTrack(context, "ambient_wind_plain")), 0.5);
});

test("rain pushes down the base ambient layer and lifts rain ambience", () => {
  const { runtime, context } = createRuntime([
    "ambient_wind_plain",
    "ambient_rain_heavy",
    "ambient_stream_water",
    "ambient_river_large"
  ]);
  const mixer = createAmbientMixer(runtime);

  mixer.setContext({
    biome: "plain",
    isNight: false,
    weather: "rain",
    altitudeBand: "low",
    riverProximity: 0,
    largeRiverProximity: 0
  });

  assert.equal(lastRampValue(gainEventsForTrack(context, "ambient_rain_heavy")), 0.7);
  assert.equal(lastRampValue(gainEventsForTrack(context, "ambient_wind_plain")), 0.1);
});
