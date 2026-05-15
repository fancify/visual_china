/**
 * City archetype — 城市原型 (small / medium / large)
 *
 * 视觉构成:
 *   - 连续闭合夯土城墙 (东西南北 + 角部补墙)
 *   - 内部按 size 分级:
 *       small  ~3m: 2-3 民居 box + 1 buildSimpleHall (官衙)
 *       medium ~5m: 4-5 建筑, 含 buildSimpleHall + 带腰檐双层楼
 *       large  ~8m: 双重城墙 + 3-4 simpleHall + 1 个 buildPagoda (5 层)
 *
 * 坐标系: 城市中心在原点 (0, 0, 0); 地面 = y=0.
 */

import * as THREE from "three";
import {
  TANG_PALETTE,
  buildHipRoof,
  buildRammedEarthWall,
  buildSimpleHall,
  buildPagoda,
} from "../tangParts.js";

export type CitySize = "small" | "medium" | "large";

/** size → 主要参数表. */
interface CityDims {
  /** 外城墙边长 (正方形). */
  outerSide: number;
  /** 外城墙高度. */
  wallHeight: number;
  /** 城墙厚度. */
  wallThickness: number;
}

function getDims(size: CitySize): CityDims {
  switch (size) {
    case "small":
      return { outerSide: 3, wallHeight: 0.6, wallThickness: 0.18 };
    case "medium":
      return { outerSide: 5, wallHeight: 0.9, wallThickness: 0.25 };
    case "large":
      return { outerSide: 8, wallHeight: 1.4, wallThickness: 0.35 };
  }
}

/** 连续夯土城墙: 四边 + 四角补块, 南侧留门洞, 避免四角断开. */
function buildContinuousCityWall(
  group: THREE.Group,
  outerSide: number,
  wallHeight: number,
  wallThickness: number,
): void {
  const mat = new THREE.MeshLambertMaterial({ color: TANG_PALETTE.hangHuang });
  const half = outerSide / 2;
  const gateWidth = Math.max(wallThickness * 2.4, outerSide * 0.18);
  const gateOpeningHeight = wallHeight * 0.62;
  const gateLintelHeight = wallHeight - gateOpeningHeight;
  const southSegmentLength = (outerSide - gateWidth) / 2;

  const addWallSegment = (name: string, length: number, x: number, z: number, rotationY = 0): void => {
    const wall = buildRammedEarthWall(length, wallHeight, wallThickness, false);
    wall.name = name;
    wall.rotation.y = rotationY;
    wall.position.set(x, 0, z);
    group.add(wall);
  };

  addWallSegment("city_wall_north", outerSide, 0, -half);
  addWallSegment("city_wall_south_west", southSegmentLength, -(gateWidth + southSegmentLength) / 2, half);
  addWallSegment("city_wall_south_east", southSegmentLength, (gateWidth + southSegmentLength) / 2, half);
  addWallSegment("city_wall_east", outerSide, half, 0, Math.PI / 2);
  addWallSegment("city_wall_west", outerSide, -half, 0, Math.PI / 2);

  const lintel = new THREE.Mesh(
    new THREE.BoxGeometry(gateWidth, gateLintelHeight, wallThickness),
    mat,
  );
  lintel.name = "city_wall_south_door_lintel";
  lintel.position.set(0, gateOpeningHeight + gateLintelHeight / 2, half);
  group.add(lintel);

  const threshold = new THREE.Mesh(
    new THREE.BoxGeometry(gateWidth * 0.9, 0.04, wallThickness * 1.25),
    new THREE.MeshLambertMaterial({ color: TANG_PALETTE.shiHui }),
  );
  threshold.name = "city_wall_south_gate_threshold";
  threshold.position.set(0, 0.02, half);
  group.add(threshold);

  const corners: Array<[number, number, string]> = [
    [half, half, "se"],
    [-half, half, "sw"],
    [half, -half, "ne"],
    [-half, -half, "nw"],
  ];
  for (const [x, z, name] of corners) {
    const corner = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, wallHeight, wallThickness),
      mat,
    );
    corner.name = `city_wall_corner_${name}`;
    corner.position.set(x, wallHeight / 2, z);
    group.add(corner);
  }
}

/** 内部民居: 小红墙 + 灰黑屋顶, 避免像夯土块一样和建筑混在一起. */
function makeHouse(width: number, height: number, depth: number, x: number, z: number, name: string): THREE.Group {
  const group = new THREE.Group();
  group.name = name;

  const plinthH = Math.max(0.025, height * 0.08);
  const bodyH = height * 0.72;
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(width * 1.06, plinthH, depth * 1.04),
    new THREE.MeshLambertMaterial({ color: TANG_PALETTE.shiHui }),
  );
  plinth.name = `${name}_plinth`;
  plinth.position.y = plinthH / 2;
  group.add(plinth);

  const bodyGeom = new THREE.BoxGeometry(width * 0.76, bodyH, depth * 0.7);
  bodyGeom.translate(0, plinthH + bodyH / 2, 0);
  const body = new THREE.Mesh(bodyGeom, new THREE.MeshLambertMaterial({ color: TANG_PALETTE.zhuHong }));
  body.name = `${name}_body`;
  group.add(body);

  const roof = buildHipRoof(width * 0.95, depth * 0.9, height * 0.28);
  roof.name = `${name}_city_house_roof`;
  roof.position.y = plinthH + bodyH;
  group.add(roof);

  group.position.set(x, 0, z);
  return group;
}

function buildStoryBody(width: number, depth: number, height: number, name: string): THREE.Group {
  const group = new THREE.Group();
  group.name = name;

  const wallGeom = new THREE.BoxGeometry(width, height, depth);
  wallGeom.translate(0, height / 2, 0);
  const wall = new THREE.Mesh(wallGeom, new THREE.MeshLambertMaterial({ color: TANG_PALETTE.zhuHong }));
  wall.name = `${name}_wall`;
  group.add(wall);

  const columnRadius = Math.min(width, depth) * 0.035;
  const columnInset = Math.min(width, depth) * 0.08;
  const columns: Array<[number, number]> = [
    [-width / 2 + columnInset, -depth / 2 + columnInset],
    [width / 2 - columnInset, -depth / 2 + columnInset],
    [-width / 2 + columnInset, depth / 2 - columnInset],
    [width / 2 - columnInset, depth / 2 - columnInset],
  ];
  for (const [x, z] of columns) {
    const columnGeom = new THREE.CylinderGeometry(columnRadius, columnRadius, height, 8);
    columnGeom.translate(0, height / 2, 0);
    const column = new THREE.Mesh(columnGeom, new THREE.MeshLambertMaterial({ color: TANG_PALETTE.zhuHong }));
    column.name = `${name}_column`;
    column.position.set(x, 0, z);
    group.add(column);
  }

  return group;
}

function buildBeltRoof(width: number, depth: number, y: number): THREE.Group {
  const group = new THREE.Group();
  group.name = "city_twoStoryHall_beltRoof";
  const material = new THREE.MeshLambertMaterial({ color: TANG_PALETTE.daiHei });
  const overhang = Math.min(width, depth) * 0.16;
  const thick = Math.min(width, depth) * 0.08;

  const frontBackWidth = width + overhang * 2;
  const sideDepth = depth + overhang * 2;
  const slabs: Array<[string, number, number, number, number]> = [
    ["front", frontBackWidth, overhang, 0, -depth / 2 - overhang / 2],
    ["back", frontBackWidth, overhang, 0, depth / 2 + overhang / 2],
    ["left", overhang, sideDepth, -width / 2 - overhang / 2, 0],
    ["right", overhang, sideDepth, width / 2 + overhang / 2, 0],
  ];

  for (const [name, slabWidth, slabDepth, x, z] of slabs) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(slabWidth, thick, slabDepth), material);
    slab.name = `city_twoStoryHall_beltRoof_${name}`;
    slab.position.set(x, y, z);
    group.add(slab);
  }

  return group;
}

/** 双层楼: 下层墙体 + 一圈腰檐 + 上层墙体 + 顶屋顶. */
function buildTwoStoryHall(width: number, depth: number, storyHeight: number): THREE.Group {
  const group = new THREE.Group();
  group.name = "city_twoStoryHall";

  const plinthHeight = Math.max(0.04, storyHeight * 0.08);
  const storyBodyHeight = storyHeight * 0.5;
  const beltY = plinthHeight + storyBodyHeight;

  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(width * 1.12, plinthHeight, depth * 1.08),
    new THREE.MeshLambertMaterial({ color: TANG_PALETTE.shiHui }),
  );
  plinth.name = "city_twoStoryHall_plinth";
  plinth.position.y = plinthHeight / 2;
  group.add(plinth);

  const lowerBody = buildStoryBody(width, depth, storyBodyHeight, "city_twoStoryHall_lowerBody");
  lowerBody.position.y = plinthHeight;
  group.add(lowerBody);

  const beltRoof = buildBeltRoof(width, depth, beltY);
  group.add(beltRoof);

  const upperWidth = width * 0.78;
  const upperDepth = depth * 0.78;
  const upperBodyHeight = storyBodyHeight * 0.88;
  const upperBody = buildStoryBody(upperWidth, upperDepth, upperBodyHeight, "city_twoStoryHall_upperBody");
  upperBody.position.y = beltY;
  group.add(upperBody);

  const topRoof = buildHipRoof(upperWidth * 1.15, upperDepth * 1.15, storyHeight * 0.44);
  topRoof.name = "city_twoStoryHall_topRoof";
  topRoof.position.y = beltY + upperBodyHeight;
  group.add(topRoof);

  return group;
}

export function buildCity(size: CitySize): THREE.Group {
  const group = new THREE.Group();
  group.name = `city_${size}`;

  const dims = getDims(size);
  const { outerSide, wallHeight, wallThickness } = dims;

  // ── 外城墙: 连续闭合夯土墙, 不在四角放小楼 ──
  buildContinuousCityWall(group, outerSide, wallHeight, wallThickness);

  // ── 内部建筑 ──
  if (size === "small") {
    // 2-3 民居 + 1 simpleHall (官衙)
    group.add(makeHouse(0.42, 0.28, 0.38, -0.9, 0.7, "city_house_1"));
    group.add(makeHouse(0.38, 0.26, 0.36, 0.85, 0.75, "city_house_2"));
    group.add(makeHouse(0.38, 0.26, 0.36, -0.85, -0.65, "city_house_3"));

    const yamen = buildSimpleHall(1.0, 0.8, 0.55);
    yamen.name = "city_yamen";
    yamen.position.set(0.25, 0, -0.15);
    group.add(yamen);
  } else if (size === "medium") {
    // 4-5 建筑: simpleHall (官衙) + 2 层楼 + 3 民居
    const yamen = buildSimpleHall(1.6, 1.2, 0.8);
    yamen.name = "city_yamen";
    yamen.position.set(0, 0, -0.6);
    group.add(yamen);

    const tower = buildTwoStoryHall(0.9, 0.82, 0.7);
    tower.position.set(1.45, 0, 1.05);
    group.add(tower);

    group.add(makeHouse(0.52, 0.34, 0.46, -1.65, 1.2, "city_house_1"));
    group.add(makeHouse(0.5, 0.32, 0.44, -1.7, -1.3, "city_house_2"));
    group.add(makeHouse(0.48, 0.3, 0.42, 0.55, 1.45, "city_house_3"));
  } else {
    // large: 双重城墙 + 3-4 simpleHall + buildPagoda (5 层)
    // 中间一圈小墙 (内城)
    const innerSide = outerSide * 0.7;
    const innerHeight = wallHeight * 0.7;
    const innerThick = wallThickness * 0.7;
    buildContinuousCityWall(group, innerSide, innerHeight, innerThick);

    // 主官衙 (大 simpleHall)
    const palace = buildSimpleHall(2.0, 1.6, 1.2);
    palace.name = "city_palace";
    palace.position.set(0, 0, -0.8);
    group.add(palace);

    // 2 个副殿
    const hall1 = buildSimpleHall(1.4, 1.0, 0.9);
    hall1.name = "city_hall_east";
    hall1.position.set(1.6, 0, 0.4);
    group.add(hall1);

    const hall2 = buildSimpleHall(1.4, 1.0, 0.9);
    hall2.name = "city_hall_west";
    hall2.position.set(-1.6, 0, 0.4);
    group.add(hall2);

    // 5 层 buildPagoda (位于一角)
    const pagoda = buildPagoda(5, 0.7);
    pagoda.name = "city_pagoda";
    pagoda.position.set(2.4, 0, -2.0);
    group.add(pagoda);
  }

  return group;
}
