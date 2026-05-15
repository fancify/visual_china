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
    // ----- 拱形桥身 (∩ 形, 拱顶向上) -----
    // TorusGeometry default 在 xy 平面, θ=0..π 是上半圆 (∩ shape, 顶在 +y)
    // 不要 rotation, default 已是拱桥形状
    const archR = 1.2;
    const archGeom = new THREE.TorusGeometry(archR, 0.15, 6, 16, Math.PI);
    const arch = new THREE.Mesh(archGeom, muSeMat);
    arch.name = "bridge_arch";
    arch.position.set(0, 0.05, 0); // 拱底端在 y≈0 (略略上抬避免水面穿模)
    group.add(arch);

    // ----- 桥面: 沿拱顶曲线的平板 (用多个小 box 拼接近似) -----
    // 6 个 box 沿 x 分布, 每个 box 的 y 由 arch 弧度决定
    const deckSegments = 12;
    const deckW = 0.5; // 桥面宽 (沿 z)
    for (let i = 0; i < deckSegments; i++) {
      const t = (i + 0.5) / deckSegments; // 0..1
      const theta = t * Math.PI; // 0..π
      const x = -archR * Math.cos(theta); // -R..+R
      const y = archR * Math.sin(theta) * 0.95 + 0.05; // 略低于拱顶
      const dx = (Math.PI * archR) / deckSegments * 1.1; // 段长
      const angle = theta - Math.PI / 2; // 切线角
      const seg = new THREE.Mesh(
        new THREE.BoxGeometry(dx, 0.08, deckW),
        muSeMat,
      );
      seg.position.set(x, y, 0);
      seg.rotation.z = -angle; // 沿弧度倾斜
      seg.name = `bridge_deck_${i}`;
      group.add(seg);
    }

    // ----- 栏杆: 沿拱顶曲线两侧, 每侧 7 根, 沿弧排布 -----
    for (let side = 0; side < 2; side++) {
      const z = side === 0 ? deckW / 2 : -deckW / 2;
      for (let i = 0; i < 7; i++) {
        const t = (i + 0.5) / 7;
        const theta = t * Math.PI;
        const x = -archR * Math.cos(theta);
        const yBase = archR * Math.sin(theta) * 0.95 + 0.05;
        const col = buildColumn(0.28, TANG_PALETTE.muSe);
        col.position.set(x, yBase, z);
        col.name = `bridge_railing_${side === 0 ? "front" : "back"}_${i}`;
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
    // ----- tower: 3 层楼阁 (类塔结构: 墙体 + 水平檐口 + 顶层歇山顶) -----
    // 设计: 不用 buildSimpleHall 叠加 (会产生重复柱+横梁+斗拱混乱)
    // 改用 box 墙体 (zhuHong) + 水平檐口板 (daiHei) + 4 角斗拱
    // 最顶层用 buildHipRoof 收顶
    const zhuMat = new THREE.MeshLambertMaterial({ color: TANG_PALETTE.zhuHong });
    const daiMat = new THREE.MeshLambertMaterial({ color: TANG_PALETTE.daiHei });
    const layers = [
      { w: 2.8, d: 2.8, h: 2.0 }, // 底层最大
      { w: 2.4, d: 2.4, h: 1.6 },
      { w: 2.0, d: 2.0, h: 1.4 }, // 顶层最小
    ];
    let curY = 0;
    layers.forEach((spec, i) => {
      // 1) 墙体 (整层红色 box)
      const wallGeom = new THREE.BoxGeometry(spec.w, spec.h, spec.d);
      const wall = new THREE.Mesh(wallGeom, zhuMat);
      wall.position.set(0, curY + spec.h / 2, 0);
      wall.name = `tower_wall_${i + 1}`;
      group.add(wall);

      curY += spec.h;

      // 2) 4 角斗拱 (在墙顶, 角落)
      const hw = spec.w / 2;
      const hd = spec.d / 2;
      const corners: Array<[number, number]> = [
        [-hw + 0.1, -hd + 0.1],
        [hw - 0.1, -hd + 0.1],
        [-hw + 0.1, hd - 0.1],
        [hw - 0.1, hd - 0.1],
      ];
      corners.forEach((c, j) => {
        const bracket = buildBracketSet(0.25);
        bracket.position.set(c[0], curY, c[1]);
        bracket.name = `tower_bracket_${i + 1}_${j}`;
        group.add(bracket);
      });

      // 3) 中间层用水平檐口板 (顶层不加, 用 hipRoof 替代)
      if (i < layers.length - 1) {
        const eaveOverhang = 1.35;
        const eaveThick = 0.15;
        const eaveGeom = new THREE.BoxGeometry(spec.w * eaveOverhang, eaveThick, spec.d * eaveOverhang);
        const eave = new THREE.Mesh(eaveGeom, daiMat);
        eave.position.set(0, curY + 0.25 + eaveThick / 2, 0); // 斗拱顶之上
        eave.name = `tower_eave_${i + 1}`;
        group.add(eave);
        curY += 0.25 + eaveThick + 0.05; // 斗拱高 + 檐口厚 + 间隔
      } else {
        curY += 0.25; // 斗拱高
      }
    });

    // ----- 顶层歇山顶 -----
    const topLayer = layers[layers.length - 1]!;
    const roof = buildHipRoof(topLayer.w * 1.35, topLayer.d * 1.35, 0.8);
    roof.name = "tower_roof";
    roof.position.set(0, curY, 0);
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
