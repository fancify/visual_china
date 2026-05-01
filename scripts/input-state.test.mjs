import assert from "node:assert/strict";
import test from "node:test";

import {
  clearGameplayInput,
  isGameplayInputKey,
  movementAxesFromKeys,
  normalizeInputKey
} from "../src/game/inputState.js";

test("normalizes browser key names into stable gameplay input keys", () => {
  assert.equal(normalizeInputKey("W"), "w");
  assert.equal(normalizeInputKey("ArrowUp"), "arrowup");
  assert.equal(isGameplayInputKey("W"), true);
  assert.equal(isGameplayInputKey("m"), false);
});

test("derives movement axes from the active key set", () => {
  assert.deepEqual(movementAxesFromKeys(new Set(["w", "d"])), {
    forward: 1,
    right: 1
  });
  assert.deepEqual(movementAxesFromKeys(new Set(["w", "s"])), {
    forward: 0,
    right: 0
  });
});

test("clears sticky movement keys after focus loss or UI mode changes", () => {
  const keys = new Set(["w", "shift"]);

  assert.equal(clearGameplayInput(keys), keys);
  assert.equal(keys.size, 0);
});
