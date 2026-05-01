import fs from "node:fs/promises";
import path from "node:path";

import { qinlingModernHydrography } from "../src/game/qinlingHydrography.js";
import { validateHydrographyAgainstDem } from "../src/game/hydrographyValidation.js";

const demPath = path.resolve("public/data/qinling-slice-dem.json");
const outputPath = path.resolve(
  "public/data/regions/qinling/hydrography/dem-mismatch-report.json"
);

const demAsset = JSON.parse(await fs.readFile(demPath, "utf8"));
const report = validateHydrographyAgainstDem(
  qinlingModernHydrography.features,
  demAsset,
  {
    minRiverAffinity: 0.12,
    maxSlope: 0.9
  }
);

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(
  outputPath,
  `${JSON.stringify({
    ...report,
    generatedAt: new Date().toISOString(),
    sourceAsset: {
      hydrography: "public/data/regions/qinling/hydrography/modern.json",
      dem: "public/data/qinling-slice-dem.json"
    },
    interpretation: [
      "This report checks whether curated hydrography points agree with the current DEM-derived river affinity and slope fields.",
      "Current hydrography is still a curated skeleton; low affinity points are QA signals, not automatic errors.",
      "Points inside interpolated DEM tiles should not be used as strong evidence until DEM source gaps are repaired."
    ]
  }, null, 2)}\n`,
  "utf8"
);

console.log(
  [
    `Wrote ${path.relative(process.cwd(), outputPath)}`,
    `features=${report.summary.featureCount}`,
    `points=${report.summary.totalPoints}`,
    `problemPoints=${report.summary.problemPoints}`
  ].join(" | ")
);
