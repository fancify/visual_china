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

test("ambient mixer keeps a single soft wind layer in dry weather", () => {
  const { runtime, context } = createRuntime([
    "ambient_soft_wind",
    "ambient_rain_heavy"
  ]);
  const mixer = createAmbientMixer(runtime);

  mixer.setContext({
    biome: "forest",
    isNight: false,
    weather: "clear",
    altitudeBand: "mid",
    riverProximity: 0.9,
    largeRiverProximity: 0.8
  });

  assert.equal(lastRampValue(gainEventsForTrack(context, "ambient_soft_wind")), 0.04);
  assert.equal(lastRampValue(gainEventsForTrack(context, "ambient_rain_heavy")), 0);
});

test("ambient mixer lifts wind slightly at high altitude", () => {
  const { runtime, context } = createRuntime([
    "ambient_soft_wind",
    "ambient_rain_heavy"
  ]);
  const mixer = createAmbientMixer(runtime);

  mixer.setContext({
    biome: "highland",
    isNight: false,
    weather: "clear",
    altitudeBand: "high",
    riverProximity: 0,
    largeRiverProximity: 0
  });

  assert.equal(lastRampValue(gainEventsForTrack(context, "ambient_soft_wind")), 0.08);
});

test("rain takes over by muting wind and raising the rain loop", () => {
  const { runtime, context } = createRuntime([
    "ambient_soft_wind",
    "ambient_rain_heavy"
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

  assert.equal(lastRampValue(gainEventsForTrack(context, "ambient_soft_wind")), 0);
  assert.equal(lastRampValue(gainEventsForTrack(context, "ambient_rain_heavy")), 0.6);
});

test("ambient mixer exposes active layers with current gain and trigger label", () => {
  const { runtime } = createRuntime([
    "ambient_soft_wind",
    "ambient_rain_heavy"
  ]);
  const mixer = createAmbientMixer(runtime);

  mixer.setContext({
    biome: "plain",
    isNight: false,
    weather: "clear",
    altitudeBand: "mid",
    riverProximity: 0,
    largeRiverProximity: 0
  });
  runtime.context.currentTime = 2;

  assert.equal(typeof mixer.getActiveLayers, "function");
  assert.deepEqual(mixer.getActiveLayers(), [
    {
      trackId: "ambient_soft_wind",
      currentGain: 0.04,
      triggerLabel: "weather=clear, altitude=mid"
    }
  ]);
});
