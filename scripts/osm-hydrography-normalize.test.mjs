import assert from "node:assert/strict";
import test from "node:test";

import {
  lonLatToWorldPoint,
  normalizeOsmWaterways
} from "../src/game/osmHydrography.js";

const bounds = { west: 100, east: 102, south: 30, north: 32 };
const world = { width: 20, depth: 20 };

test("converts lon/lat into the project's strict world coordinates", () => {
  assert.deepEqual(
    lonLatToWorldPoint({ lon: 100, lat: 32 }, bounds, world),
    { x: -10, y: 10 }
  );
  assert.deepEqual(
    lonLatToWorldPoint({ lon: 102, lat: 30 }, bounds, world),
    { x: 10, y: -10 }
  );
});

test("normalizes named OSM waterway ways into hydrography features", () => {
  const asset = normalizeOsmWaterways(
    {
      elements: [
        { type: "node", id: 1, lon: 100, lat: 31 },
        { type: "node", id: 2, lon: 101, lat: 31.5 },
        { type: "node", id: 3, lon: 102, lat: 31 },
        {
          type: "way",
          id: 88,
          nodes: [1, 2, 3],
          tags: { waterway: "river", name: "测试河" }
        }
      ]
    },
    { bounds, world, regionId: "qinling" }
  );

  assert.equal(asset.schema, "visual-china.region-hydrography.v1");
  assert.equal(asset.source.name, "openstreetmap-overpass");
  assert.equal(asset.features.length, 1);
  assert.equal(asset.features[0].id, "osm-way-88");
  assert.equal(asset.features[0].name, "测试河");
  assert.equal(asset.features[0].kind, "river");
  assert.equal(asset.features[0].rank, 1);
  assert.deepEqual(asset.features[0].geometry.points[0], { x: -10, y: 0 });
});

test("drops OSM waterways that cannot form an in-bounds polyline", () => {
  const asset = normalizeOsmWaterways(
    {
      elements: [
        { type: "node", id: 1, lon: 99, lat: 29 },
        { type: "node", id: 2, lon: 99.5, lat: 29.5 },
        {
          type: "way",
          id: 99,
          nodes: [1, 2],
          tags: { waterway: "stream", name: "界外溪" }
        }
      ]
    },
    { bounds, world, regionId: "qinling" }
  );

  assert.equal(asset.features.length, 0);
});
