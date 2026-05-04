import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { MeshPhongMaterial, Vector2 } from "three";
import ts from "typescript";

async function loadScenicPoiVisualsModule() {
  const tempRoot = path.resolve(".codex-temp-tests");
  await mkdir(tempRoot, { recursive: true });
  const tempDir = await mkdtemp(path.join(tempRoot, "scenic-poi-"));
  const sourcePath = path.resolve("src/game/scenicPoiVisuals.ts");
  const source = await readFile(sourcePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022
    },
    fileName: "scenicPoiVisuals.ts"
  });

  await writeFile(path.join(tempDir, "scenicPoiVisuals.js"), output.outputText, "utf8");

  const moduleUrl = new URL(`file://${path.join(tempDir, "scenicPoiVisuals.js")}`).href;
  const scenicPoiVisuals = await import(`${moduleUrl}?v=${Date.now()}`);
  await rm(tempDir, { recursive: true, force: true });
  return scenicPoiVisuals;
}

function worldTop(meshes) {
  return Math.max(
    ...meshes.map((mesh) => {
      mesh.updateMatrixWorld(true);
      mesh.geometry.computeBoundingBox();
      return mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld).max.y;
    })
  );
}

function buildMaterials() {
  return {
    alpineRock: new MeshPhongMaterial(),
    alpineSnow: new MeshPhongMaterial(),
    forestGreen: new MeshPhongMaterial(),
    pavilionWall: new MeshPhongMaterial(),
    pavilionRoof: new MeshPhongMaterial(),
    karstWater: new MeshPhongMaterial(),
    karstTree: new MeshPhongMaterial(),
    pagodaWall: new MeshPhongMaterial(),
    pagodaBaseStone: new MeshPhongMaterial(),
    mausoleumEarth: new MeshPhongMaterial(),
    mausoleumStele: new MeshPhongMaterial(),
    travertineGold: new MeshPhongMaterial(),
    tiankengWell: new MeshPhongMaterial(),
    tiankengRim: new MeshPhongMaterial()
  };
}

test("mountain scenic roles keep labels only and no longer spawn meshes", async () => {
  const { buildScenicPoiMeshes, scenicPoiLabelHeights } = await loadScenicPoiVisualsModule();
  const materials = buildMaterials();

  const alpineMeshes = buildScenicPoiMeshes({
    chunkId: "taibai",
    ground: 0,
    materials,
    position: new Vector2(0, 0),
    role: "alpine-peak"
  });
  const forestMeshes = buildScenicPoiMeshes({
    chunkId: "qingcheng",
    ground: 0,
    materials,
    position: new Vector2(0, 0),
    role: "religious-mountain"
  });

  assert.equal(alpineMeshes.length, 0);
  assert.equal(forestMeshes.length, 0);
  assert.equal(scenicPoiLabelHeights["alpine-peak"], 1.9);
  assert.equal(scenicPoiLabelHeights["religious-mountain"], 1.7);
});

test("pagoda, mausoleum, travertine, and sinkhole meshes use the compact scenic scale", async () => {
  const { buildScenicPoiMeshes, scenicPoiLabelHeights } = await loadScenicPoiVisualsModule();
  const materials = buildMaterials();
  const position = new Vector2(0, 0);

  const pagodaMeshes = buildScenicPoiMeshes({
    chunkId: "famen",
    ground: 0,
    materials,
    position,
    role: "buddhist-relic"
  });
  const mausoleumMeshes = buildScenicPoiMeshes({
    chunkId: "qianling",
    ground: 0,
    materials,
    position,
    role: "imperial-mausoleum"
  });
  const travertineMeshes = buildScenicPoiMeshes({
    chunkId: "huanglong",
    ground: 0,
    materials,
    position,
    role: "travertine-terraces"
  });
  const sinkholeMeshes = buildScenicPoiMeshes({
    chunkId: "tiankeng",
    ground: 0,
    materials,
    position,
    role: "karst-sinkhole"
  });

  assert.equal(pagodaMeshes.length, 6);
  assert.ok(
    worldTop(pagodaMeshes) > 1.45 && worldTop(pagodaMeshes) < 1.65,
    `pagoda top should stay near 1.5u, got ${worldTop(pagodaMeshes)}`
  );
  assert.equal(scenicPoiLabelHeights["buddhist-relic"], 1.8);

  assert.equal(mausoleumMeshes.length, 3);
  assert.ok(
    worldTop(mausoleumMeshes) > 1.18 && worldTop(mausoleumMeshes) < 1.26,
    `mausoleum mound should stay near 1.2u, got ${worldTop(mausoleumMeshes)}`
  );
  assert.equal(scenicPoiLabelHeights["imperial-mausoleum"], 1.65);

  assert.equal(travertineMeshes.length, 6);
  assert.ok(
    worldTop(travertineMeshes) > 0.46 && worldTop(travertineMeshes) < 0.54,
    `travertine terraces should top out below 0.55u, got ${worldTop(travertineMeshes)}`
  );
  assert.equal(scenicPoiLabelHeights["travertine-terraces"], 1.5);

  assert.equal(sinkholeMeshes.length, 3);
  assert.ok(
    worldTop(sinkholeMeshes) > 0.16 && worldTop(sinkholeMeshes) < 0.24,
    `sinkhole rim should top out below 0.25u, got ${worldTop(sinkholeMeshes)}`
  );
  assert.equal(scenicPoiLabelHeights["karst-sinkhole"], 1.5);
});

test("karst lake system keeps a small cluster instead of the old wide prototype footprint", async () => {
  const { buildScenicPoiMeshes, scenicPoiLabelHeights } = await loadScenicPoiVisualsModule();
  const materials = buildMaterials();
  const meshes = buildScenicPoiMeshes({
    chunkId: "jiuzhai",
    ground: 0,
    materials,
    position: new Vector2(0, 0),
    role: "karst-lake-system"
  });

  assert.equal(meshes.length, 7);
  assert.equal(scenicPoiLabelHeights["karst-lake-system"], 1.6);

  const maxRadius = Math.max(
    ...meshes.map((mesh) => Math.hypot(mesh.position.x, mesh.position.z))
  );
  assert.ok(
    maxRadius < 1.3,
    `karst cluster should stay close to the anchor instead of the old 3-4u spread, got ${maxRadius}`
  );
  assert.ok(
    worldTop(meshes) > 0.45 && worldTop(meshes) < 0.65,
    `karst trees should top out around 0.5u, got ${worldTop(meshes)}`
  );
});
