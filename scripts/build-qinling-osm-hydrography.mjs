import fs from "node:fs/promises";
import path from "node:path";

import { normalizeOsmWaterways } from "../src/game/osmHydrography.js";
import { qinlingBounds, qinlingWorld } from "./qinling-dem-common.mjs";

const inputPath = path.resolve("data/hydrography/raw/qinling-osm-waterways.overpass.json");
const outputPath = path.resolve("public/data/regions/qinling/hydrography/osm-modern.json");

let raw;

try {
  raw = JSON.parse(await fs.readFile(inputPath, "utf8"));
} catch (error) {
  throw new Error(
    `Missing or invalid ${path.relative(process.cwd(), inputPath)}. Run npm run fetch:hydrography:osm first.`
  );
}

const asset = normalizeOsmWaterways(raw, {
  bounds: qinlingBounds,
  world: qinlingWorld,
  regionId: "qinling"
});

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(
  outputPath,
  `${JSON.stringify({
    ...asset,
    generatedAt: new Date().toISOString(),
    sourceAsset: path.relative(process.cwd(), inputPath)
  }, null, 2)}\n`,
  "utf8"
);

const namedCount = asset.features.filter((feature) => feature.source.confidence !== "low").length;

console.log(
  [
    `Wrote ${path.relative(process.cwd(), outputPath)}`,
    `features=${asset.features.length}`,
    `namedOrChinese=${namedCount}`
  ].join(" | ")
);
