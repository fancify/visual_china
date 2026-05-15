/**
 * City archetype — 城市原型 (small / medium / large)
 *
 * 视觉构成:
 *   - 四面 buildRammedEarthWall 围合城墙 (东西南北)
 *   - 四角城门楼 (用小 buildSimpleHall 当门楼)
 *   - 内部按 size 分级:
 *       small  ~3m: 2-3 民居 box + 1 buildSimpleHall (官衙)
 *       medium ~5m: 4-5 建筑, 含 buildSimpleHall + 双层楼 (2 个 simpleHall 叠加)
 *       large  ~8m: 双重城墙 + 4 高城门 + 3-4 simpleHall + 1 个 buildPagoda (5 层)
 *
 * 坐标系: 城市中心在原点 (0, 0, 0); 地面 = y=0.
 */

import * as THREE from "three";
import {
  TANG_PALETTE,
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
  /** 城门楼宽 (小 simpleHall). */
  gateWidth: number;
  /** 城门楼高 (柱高). */
  gateHeight: number;
}

function getDims(size: CitySize): CityDims {
  switch (size) {
    case "small":
      return { outerSide: 3, wallHeight: 0.6, wallThickness: 0.18, gateWidth: 0.6, gateHeight: 0.6 };
    case "medium":
      return { outerSide: 5, wallHeight: 0.9, wallThickness: 0.25, gateWidth: 0.9, gateHeight: 0.9 };
    case "large":
      return { outerSide: 8, wallHeight: 1.4, wallThickness: 0.35, gateWidth: 1.2, gateHeight: 1.4 };
  }
}

/** 把一段夯土墙摆到指定一边 (north/south/east/west). */
function placeWall(
  group: THREE.Group,
  side: "north" | "south" | "east" | "west",
  outerSide: number,
  wallHeight: number,
  wallThickness: number,
): void {
  const wall = buildRammedEarthWall(outerSide, wallHeight, wallThickness, false);
  wall.name = `city_wall_${side}`;
  const half = outerSide / 2;
  switch (side) {
    case "north":
      wall.position.set(0, 0, -half);
      break;
    case "south":
      wall.position.set(0, 0, half);
      break;
    case "east":
      wall.position.set(half, 0, 0);
      wall.rotation.y = Math.PI / 2;
      break;
    case "west":
      wall.position.set(-half, 0, 0);
      wall.rotation.y = Math.PI / 2;
      break;
  }
  group.add(wall);
}

/** 在 4 角放城门楼 (小 simpleHall). */
function placeGates(
  group: THREE.Group,
  outerSide: number,
  gateWidth: number,
  gateHeight: number,
  prefix: string,
): void {
  const half = outerSide / 2;
  const corners: Array<[number, number, string]> = [
    [half, half, "se"],
    [-half, half, "sw"],
    [half, -half, "ne"],
    [-half, -half, "nw"],
  ];
  for (const [cx, cz, tag] of corners) {
    const gate = buildSimpleHall(gateWidth, gateWidth, gateHeight);
    gate.name = `${prefix}_gate_${tag}`;
    gate.position.set(cx, 0, cz);
    group.add(gate);
  }
}

/** 内部民居 box (低矮 hangHuang 夯黄). */
function makeHouse(width: number, height: number, depth: number, x: number, z: number, name: string): THREE.Mesh {
  const geom = new THREE.BoxGeometry(width, height, depth);
  geom.translate(0, height / 2, 0);
  const mesh = new THREE.Mesh(geom, new THREE.MeshLambertMaterial({ color: TANG_PALETTE.hangHuang }));
  mesh.name = name;
  mesh.position.set(x, 0, z);
  return mesh;
}

/** 双层楼: 2 个 simpleHall 叠加 (上层略小). */
function buildTwoStoryHall(width: number, depth: number, storyHeight: number): THREE.Group {
  const group = new THREE.Group();
  group.name = "city_twoStoryHall";

  const lower = buildSimpleHall(width, depth, storyHeight);
  lower.name = "city_twoStoryHall_lower";
  group.add(lower);

  const upper = buildSimpleHall(width * 0.78, depth * 0.78, storyHeight * 0.85);
  upper.name = "city_twoStoryHall_upper";
  // simpleHall 屋顶在 height + height*0.5 处, lower 顶点 ≈ storyHeight*1.5
  upper.position.y = storyHeight * 1.55;
  group.add(upper);

  return group;
}

export function buildCity(size: CitySize): THREE.Group {
  const group = new THREE.Group();
  group.name = `city_${size}`;

  const dims = getDims(size);
  const { outerSide, wallHeight, wallThickness, gateWidth, gateHeight } = dims;

  // ── 外城墙 (4 段) ──
  placeWall(group, "north", outerSide, wallHeight, wallThickness);
  placeWall(group, "south", outerSide, wallHeight, wallThickness);
  placeWall(group, "east", outerSide, wallHeight, wallThickness);
  placeWall(group, "west", outerSide, wallHeight, wallThickness);

  // ── 4 角城门楼 ──
  placeGates(group, outerSide, gateWidth, gateHeight, "city");

  // ── 内部建筑 ──
  if (size === "small") {
    // 2-3 民居 + 1 simpleHall (官衙)
    group.add(makeHouse(0.55, 0.4, 0.5, -0.7, 0.5, "city_house_1"));
    group.add(makeHouse(0.5, 0.35, 0.5, 0.6, 0.6, "city_house_2"));
    group.add(makeHouse(0.5, 0.4, 0.55, 0, -0.4, "city_house_3"));

    const yamen = buildSimpleHall(1.0, 0.8, 0.55);
    yamen.name = "city_yamen";
    yamen.position.set(0.3, 0, 0);
    group.add(yamen);
  } else if (size === "medium") {
    // 4-5 建筑: simpleHall (官衙) + 2 层楼 + 3 民居
    const yamen = buildSimpleHall(1.6, 1.2, 0.8);
    yamen.name = "city_yamen";
    yamen.position.set(0, 0, -0.6);
    group.add(yamen);

    const tower = buildTwoStoryHall(1.0, 0.9, 0.7);
    tower.position.set(1.2, 0, 0.8);
    group.add(tower);

    group.add(makeHouse(0.7, 0.55, 0.6, -1.3, 0.7, "city_house_1"));
    group.add(makeHouse(0.65, 0.5, 0.55, -1.2, -0.7, "city_house_2"));
    group.add(makeHouse(0.7, 0.5, 0.6, 0, 1.0, "city_house_3"));
  } else {
    // large: 双重城墙 + 4 高城门 + 3-4 simpleHall + buildPagoda (5 层)
    // 中间一圈小墙 (内城)
    const innerSide = outerSide * 0.55;
    const innerHeight = wallHeight * 0.7;
    const innerThick = wallThickness * 0.7;
    placeWall(group, "north", innerSide, innerHeight, innerThick);
    placeWall(group, "south", innerSide, innerHeight, innerThick);
    placeWall(group, "east", innerSide, innerHeight, innerThick);
    placeWall(group, "west", innerSide, innerHeight, innerThick);

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
