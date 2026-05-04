import assert from "node:assert/strict";
import test from "node:test";

import {
  createInitialHudUpdate,
  findNearestProximityPoi,
  resolveHudTargetSource,
  reduceHudTarget,
  toggleHudDetailState
} from "../src/game/cityHoverHud.ts";

function buildPoi({
  id,
  name,
  category = "scenic",
  worldX,
  worldZ
}) {
  return {
    id,
    name,
    category,
    worldX,
    worldZ,
    elevation: 1000,
    realLat: 34,
    realLon: 108
  };
}

test("findNearestProximityPoi returns POI inside radius", () => {
  const poiA = buildPoi({ id: "a", name: "A", worldX: 3, worldZ: 0 });

  const nearest = findNearestProximityPoi(0, 0, [poiA], () => 3.5);

  assert.equal(nearest?.id, "a");
});

test("findNearestProximityPoi returns null outside radius", () => {
  const poiA = buildPoi({ id: "a", name: "A", worldX: 3, worldZ: 0 });

  const nearest = findNearestProximityPoi(10, 0, [poiA], () => 3.5);

  assert.equal(nearest, null);
});

test("findNearestProximityPoi prefers the nearest eligible POI", () => {
  const poiA = buildPoi({ id: "a", name: "A", worldX: 1, worldZ: 0 });
  const poiB = buildPoi({ id: "b", name: "B", worldX: 2, worldZ: 0 });

  const nearest = findNearestProximityPoi(0, 0, [poiB, poiA], () => 3.5);

  assert.equal(nearest?.id, "a");
});

test("target switch resets detail state back to compact", () => {
  const poiA = buildPoi({ id: "a", name: "A", worldX: 1, worldZ: 0 });
  const poiB = buildPoi({ id: "b", name: "B", worldX: 2, worldZ: 0 });

  const compact = reduceHudTarget(createInitialHudUpdate(), poiA, "hover");
  const detail = toggleHudDetailState(compact);
  const switched = reduceHudTarget(detail, poiB, "proximity");

  assert.equal(compact.state, "compact");
  assert.equal(detail.state, "detail");
  assert.equal(switched.state, "compact");
  assert.equal(switched.target?.id, "b");
});

test("toggleHudDetailState toggles compact and detail", () => {
  const poiA = buildPoi({ id: "a", name: "A", worldX: 1, worldZ: 0 });

  const compact = reduceHudTarget(createInitialHudUpdate(), poiA, "hover");
  const detail = toggleHudDetailState(compact);
  const compactAgain = toggleHudDetailState(detail);

  assert.equal(detail.state, "detail");
  assert.equal(compactAgain.state, "compact");
});

test("resolveHudTargetSource stays hidden when no source is active", () => {
  const update = resolveHudTargetSource(null, null);

  assert.equal(update.state, "hidden");
  assert.equal(update.target, null);
  assert.equal(update.source, null);
});

test("resolveHudTargetSource uses proximity target when hover is absent", () => {
  const poiA = buildPoi({ id: "a", name: "A", worldX: 1, worldZ: 0 });

  const update = resolveHudTargetSource(null, poiA);

  assert.equal(update.state, "compact");
  assert.equal(update.target?.id, "a");
  assert.equal(update.source, "proximity");
});

test("resolveHudTargetSource gives hover higher priority than proximity", () => {
  const poiA = buildPoi({ id: "a", name: "A", worldX: 1, worldZ: 0 });
  const poiB = buildPoi({ id: "b", name: "B", worldX: 2, worldZ: 0 });

  const update = resolveHudTargetSource(poiA, poiB);

  assert.equal(update.state, "compact");
  assert.equal(update.target?.id, "a");
  assert.equal(update.source, "hover");
});
