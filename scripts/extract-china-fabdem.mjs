import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { workspacePath } from "./china-dem-common.mjs";

const execFileAsync = promisify(execFile);

const archivesDir = workspacePath("data", "fabdem", "china", "archives");
const tilesDir = workspacePath("data", "fabdem", "china", "tiles");
const args = new Set(process.argv.slice(2));
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : Number.POSITIVE_INFINITY;

await fs.mkdir(tilesDir, { recursive: true });

const archiveNames = (await fs.readdir(archivesDir))
  .filter((name) => name.endsWith(".zip"))
  .sort()
  .slice(0, limit);

for (const archiveName of archiveNames) {
  const archivePath = path.join(archivesDir, archiveName);
  console.log(`Extracting ${archiveName}`);
  await execFileAsync("unzip", ["-o", archivePath, "-d", tilesDir]);
}

if (args.has("--list")) {
  const extracted = (await fs.readdir(tilesDir))
    .filter((name) => name.endsWith(".tif"))
    .sort();
  console.log(extracted.join("\n"));
}

console.log(`Extracted ${archiveNames.length} archives into ${tilesDir}`);
