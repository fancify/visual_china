import fs from "node:fs/promises";
import path from "node:path";

import { densityProfileForClass } from "../src/game/geoProjection.js";
import {
  qinlingBounds,
  qinlingGeographicFootprintKm,
  qinlingResolutionStrategy
} from "./qinling-dem-common.mjs";

const root = process.cwd();
const legacyAssetPath = path.join(root, "public", "data", "qinling-slice-dem.json");
const regionRoot = path.join(root, "public", "data", "regions", "qinling");
const chunksRoot = path.join(regionRoot, "chunks");

const regionBounds = qinlingBounds;
const geographicFootprintKm = qinlingGeographicFootprintKm;

const chunkColumns = 4;
const chunkRows = 5;
const densityClass = "high-focus";
const experienceProfile = densityProfileForClass(densityClass);

function indexAt(column, row, columns) {
  return row * columns + column;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function interpolate(min, max, t) {
  return min + (max - min) * t;
}

function buildChunkChannel(data, sourceColumns, startColumn, endColumn, startRow, endRow) {
  const result = [];

  for (let row = startRow; row < endRow; row += 1) {
    for (let column = startColumn; column < endColumn; column += 1) {
      result.push(data[indexAt(column, row, sourceColumns)]);
    }
  }

  return result;
}

const asset = JSON.parse(await fs.readFile(legacyAssetPath, "utf8"));
const sliceAsset = {
  ...asset,
  id: "qinling-l1-slice",
  type: "terrain-slice",
  version: 1,
  regionId: "qinling",
  lod: "L1",
  bounds: regionBounds
};

const sliceFileName = "slice-l1.json";
const sliceOutputPath = path.join(regionRoot, sliceFileName);

await fs.mkdir(chunksRoot, { recursive: true });
await fs.writeFile(sliceOutputPath, `${JSON.stringify(sliceAsset, null, 2)}\n`, "utf8");

const chunkManifest = {
  regionId: "qinling",
  type: "chunk-manifest",
  version: 1,
  chunkColumns,
  chunkRows,
  chunks: []
};

for (let chunkRow = 0; chunkRow < chunkRows; chunkRow += 1) {
  for (let chunkColumn = 0; chunkColumn < chunkColumns; chunkColumn += 1) {
    const startColumn = Math.round((chunkColumn / chunkColumns) * (asset.grid.columns - 1));
    const endColumn =
      Math.round(((chunkColumn + 1) / chunkColumns) * (asset.grid.columns - 1)) + 1;
    const startRow = Math.round((chunkRow / chunkRows) * (asset.grid.rows - 1));
    const endRow = Math.round(((chunkRow + 1) / chunkRows) * (asset.grid.rows - 1)) + 1;

    const columns = endColumn - startColumn;
    const rows = endRow - startRow;

    const westT = chunkColumn / chunkColumns;
    const eastT = (chunkColumn + 1) / chunkColumns;
    const northT = chunkRow / chunkRows;
    const southT = (chunkRow + 1) / chunkRows;

    const chunkBounds = {
      west: interpolate(regionBounds.west, regionBounds.east, westT),
      east: interpolate(regionBounds.west, regionBounds.east, eastT),
      north: interpolate(regionBounds.north, regionBounds.south, northT),
      south: interpolate(regionBounds.north, regionBounds.south, southT)
    };

    const minX = interpolate(-asset.world.width * 0.5, asset.world.width * 0.5, westT);
    const maxX = interpolate(-asset.world.width * 0.5, asset.world.width * 0.5, eastT);
    const maxZ = interpolate(asset.world.depth * 0.5, -asset.world.depth * 0.5, northT);
    const minZ = interpolate(asset.world.depth * 0.5, -asset.world.depth * 0.5, southT);

    const heights = buildChunkChannel(
      asset.heights,
      asset.grid.columns,
      startColumn,
      endColumn,
      startRow,
      endRow
    );
    const riverMask = buildChunkChannel(
      asset.riverMask,
      asset.grid.columns,
      startColumn,
      endColumn,
      startRow,
      endRow
    );
    const passMask = buildChunkChannel(
      asset.passMask,
      asset.grid.columns,
      startColumn,
      endColumn,
      startRow,
      endRow
    );
    const settlementMask = buildChunkChannel(
      asset.settlementMask,
      asset.grid.columns,
      startColumn,
      endColumn,
      startRow,
      endRow
    );

    const minHeight = Math.min(...heights);
    const maxHeight = Math.max(...heights);
    const chunkId = `qinling_${chunkColumn}_${chunkRow}`;
    const fileName = `${chunkId}.json`;

    const chunkAsset = {
      id: chunkId,
      type: "terrain-chunk",
      version: 1,
      regionId: "qinling",
      lod: "L2",
      name: `qinling-chunk-${chunkColumn}-${chunkRow}`,
      sourceType: asset.sourceType,
      generatedAt: asset.generatedAt,
      bounds: chunkBounds,
      world: {
        width: Number((maxX - minX).toFixed(3)),
        depth: Number((maxZ - minZ).toFixed(3))
      },
      worldBounds: {
        minX: Number(minX.toFixed(3)),
        maxX: Number(maxX.toFixed(3)),
        minZ: Number(minZ.toFixed(3)),
        maxZ: Number(maxZ.toFixed(3))
      },
      grid: {
        columns,
        rows
      },
      minHeight: Number(minHeight.toFixed(3)),
      maxHeight: Number(maxHeight.toFixed(3)),
      presentation: asset.presentation
        ? {
            ...asset.presentation,
            globalMinHeight: asset.minHeight,
            globalMaxHeight: asset.maxHeight
          }
        : undefined,
      heights,
      riverMask,
      passMask,
      settlementMask,
      notes: [`Derived from ${path.basename(legacyAssetPath)} for chunk streaming tests.`]
    };

    await fs.writeFile(
      path.join(chunksRoot, fileName),
      `${JSON.stringify(chunkAsset, null, 2)}\n`,
      "utf8"
    );

    chunkManifest.chunks.push({
      id: chunkId,
      x: chunkColumn,
      y: chunkRow,
      file: fileName,
      bounds: chunkBounds,
      worldBounds: chunkAsset.worldBounds
    });
  }
}

const regionManifest = {
  id: "qinling",
  type: "region-manifest",
  version: 1,
  displayName: "秦岭 - 关中 - 汉中 - 四川盆地",
  densityClass,
  coordinatePolicy: "strict-geographic",
  parentWorldId: "china-mainland",
  sourceType: asset.sourceType,
  generatedAt: asset.generatedAt,
  bounds: regionBounds,
  world: asset.world,
  geographicFootprintKm,
  scaleArchitecture: {
    currentLayer: qinlingResolutionStrategy.experienceLayer,
    nationalTouringBaseMeters: qinlingResolutionStrategy.baseTerrainResolutionMeters,
    detailCorrectionMeters: qinlingResolutionStrategy.detailCorrectionResolutionMeters,
    sparseRegionMeters: qinlingResolutionStrategy.sparseRegionResolutionMeters,
    runtimeSampleSpacingKm: qinlingResolutionStrategy.runtimeSampleSpacingKm,
    detailCorrectionZones: qinlingResolutionStrategy.detailCorrectionZones.map((zone) => ({
      id: zone.id,
      role: zone.role,
      bounds: zone.bounds
    }))
  },
  experienceScaleMultiplier: 2.3,
  experienceProfile,
  lods: [
    {
      id: "L1",
      file: sliceFileName,
      grid: asset.grid
    }
  ],
  chunking: {
    enabled: true,
    chunkColumns,
    chunkRows,
    chunkManifest: "chunks/manifest.json"
  },
  poiManifest: "poi/manifest.json"
};

await fs.writeFile(
  path.join(regionRoot, "manifest.json"),
  `${JSON.stringify(regionManifest, null, 2)}\n`,
  "utf8"
);
await fs.writeFile(
  path.join(chunksRoot, "manifest.json"),
  `${JSON.stringify(chunkManifest, null, 2)}\n`,
  "utf8"
);

console.log(`Built Qinling region manifest, slice, and ${chunkManifest.chunks.length} chunks.`);
