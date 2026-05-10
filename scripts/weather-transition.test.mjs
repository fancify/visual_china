import assert from "node:assert/strict";
import test from "node:test";

import { EnvironmentController } from "../src/game/environment.ts";

test("setWeather keeps state stable during transition and commits after the duration", () => {
  const controller = new EnvironmentController();

  assert.equal(controller.state.weather, "clear");
  controller.setWeather("rain", 10);

  assert.equal(controller.state.weather, "clear");
  assert.deepEqual(controller.getWeatherTransitionLerp(), {
    from: "clear",
    to: "rain",
    t: 0
  });

  controller.update(5);
  const halfway = controller.getWeatherTransitionLerp();
  assert.equal(controller.state.weather, "clear");
  assert.equal(halfway?.from, "clear");
  assert.equal(halfway?.to, "rain");
  assert.ok(Math.abs((halfway?.t ?? 0) - 0.5) < 1e-9);

  controller.update(5);
  assert.equal(controller.state.weather, "rain");
  assert.equal(controller.getWeatherTransitionLerp(), null);
});

test("advanceWeather starts a transition instead of mutating weather immediately", () => {
  const controller = new EnvironmentController();

  controller.advanceWeather();

  assert.equal(controller.state.weather, "clear");
  const transition = controller.getWeatherTransitionLerp();
  assert.equal(transition?.from, "clear");
  assert.notEqual(transition?.to, "clear");
  assert.equal(transition?.t, 0);
});
