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
import {
  CITY_TIER_SPECS,
  createCityMarkers
} from "../src/game/cityMarkers.ts";
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
    ["city-walls-capital", 0.9 * 1.6],
    ["city-walls-prefecture", 0.7 * 1.2],
    ["city-walls-county", 0.5]
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
    vertexCountsByMesh.get("city-walls-capital") >= vertexCountsByMesh.get("city-walls-prefecture"),
    "capital should keep at least as much geometry detail as prefecture"
  );
  assert.ok(
    vertexCountsByMesh.get("city-walls-prefecture") > vertexCountsByMesh.get("city-walls-county"),
    "prefecture should have more geometry detail than county"
  );
});

test("county stays hollow while higher city tiers fill the center", () => {
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
    const mesh = new Mesh(child.geometry, new MeshBasicMaterial());
    raycaster.set(origin, direction);
    const intersections = raycaster.intersectObject(mesh, false);
    if (child.name === "city-walls-county") {
      assert.equal(
        intersections.length,
        0,
        `${child.name} should stay hollow at the center when viewed from above`
      );
      return;
    }

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
        houses: CITY_TIER_SPECS.capital.houses,
        gateOnSide: CITY_TIER_SPECS.capital.gateOnSide
      },
      prefecture: {
        outerSide: CITY_TIER_SPECS.prefecture.outerSide,
        innerSide: CITY_TIER_SPECS.prefecture.innerSide,
        height: CITY_TIER_SPECS.prefecture.height,
        cornerTowers: CITY_TIER_SPECS.prefecture.cornerTowers,
        centralBuilding: CITY_TIER_SPECS.prefecture.centralBuilding,
        houses: CITY_TIER_SPECS.prefecture.houses,
        gateOnSide: CITY_TIER_SPECS.prefecture.gateOnSide
      },
      county: {
        outerSide: CITY_TIER_SPECS.county.outerSide,
        innerSide: CITY_TIER_SPECS.county.innerSide,
        height: CITY_TIER_SPECS.county.height,
        cornerTowers: CITY_TIER_SPECS.county.cornerTowers,
        centralBuilding: CITY_TIER_SPECS.county.centralBuilding,
        houses: CITY_TIER_SPECS.county.houses,
        gateOnSide: CITY_TIER_SPECS.county.gateOnSide
      }
    },
    {
      capital: {
        outerSide: 4.4,
        innerSide: 3.6,
        height: 0.9,
        cornerTowers: true,
        centralBuilding: "hip-roof-palace",
        houses: 0,
        gateOnSide: "south"
      },
      prefecture: {
        outerSide: 3.4,
        innerSide: 2.6,
        height: 0.7,
        cornerTowers: true,
        centralBuilding: "xie-shan-hall",
        houses: 0,
        gateOnSide: "south"
      },
      county: {
        outerSide: 2.4,
        innerSide: 1.6,
        height: 0.5,
        cornerTowers: false,
        centralBuilding: null,
        houses: 0,
        gateOnSide: "south"
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

  assert.equal(maxYByMesh.get("city-walls-county"), 0.5);
  assert.ok(
    maxYByMesh.get("city-walls-capital") > maxYByMesh.get("city-walls-prefecture"),
    "capital should have the tallest central roofline"
  );
  assert.ok(
    maxYByMesh.get("city-walls-prefecture") > maxYByMesh.get("city-walls-county"),
    "prefecture should still stand taller than the empty county ring"
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
    child.geometry.computeBoundingBox();
    const expectedHalfExtent = halfExtentByMesh.get(child.name);
    assert.ok(expectedHalfExtent, `unexpected mesh ${child.name}`);
    assert.ok(Math.abs(child.geometry.boundingBox.max.x - expectedHalfExtent) < 1e-6);
    assert.ok(Math.abs(child.geometry.boundingBox.min.x + expectedHalfExtent) < 1e-6);
    assert.ok(Math.abs(child.geometry.boundingBox.max.z - expectedHalfExtent) < 1e-6);
    assert.ok(Math.abs(child.geometry.boundingBox.min.z + expectedHalfExtent) < 1e-6);
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
