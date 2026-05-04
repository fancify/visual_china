import assert from "node:assert/strict";
import test from "node:test";

import {
  createSparseScheduler
} from "../src/game/audio/sparseScheduler.ts";

function withMockRandom(value, fn) {
  const original = Math.random;
  Math.random = () => value;
  try {
    fn();
  } finally {
    Math.random = original;
  }
}

function createTriggerSpy() {
  const fires = [];
  return {
    fires,
    triggerSystem: {
      fire(id, opts) {
        fires.push({ id, opts });
      },
      getRecentFires() {
        return [];
      },
      setThunderActive() {},
      footstepPulse() {}
    }
  };
}

function dayForestContext() {
  return {
    biome: "forest",
    isNight: false,
    weather: "clear",
    altitudeBand: "mid",
    riverProximity: 0,
    largeRiverProximity: 0
  };
}

test("sparse scheduler fires inside the configured interval window", () => {
  withMockRandom(0, () => {
    const { fires, triggerSystem } = createTriggerSpy();
    const scheduler = createSparseScheduler(triggerSystem, [
      {
        key: "bird_chirp",
        condition: () => true,
        minIntervalMs: 1_000,
        maxIntervalMs: 2_000,
        volume: 0.4
      }
    ]);

    scheduler.setContext(dayForestContext());
    scheduler.tick(999);
    assert.equal(fires.length, 0);

    scheduler.tick(1);
    assert.equal(fires.length, 1);
    assert.equal(fires[0].opts.volume, 0.4);
  });
});

test("sparse scheduler does not reset while context changes but condition stays true", () => {
  withMockRandom(0, () => {
    const { fires, triggerSystem } = createTriggerSpy();
    const scheduler = createSparseScheduler(triggerSystem, [
      {
        key: "bird_chirp",
        condition: (ctx) => !ctx.isNight,
        minIntervalMs: 1_000,
        maxIntervalMs: 2_000
      }
    ]);

    scheduler.setContext(dayForestContext());
    scheduler.tick(500);
    scheduler.setContext({
      ...dayForestContext(),
      biome: "subtropical"
    });
    scheduler.tick(499);
    assert.equal(fires.length, 0);

    scheduler.tick(1);
    assert.equal(fires.length, 1);
  });
});

test("sparse scheduler waits for condition to become true again before restarting the interval", () => {
  withMockRandom(0, () => {
    const { fires, triggerSystem } = createTriggerSpy();
    const scheduler = createSparseScheduler(triggerSystem, [
      {
        key: "frog_call",
        condition: (ctx) => ctx.isNight,
        minIntervalMs: 1_000,
        maxIntervalMs: 2_000
      }
    ]);

    scheduler.setContext({
      ...dayForestContext(),
      isNight: true
    });
    scheduler.tick(500);
    scheduler.setContext(dayForestContext());
    scheduler.tick(10_000);
    assert.equal(fires.length, 0);

    scheduler.setContext({
      ...dayForestContext(),
      isNight: true
    });
    scheduler.tick(999);
    assert.equal(fires.length, 0);

    scheduler.tick(1);
    assert.equal(fires.length, 1);
  });
});
