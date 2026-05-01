import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { qinlingFabdemArchive, qinlingWorkspacePath } from "./qinling-dem-common.mjs";

const DEFAULT_EXPECTED_ARCHIVE_BYTES = 2_692_425_722;

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "unknown";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = -1;

  do {
    value /= 1024;
    unitIndex += 1;
  } while (value >= 1024 && unitIndex < units.length - 1);

  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}

async function statFile(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return { exists: stat.isFile(), bytes: stat.isFile() ? stat.size : 0, path: filePath };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return { exists: false, bytes: 0, path: filePath };
    }

    throw error;
  }
}

async function countTifFiles(dirPath) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".tif"))
      .length;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return 0;
    }

    throw error;
  }
}

async function readSourceType(filePath) {
  try {
    const raw = JSON.parse(await fs.readFile(filePath, "utf8"));
    return typeof raw.sourceType === "string" && raw.sourceType.length > 0
      ? raw.sourceType
      : "unknown";
  } catch (error) {
    if (error?.code === "ENOENT") {
      return "missing";
    }

    throw error;
  }
}

export async function collectQinlingDemStatus({
  rootDir = process.cwd(),
  expectedArchiveBytes = DEFAULT_EXPECTED_ARCHIVE_BYTES
} = {}) {
  const workspacePath =
    rootDir === process.cwd() ? qinlingWorkspacePath : (...parts) => path.join(rootDir, ...parts);
  const archivesDir = workspacePath("data", "fabdem", "qinling", "archives");
  const tilesDir = workspacePath("data", "fabdem", "qinling", "tiles");
  const archivePath = path.join(archivesDir, qinlingFabdemArchive.archiveName);
  const partialPath = `${archivePath}.part`;
  const sliceDemPath = workspacePath("public", "data", "qinling-slice-dem.json");
  const regionManifestPath = workspacePath("public", "data", "regions", "qinling", "manifest.json");

  const [archiveFinal, partialFile, tifCount, sourceType, regionManifest] = await Promise.all([
    statFile(archivePath),
    statFile(partialPath),
    countTifFiles(tilesDir),
    readSourceType(sliceDemPath),
    statFile(regionManifestPath)
  ]);
  const totalBytes = Number.isFinite(expectedArchiveBytes) ? expectedArchiveBytes : null;
  const progressPercent =
    partialFile.exists && totalBytes && totalBytes > 0
      ? Number(((partialFile.bytes / totalBytes) * 100).toFixed(2))
      : null;

  return {
    archiveFinal,
    partial: {
      ...partialFile,
      totalBytes,
      progressPercent
    },
    tiles: {
      path: tilesDir,
      tifCount
    },
    sliceDem: {
      path: sliceDemPath,
      sourceType
    },
    regionManifest
  };
}

export function formatQinlingDemStatus(status) {
  const partialTotal = status.partial.totalBytes === null ? "unknown" : formatBytes(status.partial.totalBytes);
  const partialProgress =
    status.partial.progressPercent === null ? "unknown" : `${status.partial.progressPercent.toFixed(2)}%`;

  return [
    "Qinling FABDEM / DEM status",
    `Archive final zip: ${status.archiveFinal.exists ? "present" : "missing"} (${formatBytes(status.archiveFinal.bytes)})`,
    `Partial download: ${status.partial.exists ? "present" : "missing"} (${formatBytes(status.partial.bytes)} / ${partialTotal}, ${partialProgress})`,
    `Tiles directory TIFF count: ${status.tiles.tifCount}`,
    `qinling-slice-dem.json sourceType: ${status.sliceDem.sourceType}`,
    `Region manifest: ${status.regionManifest.exists ? "present" : "missing"}`
  ].join("\n");
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const status = await collectQinlingDemStatus();

  if (args.has("--json")) {
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  console.log(formatQinlingDemStatus(status));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
