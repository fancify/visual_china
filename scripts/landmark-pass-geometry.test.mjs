import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { MeshPhongMaterial, Vector2 } from "three";
import ts from "typescript";

async function loadPassLandmarkModule() {
  const tempRoot = path.resolve(".codex-temp-tests");
  await mkdir(tempRoot, { recursive: true });
  const tempDir = await mkdtemp(path.join(tempRoot, "pass-landmarks-"));
  const sourcePath = path.resolve("src/game/passLandmarks.ts");
  const source = await readFile(sourcePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022
    },
    fileName: "passLandmarks.ts"
  });

  await writeFile(path.join(tempDir, "passLandmarks.js"), output.outputText, "utf8");

  const moduleUrl = new URL(`file://${path.join(tempDir, "passLandmarks.js")}`).href;
  const passLandmarks = await import(`${moduleUrl}?v=${Date.now()}`);
  await rm(tempDir, { recursive: true, force: true });
  return passLandmarks;
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

test("qinling pass landmarks carry explicit subKind classifications", async () => {
  const content = JSON.parse(
    await readFile("public/data/regions/qinling/poi/content.json", "utf8")
  );
  const passSubKinds = new Map(
    content.landmarks
      .filter((landmark) => landmark.kind === "pass")
      .map((landmark) => [landmark.name, landmark.subKind])
  );

  assert.deepEqual([...passSubKinds.keys()], ["剑门关"]);
  assert.equal(passSubKinds.get("剑门关"), "major-pass");
  assert.equal(passSubKinds.get("陈仓道"), undefined);
  assert.equal(passSubKinds.get("剑门蜀道"), undefined);
  assert.equal(passSubKinds.get("褒斜谷意象"), undefined);
});

test("pass landmark helper builds distinct major and gorge silhouettes", async () => {
  const { buildPassLandmarkMeshes } = await loadPassLandmarkModule();
  assert.equal(
    typeof buildPassLandmarkMeshes,
    "function",
    "buildPassLandmarkMeshes should be exported for geometry regression tests"
  );

  const materials = {
    body: new MeshPhongMaterial(),
    accent: new MeshPhongMaterial()
  };
  const majorMeshes = buildPassLandmarkMeshes({
    position: new Vector2(0, 0),
    ground: 0,
    chunkId: "major",
    subKind: "major-pass",
    materials
  });
  const gorgeMeshes = buildPassLandmarkMeshes({
    position: new Vector2(0, 0),
    ground: 0,
    chunkId: "gorge",
    subKind: "gorge-pass",
    materials
  });

  assert.ok(
    majorMeshes.length >= 4,
    `major-pass should build at least 4 meshes, got ${majorMeshes.length}`
  );
  assert.equal(gorgeMeshes.length, 4, `gorge-pass should build 4 meshes, got ${gorgeMeshes.length}`);

  const majorHeight = worldTop(majorMeshes);
  const gorgeHeight = worldTop(gorgeMeshes);
  assert.ok(
    majorHeight >= 0.98 && majorHeight <= 1.06,
    `major-pass height should shrink to about 1.0u (0.3x), got ${majorHeight}`
  );
  assert.ok(
    gorgeHeight >= 2.5 && gorgeHeight <= 2.8,
    `gorge-pass height should stay near the old stele scale, got ${gorgeHeight}`
  );
  assert.ok(
    majorHeight < gorgeHeight,
    `major-pass should now be visibly shorter than gorge-pass, got ${majorHeight} >= ${gorgeHeight}`
  );

  majorMeshes.forEach((mesh) => {
    assert.equal(mesh.userData.chunkId, "major");
    assert.equal(mesh.userData.sharedResources, true);
    assert.equal(typeof mesh.userData.terrainYOffset, "number");
  });
  gorgeMeshes.forEach((mesh) => {
    assert.equal(mesh.userData.chunkId, "gorge");
    assert.equal(mesh.userData.sharedResources, true);
    assert.equal(typeof mesh.userData.terrainYOffset, "number");
  });
});
