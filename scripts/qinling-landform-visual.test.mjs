import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const asset = JSON.parse(
  fs.readFileSync("public/data/qinling-slice-dem.json", "utf8")
);

function sampleHeightAt(lon, lat) {
  const { bounds, grid, heights } = asset;
  const column = Math.round(
    ((lon - bounds.west) / (bounds.east - bounds.west)) * (grid.columns - 1)
  );
  const row = Math.round(
    ((bounds.north - lat) / (bounds.north - bounds.south)) * (grid.rows - 1)
  );

  return heights[row * grid.columns + column];
}

function localReliefStats() {
  const { grid, heights } = asset;
  const neighborJumps = [];
  const localSlopes = [];

  for (let row = 1; row < grid.rows - 1; row += 1) {
    for (let column = 1; column < grid.columns - 1; column += 1) {
      const index = row * grid.columns + column;
      const height = heights[index];
      const left = heights[row * grid.columns + column - 1];
      const right = heights[row * grid.columns + column + 1];
      const up = heights[(row - 1) * grid.columns + column];
      const down = heights[(row + 1) * grid.columns + column];

      neighborJumps.push(
        Math.abs(height - left),
        Math.abs(height - right),
        Math.abs(height - up),
        Math.abs(height - down)
      );
      localSlopes.push(Math.hypot(right - left, down - up));
    }
  }

  neighborJumps.sort((a, b) => a - b);
  localSlopes.sort((a, b) => a - b);

  return {
    jump95: neighborJumps[Math.floor(neighborJumps.length * 0.95)],
    slope95: localSlopes[Math.floor(localSlopes.length * 0.95)]
  };
}

test("Qinling slice keeps lowland basins readable in visual scale", () => {
  const guanzhong = sampleHeightAt(108.94, 34.34);
  const hanzhong = sampleHeightAt(107.03, 33.07);
  const chengduPlain = sampleHeightAt(104.07, 30.67);
  const qinlingRidge = sampleHeightAt(107.5, 33.7);
  const verticalRange = asset.maxHeight - asset.minHeight;
  const waterLevel = asset.presentation?.waterLevel;

  assert.equal(asset.sourceType, "processed-real-dem");
  assert.ok(
    Number.isFinite(waterLevel),
    "asset.presentation.waterLevel must be explicit so lowlands are not accidentally rendered as sea"
  );
  assert.ok(
    waterLevel < Math.min(guanzhong, hanzhong, chengduPlain) - 1,
    "global water plane must sit below Guanzhong, Hanzhong, and Chengdu lowlands"
  );
  assert.ok(
    verticalRange <= 24,
    `visual height range should stay readable for third-person scale, got ${verticalRange}`
  );
  assert.ok(
    qinlingRidge > guanzhong + 6,
    "Qinling ridge should still read as a wall above Guanzhong"
  );
  assert.ok(
    Math.max(guanzhong, hanzhong, chengduPlain) < asset.minHeight + verticalRange * 0.35,
    "Guanzhong, Hanzhong, and Chengdu should remain lowland/basin samples"
  );
});

test("Qinling visual relief avoids needle-like mountain noise", () => {
  const relief = localReliefStats();

  assert.ok(
    relief.jump95 <= 2,
    `95th percentile neighbor height jump should stay readable, got ${relief.jump95}`
  );
  assert.ok(
    relief.slope95 <= 3.4,
    `95th percentile local slope should avoid needle-like ridges, got ${relief.slope95}`
  );
});
