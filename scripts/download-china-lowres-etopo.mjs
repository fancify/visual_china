import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

import {
  chinaLowresManifestPath,
  chinaLowresSourcePath,
  etopoLowresSource
} from "./china-lowres-dem-common.mjs";

const args = new Set(process.argv.slice(2));
const force = args.has("--force");

function subsetUrl() {
  const { latStart, latEnd, lonStart, lonEnd } = etopoLowresSource.subsetIndices;
  const stride = etopoLowresSource.subsetStride;
  const constraint = [
    `lat[${latStart}:${stride}:${latEnd}]`,
    `lon[${lonStart}:${stride}:${lonEnd}]`,
    `z[${latStart}:${stride}:${latEnd}][${lonStart}:${stride}:${lonEnd}]`
  ].join(",");

  return `${etopoLowresSource.opendapDatasetUrl}.ascii?${constraint}`;
}

async function runCurl(url, destination) {
  await new Promise((resolve, reject) => {
    const child = spawn(
      "curl",
      ["-g", "-L", "--fail", "--output", destination, url],
      { stdio: "inherit" }
    );

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`curl exited with code ${code}`));
    });
  });
}

await fs.mkdir(path.dirname(chinaLowresSourcePath), { recursive: true });

if (force) {
  await fs.rm(chinaLowresSourcePath, { force: true });
}

try {
  const stat = await fs.stat(chinaLowresSourcePath);

  if (stat.size > 0) {
    console.log(`Skip existing ${chinaLowresSourcePath} (${stat.size} bytes)`);
  }
} catch {
  const url = subsetUrl();
  console.log(`Downloading ETOPO China OPeNDAP subset to ${chinaLowresSourcePath}`);
  await runCurl(url, chinaLowresSourcePath);
}

const finalStat = await fs.stat(chinaLowresSourcePath);

if (finalStat.size <= 0) {
  throw new Error(`${chinaLowresSourcePath} is empty.`);
}

await fs.writeFile(
  chinaLowresManifestPath("manifest.json"),
  `${JSON.stringify(
    {
      dataset: etopoLowresSource.name,
      generatedAt: new Date().toISOString(),
      source: {
        name: etopoLowresSource.name,
        opendapDatasetUrl: etopoLowresSource.opendapDatasetUrl,
        subsetUrl: subsetUrl(),
        subsetStride: etopoLowresSource.subsetStride,
        subsetIndices: etopoLowresSource.subsetIndices,
        citation: etopoLowresSource.citation
      },
      localPath: chinaLowresSourcePath,
      bytes: finalStat.size
    },
    null,
    2
  )}\n`,
  "utf8"
);

console.log(`Downloaded ${chinaLowresSourcePath} (${finalStat.size} bytes)`);
