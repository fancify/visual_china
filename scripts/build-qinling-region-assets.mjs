import fs from "node:fs/promises";
import path from "node:path";

import { densityProfileForClass } from "../src/game/geoProjection.js";
import { qinlingModernHydrography } from "../src/game/qinlingHydrography.js";
import {
  qinlingBounds,
  qinlingGeographicFootprintKm,
  qinlingResolutionStrategy
} from "./qinling-dem-common.mjs";

const root = process.cwd();
const legacyAssetPath = path.join(root, "public", "data", "qinling-slice-dem.json");
const regionRoot = path.join(root, "public", "data", "regions", "qinling");
const chunksRoot = path.join(regionRoot, "chunks");
const hydrographyRoot = path.join(regionRoot, "hydrography");

const regionBounds = qinlingBounds;
const geographicFootprintKm = qinlingGeographicFootprintKm;

const targetChunkSpanCells = 50;
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

// Phase 3 全国 0.9 km grid 大于 V8 单字符串上限，DEM build 写成 meta JSON +
// 4 个 binary sidecar。这个 helper 把它们 reassemble 成完整 asset 对象。
const { loadDemAssetWithChannels } = await import("./dem-asset-io.mjs");
const asset = await loadDemAssetWithChannels(legacyAssetPath);
const chunkColumns = Math.max(1, Math.ceil((asset.grid.columns - 1) / targetChunkSpanCells));
const chunkRows = Math.max(1, Math.ceil((asset.grid.rows - 1) / targetChunkSpanCells));
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
await fs.mkdir(hydrographyRoot, { recursive: true });

// Phase 3 全国 0.9 km grid：slice-l1 直接产出 downsample 后的版本（~17 MB），
// 不再写 26.87M cells 的中间巨型 JSON（会撞 V8 string 上限）。downsample 等价
// 于把 slice-l1 直接交给浏览器加载——L1 只用于 atlas + 远景 fallback mesh，
// 7.2 km/cell 够用，细节由 chunks (0.9 km/cell) 接管。
const SLICE_L1_DOWNSAMPLE_STRIDE = 8;
function downsampleChannel(channel, srcCols, srcRows, dstCols, dstRows) {
  if (!Array.isArray(channel)) return channel;
  const out = new Array(dstCols * dstRows);
  const stride = Math.max(1, Math.floor(srcCols / dstCols));
  for (let row = 0; row < dstRows; row += 1) {
    const srcRow = Math.min(srcRows - 1, Math.floor(row * stride + stride / 2));
    for (let col = 0; col < dstCols; col += 1) {
      const srcCol = Math.min(srcCols - 1, Math.floor(col * stride + stride / 2));
      out[row * dstCols + col] = channel[srcRow * srcCols + srcCol];
    }
  }
  return out;
}
{
  const stride = SLICE_L1_DOWNSAMPLE_STRIDE;
  const dstCols = Math.ceil(sliceAsset.grid.columns / stride);
  const dstRows = Math.ceil(sliceAsset.grid.rows / stride);
  const downsampledAsset = {
    ...sliceAsset,
    grid: { columns: dstCols, rows: dstRows },
    heights: downsampleChannel(
      sliceAsset.heights, sliceAsset.grid.columns, sliceAsset.grid.rows, dstCols, dstRows
    ),
    riverMask: downsampleChannel(
      sliceAsset.riverMask, sliceAsset.grid.columns, sliceAsset.grid.rows, dstCols, dstRows
    ),
    passMask: downsampleChannel(
      sliceAsset.passMask, sliceAsset.grid.columns, sliceAsset.grid.rows, dstCols, dstRows
    ),
    settlementMask: downsampleChannel(
      sliceAsset.settlementMask, sliceAsset.grid.columns, sliceAsset.grid.rows, dstCols, dstRows
    ),
    notes: [
      ...(sliceAsset.notes ?? []),
      `Downsampled by ${stride}× from full grid for browser-friendly initial load. Detailed terrain from chunked LODs.`
    ]
  };
  await fs.writeFile(
    sliceOutputPath,
    `${JSON.stringify(downsampledAsset, null, 2)}\n`,
    "utf8"
  );
}
await fs.writeFile(
  path.join(hydrographyRoot, "modern.json"),
  `${JSON.stringify(qinlingModernHydrography, null, 2)}\n`,
  "utf8"
);

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
    // 2026-05 修一个长期 latent bug：之前这里用 (+halfDepth, -halfDepth, t)
    // 把"北 = +Z"。但 mapOrientation 契约是 "北 = -Z"，cityMarkers /
    // hydrography / atlas 都按这个走。结果 chunks 在 world 里 N↔S mirror，
    // 城市 / 河 placed 在地理正确的世界位置但底下 chunk 是反的 → 河谷
    // 雕刻不对位 + 城建在错误高度 → 用户反馈"树飘 / 城市消失 / 河 fragmented"
    // 都是这个 bug 的衍生。codex 找到的根因。
    const minZ = interpolate(-asset.world.depth * 0.5, asset.world.depth * 0.5, northT);
    const maxZ = interpolate(-asset.world.depth * 0.5, asset.world.depth * 0.5, southT);

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
