import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

import { qinlingAncientSites } from "../src/game/qinlingAtlas.js";

const IMPERIAL_TOMB_IDS = [
  "ancient-qinshihuang-tomb",
  "ancient-maoling",
  "ancient-zhaoling",
  "ancient-qianling",
  "ancient-huangdi-tomb"
];

async function loadAncientPoiVisualsModule() {
  const tempRoot = path.resolve(".codex-temp-tests");
  await mkdir(tempRoot, { recursive: true });
  const tempDir = await mkdtemp(path.join(tempRoot, "ancient-poi-"));
  const sourcePath = path.resolve("src/game/ancientPoiVisuals.ts");
  const source = await readFile(sourcePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022
    },
    fileName: "ancientPoiVisuals.ts"
  });

  await writeFile(path.join(tempDir, "ancientPoiVisuals.js"), output.outputText, "utf8");

  const moduleUrl = new URL(`file://${path.join(tempDir, "ancientPoiVisuals.js")}`).href;
  const ancientPoiVisuals = await import(`${moduleUrl}?v=${Date.now()}`);
  await rm(tempDir, { recursive: true, force: true });
  return ancientPoiVisuals;
}

test("five imperial tomb POIs exist with bounded real-world coordinates", () => {
  for (const id of IMPERIAL_TOMB_IDS) {
    const site = qinlingAncientSites.find((entry) => entry.id === id);
    assert.ok(site, `${id} should exist in qinlingAncientSites`);
    assert.equal(site.role, "imperial-tomb");
    assert.ok(site.lat >= 30 && site.lat <= 36, `${site.name} latitude should stay within China-wide sanity bounds`);
    assert.ok(site.lon >= 105 && site.lon <= 112, `${site.name} longitude should stay within China-wide sanity bounds`);
    assert.ok(site.summary.length > 0, `${site.name} should include a summary`);
    assert.ok(site.symbol, `${site.name} should include a symbol reference`);
  }
});

test("imperial tomb mound geometry builds a non-empty stepped mound silhouette", async () => {
  const { buildImperialTombMound } = await loadAncientPoiVisualsModule();
  const geometry = buildImperialTombMound(1);

  geometry.computeBoundingBox();
  assert.ok(geometry.attributes.position.count > 0, "mound geometry should contain vertices");
  assert.ok(geometry.boundingBox, "mound geometry should have a bounding box");
  assert.ok(
    geometry.boundingBox.max.y > 1.4,
    `mound top should rise above 1.4u before placement, got ${geometry.boundingBox.max.y}`
  );
});
