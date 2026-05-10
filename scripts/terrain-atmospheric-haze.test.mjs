import assert from "node:assert/strict";
import test from "node:test";
import { Color } from "three";

import {
  terrainAtmosphericHazeDefaults
} from "../src/game/terrainShaderEnhancer.ts";
import {
  sharedAtmosphericFarColor
} from "../src/game/environment.ts";

test("terrain atmospheric haze defaults — Claude calibrated post-Playwright review", () => {
  // start=80 让 default-follow (~65u) 完全无 haze；overview (~170u) 近 chunks 也几乎无 haze。
  // strength=0.55 避免跟 colorGradeShader split-tone 双重扭曲后远色脏。
  assert.equal(terrainAtmosphericHazeDefaults.startDistance, 80);
  assert.equal(terrainAtmosphericHazeDefaults.endDistance, 250);
  assert.equal(terrainAtmosphericHazeDefaults.strength, 0.55);
});

test("shared atmospheric far color follows the sky horizon color without zenith or stone-blue tinting", () => {
  const skyHorizonColor = new Color("#b6c4be");
  const farColor = sharedAtmosphericFarColor({ skyHorizonColor });

  assert.notEqual(farColor, skyHorizonColor, "callers should receive a clone they can mutate");
  assert.ok(
    farColor.equals(skyHorizonColor),
    "terrain/cloud/mountain far color should use the same horizon color as the sky shader"
  );

  farColor.set("#000000");
  assert.ok(
    skyHorizonColor.equals(new Color("#b6c4be")),
    "mutating the shared far color clone must not mutate environment visuals"
  );
});
