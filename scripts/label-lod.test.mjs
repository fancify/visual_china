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
    [
      {
        position: { x: 0, y: 0, z: 0 },
        scale: { y: 1 },
        userData: { maxLabelDistance: 20 }
      }
    ],
    {
      cameraPosition: { x: 30, y: 0, z: 0 },
      cameraFovDeg: 60,
      canvasHeightPx: 1080,
      maxScreenHeightPx: 110
    }
  );

  assert.equal(visible, false);
});

test("label hidden when projected screen height exceeds the near-field cap", () => {
  const [visible] = computeLabelVisibility(
    [
      {
        position: { x: 0, y: 0, z: 0 },
        scale: { y: 2 },
        userData: { maxLabelDistance: 20 }
      }
    ],
    {
      cameraPosition: { x: 0.5, y: 0, z: 0 },
      cameraFovDeg: 60,
      canvasHeightPx: 1080,
      maxScreenHeightPx: 110
    }
  );

  assert.equal(visible, false);
});

test("label stays visible when distance and projected size are both within limits", () => {
  const [visible] = computeLabelVisibility(
    [
      {
        position: { x: 0, y: 0, z: 0 },
        scale: { y: 1 },
        userData: { maxLabelDistance: 20 }
      }
    ],
    {
      cameraPosition: { x: 9, y: 0, z: 0 },
      cameraFovDeg: 60,
      canvasHeightPx: 1080,
      maxScreenHeightPx: 110
    }
  );

  assert.equal(visible, true);
});

test("max label render distance scales with sprite height", () => {
  assert.equal(labelMaxRenderDistance(1.2), 36);
  assert.equal(labelMaxRenderDistance(0.6), 18);
});
