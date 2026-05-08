import test from "node:test";
import assert from "node:assert/strict";
import { CHINA_LAKES } from "../src/game/data/chinaLakes.ts";

test("CHINA_LAKES exposes 5 major lakes with polygon vertices", () => {
  assert.equal(CHINA_LAKES.length, 5);
  for (const lake of CHINA_LAKES) {
    assert.ok(lake.id.startsWith("lake-"));
    assert.ok(lake.polygon.length >= 6 && lake.polygon.length <= 12);
    for (const point of lake.polygon) {
      assert.ok(point.lat >= 18 && point.lat <= 53);
      assert.ok(point.lon >= 73 && point.lon <= 135);
    }
  }
});
