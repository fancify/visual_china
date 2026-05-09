import assert from "node:assert/strict";
import test from "node:test";

import { qinlingRegionBounds } from "../src/data/qinlingRegion.js";
import { realQinlingCities } from "../src/data/realCities.js";

const SOUTHERN_SLICE_BOUNDS = {
  south: 22,
  north: 35.4,
  west: 103.5,
  east: 117.0
};

const EXPECTED_NORTHERN_CITY_IDS = [
  "beijing",
  "taiyuan",
  "shijiazhuang",
  "handan",
  "anyang",
  "luoyang",
  "yanan",
  "yulin-sx",
  "kaifeng"
];

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

const EXPECTED_SOUTHERN_CITY_IDS = [
  "guiyang",
  "guilin",
  "yangshuo",
  "fenghuang",
  "huaihua",
  "kaili",
  "zhenyuan",
  "duyun",
  "hechi"
];

const EXPECTED_EASTERN_CITY_IDS = [
  "wuhan",
  "changsha",
  "yueyang",
  "nanchang",
  "jingzhou",
  "jiujiang"
];

const EXPECTED_PHASE_A_CITY_IDS = [
  "yichang",
  "xiangyang",
  "shiyan",
  "huangshi",
  "huanggang",
  "yichun-jx",
  "jian",
  "ganzhou",
  "yongzhou",
  "shaoyang"
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

test("southern Phase B cities stay inside the south-extension slice and include descriptions", () => {
  for (const cityId of EXPECTED_SOUTHERN_CITY_IDS) {
    const city = realQinlingCities.find((entry) => entry.id === cityId);
    assert.ok(city, `${cityId} should exist`);
    assert.equal(typeof city.description, "string");
    assert.ok(city.description.length > 0, `${cityId} should include a historical description`);

    const isInBounds =
      city.lat >= SOUTHERN_SLICE_BOUNDS.south &&
      city.lat <= SOUTHERN_SLICE_BOUNDS.north &&
      city.lon >= SOUTHERN_SLICE_BOUNDS.west &&
      city.lon <= SOUTHERN_SLICE_BOUNDS.east;

    assert.equal(isInBounds, true, `${cityId} should stay inside the Phase B slice`);
  }
});

test("eastern Phase E cities stay inside the east-extension slice and include descriptions", () => {
  for (const cityId of EXPECTED_EASTERN_CITY_IDS) {
    const city = realQinlingCities.find((entry) => entry.id === cityId);
    assert.ok(city, `${cityId} should exist`);
    assert.equal(typeof city.description, "string");
    assert.ok(city.description.length > 0, `${cityId} should include a historical description`);

    const isInBounds =
      city.lat >= SOUTHERN_SLICE_BOUNDS.south &&
      city.lat <= SOUTHERN_SLICE_BOUNDS.north &&
      city.lon >= SOUTHERN_SLICE_BOUNDS.west &&
      city.lon <= SOUTHERN_SLICE_BOUNDS.east;

    assert.equal(isInBounds, true, `${cityId} should stay inside the Phase E slice`);
  }
});

test("north expansion adds the North China / Loess Plateau city set with descriptions", () => {
  for (const cityId of [...EXPECTED_NORTHERN_CITY_IDS, "datong"]) {
    const city = realQinlingCities.find((entry) => entry.id === cityId);
    assert.ok(city, `${cityId} should exist`);
    assert.equal(typeof city.description, "string");
    assert.ok(city.description.length > 0, `${cityId} should include a historical description`);
  }
});

test("full-China bounds bring the northern city set and Datong into the current slice", () => {
  for (const cityId of [...EXPECTED_NORTHERN_CITY_IDS, "datong"]) {
    const city = realQinlingCities.find((entry) => entry.id === cityId);
    assert.ok(city, `${cityId} should exist`);

    const isInBounds =
      city.lat >= qinlingRegionBounds.south &&
      city.lat <= qinlingRegionBounds.north &&
      city.lon >= qinlingRegionBounds.west &&
      city.lon <= qinlingRegionBounds.east;

    assert.equal(isInBounds, true, `${cityId} should be renderable inside the full-China slice`);
  }
});

test("Phase A medium cities stay inside the current slice and include descriptions", () => {
  for (const cityId of EXPECTED_PHASE_A_CITY_IDS) {
    const city = realQinlingCities.find((entry) => entry.id === cityId);
    assert.ok(city, `${cityId} should exist`);
    assert.equal(typeof city.description, "string");
    assert.ok(city.description.length > 0, `${cityId} should include a historical description`);

    const isInBounds =
      city.lat >= SOUTHERN_SLICE_BOUNDS.south &&
      city.lat <= SOUTHERN_SLICE_BOUNDS.north &&
      city.lon >= SOUTHERN_SLICE_BOUNDS.west &&
      city.lon <= SOUTHERN_SLICE_BOUNDS.east;

    assert.equal(isInBounds, true, `${cityId} should stay inside the current slice`);
  }
});

test("real city total count includes coastal/borderland additions", () => {
  // 71（Qinling/巴蜀/Phase A/F）+ 39（沿海 + 东北 + 西北 + 西南补全）= 110
  assert.equal(realQinlingCities.length, 110);
});
