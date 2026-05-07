import { Vector2 } from "three";

import type { DemBounds } from "./demSampler";

export interface ChunkWorldBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface RegionChunkEntry {
  id: string;
  x: number;
  y: number;
  file: string;
  bounds: DemBounds;
  worldBounds: ChunkWorldBounds;
}

export interface RegionChunkManifest {
  regionId: string;
  type: "chunk-manifest";
  version: number;
  chunkColumns: number;
  chunkRows: number;
  chunks: RegionChunkEntry[];
}

interface RegionChunkLookup {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  cellWidth: number;
  cellDepth: number;
  chunksByGridKey: Map<string, RegionChunkEntry>;
}

const manifestLookupCache = new WeakMap<RegionChunkManifest, RegionChunkLookup>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Chunk manifest field "${fieldName}" must be a non-empty string.`);
  }

  return value;
}

function asFiniteNumber(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Chunk manifest field "${fieldName}" must be a finite number.`);
  }

  return value;
}

function validateBounds(raw: unknown, fieldName: string): DemBounds {
  if (!isRecord(raw)) {
    throw new Error(`Chunk manifest field "${fieldName}" must be an object.`);
  }

  const west = asFiniteNumber(raw.west, `${fieldName}.west`);
  const east = asFiniteNumber(raw.east, `${fieldName}.east`);
  const south = asFiniteNumber(raw.south, `${fieldName}.south`);
  const north = asFiniteNumber(raw.north, `${fieldName}.north`);

  if (west >= east || south >= north) {
    throw new Error(`Chunk manifest field "${fieldName}" has invalid geographic bounds.`);
  }

  return { west, east, south, north };
}

function validateWorldBounds(raw: unknown, fieldName: string): ChunkWorldBounds {
  if (!isRecord(raw)) {
    throw new Error(`Chunk manifest field "${fieldName}" must be an object.`);
  }

  const minX = asFiniteNumber(raw.minX, `${fieldName}.minX`);
  const maxX = asFiniteNumber(raw.maxX, `${fieldName}.maxX`);
  const minZ = asFiniteNumber(raw.minZ, `${fieldName}.minZ`);
  const maxZ = asFiniteNumber(raw.maxZ, `${fieldName}.maxZ`);

  if (minX >= maxX || minZ >= maxZ) {
    throw new Error(`Chunk manifest field "${fieldName}" has invalid world bounds.`);
  }

  return { minX, maxX, minZ, maxZ };
}

function validateChunkEntry(raw: unknown, index: number): RegionChunkEntry {
  if (!isRecord(raw)) {
    throw new Error(`Chunk manifest entry ${index} must be an object.`);
  }

  return {
    id: asString(raw.id, `chunks[${index}].id`),
    x: asFiniteNumber(raw.x, `chunks[${index}].x`),
    y: asFiniteNumber(raw.y, `chunks[${index}].y`),
    file: asString(raw.file, `chunks[${index}].file`),
    bounds: validateBounds(raw.bounds, `chunks[${index}].bounds`),
    worldBounds: validateWorldBounds(raw.worldBounds, `chunks[${index}].worldBounds`)
  };
}

export async function loadRegionChunkManifest(
  manifestUrl: string
): Promise<RegionChunkManifest> {
  const response = await fetch(manifestUrl);

  if (!response.ok) {
    throw new Error(`Failed to load chunk manifest from ${manifestUrl} (${response.status}).`);
  }

  const raw = (await response.json()) as unknown;

  if (!isRecord(raw) || raw.type !== "chunk-manifest") {
    throw new Error("Unsupported chunk manifest format.");
  }

  if (!Array.isArray(raw.chunks)) {
    throw new Error('Chunk manifest field "chunks" must be an array.');
  }

  return {
    regionId: asString(raw.regionId, "regionId"),
    type: "chunk-manifest",
    version: asFiniteNumber(raw.version, "version"),
    chunkColumns: asFiniteNumber(raw.chunkColumns, "chunkColumns"),
    chunkRows: asFiniteNumber(raw.chunkRows, "chunkRows"),
    chunks: raw.chunks.map(validateChunkEntry)
  };
}

export function findChunkForPosition(
  chunkManifest: RegionChunkManifest,
  position: Vector2
): RegionChunkEntry | null {
  const lookup = getRegionChunkLookup(chunkManifest);

  if (!isPositionWithinLookupBounds(lookup, position)) {
    return null;
  }

  const column = clampIndex(
    Math.floor((position.x - lookup.minX) / lookup.cellWidth),
    chunkManifest.chunkColumns
  );
  const row = clampIndex(
    Math.floor((position.y - lookup.minZ) / lookup.cellDepth),
    chunkManifest.chunkRows
  );
  const candidate = lookup.chunksByGridKey.get(chunkGridKey(column, row));

  if (candidate && chunkContainsPosition(candidate, position)) {
    return candidate;
  }

  return (
    chunkManifest.chunks.find((chunk) => chunkContainsPosition(chunk, position)) ?? null
  );
}

export function buildVisibleChunkIds(
  chunkManifest: RegionChunkManifest,
  currentChunkId: string | null,
  radius = 1
): Set<string> {
  return buildChunkWindowIds(chunkManifest, currentChunkId, radius);
}

export function buildRetainedChunkIds(
  chunkManifest: RegionChunkManifest,
  currentChunkId: string | null,
  radius = 2
): Set<string> {
  return buildChunkWindowIds(chunkManifest, currentChunkId, radius);
}

export function limitChunkIdsByGridDistance(
  chunkManifest: RegionChunkManifest,
  chunkIds: Set<string>,
  currentChunkId: string | null,
  maxCount: number
): Set<string> {
  if (chunkIds.size <= maxCount || maxCount <= 0) {
    return chunkIds;
  }

  const currentChunk = chunkManifest.chunks.find((chunk) => chunk.id === currentChunkId);

  if (!currentChunk) {
    return new Set(Array.from(chunkIds).slice(0, maxCount));
  }

  return new Set(
    chunkManifest.chunks
      .filter((chunk) => chunkIds.has(chunk.id))
      .sort((a, b) => {
        const distanceA = Math.hypot(a.x - currentChunk.x, a.y - currentChunk.y);
        const distanceB = Math.hypot(b.x - currentChunk.x, b.y - currentChunk.y);
        return distanceA - distanceB;
      })
      .slice(0, maxCount)
      .map((chunk) => chunk.id)
  );
}

function buildChunkWindowIds(
  chunkManifest: RegionChunkManifest,
  currentChunkId: string | null,
  radius: number
): Set<string> {
  if (!currentChunkId) {
    return new Set(chunkManifest.chunks.map((chunk) => chunk.id));
  }

  const currentChunk = chunkManifest.chunks.find((chunk) => chunk.id === currentChunkId);

  if (!currentChunk) {
    return new Set(chunkManifest.chunks.map((chunk) => chunk.id));
  }

  return new Set(
    chunkManifest.chunks
      .filter(
        (chunk) =>
          Math.abs(chunk.x - currentChunk.x) <= radius &&
          Math.abs(chunk.y - currentChunk.y) <= radius
      )
      .map((chunk) => chunk.id)
  );
}

function getRegionChunkLookup(chunkManifest: RegionChunkManifest): RegionChunkLookup {
  const cached = manifestLookupCache.get(chunkManifest);
  if (cached) {
    return cached;
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  const chunksByGridKey = new Map<string, RegionChunkEntry>();

  chunkManifest.chunks.forEach((chunk) => {
    minX = Math.min(minX, chunk.worldBounds.minX);
    maxX = Math.max(maxX, chunk.worldBounds.maxX);
    minZ = Math.min(minZ, chunk.worldBounds.minZ);
    maxZ = Math.max(maxZ, chunk.worldBounds.maxZ);
    chunksByGridKey.set(chunkGridKey(chunk.x, chunk.y), chunk);
  });

  const lookup = {
    minX,
    maxX,
    minZ,
    maxZ,
    cellWidth: (maxX - minX) / Math.max(1, chunkManifest.chunkColumns),
    cellDepth: (maxZ - minZ) / Math.max(1, chunkManifest.chunkRows),
    chunksByGridKey
  } satisfies RegionChunkLookup;
  manifestLookupCache.set(chunkManifest, lookup);
  return lookup;
}

function chunkGridKey(x: number, y: number): string {
  return `${x}:${y}`;
}

function clampIndex(value: number, length: number): number {
  return Math.max(0, Math.min(length - 1, value));
}

function chunkContainsPosition(chunk: RegionChunkEntry, position: Vector2): boolean {
  const { minX, maxX, minZ, maxZ } = chunk.worldBounds;
  return (
    position.x >= minX &&
    position.x <= maxX &&
    position.y >= minZ &&
    position.y <= maxZ
  );
}

function isPositionWithinLookupBounds(
  lookup: RegionChunkLookup,
  position: Vector2
): boolean {
  return (
    position.x >= lookup.minX &&
    position.x <= lookup.maxX &&
    position.y >= lookup.minZ &&
    position.y <= lookup.maxZ
  );
}
