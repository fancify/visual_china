import assert from "node:assert/strict";
import test from "node:test";

import { createTriggerSystem } from "../src/game/audio/triggerSystem.ts";
import {
  createRuntime,
  createdTrackIds
} from "./audio-test-helpers.mjs";

test("trigger system ignores repeated fires inside the cooldown window", () => {
  const { runtime, context } = createRuntime(["ui_click"]);
  const triggers = createTriggerSystem(runtime);

  triggers.fire("ui_click");
  triggers.fire("ui_click");

  assert.deepEqual(createdTrackIds(context), ["ui_click"]);
});

test("thunder scheduler emits thunder while storm mode is active", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const { runtime, context } = createRuntime(["ambient_thunder_distant"]);
  const triggers = createTriggerSystem(runtime);

  triggers.setThunderActive(true);
  t.mock.timers.tick(36000);
  await Promise.resolve();

  assert.ok(
    createdTrackIds(context).includes("ambient_thunder_distant"),
    "storm scheduling should eventually fire thunder"
  );

  triggers.setThunderActive(false);
});

test("footstep pulse on ox falls back to grass when no ox hoof buffer exists", () => {
  const { runtime, context } = createRuntime([
    "footstep_grass",
    "mount_horse_hoof"
  ]);
  const triggers = createTriggerSystem(runtime);

  triggers.footstepPulse({
    inWater: false,
    mounted: "ox"
  });

  assert.equal(createdTrackIds(context).at(-1), "footstep_grass");
});
