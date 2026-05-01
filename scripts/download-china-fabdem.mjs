import fs from "node:fs/promises";
import path from "node:path";

import { downloadArchive } from "./fabdem-download.mjs";
import {
  chinaFabdemGroups,
  fabdemDataset,
  workspacePath
} from "./china-dem-common.mjs";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const force = args.has("--force");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : Number.POSITIVE_INFINITY;

const archivesDir = workspacePath("data", "fabdem", "china", "archives");
const manifestPath = workspacePath("data", "fabdem", "china", "manifest.json");
const groups = chinaFabdemGroups().slice(0, limit);

await fs.mkdir(archivesDir, { recursive: true });

const manifest = {
  dataset: fabdemDataset.name,
  generatedAt: new Date().toISOString(),
  dryRun,
  archivesDir,
  groups
};

await fs.mkdir(path.dirname(manifestPath), { recursive: true });
await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

if (dryRun) {
  console.log(`Prepared manifest with ${groups.length} archive groups at ${manifestPath}`);
  process.exit(0);
}

for (const group of groups) {
  const destination = path.join(archivesDir, group.archiveName);
  await downloadArchive({
    archiveName: group.archiveName,
    url: group.url,
    destination,
    force
  });
}

console.log(`Downloaded ${groups.length} archive groups to ${archivesDir}`);
