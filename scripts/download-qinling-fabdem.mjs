import fs from "node:fs/promises";
import path from "node:path";

import { fabdemDataset } from "./china-dem-common.mjs";
import { downloadArchive } from "./fabdem-download.mjs";
import {
  qinlingFabdemArchive,
  qinlingWorkspacePath
} from "./qinling-dem-common.mjs";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const force = args.has("--force");

const archivesDir = qinlingWorkspacePath("data", "fabdem", "qinling", "archives");
const manifestPath = qinlingWorkspacePath("data", "fabdem", "qinling", "manifest.json");

await fs.mkdir(archivesDir, { recursive: true });

const manifest = {
  dataset: fabdemDataset.name,
  generatedAt: new Date().toISOString(),
  dryRun,
  archivesDir,
  archive: qinlingFabdemArchive
};

await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

if (dryRun) {
  console.log(`Prepared Qinling FABDEM manifest at ${manifestPath}`);
  process.exit(0);
}

const destination = path.join(archivesDir, qinlingFabdemArchive.archiveName);
await downloadArchive({
  archiveName: qinlingFabdemArchive.archiveName,
  url: qinlingFabdemArchive.url,
  destination,
  force,
  expectedBytes: qinlingFabdemArchive.expectedBytes
});
