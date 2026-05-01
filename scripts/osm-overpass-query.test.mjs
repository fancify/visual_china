import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOverpassWaterwayQuery,
  mergeOverpassJsons,
  parseBbox,
  parseOverpassFetchArgs,
  splitTileInHalf,
  splitBoundsIntoTiles
} from "./osm-overpass-query.mjs";

const fallbackBounds = { south: 30, west: 100, north: 40, east: 110 };

test("parses bbox arguments in strict south,west,north,east order", () => {
  assert.deepEqual(parseBbox("32.5,106,34.7,109", fallbackBounds), {
    south: 32.5,
    west: 106,
    north: 34.7,
    east: 109
  });
});

test("defaults OSM fetches to named waterways with an abort timeout", () => {
  const options = parseOverpassFetchArgs(["--timeout-ms=45000"], fallbackBounds);

  assert.equal(options.namedOnly, true);
  assert.equal(options.timeoutMs, 45_000);
  assert.equal(options.overpassTimeoutSeconds, 45);
  assert.deepEqual(options.bbox, fallbackBounds);
});

test("builds a named-waterway query that avoids the full raw waterway set by default", () => {
  const query = buildOverpassWaterwayQuery({
    bbox: fallbackBounds,
    namedOnly: true,
    overpassTimeoutSeconds: 45
  });

  assert.match(query, /\[timeout:45\]/);
  assert.match(query, /\["name"\]/);
  assert.match(query, /\["name:zh"\]/);
  assert.doesNotMatch(query, /way\["waterway"~"\^\(river\|stream\|canal\)\$"\]\(30,100,40,110\);/);
});

test("supports full waterway import when explicitly requested", () => {
  const options = parseOverpassFetchArgs(["--all"], fallbackBounds);
  const query = buildOverpassWaterwayQuery(options);

  assert.equal(options.namedOnly, false);
  assert.match(query, /way\["waterway"~"\^\(river\|stream\|canal\)\$"\]\(30,100,40,110\);/);
});

test("splits large waterway bboxes into deterministic import tiles", () => {
  const tiles = splitBoundsIntoTiles({ south: 30.4, west: 103.5, north: 32.1, east: 105.2 }, 1);

  assert.deepEqual(tiles, [
    { south: 30.4, west: 103.5, north: 31.4, east: 104.5 },
    { south: 30.4, west: 104.5, north: 31.4, east: 105.2 },
    { south: 31.4, west: 103.5, north: 32.1, east: 104.5 },
    { south: 31.4, west: 104.5, north: 32.1, east: 105.2 }
  ]);
});

test("bisects heavy tiles along their longer axis", () => {
  assert.deepEqual(
    splitTileInHalf({ south: 30, west: 100, north: 31, east: 102 }),
    [
      { south: 30, west: 100, north: 31, east: 101 },
      { south: 30, west: 101, north: 31, east: 102 }
    ]
  );

  assert.deepEqual(
    splitTileInHalf({ south: 30, west: 100, north: 32, east: 101 }),
    [
      { south: 30, west: 100, north: 31, east: 101 },
      { south: 31, west: 100, north: 32, east: 101 }
    ]
  );
});

test("merges tiled Overpass responses without duplicating shared ways or nodes", () => {
  const merged = mergeOverpassJsons([
    { version: 0.6, elements: [{ type: "node", id: 1 }, { type: "way", id: 7 }] },
    { version: 0.6, elements: [{ type: "node", id: 1 }, { type: "node", id: 2 }] }
  ]);

  assert.equal(merged.generator, "visual-china-overpass-tile-merge");
  assert.deepEqual(merged.elements, [
    { type: "node", id: 1 },
    { type: "way", id: 7 },
    { type: "node", id: 2 }
  ]);
});
