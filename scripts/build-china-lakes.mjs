// build-china-lakes.mjs
//
// Filter Natural Earth 10m lakes → China bounds. Output simplified GeoJSON for runtime
// flat-mesh rendering (大致水域 polygon, 不分级)。
//
// Input:  data/natural-earth/ne_10m_lakes.geojson (4.8 MB global)
// Output: public/data/lakes/china-lakes.json (~100-300 KB filtered)
//
// Tang 备注: 罗布泊 / 居延海 唐时仍有水, Natural Earth 现代图缺。后续可手补 Tang 专属
// 内陆湖列表 (诺尔图、嘎顺淖尔 等)。
//
// 用法: node scripts/build-china-lakes.mjs

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SRC = path.join(ROOT, "data/natural-earth/ne_10m_lakes.geojson");
const OUT_DIR = path.join(ROOT, "public/data/lakes");
const OUT_FILE = path.join(OUT_DIR, "china-lakes.json");

const BOUNDS = { west: 73, east: 135, south: 18, north: 53 };

function bboxInChina(geom) {
  // Quick reject: check first coord, then any-vertex-in-bounds
  function inBounds(lon, lat) {
    return lon >= BOUNDS.west && lon <= BOUNDS.east && lat >= BOUNDS.south && lat <= BOUNDS.north;
  }
  if (geom.type === "Polygon") {
    for (const ring of geom.coordinates) {
      for (const [lon, lat] of ring) {
        if (inBounds(lon, lat)) return true;
      }
    }
  } else if (geom.type === "MultiPolygon") {
    for (const poly of geom.coordinates) {
      for (const ring of poly) {
        for (const [lon, lat] of ring) {
          if (inBounds(lon, lat)) return true;
        }
      }
    }
  }
  return false;
}

function reducePrecision(coord) {
  return [Math.round(coord[0] * 100000) / 100000, Math.round(coord[1] * 100000) / 100000];
}

function simplifyGeometry(geom) {
  if (geom.type === "Polygon") {
    return { type: "Polygon", coordinates: geom.coordinates.map((ring) => ring.map(reducePrecision)) };
  }
  if (geom.type === "MultiPolygon") {
    return {
      type: "MultiPolygon",
      coordinates: geom.coordinates.map((poly) => poly.map((ring) => ring.map(reducePrecision)))
    };
  }
  return geom;
}

async function main() {
  const raw = await fs.readFile(SRC, "utf8");
  const fc = JSON.parse(raw);
  console.log(`Loaded ${fc.features.length} global lakes from Natural Earth 10m`);

  const filtered = [];
  for (const feat of fc.features) {
    if (!bboxInChina(feat.geometry)) continue;
    filtered.push({
      type: "Feature",
      properties: {
        name: feat.properties.name ?? null,
        nameAlt: feat.properties.name_alt ?? null,
        scalerank: feat.properties.scalerank ?? null,
        admin: feat.properties.admin ?? null
      },
      geometry: simplifyGeometry(feat.geometry)
    });
  }

  await fs.mkdir(OUT_DIR, { recursive: true });
  const out = {
    type: "FeatureCollection",
    schemaVersion: "visual-china.lakes.v1",
    source: "Natural Earth 10m lakes",
    bounds: BOUNDS,
    generatedAt: new Date().toISOString(),
    count: filtered.length,
    features: filtered
  };
  await fs.writeFile(OUT_FILE, JSON.stringify(out), "utf8");
  const sizeKB = (await fs.stat(OUT_FILE)).size / 1024;
  console.log(`Wrote ${filtered.length} China lakes → ${OUT_FILE} (${sizeKB.toFixed(1)} KB)`);

  // Top 10 by name visibility (scalerank low = important)
  filtered.sort((a, b) => (a.properties.scalerank ?? 99) - (b.properties.scalerank ?? 99));
  console.log("\nTop 10 lakes (by scalerank):");
  for (const f of filtered.slice(0, 10)) {
    console.log(`  ${f.properties.name} (rank=${f.properties.scalerank})`);
  }
}

await main();
