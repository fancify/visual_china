import assert from "node:assert/strict";
import test from "node:test";

let computeLabelVisibility;
let labelMaxRenderDistance;

try {
  ({ computeLabelVisibility, labelMaxRenderDistance } = await import("../src/game/labelVisibility.ts"));
} catch (error) {
  assert.fail(
    `expected label visibility helper module to exist: ${error instanceof Error ? error.message : String(error)}`
  );
}

test("label hidden when distance exceeds maxLabelDistance", () => {
  const [visible] = computeLabelVisibility(
    { x: 30, y: 0, z: 0 },
    [{ position: { x: 0, y: 0, z: 0 }, userData: { maxLabelDistance: 20 } }]
  );

  assert.equal(visible, false);
});

test("label stays visible when distance is within maxLabelDistance", () => {
  const [visible] = computeLabelVisibility(
    { x: 12, y: 0, z: 0 },
    [{ position: { x: 0, y: 0, z: 0 }, userData: { maxLabelDistance: 20 } }]
  );

  assert.equal(visible, true);
});

test("max label render distance scales with sprite height", () => {
  assert.equal(labelMaxRenderDistance(1.2), 36);
  assert.equal(labelMaxRenderDistance(0.6), 18);
});
