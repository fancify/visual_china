import assert from "node:assert/strict";
import test from "node:test";

import {
  hydrographyPointDemDiagnostics,
  validateHydrographyAgainstDem
} from "../src/game/hydrographyValidation.js";

const demAsset = {
  bounds: { west: 0, east: 2, south: 0, north: 2 },
  world: { width: 20, depth: 20 },
  grid: { columns: 3, rows: 3 },
  minHeight: 0,
  maxHeight: 10,
  heights: [
    9, 9, 9,
    2, 1, 8,
    8, 8, 8
  ],
  riverMask: [
    0, 0, 0,
    0.9, 0.95, 0.05,
    0, 0, 0
  ],
  notes: [
    "Missing required tiles filled by neighbor interpolation: N01E001_FABDEM_V1-2.tif."
  ]
};

test("hydrography diagnostics flag points that do not follow DEM river affinity", () => {
  const report = validateHydrographyAgainstDem(
    [
      {
        id: "river-test",
        name: "测试河",
        rank: 1,
        geometry: {
          points: [
            { x: -5, y: 0 },
            { x: 8, y: 0 }
          ]
        }
      }
    ],
    demAsset,
    { minRiverAffinity: 0.5, maxSlope: 0.95 }
  );

  assert.equal(report.features.length, 1);
  assert.equal(report.features[0].points[0].issues.length, 0);
  assert.ok(report.features[0].points[1].issues.includes("low-river-affinity"));
  assert.equal(report.summary.problemPoints, 1);
  assert.equal(report.summary.issueCounts["low-river-affinity"], 1);
});

test("hydrography diagnostics expose interpolated DEM tile overlap", () => {
  const diagnostics = hydrographyPointDemDiagnostics(
    { x: 9, y: 8 },
    demAsset,
    { minRiverAffinity: 0.5, maxSlope: 1 }
  );

  assert.ok(diagnostics.issues.includes("interpolated-dem-tile"));
  assert.equal(diagnostics.missingTileNames[0], "N01E001_FABDEM_V1-2.tif");
});
