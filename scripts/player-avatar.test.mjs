import assert from "node:assert/strict";
import test from "node:test";

import {
  avatarHeadingForMovement,
  woodHorseLegPose,
  woodHorseAvatarParts
} from "../src/game/playerAvatar.js";

test("wood horse avatar has readable toy horse and rider parts", () => {
  const partNames = new Set(woodHorseAvatarParts.map((part) => part.name));

  assert.ok(partNames.has("wooden-horse-body"));
  assert.ok(partNames.has("wooden-horse-head"));
  assert.ok(partNames.has("front-left-leg"));
  assert.ok(partNames.has("front-right-leg"));
  assert.ok(partNames.has("back-left-leg"));
  assert.ok(partNames.has("back-right-leg"));
  assert.ok(partNames.has("traveler-cloak"));
  // route-banner（红旗）按用户要求去掉，换成更可爱的斗笠 + 眼睛
  assert.ok(partNames.has("traveler-douli"));
  assert.ok(partNames.has("traveler-eye-left"));
  assert.ok(partNames.has("traveler-eye-right"));
});

test("wood horse head points toward the movement vector", () => {
  assert.equal(avatarHeadingForMovement({ x: 1, z: 0 }), 0);
  assert.ok(Math.abs(avatarHeadingForMovement({ x: 0, z: 1 }) + Math.PI / 2) < 1e-9);
  assert.ok(Math.abs(avatarHeadingForMovement({ x: 0, z: -1 }) - Math.PI / 2) < 1e-9);
});

test("wood horse legs swing in playful diagonal pairs while moving", () => {
  const standing = woodHorseLegPose({ timeSeconds: 0, movementIntensity: 0 });
  const walking = woodHorseLegPose({ timeSeconds: 0.12, movementIntensity: 1 });

  assert.equal(standing["front-left-leg"], 0.1);
  assert.equal(standing["front-right-leg"], -0.1);
  assert.notEqual(walking["front-left-leg"], standing["front-left-leg"]);
  assert.notEqual(walking["front-right-leg"], standing["front-right-leg"]);
  assert.equal(
    Math.sign(walking["front-left-leg"] - standing["front-left-leg"]),
    Math.sign(walking["back-right-leg"] - standing["back-right-leg"])
  );
  assert.equal(
    Math.sign(walking["front-right-leg"] - standing["front-right-leg"]),
    Math.sign(walking["back-left-leg"] - standing["back-left-leg"])
  );
  assert.notEqual(
    Math.sign(walking["front-left-leg"] - standing["front-left-leg"]),
    Math.sign(walking["front-right-leg"] - standing["front-right-leg"])
  );
});
