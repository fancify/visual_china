import assert from "node:assert/strict";
import test from "node:test";

import { cameraLookTargetForMode } from "../src/game/cameraView.js";

test("overview camera looks at the landform center instead of the player", () => {
  const target = cameraLookTargetForMode({
    mode: "overview",
    player: { x: 12, y: 3, z: 90 },
    lookAtHeight: 2.9
  });

  assert.deepEqual(target, { x: 0, y: 8, z: 0 });
});

test("follow camera looks at the player with configured headroom", () => {
  const target = cameraLookTargetForMode({
    mode: "follow",
    player: { x: 12, y: 3, z: 90 },
    lookAtHeight: 2.9
  });

  assert.deepEqual(target, { x: 12, y: 5.9, z: 90 });
});
