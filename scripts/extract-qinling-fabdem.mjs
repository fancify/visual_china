import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { qinlingFabdemArchive, qinlingWorkspacePath } from "./qinling-dem-common.mjs";

const execFileAsync = promisify(execFile);

const archivesDir = qinlingWorkspacePath("data", "fabdem", "qinling", "archives");
const tilesDir = qinlingWorkspacePath("data", "fabdem", "qinling", "tiles");

await fs.mkdir(tilesDir, { recursive: true });

const archivePath = path.join(archivesDir, qinlingFabdemArchive.archiveName);

await fs.access(archivePath);
const archiveStat = await fs.stat(archivePath);

if (
  Number.isFinite(qinlingFabdemArchive.expectedBytes) &&
  archiveStat.size !== qinlingFabdemArchive.expectedBytes
) {
  throw new Error(
    `Qinling archive has unexpected size: ${archiveStat.size}, expected ${qinlingFabdemArchive.expectedBytes}.`
  );
}

console.log(`Testing ${qinlingFabdemArchive.archiveName}`);
await execFileAsync("unzip", ["-t", archivePath]);

console.log(`Extracting ${qinlingFabdemArchive.archiveName}`);
await execFileAsync("unzip", ["-o", archivePath, "-d", tilesDir]);

console.log(`Extracted Qinling archive into ${tilesDir}`);
