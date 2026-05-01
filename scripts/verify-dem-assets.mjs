import fs from "node:fs/promises";
import path from "node:path";

const MAX_GRID_COLUMNS = 1024;
const MAX_GRID_ROWS = 1024;
const MAX_TOTAL_CELLS = 1024 * 1024;

function isRecord(value) {
  return typeof value === "object" && value !== null;
}

function asFiniteNumber(value, fieldName) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Field "${fieldName}" must be a finite number.`);
  }

  return value;
}

function asString(value, fieldName) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Field "${fieldName}" must be a non-empty string.`);
  }

  return value;
}

function validateBounds(raw, fieldName) {
  if (!isRecord(raw)) {
    throw new Error(`Field "${fieldName}" must be an object.`);
  }

  const west = asFiniteNumber(raw.west, `${fieldName}.west`);
  const east = asFiniteNumber(raw.east, `${fieldName}.east`);
  const south = asFiniteNumber(raw.south, `${fieldName}.south`);
  const north = asFiniteNumber(raw.north, `${fieldName}.north`);

  if (west >= east || south >= north) {
    throw new Error(`Field "${fieldName}" has invalid geographic bounds.`);
  }

  return { west, east, south, north };
}

function validateWorld(raw) {
  if (!isRecord(raw)) {
    throw new Error('Field "world" must be an object.');
  }

  const width = asFiniteNumber(raw.width, "world.width");
  const depth = asFiniteNumber(raw.depth, "world.depth");

  if (width <= 0 || depth <= 0) {
    throw new Error('Field "world" must use positive dimensions.');
  }

  return { width, depth };
}

function validateWorldBounds(raw, fieldName) {
  if (!isRecord(raw)) {
    throw new Error(`Field "${fieldName}" must be an object.`);
  }

  const minX = asFiniteNumber(raw.minX, `${fieldName}.minX`);
  const maxX = asFiniteNumber(raw.maxX, `${fieldName}.maxX`);
  const minZ = asFiniteNumber(raw.minZ, `${fieldName}.minZ`);
  const maxZ = asFiniteNumber(raw.maxZ, `${fieldName}.maxZ`);

  if (minX >= maxX || minZ >= maxZ) {
    throw new Error(`Field "${fieldName}" has invalid world bounds.`);
  }

  return { minX, maxX, minZ, maxZ };
}

function validatePoint2(raw, fieldName) {
  if (!isRecord(raw)) {
    throw new Error(`Field "${fieldName}" must be an object.`);
  }

  return {
    x: asFiniteNumber(raw.x, `${fieldName}.x`),
    y: asFiniteNumber(raw.y, `${fieldName}.y`)
  };
}

function validateGrid(raw) {
  if (!isRecord(raw)) {
    throw new Error('Field "grid" must be an object.');
  }

  const columns = asFiniteNumber(raw.columns, "grid.columns");
  const rows = asFiniteNumber(raw.rows, "grid.rows");

  if (!Number.isInteger(columns) || !Number.isInteger(rows)) {
    throw new Error('Field "grid" must use integer dimensions.');
  }

  if (columns < 2 || rows < 2) {
    throw new Error('Field "grid" must be at least 2 x 2.');
  }

  if (columns > MAX_GRID_COLUMNS || rows > MAX_GRID_ROWS) {
    throw new Error(`Grid ${columns} x ${rows} exceeds the browser guardrail.`);
  }

  if (columns * rows > MAX_TOTAL_CELLS) {
    throw new Error(`Grid uses ${columns * rows} cells, exceeding the browser guardrail.`);
  }

  return { columns, rows };
}

function validateChannel(raw, fieldName, expectedLength) {
  if (!Array.isArray(raw)) {
    throw new Error(`Field "${fieldName}" must be an array.`);
  }

  if (raw.length !== expectedLength) {
    throw new Error(
      `Field "${fieldName}" has ${raw.length} values, expected ${expectedLength}.`
    );
  }

  raw.forEach((value, index) => {
    asFiniteNumber(value, `${fieldName}[${index}]`);
  });

  return raw;
}

function validateAsset(raw) {
  if (!isRecord(raw)) {
    throw new Error("DEM asset must be a JSON object.");
  }

  const name = asString(raw.name, "name");
  const sourceType = asString(raw.sourceType, "sourceType");
  const generatedAt = asString(raw.generatedAt, "generatedAt");
  const world = validateWorld(raw.world);
  const grid = validateGrid(raw.grid);
  const expectedLength = grid.columns * grid.rows;
  const minHeight = asFiniteNumber(raw.minHeight, "minHeight");
  const maxHeight = asFiniteNumber(raw.maxHeight, "maxHeight");

  if (minHeight > maxHeight) {
    throw new Error('Fields "minHeight" and "maxHeight" are inconsistent.');
  }

  if (raw.bounds !== undefined) {
    validateBounds(raw.bounds, "bounds");
  }

  if (raw.worldBounds !== undefined) {
    validateWorldBounds(raw.worldBounds, "worldBounds");
  }

  const heights = validateChannel(raw.heights, "heights", expectedLength);
  validateChannel(raw.riverMask, "riverMask", expectedLength);
  validateChannel(raw.passMask, "passMask", expectedLength);
  validateChannel(raw.settlementMask, "settlementMask", expectedLength);

  const firstHeight = heights[0];

  if (heights.every((value) => value === firstHeight)) {
    throw new Error('Field "heights" is constant, which indicates a broken export.');
  }

  return { name, sourceType, generatedAt, world, grid, minHeight, maxHeight };
}

function isManifestLike(raw) {
  return (
    isRecord(raw) &&
    (raw.type === "region-manifest" || raw.type === "world-manifest") &&
    Array.isArray(raw.lods)
  );
}

function isChunkManifestLike(raw) {
  return isRecord(raw) && raw.type === "chunk-manifest" && Array.isArray(raw.chunks);
}

async function loadJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function resolveAssetTarget(filePath) {
  const raw = await loadJson(filePath);

  if (!isManifestLike(raw)) {
    return { filePath, raw, sourceKind: "asset" };
  }

  asString(raw.id, "id");
  validateBounds(raw.bounds, "bounds");
  validateWorld(raw.world);

  if (raw.lods.length === 0 || !isRecord(raw.lods[0])) {
    throw new Error("Manifest must contain at least one lod entry.");
  }

  const firstLod = raw.lods[0];
  const assetFile = asString(firstLod.file, "lods[0].file");
  const resolvedFile = path.resolve(path.dirname(filePath), assetFile);

  return {
    filePath: resolvedFile,
    raw: await loadJson(resolvedFile),
    sourceKind: "manifest",
    manifestPath: filePath
  };
}

async function validateChunkManifest(filePath) {
  const raw = await loadJson(filePath);

  if (!isChunkManifestLike(raw)) {
    throw new Error(`Unsupported chunk manifest format at ${filePath}.`);
  }

  const regionId = asString(raw.regionId, "regionId");
  const chunkEntries = raw.chunks;

  if (chunkEntries.length === 0) {
    throw new Error("Chunk manifest must contain at least one chunk.");
  }

  const summaries = [];

  for (const [index, chunkEntry] of chunkEntries.entries()) {
    if (!isRecord(chunkEntry)) {
      throw new Error(`chunks[${index}] must be an object.`);
    }

    const chunkId = asString(chunkEntry.id, `chunks[${index}].id`);
    const chunkFile = asString(chunkEntry.file, `chunks[${index}].file`);
    validateBounds(chunkEntry.bounds, `chunks[${index}].bounds`);

    if (!isRecord(chunkEntry.worldBounds)) {
      throw new Error(`chunks[${index}].worldBounds must be an object.`);
    }

    asFiniteNumber(chunkEntry.worldBounds.minX, `chunks[${index}].worldBounds.minX`);
    asFiniteNumber(chunkEntry.worldBounds.maxX, `chunks[${index}].worldBounds.maxX`);
    asFiniteNumber(chunkEntry.worldBounds.minZ, `chunks[${index}].worldBounds.minZ`);
    asFiniteNumber(chunkEntry.worldBounds.maxZ, `chunks[${index}].worldBounds.maxZ`);

    const chunkPath = path.resolve(path.dirname(filePath), chunkFile);
    const summary = validateAsset(await loadJson(chunkPath));
    summaries.push({ chunkId, chunkPath, summary });
  }

  return { regionId, summaries };
}

async function validatePoiManifest(filePath) {
  const rawManifest = await loadJson(filePath);

  if (!isRecord(rawManifest) || rawManifest.type !== "region-poi-manifest") {
    throw new Error(`Unsupported POI manifest format at ${filePath}.`);
  }

  const regionId = asString(rawManifest.regionId, "regionId");
  const contentFile = asString(rawManifest.file, "file");
  const contentPath = path.resolve(path.dirname(filePath), contentFile);
  const rawContent = await loadJson(contentPath);

  if (!isRecord(rawContent)) {
    throw new Error(`POI content must be an object at ${contentPath}.`);
  }

  validatePoint2(rawContent.routeStart, "routeStart");

  if (!Array.isArray(rawContent.landmarks)) {
    throw new Error('Field "landmarks" must be an array.');
  }

  if (!Array.isArray(rawContent.fragments)) {
    throw new Error('Field "fragments" must be an array.');
  }

  rawContent.landmarks.forEach((landmark, index) => {
    if (!isRecord(landmark)) {
      throw new Error(`landmarks[${index}] must be an object.`);
    }

    asString(landmark.name, `landmarks[${index}].name`);
    asString(landmark.kind, `landmarks[${index}].kind`);
    validatePoint2(landmark.position, `landmarks[${index}].position`);
    asString(landmark.description, `landmarks[${index}].description`);
  });

  const fragmentIds = new Set();
  rawContent.fragments.forEach((fragment, index) => {
    if (!isRecord(fragment)) {
      throw new Error(`fragments[${index}] must be an object.`);
    }

    const id = asString(fragment.id, `fragments[${index}].id`);
    fragmentIds.add(id);
    asString(fragment.title, `fragments[${index}].title`);
    asString(fragment.zone, `fragments[${index}].zone`);
    validatePoint2(fragment.position, `fragments[${index}].position`);
    asString(fragment.pickupLine, `fragments[${index}].pickupLine`);

    if (!isRecord(fragment.details)) {
      throw new Error(`fragments[${index}].details must be an object.`);
    }

    asString(fragment.details.geo, `fragments[${index}].details.geo`);
    asString(fragment.details.history, `fragments[${index}].details.history`);
    asString(fragment.details.strategy, `fragments[${index}].details.strategy`);
  });

  const storyBeats = Array.isArray(rawContent.storyBeats) ? rawContent.storyBeats : [];
  storyBeats.forEach((storyBeat, index) => {
    if (!isRecord(storyBeat)) {
      throw new Error(`storyBeats[${index}] must be an object.`);
    }

    asString(storyBeat.id, `storyBeats[${index}].id`);
    asString(storyBeat.title, `storyBeats[${index}].title`);
    asString(storyBeat.guidance, `storyBeats[${index}].guidance`);
    asString(storyBeat.completionLine, `storyBeats[${index}].completionLine`);
    validatePoint2(storyBeat.target, `storyBeats[${index}].target`);
    const radius = asFiniteNumber(
      storyBeat.completionRadius,
      `storyBeats[${index}].completionRadius`
    );

    if (radius <= 0) {
      throw new Error(`storyBeats[${index}].completionRadius must be positive.`);
    }

    if (storyBeat.requiredFragmentId !== undefined) {
      const requiredFragmentId = asString(
        storyBeat.requiredFragmentId,
        `storyBeats[${index}].requiredFragmentId`
      );

      if (!fragmentIds.has(requiredFragmentId)) {
        throw new Error(
          `storyBeats[${index}].requiredFragmentId references missing fragment "${requiredFragmentId}".`
        );
      }
    }
  });

  return {
    regionId,
    contentPath,
    landmarks: rawContent.landmarks.length,
    fragments: rawContent.fragments.length,
    storyBeats: storyBeats.length
  };
}

async function main() {
  const targets = process.argv.slice(2);

  if (targets.length === 0) {
    targets.push("public/data/qinling-slice-dem.json");
  }

  for (const target of targets) {
    const absolutePath = path.resolve(process.cwd(), target);
    const raw = await loadJson(absolutePath);

    if (isChunkManifestLike(raw)) {
      const chunkManifest = await validateChunkManifest(absolutePath);
      console.log(
        [
          `OK ${path.relative(process.cwd(), absolutePath)}`,
          `region=${chunkManifest.regionId}`,
          `chunks=${chunkManifest.summaries.length}`
        ].join(" | ")
      );
      continue;
    }

    const resolved = await resolveAssetTarget(absolutePath);
    const summary = validateAsset(resolved.raw);

    console.log(
      [
        `OK ${path.relative(process.cwd(), resolved.filePath)}`,
        `name=${summary.name}`,
        `source=${summary.sourceType}`,
        `grid=${summary.grid.columns}x${summary.grid.rows}`,
        `world=${summary.world.width}x${summary.world.depth}`,
        `heights=${summary.minHeight}..${summary.maxHeight}`,
        resolved.sourceKind === "manifest"
          ? `via=${path.relative(process.cwd(), resolved.manifestPath)}`
          : null
      ]
        .filter(Boolean)
        .join(" | ")
    );

    if (resolved.sourceKind === "manifest" && isRecord(raw.chunking) && raw.chunking.enabled === true) {
      const chunkManifestFile = asString(raw.chunking.chunkManifest, "chunking.chunkManifest");
      const chunkManifestPath = path.resolve(path.dirname(absolutePath), chunkManifestFile);
      const chunkManifest = await validateChunkManifest(chunkManifestPath);
      console.log(
        [
          `OK ${path.relative(process.cwd(), chunkManifestPath)}`,
          `region=${chunkManifest.regionId}`,
          `chunks=${chunkManifest.summaries.length}`,
          `via=${path.relative(process.cwd(), absolutePath)}`
        ].join(" | ")
      );
    }

    if (resolved.sourceKind === "manifest" && typeof raw.poiManifest === "string") {
      const poiManifestPath = path.resolve(path.dirname(absolutePath), raw.poiManifest);
      const poiSummary = await validatePoiManifest(poiManifestPath);
      console.log(
        [
          `OK ${path.relative(process.cwd(), poiSummary.contentPath)}`,
          `region=${poiSummary.regionId}`,
          `landmarks=${poiSummary.landmarks}`,
          `fragments=${poiSummary.fragments}`,
          `storyBeats=${poiSummary.storyBeats}`,
          `via=${path.relative(process.cwd(), absolutePath)}`
        ].join(" | ")
      );
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
