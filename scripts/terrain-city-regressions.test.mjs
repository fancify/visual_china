import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Raycaster,
  Vector3
} from "three";

import { configureChunkTerrainFrustum } from "../src/game/terrainMeshFrustum.js";
import { TerrainSampler } from "../src/game/demSampler.ts";
import { createCityMarkers } from "../src/game/cityMarkers.ts";
import { realQinlingCities } from "../src/data/realCities.js";

const regionManifest = JSON.parse(
  await readFile("public/data/regions/qinling/manifest.json", "utf8")
);
const regionAsset = JSON.parse(
  await readFile(`public/data/regions/qinling/${regionManifest.lods[0].file}`, "utf8")
);

test("chunk terrain disables frustum culling and refreshes displaced bounds", () => {
  const geometry = new PlaneGeometry(18, 24, 2, 2);
  geometry.rotateX(-Math.PI / 2);
  geometry.computeBoundingSphere();
  const initialRadius = geometry.boundingSphere.radius;

  const position = geometry.attributes.position;
  for (let index = 0; index < position.count; index += 1) {
    position.setY(index, index % 2 === 0 ? 6 : -3);
  }
  position.needsUpdate = true;

  const mesh = new Mesh(geometry, new MeshBasicMaterial());
  configureChunkTerrainFrustum(mesh, geometry);

  assert.equal(mesh.frustumCulled, false);
  assert.ok(geometry.boundingBox, "bounding box should be recomputed after terrain displacement");
  assert.ok(geometry.boundingSphere, "bounding sphere should be recomputed after terrain displacement");
  assert.ok(
    geometry.boundingSphere.radius > initialRadius,
    "displaced terrain should expand the culling sphere instead of keeping the flat-plane radius"
  );
  assert.equal(geometry.boundingBox.min.y, -3);
  assert.equal(geometry.boundingBox.max.y, 6);
});

test("city wall geometry sits on the sampled ground instead of floating by one wall height", () => {
  const sampler = new TerrainSampler(regionAsset);
  const handle = createCityMarkers(
    realQinlingCities.filter((city) =>
      city.id === "xian" || city.id === "hanzhong" || city.id === "chenggu"
    ),
    regionAsset.bounds,
    regionAsset.world,
    sampler
  );

  const expectedHeightsByMesh = new Map([
    ["city-walls-capital", 1.4 * 1.5],
    ["city-walls-prefecture", 1.1 * 1.2],
    ["city-walls-county", 0.8]
  ]);
  const vertexCountsByMesh = new Map();

  handle.group.children.forEach((child) => {
    child.geometry.computeBoundingBox();
    const expectedHeight = expectedHeightsByMesh.get(child.name);
    assert.ok(expectedHeight, `unexpected mesh ${child.name}`);
    assert.ok(Math.abs(child.geometry.boundingBox.min.y) < 1e-6);
    assert.ok(Math.abs(child.geometry.boundingBox.max.y - expectedHeight) < 1e-6);
    vertexCountsByMesh.set(child.name, child.geometry.attributes.position.count);
  });

  assert.ok(
    vertexCountsByMesh.get("city-walls-capital") > vertexCountsByMesh.get("city-walls-prefecture"),
    "capital should have more geometry detail than prefecture"
  );
  assert.ok(
    vertexCountsByMesh.get("city-walls-prefecture") > vertexCountsByMesh.get("city-walls-county"),
    "prefecture should have more geometry detail than county"
  );
});

test("county and prefecture city walls keep a hollow center", () => {
  const sampler = new TerrainSampler(regionAsset);
  const handle = createCityMarkers(
    realQinlingCities.filter((city) => city.id === "hanzhong" || city.id === "chenggu"),
    regionAsset.bounds,
    regionAsset.world,
    sampler
  );

  const raycaster = new Raycaster();
  const origin = new Vector3(0, 4, 0);
  const direction = new Vector3(0, -1, 0);

  handle.group.children.forEach((child) => {
    const mesh = new Mesh(child.geometry, new MeshBasicMaterial());
    raycaster.set(origin, direction);
    const intersections = raycaster.intersectObject(mesh, false);
    assert.equal(
      intersections.length,
      0,
      `${child.name} should stay hollow at the center when viewed from above`
    );
  });
});
