import fs from "node:fs/promises";
import path from "node:path";

import {
  buildOverpassWaterwayQuery,
  mergeOverpassJsons,
  parseOverpassFetchArgs,
  splitTileInHalf,
  splitBoundsIntoTiles
} from "./osm-overpass-query.mjs";

const outputPath = path.resolve("data/hydrography/raw/qinling-osm-waterways.overpass.json");
const tileCacheDir = path.resolve("data/hydrography/raw/qinling-osm-waterways-tiles");
const endpoint = process.env.OVERPASS_ENDPOINT ?? "https://overpass-api.de/api/interpreter";
const options = parseOverpassFetchArgs(process.argv.slice(2));

function tileCachePath(bbox) {
  const key = [bbox.south, bbox.west, bbox.north, bbox.east]
    .map((value) => String(value).replaceAll(".", "p").replaceAll("-", "m"))
    .join("_");
  return path.join(tileCacheDir, `${key}.json`);
}

function canSubdivide(bbox) {
  return (
    bbox.east - bbox.west > options.minTileDegrees ||
    bbox.north - bbox.south > options.minTileDegrees
  );
}

async function fetchOverpassTile(bbox, label) {
  const cachePath = tileCachePath(bbox);
  try {
    return JSON.parse(await fs.readFile(cachePath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  const query = buildOverpassWaterwayQuery({ ...options, bbox });
  const abortController = new AbortController();
  const abortTimer = setTimeout(() => abortController.abort(), options.timeoutMs);

  try {
    console.log(
      `Fetching tile ${label}: ${bbox.south},${bbox.west},${bbox.north},${bbox.east}`
    );
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
        "user-agent": "visual-china-prototype/0.1"
      },
      body: new URLSearchParams({ data: query }),
      signal: abortController.signal
    });

    if (!response.ok) {
      throw new Error(`Overpass request failed: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    const parsed = JSON.parse(text);
    await fs.writeFile(cachePath, `${JSON.stringify(parsed)}\n`, "utf8");
    return parsed;
  } finally {
    clearTimeout(abortTimer);
  }
}

async function fetchTileWithSubdivision(bbox, label) {
  try {
    return [await fetchOverpassTile(bbox, label)];
  } catch (error) {
    if (!canSubdivide(bbox)) {
      throw error;
    }

    console.log(`Subdividing tile ${label} after ${error.message}`);
    const children = splitTileInHalf(bbox);
    const parts = [];
    for (let index = 0; index < children.length; index += 1) {
      parts.push(...(await fetchTileWithSubdivision(children[index], `${label}.${index + 1}`)));
    }
    return parts;
  }
}

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.mkdir(tileCacheDir, { recursive: true });

console.log(
  `Fetching ${options.namedOnly ? "named" : "all"} Qinling OSM waterways from ${endpoint}`
);

const tiles = splitBoundsIntoTiles(options.bbox, options.tileDegrees);
const parts = [];
for (let index = 0; index < tiles.length; index += 1) {
  parts.push(...(await fetchTileWithSubdivision(tiles[index], `${index + 1}/${tiles.length}`)));
}

const text = `${JSON.stringify(mergeOverpassJsons(parts), null, 2)}\n`;
await fs.writeFile(outputPath, text, "utf8");

console.log(`Wrote ${path.relative(process.cwd(), outputPath)} (${text.length} bytes)`);
