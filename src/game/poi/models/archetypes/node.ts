import * as THREE from "three";
import {
  TANG_PALETTE,
  buildHipRoof,
  buildSimpleHall,
  buildHuaBiao,
  buildColumn,
  buildBracketSet,
} from "../tangParts.js";

/**
 * 节点 (node) 原型: 桥 / 渡口 / 港口 / 楼阁.
 *
 * 4 variant:
 * - bridge: 拱桥 (拱形桥身 + 栏杆 + 桥下水面)
 * - ferry:  渡口 (木平台 + 单艘帆船 + 水面)
 * - port:   港口 (海岸线 + 水面 + 3 艘船 + 码头 + 港务建筑)
 * - tower:  单座名楼 (3 层楼阁 + 屋顶 + 转角斗拱 + 华表)
 *
 * 全部使用 MeshLambertMaterial.
 *
 * @returns THREE.Group, name = "node_" + variant
 */
export function buildNode(
  variant: "bridge" | "ferry" | "port" | "tower",
): THREE.Group {
  const group = new THREE.Group();
  group.name = `node_${variant}`;

  const muSeMat = new THREE.MeshLambertMaterial({ color: TANG_PALETTE.muSe });
  const shuiLanMat = new THREE.MeshLambertMaterial({
    color: TANG_PALETTE.shuiLan,
  });
  const shiHuiMat = new THREE.MeshLambertMaterial({ color: TANG_PALETTE.shiHui });
  const hangHuangMat = new THREE.MeshLambertMaterial({
    color: TANG_PALETTE.hangHuang,
  });
  const sailMat = new THREE.MeshLambertMaterial({
    color: 0xddd5c0,
    side: THREE.DoubleSide,
  });

  if (variant === "bridge") {
    // ----- 拱形桥身 -----
    const archGeom = new THREE.TorusGeometry(1.2, 0.15, 6, 8, Math.PI);
    const arch = new THREE.Mesh(archGeom, muSeMat);
    arch.name = "bridge_arch";
    // 默认 Torus 平面在 xy, 半圆开口朝 -y; rotateX(π) 翻转使开口向下
    arch.rotation.x = Math.PI;
    arch.position.set(0, 1.0, 0);
    group.add(arch);

    // ----- 桥两侧栏杆: 各 6 个 buildColumn(0.3, muSe), 间隔 0.4 -----
    for (let side = 0; side < 2; side++) {
      const z = side === 0 ? 0.5 : -0.5;
      for (let i = 0; i < 6; i++) {
        const col = buildColumn(0.3, TANG_PALETTE.muSe);
        col.name = `bridge_railing_${side === 0 ? "front" : "back"}_${i}`;
        // 桥长 ~3m, 6 根柱沿 x 排列, 间隔 0.4, 居中
        const x = (i - 2.5) * 0.4;
        col.position.set(x, 1.0, z);
        group.add(col);
      }
    }

    // ----- 桥下水面 -----
    const waterGeom = new THREE.PlaneGeometry(4, 2.5);
    const water = new THREE.Mesh(waterGeom, shuiLanMat);
    water.name = "bridge_water";
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, -0.1, 0);
    group.add(water);
  } else if (variant === "ferry") {
    // ----- 木平台 -----
    const platformGeom = new THREE.BoxGeometry(2, 0.15, 1);
    const platform = new THREE.Mesh(platformGeom, muSeMat);
    platform.name = "ferry_platform";
    platform.position.set(0, 0.075, 0);
    group.add(platform);

    // ----- 帆船 -----
    const boat = buildBoat(1.2, 0.3, 0.4, 1.2, 0.8, 0.7, muSeMat, sailMat);
    boat.name = "ferry_boat";
    boat.position.set(1.5, 0, 0);
    group.add(boat);

    // ----- 水面 -----
    const waterGeom = new THREE.PlaneGeometry(4, 3);
    const water = new THREE.Mesh(waterGeom, shuiLanMat);
    water.name = "ferry_water";
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, -0.05, 0);
    group.add(water);
  } else if (variant === "port") {
    // ----- 海岸线 -----
    const shoreGeom = new THREE.PlaneGeometry(5, 1.5);
    const shore = new THREE.Mesh(shoreGeom, shiHuiMat);
    shore.name = "port_shore";
    shore.rotation.x = -Math.PI / 2;
    shore.position.set(0, 0.01, -1.5);
    group.add(shore);

    // ----- 水面 -----
    const waterGeom = new THREE.PlaneGeometry(5, 2.5);
    const water = new THREE.Mesh(waterGeom, shuiLanMat);
    water.name = "port_water";
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, -0.05, 1);
    group.add(water);

    // ----- 3 艘船 (船身 + 桅杆 + 帆) -----
    const boatSpecs = [
      { x: -1.5, z: 1.0, l: 1.0, h: 0.3, w: 0.5, mast: 1.0, sailW: 0.7, sailH: 0.6 },
      { x: 0, z: 0.5, l: 1.2, h: 0.35, w: 0.6, mast: 1.1, sailW: 0.8, sailH: 0.7 },
      { x: 1.6, z: 1.2, l: 0.9, h: 0.3, w: 0.5, mast: 0.95, sailW: 0.65, sailH: 0.55 },
    ];
    boatSpecs.forEach((spec, i) => {
      const boat = buildBoat(
        spec.l,
        spec.h,
        spec.w,
        spec.mast,
        spec.sailW,
        spec.sailH,
        muSeMat,
        sailMat,
      );
      boat.name = `port_boat_${i}`;
      boat.position.set(spec.x, 0, spec.z);
      group.add(boat);
    });

    // ----- 码头: 3 个 BoxGeometry(0.4, 0.5, 0.8) -----
    const dockGeom = new THREE.BoxGeometry(0.4, 0.5, 0.8);
    [-1.5, 0, 1.5].forEach((x, i) => {
      const dock = new THREE.Mesh(dockGeom, muSeMat);
      dock.name = `port_dock_${i}`;
      dock.position.set(x, 0.25, 0.2);
      group.add(dock);
    });

    // ----- 远处港务建筑: 2 个 BoxGeometry(0.6, 0.5, 0.6) hangHuang -----
    const buildingGeom = new THREE.BoxGeometry(0.6, 0.5, 0.6);
    [-1.5, 1.5].forEach((x, i) => {
      const building = new THREE.Mesh(buildingGeom, hangHuangMat);
      building.name = `port_building_${i}`;
      building.position.set(x, 0.25, -1.5);
      group.add(building);
    });
  } else {
    // ----- tower: 3 层楼阁 -----
    const layerSpecs = [
      { w: 2.5, d: 2.5, h: 2.0, y: 1.0 },
      { w: 2.2, d: 2.2, h: 1.8, y: 3.2 },
      { w: 1.9, d: 1.9, h: 1.6, y: 5.2 },
    ];
    layerSpecs.forEach((spec, i) => {
      const hall = buildSimpleHall(spec.w, spec.d, spec.h);
      hall.name = `tower_floor_${i + 1}`;
      hall.position.set(0, spec.y, 0);
      group.add(hall);

      // 每层 4 个转角 buildBracketSet(0.4) 在屋檐下
      const eaveY = spec.y + spec.h / 2;
      const hw = spec.w / 2;
      const hd = spec.d / 2;
      const corners: Array<[number, number]> = [
        [-hw, -hd],
        [hw, -hd],
        [-hw, hd],
        [hw, hd],
      ];
      corners.forEach((c, j) => {
        const bracket = buildBracketSet(0.4);
        bracket.name = `tower_bracket_floor${i + 1}_${j}`;
        bracket.position.set(c[0], eaveY, c[1]);
        group.add(bracket);
      });
    });

    // ----- 顶部歇山顶 -----
    const roof = buildHipRoof(2.0, 2.0, 0.6);
    roof.name = "tower_roof";
    roof.position.set(0, 6.4, 0);
    group.add(roof);

    // ----- 前方华表 -----
    const huaBiao = buildHuaBiao(2.5);
    huaBiao.name = "tower_huabiao";
    huaBiao.position.set(0, 0, 2);
    group.add(huaBiao);
  }

  return group;
}

/**
 * 内部辅助: 构造一艘帆船 (船身 + 桅杆 + 帆), 整体居中于 (0,0,0).
 * boat 内部局部坐标; 调用者用 boat.position 摆位.
 */
function buildBoat(
  hullL: number,
  hullH: number,
  hullW: number,
  mastH: number,
  sailW: number,
  sailH: number,
  hullMat: THREE.Material,
  sailMat: THREE.Material,
): THREE.Group {
  const boat = new THREE.Group();

  const hullGeom = new THREE.BoxGeometry(hullL, hullH, hullW);
  const hull = new THREE.Mesh(hullGeom, hullMat);
  hull.name = "boat_hull";
  hull.position.set(0, hullH / 2, 0);
  boat.add(hull);

  const mastGeom = new THREE.CylinderGeometry(0.04, 0.04, mastH, 8);
  const mast = new THREE.Mesh(mastGeom, hullMat);
  mast.name = "boat_mast";
  mast.position.set(0, hullH + mastH / 2, 0);
  boat.add(mast);

  const sailGeom = new THREE.PlaneGeometry(sailW, sailH);
  const sail = new THREE.Mesh(sailGeom, sailMat);
  sail.name = "boat_sail";
  sail.rotation.y = Math.PI / 2;
  sail.position.set(0, hullH + mastH / 2, 0);
  boat.add(sail);

  return boat;
}
