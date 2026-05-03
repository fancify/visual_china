import assert from "node:assert/strict";
import test from "node:test";

let isSpriteOccludedByTerrain;

try {
  ({ isSpriteOccludedByTerrain } = await import("../src/game/labelOcclusion.ts"));
} catch (error) {
  assert.fail(
    `expected label occlusion helper module to exist: ${error instanceof Error ? error.message : String(error)}`
  );
}

test("narrow ridge between camera and label occludes the sprite", () => {
  const blocked = isSpriteOccludedByTerrain({
    camera: { x: 0, y: 12, z: 0 },
    target: { x: 100, y: 4, z: 0 },
    sampler: {
      sampleSurfaceHeight(x, z) {
        void z;
        return x >= 47.5 && x <= 52.5 ? 9 : 0;
      }
    }
  });

  assert.equal(blocked, true);
});

test("flat terrain below the sight line does not occlude the sprite", () => {
  const blocked = isSpriteOccludedByTerrain({
    camera: { x: 0, y: 18, z: 0 },
    target: { x: 100, y: 14, z: 0 },
    sampler: {
      sampleSurfaceHeight() {
        return 3;
      }
    }
  });

  assert.equal(blocked, false);
});

test("sampling stops short of the label so the label foot does not self-occlude", () => {
  const samples = [];
  const blocked = isSpriteOccludedByTerrain({
    camera: { x: 0, y: 18, z: 0 },
    target: { x: 100, y: 12, z: 0 },
    sampler: {
      sampleSurfaceHeight(x, z) {
        samples.push({ x, z });
        return x >= 98 ? 20 : 0;
      }
    }
  });

  assert.equal(blocked, false);
  assert.ok(samples.length > 0);
  assert.ok(samples[0].x > 0);
  assert.ok(samples.at(-1).x < 100);
});
