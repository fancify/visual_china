import assert from "node:assert/strict";
import test from "node:test";

import { qinlingRegionBounds } from "../src/data/qinlingRegion.js";
import { realQinlingCities } from "../src/data/realCities.js";

const EXPECTED_NEW_CITY_IDS = [
  "xihe",
  "qishan",
  "chengxian",
  "baishui-river",
  "zhenba",
  "zitong",
  "wulian",
  "fuling",
  "tongguan",
  // 华山从 realCities 移到 qinlingScenicLandmarks，现在按山岳渲染而非城市
  "chongqing",
  "luzhou",
  "yibin"
];

test("new qinling real cities cover added Shu roads and keep one-line historical descriptions", () => {
  for (const cityId of EXPECTED_NEW_CITY_IDS) {
    const city = realQinlingCities.find((entry) => entry.id === cityId);
    assert.ok(city, `${cityId} should exist`);
    assert.equal(typeof city.description, "string");
    assert.ok(city.description.length > 0, `${cityId} should include a historical description`);
  }
});

test("south/east expansion brings Fuling and the new Guanzhong-Sichuan cities into the current slice", () => {
  for (const cityId of EXPECTED_NEW_CITY_IDS) {
    const city = realQinlingCities.find((entry) => entry.id === cityId);
    assert.ok(city, `${cityId} should exist`);

    const isInBounds =
      city.lat >= qinlingRegionBounds.south &&
      city.lat <= qinlingRegionBounds.north &&
      city.lon >= qinlingRegionBounds.west &&
      city.lon <= qinlingRegionBounds.east;

    assert.equal(isInBounds, true, `${cityId} should be renderable inside the expanded slice`);
  }
});
