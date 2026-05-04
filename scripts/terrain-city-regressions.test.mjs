import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  Color,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  Raycaster,
  Vector3
} from "three";

import { configureChunkTerrainFrustum } from "../src/game/terrainMeshFrustum.js";
import { TerrainSampler } from "../src/game/demSampler.ts";
import {
  CITY_TIER_SPECS,
  createCityMarkers
} from "../src/game/cityMarkers.ts";
import { projectGeoToWorld } from "../src/game/mapOrientation.js";
import { realQinlingCities } from "../src/data/realCities.js";
import {
  buildPoiHoverCardHtml,
  buildCityHoverCardHtml,
  findStoryBeatForZone
} from "../src/game/cityHoverHud.ts";
import {
  qinlingAncientSites,
  qinlingScenicLandmarks
} from "../src/game/qinlingAtlas.js";

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
    ["city-walls-capital", 2.7],
    ["city-walls-prefecture", 1.575],
    ["city-walls-county", 0.6]
  ]);
  const vertexCountsByMesh = new Map();

  handle.group.children.forEach((child) => {
    if (!child.name.startsWith("city-walls-")) {
      return;
    }
    child.geometry.computeBoundingBox();
    const expectedHeight = expectedHeightsByMesh.get(child.name);
    assert.ok(expectedHeight, `unexpected mesh ${child.name}`);
    assert.ok(Math.abs(child.geometry.boundingBox.min.y) < 1e-6);
    assert.ok(Math.abs(child.geometry.boundingBox.max.y - expectedHeight) < 1e-6);
    vertexCountsByMesh.set(child.name, child.geometry.attributes.position.count);
  });

  assert.ok(
    vertexCountsByMesh.get("city-walls-capital") >= vertexCountsByMesh.get("city-walls-prefecture"),
    "capital should keep at least as much geometry detail as prefecture"
  );
  assert.ok(
    vertexCountsByMesh.get("city-walls-prefecture") > vertexCountsByMesh.get("city-walls-county"),
    "prefecture should have more geometry detail than county"
  );
  assert.ok(
    vertexCountsByMesh.get("city-walls-county") > 144,
    "county should gain a small amount of geometry from the central hut"
  );
});

test("all city tiers keep a central silhouette when viewed from above", () => {
  const sampler = new TerrainSampler(regionAsset);
  const handle = createCityMarkers(
    realQinlingCities.filter((city) =>
      city.id === "xian" || city.id === "hanzhong" || city.id === "chenggu"
    ),
    regionAsset.bounds,
    regionAsset.world,
    sampler
  );

  const raycaster = new Raycaster();
  const origin = new Vector3(0, 4, 0);
  const direction = new Vector3(0, -1, 0);

  handle.group.children.forEach((child) => {
    if (!child.name.startsWith("city-walls-")) {
      return;
    }
    const mesh = new Mesh(child.geometry, new MeshBasicMaterial());
    raycaster.set(origin, direction);
    const intersections = raycaster.intersectObject(mesh, false);
    assert.ok(
      intersections.length > 0,
      `${child.name} should add a central building silhouette when viewed from above`
    );
  });
});

test("city tier specs use graded central buildings and no houses", () => {
  assert.deepEqual(
    {
      capital: {
        outerSide: CITY_TIER_SPECS.capital.outerSide,
        innerSide: CITY_TIER_SPECS.capital.innerSide,
        height: CITY_TIER_SPECS.capital.height,
        cornerTowers: CITY_TIER_SPECS.capital.cornerTowers,
        centralBuilding: CITY_TIER_SPECS.capital.centralBuilding,
        houses: CITY_TIER_SPECS.capital.houses
      },
      prefecture: {
        outerSide: CITY_TIER_SPECS.prefecture.outerSide,
        innerSide: CITY_TIER_SPECS.prefecture.innerSide,
        height: CITY_TIER_SPECS.prefecture.height,
        cornerTowers: CITY_TIER_SPECS.prefecture.cornerTowers,
        centralBuilding: CITY_TIER_SPECS.prefecture.centralBuilding,
        houses: CITY_TIER_SPECS.prefecture.houses
      },
      county: {
        outerSide: CITY_TIER_SPECS.county.outerSide,
        innerSide: CITY_TIER_SPECS.county.innerSide,
        height: CITY_TIER_SPECS.county.height,
        cornerTowers: CITY_TIER_SPECS.county.cornerTowers,
        centralBuilding: CITY_TIER_SPECS.county.centralBuilding,
        houses: CITY_TIER_SPECS.county.houses
      }
    },
    {
      capital: {
        outerSide: 4.4,
        innerSide: 3.6,
        height: 0.6,
        cornerTowers: true,
        centralBuilding: "hip-roof-palace",
        houses: 0
      },
      prefecture: {
        outerSide: 3.4,
        innerSide: 2.6,
        height: 0.47,
        cornerTowers: true,
        centralBuilding: "xie-shan-hall",
        houses: 0
      },
      county: {
        outerSide: 2.4,
        innerSide: 1.6,
        height: 0.33,
        cornerTowers: false,
        centralBuilding: "hard-mountain-hut",
        houses: 0
      }
    }
  );
});

test("capital central roofline stays taller than prefecture and county", () => {
  const sampler = new TerrainSampler(regionAsset);
  const handle = createCityMarkers(
    realQinlingCities.filter((city) =>
      city.id === "xian" || city.id === "hanzhong" || city.id === "chenggu"
    ),
    regionAsset.bounds,
    regionAsset.world,
    sampler
  );

  const maxYByMesh = new Map();

  handle.group.children.forEach((child) => {
    child.geometry.computeBoundingBox();
    maxYByMesh.set(child.name, child.geometry.boundingBox.max.y);
  });

  assert.ok(Math.abs(maxYByMesh.get("city-walls-county") - 0.6) < 1e-6);
  assert.ok(Math.abs(maxYByMesh.get("city-walls-capital") - 2.7) < 1e-6);
  assert.ok(Math.abs(maxYByMesh.get("city-walls-prefecture") - 1.575) < 1e-6);
  assert.ok(
    maxYByMesh.get("city-walls-capital") > maxYByMesh.get("city-walls-prefecture"),
    "capital should have the tallest central roofline"
  );
  assert.ok(
    maxYByMesh.get("city-walls-prefecture") > maxYByMesh.get("city-walls-county"),
    "prefecture should still stand taller than the smaller county hut"
  );
});

test("prefecture hall keeps the same roof peak without the floating gable box", () => {
  const sampler = new TerrainSampler(regionAsset);
  const handle = createCityMarkers(
    realQinlingCities.filter((city) => city.id === "hanzhong"),
    regionAsset.bounds,
    regionAsset.world,
    sampler
  );

  const geometry = handle.tierMeshes.prefecture.geometry;
  const positions = geometry.getAttribute("position");
  const totalHeight = 1.575;
  const normalizedHeight = totalHeight / 0.9;
  const roofHeight = normalizedHeight * 0.3;
  const roofY = normalizedHeight * 0.55 + normalizedHeight * 0.05;
  const upperRoofBandStart = roofY + roofHeight * 0.5;
  const roofTop = roofY + roofHeight;
  let upperRoofBandVertexCount = 0;

  for (let index = 0; index < positions.count; index += 1) {
    const y = positions.getY(index);
    if (y > upperRoofBandStart + 1e-3 && y < roofTop - 1e-3) {
      upperRoofBandVertexCount += 1;
    }
  }

  geometry.computeBoundingBox();
  assert.ok(Math.abs(geometry.boundingBox.max.y - totalHeight) < 1e-6);
  assert.equal(positions.count, 384);
  assert.equal(
    upperRoofBandVertexCount,
    0,
    "prefecture roof should not keep extra box vertices floating in the upper roof band"
  );
});

test("all city tiers expand the grey roof footprint beyond the red body", () => {
  const sampler = new TerrainSampler(regionAsset);
  const handle = createCityMarkers(
    realQinlingCities.filter((city) =>
      city.id === "xian" || city.id === "hanzhong" || city.id === "chenggu"
    ),
    regionAsset.bounds,
    regionAsset.world,
    sampler
  );

  const grey = new Color(0x4f5253);
  const sample = new Color();
  const greyHalfExtentByMesh = new Map();

  handle.group.children.forEach((child) => {
    if (!child.name.startsWith("city-walls-")) {
      return;
    }

    const positions = child.geometry.getAttribute("position");
    const colors = child.geometry.getAttribute("color");
    assert.ok(colors, `${child.name} should keep vertex colors on merged geometry`);

    let maxAbsX = 0;
    let maxAbsZ = 0;
    let greyVertexCount = 0;
    for (let index = 0; index < positions.count; index += 1) {
      sample.setRGB(
        colors.array[index * 3],
        colors.array[index * 3 + 1],
        colors.array[index * 3 + 2]
      );
      if (sample.getHex() !== grey.getHex()) {
        continue;
      }
      greyVertexCount += 1;
      maxAbsX = Math.max(maxAbsX, Math.abs(positions.getX(index)));
      maxAbsZ = Math.max(maxAbsZ, Math.abs(positions.getZ(index)));
    }

    assert.ok(greyVertexCount > 0, `${child.name} should include grey roof vertices`);
    greyHalfExtentByMesh.set(child.name, { x: maxAbsX, z: maxAbsZ });
  });

  const capitalWidth = CITY_TIER_SPECS.capital.outerSide * 0.6;
  assert.ok(
    greyHalfExtentByMesh.get("city-walls-capital").x >= capitalWidth * 0.7,
    "capital grey roof footprint should clearly overhang the palace body in x"
  );
  assert.ok(
    greyHalfExtentByMesh.get("city-walls-capital").z >= capitalWidth * 0.7,
    "capital grey roof footprint should clearly overhang the palace body in z"
  );

  const prefectureWidth = CITY_TIER_SPECS.prefecture.outerSide * 0.5;
  assert.ok(
    greyHalfExtentByMesh.get("city-walls-prefecture").x >= prefectureWidth * 0.7,
    "prefecture grey roof footprint should clearly overhang the hall body in x"
  );
  assert.ok(
    greyHalfExtentByMesh.get("city-walls-prefecture").z >= prefectureWidth * 0.7,
    "prefecture grey roof footprint should clearly overhang the hall body in z"
  );

  const countyWidth = CITY_TIER_SPECS.county.outerSide * 0.35;
  const countyDepth = CITY_TIER_SPECS.county.outerSide * 0.22;
  assert.ok(
    greyHalfExtentByMesh.get("city-walls-county").x >= countyWidth * 0.7,
    "county grey roof footprint should clearly overhang the hut body in x"
  );
  assert.ok(
    greyHalfExtentByMesh.get("city-walls-county").z >= countyDepth * 0.7,
    "county grey roof footprint should clearly overhang the hut body in z"
  );
});

test("corner towers use the narrowed footprint instead of dominating the walls", () => {
  const sampler = new TerrainSampler(regionAsset);
  const handle = createCityMarkers(
    realQinlingCities.filter((city) => city.id === "xian" || city.id === "hanzhong"),
    regionAsset.bounds,
    regionAsset.world,
    sampler
  );

  const halfExtentByMesh = new Map([
    ["city-walls-capital", 4.4 * 0.5 + 4.4 * 0.1 * 0.5],
    ["city-walls-prefecture", 3.4 * 0.5 + 3.4 * 0.1 * 0.5]
  ]);

  handle.group.children.forEach((child) => {
    if (!child.name.startsWith("city-walls-")) {
      return;
    }
    child.geometry.computeBoundingBox();
    const expectedHalfExtent = halfExtentByMesh.get(child.name);
    assert.ok(expectedHalfExtent, `unexpected mesh ${child.name}`);
    assert.ok(Math.abs(child.geometry.boundingBox.max.x - expectedHalfExtent) < 1e-6);
    assert.ok(Math.abs(child.geometry.boundingBox.min.x + expectedHalfExtent) < 1e-6);
    assert.ok(Math.abs(child.geometry.boundingBox.max.z - expectedHalfExtent) < 1e-6);
    assert.ok(Math.abs(child.geometry.boundingBox.min.z + expectedHalfExtent) < 1e-6);
  });
});

test("south wall stays continuous with no gate gap", () => {
  const sampler = new TerrainSampler(regionAsset);
  const handle = createCityMarkers(
    realQinlingCities.filter((city) =>
      city.id === "xian" || city.id === "hanzhong" || city.id === "chenggu"
    ),
    regionAsset.bounds,
    regionAsset.world,
    sampler
  );

  const raycaster = new Raycaster();
  const direction = new Vector3(0, -1, 0);
  const southWallCenterByMesh = new Map([
    ["city-walls-capital", -(4.4 + 3.6) * 0.25],
    ["city-walls-prefecture", -(3.4 + 2.6) * 0.25],
    ["city-walls-county", -(2.4 + 1.6) * 0.25]
  ]);

  handle.group.children.forEach((child) => {
    if (!child.name.startsWith("city-walls-")) {
      return;
    }
    const southWallCenter = southWallCenterByMesh.get(child.name);
    assert.ok(southWallCenter !== undefined, `unexpected mesh ${child.name}`);
    const mesh = new Mesh(child.geometry, new MeshBasicMaterial());
    raycaster.set(new Vector3(0, 4, southWallCenter), direction);
    const intersections = raycaster.intersectObject(mesh, false);
    assert.ok(intersections.length > 0, `${child.name} should keep the south wall closed`);
  });
});

test("city markers use vertex-colored walls and rammed-earth floor plates", () => {
  const sampler = new TerrainSampler(regionAsset);
  const handle = createCityMarkers(
    realQinlingCities.filter((city) =>
      city.id === "xian" || city.id === "hanzhong" || city.id === "chenggu"
    ),
    regionAsset.bounds,
    regionAsset.world,
    sampler
  );

  Object.values(handle.tierMaterials).forEach((material) => {
    assert.equal(material.vertexColors, true);
    assert.equal(material.color.getHex(), 0xffffff);
  });

  const floorMesh = handle.group.children.find((child) => child.name === "city-floors");
  assert.ok(floorMesh, "city floor instanced mesh should exist");
  assert.equal(floorMesh.count, 3);
  assert.equal(floorMesh.material.color.getHex(), 0xa8927a);
});

test("city wall geometries carry merged vertex colors per tier", () => {
  const sampler = new TerrainSampler(regionAsset);
  const handle = createCityMarkers(
    realQinlingCities.filter((city) =>
      city.id === "xian" || city.id === "hanzhong" || city.id === "chenggu"
    ),
    regionAsset.bounds,
    regionAsset.world,
    sampler
  );

  const collectHexes = (geometry) => {
    const colors = geometry.getAttribute("color");
    assert.ok(colors, "merged geometry should keep a color attribute");

    const uniqueHexes = new Set();
    const sample = new Color();
    for (let index = 0; index < colors.count; index += 1) {
      sample.setRGB(
        colors.array[index * 3],
        colors.array[index * 3 + 1],
        colors.array[index * 3 + 2]
      );
      uniqueHexes.add(sample.getHex());
    }
    return uniqueHexes;
  };

  const countyColors = collectHexes(handle.tierMeshes.county.geometry);
  assert.deepEqual(
    [...countyColors].sort((a, b) => a - b),
    [0x4f5253, 0xa53a2c, 0xa8927a]
  );

  const prefectureColors = collectHexes(handle.tierMeshes.prefecture.geometry);
  assert.deepEqual(
    [...prefectureColors].sort((a, b) => a - b),
    [0x4f5253, 0xa53a2c, 0xa8927a]
  );

  const capitalColors = collectHexes(handle.tierMeshes.capital.geometry);
  assert.deepEqual(
    [...capitalColors].sort((a, b) => a - b),
    [0x4f5253, 0xa53a2c, 0xa8927a]
  );
});

test("city floor mesh fully covers the inner courtyard and sits slightly above terrain", () => {
  const visibleCities = realQinlingCities.filter((city) =>
    city.id === "xian" || city.id === "hanzhong" || city.id === "chenggu"
  );
  const sampler = new TerrainSampler(regionAsset);
  const handle = createCityMarkers(
    visibleCities,
    regionAsset.bounds,
    regionAsset.world,
    sampler
  );

  const floorMesh = handle.group.children.find((child) => child.name === "city-floors");
  assert.ok(floorMesh, "city floor instanced mesh should exist");

  const matrix = new Matrix4();
  const position = new Vector3();
  const rotation = new Quaternion();
  const scale = new Vector3();

  visibleCities.forEach((city, index) => {
    floorMesh.getMatrixAt(index, matrix);
    matrix.decompose(position, rotation, scale);
    const expectedSide = CITY_TIER_SPECS[city.tier].innerSide * 1.02;
    const worldPoint = projectGeoToWorld(
      { lat: city.lat, lon: city.lon },
      regionAsset.bounds,
      regionAsset.world
    );
    const terrainY = sampler.sampleSurfaceHeight(worldPoint.x, worldPoint.z) + 0.12;
    const scaleVar = scale.x / expectedSide;

    assert.ok(scale.x > expectedSide * 0.9 && scale.x < expectedSide * 1.05);
    assert.ok(scale.z > expectedSide * 0.9 && scale.z < expectedSide * 1.05);
    assert.ok(Math.abs(scale.y - 0.06 * scaleVar) < 1e-6);
    assert.ok(Math.abs(position.y - (terrainY + 0.03)) < 1e-6);
  });
});

test("city hover card includes city facts and matching story beat", () => {
  const city = realQinlingCities.find((entry) => entry.id === "xian");
  assert.ok(city, "xian city fixture should exist");

  const beat = findStoryBeatForZone(
    [
      {
        id: "guanzhong-departure",
        title: "关中起行",
        guidance: "先感受腹地的开阔，再向山前推进。",
        completionLine: "done",
        target: { x: 0, y: 0 }
      },
      {
        id: "mountain-pass",
        title: "穿过锁口",
        guidance: "去找那条真正能过山的缝。",
        completionLine: "done",
        target: { x: 0, y: 0 }
      }
    ],
    "关中平原",
    (beatEntry) =>
      beatEntry.id === "guanzhong-departure" ? "关中平原" : "秦岭山口带"
  );

  const html = buildCityHoverCardHtml({
    city,
    elevationMeters: 460,
    zone: "关中平原",
    beat
  });

  assert.match(html, /西安/);
  assert.match(html, /capital/);
  assert.match(html, /海拔：460 m/);
  assert.match(html, /34\.2700°N/);
  assert.match(html, /108\.9500°E/);
  assert.match(html, /关中起行/);
  assert.match(html, /先感受腹地的开阔/);
});

test("poi hover card includes scenic and ancient POI facts", () => {
  const scenicPoi = qinlingScenicLandmarks.find((entry) => entry.name === "法门寺");
  const ancientPoi = qinlingAncientSites.find((entry) => entry.name === "秦始皇陵");

  assert.ok(scenicPoi, "法门寺 scenic fixture should exist");
  assert.ok(ancientPoi, "秦始皇陵 ancient fixture should exist");

  const scenicHtml = buildPoiHoverCardHtml({
    poi: scenicPoi,
    category: "scenic",
    elevationMeters: 612,
    zone: "关中西缘"
  });
  const ancientHtml = buildPoiHoverCardHtml({
    poi: ancientPoi,
    category: "ancient",
    elevationMeters: 523,
    zone: "关中东缘"
  });

  assert.match(scenicHtml, /法门寺/);
  assert.match(scenicHtml, /名胜/);
  assert.match(scenicHtml, /34\.4300°N/);
  assert.match(scenicHtml, /107\.8300°E/);
  assert.match(scenicHtml, /海拔：612 m/);
  assert.match(scenicHtml, /佛指舍利/);

  assert.match(ancientHtml, /秦始皇陵/);
  assert.match(ancientHtml, /考古/);
  assert.match(ancientHtml, /34\.3800°N/);
  assert.match(ancientHtml, /109\.2500°E/);
  assert.match(ancientHtml, /海拔：523 m/);
  assert.match(ancientHtml, /统一帝王陵/);
});
