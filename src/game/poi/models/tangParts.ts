/**
 * Tang 共通构件库 (Tang dynasty common architectural parts)
 *
 * 提供 8 个低多边形 (low-poly) Three.js 构件函数, 复用于 POI 3D 模型:
 *   1. buildHipRoof        — 歇山顶
 *   2. buildBracketSet     — 斗拱
 *   3. buildHuaBiao        — 华表
 *   4. buildRammedEarthWall — 夯土墙 (可 broken)
 *   5. buildPagoda         — 多层塔
 *   6. buildColumn         — 柱
 *   7. buildStele          — 碑
 *   8. buildSimpleHall     — 简易大殿
 *
 * 设计原则:
 *   - 每个函数 pure (每次 new geometry, 不 cache)
 *   - 主部件独立 Mesh, 装饰可 merge 减 draw call
 *   - MeshLambertMaterial + TANG_PALETTE
 *   - 飞檐效果: corner cone 倾斜 ~30°
 */

import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";

// ──────────────────────────────────────────────────────────────────────────
// 颜色 palette — Tang 风格主色
// ──────────────────────────────────────────────────────────────────────────

export const TANG_PALETTE = {
  zhuHong: 0xa6362d,    // 朱红 (柱)
  daiHei: 0x2a2520,     // 黛黑 (瓦)
  hangHuang: 0xa68a5b,  // 夯黄 (墙)
  shiHui: 0xb8b0a3,     // 灰白 (石阙)
  taiLv: 0x4a5d3a,      // 苔绿 (废墟)
  jinHuang: 0xc9a55a,   // 鎏金 (大佛/装饰)
  muSe: 0x5e4b3b,       // 木色 (栏杆/桥)
  shuiLan: 0x4d7a8a,    // 水蓝 (河面)
} as const;

export type TangPaletteKey = keyof typeof TANG_PALETTE;

// ──────────────────────────────────────────────────────────────────────────
// 内部工具
// ──────────────────────────────────────────────────────────────────────────

/** 准备 geometry 用于 merge (统一 non-indexed). */
function prepareForMerge(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  return geometry.index ? geometry.toNonIndexed() : geometry.clone();
}

/** 安全 merge: 若失败 fallback 到第一个 geometry. */
function mergeOrFirst(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  if (parts.length === 0) {
    return new THREE.BufferGeometry();
  }
  const prepped = parts.map(prepareForMerge);
  const merged = BufferGeometryUtils.mergeGeometries(prepped);
  if (!merged) {
    return prepped[0]!;
  }
  merged.computeVertexNormals();
  merged.computeBoundingBox();
  return merged;
}

/** Lambert material factory (受光). */
function lambert(color: number): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color });
}

/** 构造一个屋顶斜面 (trapezoid mesh) — 用自定义 BufferGeometry. */
function buildRoofSlope(
  bottomWidth: number,
  topWidth: number,
  depth: number,
  rise: number,
): THREE.BufferGeometry {
  // 梯形斜面: 底边 bottomWidth, 顶边 topWidth, 沿 +z 倾斜上升 rise, depth 是水平进深
  const halfB = bottomWidth / 2;
  const halfT = topWidth / 2;
  // 4 顶点 (顺时针朝外): 底左, 底右, 顶右, 顶左
  // 底在 z=+depth/2, y=0; 顶在 z=0, y=rise
  const vertices = new Float32Array([
    -halfB, 0, depth / 2,   //  0 底左
    halfB, 0, depth / 2,   //  1 底右
    halfT, rise, 0,         //  2 顶右
    -halfT, rise, 0,         //  3 顶左
  ]);
  const indices = [0, 1, 2, 0, 2, 3];
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

// ──────────────────────────────────────────────────────────────────────────
// 1. buildHipRoof — 歇山顶
// ──────────────────────────────────────────────────────────────────────────

/**
 * 歇山顶: 4 面斜屋顶 + 矩形屋脊 + 4 角飞檐 + 两端鸱吻.
 *
 * @param width  屋顶宽 (x 方向)
 * @param depth  屋顶进深 (z 方向)
 * @param ridgeHeight 屋脊高 (y 方向)
 */
export function buildHipRoof(
  width: number,
  depth: number,
  ridgeHeight: number,
): THREE.Group {
  const group = new THREE.Group();
  group.name = "hipRoof";

  // 屋脊长度 (顶部矩形) — 沿 x 方向, 约 width 的 50%
  const ridgeLen = width * 0.5;

  // ── 水平檐口板 (eave board) — 让屋顶底面与墙顶接合, 同时向外出挑 ──
  // 此板薄薄一层位于 y=0 (= 墙顶 world 坐标), 既封闭"屋顶悬在墙上方"的缝隙,
  // 也给飞檐 cone 一个明确的底盘.
  const eaveBoardThick = ridgeHeight * 0.08;
  const eaveBoardGeom = new THREE.BoxGeometry(width, eaveBoardThick, depth);
  eaveBoardGeom.translate(0, -eaveBoardThick / 2, 0);
  const eaveBoardMesh = new THREE.Mesh(eaveBoardGeom, lambert(TANG_PALETTE.daiHei));
  eaveBoardMesh.name = "hipRoof_eaveBoard";
  group.add(eaveBoardMesh);

  // ── 4 个屋顶斜面 (tile 瓦面) ──
  // 前后 (沿 z 倾斜): bottomWidth = width, topWidth = ridgeLen, depth = depth/2
  const tileGeoms: THREE.BufferGeometry[] = [];

  // 前面 (+z 方向)
  const front = buildRoofSlope(width, ridgeLen, depth / 2, ridgeHeight);
  tileGeoms.push(front);

  // 后面 (-z 方向, 镜像)
  const back = buildRoofSlope(width, ridgeLen, depth / 2, ridgeHeight);
  back.rotateY(Math.PI);
  tileGeoms.push(back);

  // 左面 (-x): 旋转 90°. 进深方向变为 width 减 ridgeLen 之外的端面短梯形.
  // 为简化, 左右两端做小三角 (近似歇山的山花面)
  const left = buildRoofSlope(depth, 0, (width - ridgeLen) / 2, ridgeHeight);
  left.rotateY(-Math.PI / 2);
  left.translate(-ridgeLen / 2, 0, 0);
  tileGeoms.push(left);

  const right = buildRoofSlope(depth, 0, (width - ridgeLen) / 2, ridgeHeight);
  right.rotateY(Math.PI / 2);
  right.translate(ridgeLen / 2, 0, 0);
  tileGeoms.push(right);

  const tileMesh = new THREE.Mesh(mergeOrFirst(tileGeoms), lambert(TANG_PALETTE.daiHei));
  tileMesh.name = "hipRoof_tiles";
  group.add(tileMesh);

  // ── 顶部矩形屋脊 (raised box) ──
  const ridgeGeom = new THREE.BoxGeometry(ridgeLen * 1.05, ridgeHeight * 0.12, depth * 0.06);
  ridgeGeom.translate(0, ridgeHeight + ridgeHeight * 0.06, 0);
  const ridgeMesh = new THREE.Mesh(ridgeGeom, lambert(TANG_PALETTE.daiHei));
  ridgeMesh.name = "hipRoof_ridge";
  group.add(ridgeMesh);

  // ── 两端鸱吻 (小三角凸起) ──
  const chiwenGeoms: THREE.BufferGeometry[] = [];
  const chiwenSize = ridgeHeight * 0.25;
  const chiwenLeft = new THREE.ConeGeometry(chiwenSize * 0.4, chiwenSize, 4);
  chiwenLeft.rotateY(Math.PI / 4);
  chiwenLeft.translate(-ridgeLen / 2, ridgeHeight + chiwenSize / 2 + ridgeHeight * 0.06, 0);
  chiwenGeoms.push(chiwenLeft);

  const chiwenRight = new THREE.ConeGeometry(chiwenSize * 0.4, chiwenSize, 4);
  chiwenRight.rotateY(Math.PI / 4);
  chiwenRight.translate(ridgeLen / 2, ridgeHeight + chiwenSize / 2 + ridgeHeight * 0.06, 0);
  chiwenGeoms.push(chiwenRight);

  const chiwenMesh = new THREE.Mesh(mergeOrFirst(chiwenGeoms), lambert(TANG_PALETTE.daiHei));
  chiwenMesh.name = "hipRoof_chiwen";
  group.add(chiwenMesh);

  // ── 4 角飞檐 (corner upturn) — 屋顶角"小翘起", 含蓄如鸱吻附属, 不像独立 spike ──
  // 缩小 + 几乎贴近屋顶角 (不再像牛角向外伸)
  const eaveGeoms: THREE.BufferGeometry[] = [];
  const eaveLen = Math.min(width, depth) * 0.10; // 大幅缩小
  const eaveR = eaveLen * 0.30;                  // 圆润一点
  const eaveTilt = Math.PI / 3;                  // 60° 几乎直立 (含蓄翘起)
  const cornerOffsetX = width / 2;
  const cornerOffsetZ = depth / 2;

  // yawRad: 把 +z 方向 (cone 倾斜后尖端外伸方向) 旋转到对应角的对角线方向
  const eaveConfigs: Array<[number, number, number]> = [
    [cornerOffsetX, cornerOffsetZ, Math.PI / 4],         // +x +z 角, 尖端朝 (+x,+z)
    [-cornerOffsetX, cornerOffsetZ, -Math.PI / 4],       // -x +z 角, 尖端朝 (-x,+z)
    [cornerOffsetX, -cornerOffsetZ, 3 * Math.PI / 4],    // +x -z 角, 尖端朝 (+x,-z)
    [-cornerOffsetX, -cornerOffsetZ, -3 * Math.PI / 4],  // -x -z 角, 尖端朝 (-x,-z)
  ];

  for (const [cx, cz, yawRad] of eaveConfigs) {
    const eave = new THREE.ConeGeometry(eaveR, eaveLen, 4);
    // 1) 把 base 移到 y=0 (默认 base 在 y=-eaveLen/2)
    eave.translate(0, eaveLen / 2, 0);
    // 2) 沿 x 轴向 +z 方向倾倒 45° (apex 朝 +z 上方)
    eave.rotateX(-eaveTilt);
    // 3) 绕 y 转到对应角的对角线 yaw
    eave.rotateY(yawRad);
    // 4) 平移到屋顶底部 4 角; 略略上抬一点点避免与水平檐口板穿模
    eave.translate(cx, ridgeHeight * 0.02, cz);
    eaveGeoms.push(eave);
  }

  const eaveMesh = new THREE.Mesh(mergeOrFirst(eaveGeoms), lambert(TANG_PALETTE.daiHei));
  eaveMesh.name = "hipRoof_eaves";
  group.add(eaveMesh);

  return group;
}

// ──────────────────────────────────────────────────────────────────────────
// 2. buildBracketSet — 斗拱
// ──────────────────────────────────────────────────────────────────────────

/**
 * 斗拱 (简化): 柱础 + 十字交叉拱木 + 顶盘.
 *
 * @param scale 整体缩放 (1.0 ≈ 0.6 单位高)
 */
export function buildBracketSet(scale: number): THREE.Group {
  const group = new THREE.Group();
  group.name = "bracketSet";
  const s = scale;

  // 装饰小部件 merge 成一个 mesh
  const parts: THREE.BufferGeometry[] = [];

  // 中间柱础 (column-base box)
  const base = new THREE.BoxGeometry(0.18 * s, 0.16 * s, 0.18 * s);
  base.translate(0, 0.08 * s, 0);
  parts.push(base);

  // 4 个十字交叉拱木 (上方)
  const armLong = 0.5 * s;
  const armShort = 0.1 * s;
  const armThick = 0.08 * s;
  const armY = 0.16 * s + armThick / 2;

  const armX = new THREE.BoxGeometry(armLong, armThick, armShort);
  armX.translate(0, armY, 0);
  parts.push(armX);

  const armZ = new THREE.BoxGeometry(armShort, armThick, armLong);
  armZ.translate(0, armY, 0);
  parts.push(armZ);

  // 第二层十字 (稍小, 上移)
  const arm2Y = armY + armThick + 0.02 * s;
  const arm2Long = 0.36 * s;
  const arm2X = new THREE.BoxGeometry(arm2Long, armThick, armShort);
  arm2X.translate(0, arm2Y, 0);
  parts.push(arm2X);

  const arm2Z = new THREE.BoxGeometry(armShort, armThick, arm2Long);
  arm2Z.translate(0, arm2Y, 0);
  parts.push(arm2Z);

  // 顶部小盘
  const top = new THREE.BoxGeometry(0.22 * s, 0.04 * s, 0.22 * s);
  top.translate(0, arm2Y + armThick / 2 + 0.02 * s, 0);
  parts.push(top);

  const mesh = new THREE.Mesh(mergeOrFirst(parts), lambert(TANG_PALETTE.muSe));
  mesh.name = "bracketSet_main";
  group.add(mesh);

  return group;
}

// ──────────────────────────────────────────────────────────────────────────
// 3. buildHuaBiao — 华表
// ──────────────────────────────────────────────────────────────────────────

/**
 * 华表: 高柱 + 顶部圆盘 + 蹲兽 + 柱身 horizontal ring 装饰.
 */
export function buildHuaBiao(height: number): THREE.Group {
  const group = new THREE.Group();
  group.name = "huaBiao";

  const radius = height * 0.05;

  // ── 柱身 (主部件) — cylinder ──
  const shaftGeom = new THREE.CylinderGeometry(radius, radius * 1.1, height, 8);
  shaftGeom.translate(0, height / 2, 0);
  const shaftMesh = new THREE.Mesh(shaftGeom, lambert(TANG_PALETTE.shiHui));
  shaftMesh.name = "huaBiao_shaft";
  group.add(shaftMesh);

  // ── 装饰 (rings + 顶盘 + 蹲兽) merge ──
  const decorParts: THREE.BufferGeometry[] = [];

  // 3 个 horizontal ring (raised box) 装饰
  const ringCount = 3;
  for (let i = 0; i < ringCount; i++) {
    const ringY = height * (0.25 + i * 0.2);
    const ring = new THREE.BoxGeometry(radius * 2.4, height * 0.025, radius * 2.4);
    ring.translate(0, ringY, 0);
    decorParts.push(ring);
  }

  // 顶部圆盘
  const disk = new THREE.CylinderGeometry(radius * 2.2, radius * 2.2, height * 0.05, 12);
  disk.translate(0, height + height * 0.025, 0);
  decorParts.push(disk);

  // 蹲兽 (顶上小 cone)
  const beast = new THREE.ConeGeometry(radius * 1.4, height * 0.12, 6);
  beast.translate(0, height + height * 0.05 + height * 0.06, 0);
  decorParts.push(beast);

  const decorMesh = new THREE.Mesh(mergeOrFirst(decorParts), lambert(TANG_PALETTE.shiHui));
  decorMesh.name = "huaBiao_decor";
  group.add(decorMesh);

  return group;
}

// ──────────────────────────────────────────────────────────────────────────
// 4. buildRammedEarthWall — 夯土墙
// ──────────────────────────────────────────────────────────────────────────

/**
 * 夯土墙: 顶面略不平的长方体 (2-3 段拼接); broken=true 时跳过一段并加杂草.
 *
 * @param length    墙长 (x 方向)
 * @param height    墙高 (y 方向)
 * @param thickness 墙厚 (z 方向)
 * @param broken    残破效果
 */
export function buildRammedEarthWall(
  length: number,
  height: number,
  thickness: number,
  broken: boolean = false,
): THREE.Group {
  const group = new THREE.Group();
  group.name = broken ? "rammedEarthWall_broken" : "rammedEarthWall";

  const segments = 3;
  const segLen = length / segments;
  const wallParts: THREE.BufferGeometry[] = [];
  const grassParts: THREE.BufferGeometry[] = [];

  for (let i = 0; i < segments; i++) {
    // 残破: 跳过中间段
    if (broken && i === 1) {
      // 添加杂草 cone
      const grass = new THREE.ConeGeometry(thickness * 0.3, height * 0.25, 5);
      grass.translate(
        -length / 2 + segLen * (i + 0.5),
        height * 0.12,
        0,
      );
      grassParts.push(grass);
      // 矮残桩 (低高度)
      const stub = new THREE.BoxGeometry(segLen * 0.85, height * 0.18, thickness);
      stub.translate(-length / 2 + segLen * (i + 0.5), height * 0.09, 0);
      wallParts.push(stub);
      continue;
    }

    // 每段高度略不同 (随机但 deterministic — 用 index hash 模拟)
    const heightWiggle = broken
      ? height * (0.78 + 0.12 * ((i * 13) % 7) / 7)
      : height * (0.94 + 0.04 * ((i * 13) % 5) / 5);

    const seg = new THREE.BoxGeometry(segLen * 0.98, heightWiggle, thickness);
    seg.translate(-length / 2 + segLen * (i + 0.5), heightWiggle / 2, 0);
    wallParts.push(seg);

    // 顶面附加一小块 (制造不平顶)
    const cap = new THREE.BoxGeometry(segLen * 0.6, height * 0.06, thickness * 0.85);
    cap.translate(
      -length / 2 + segLen * (i + 0.5) + segLen * 0.1,
      heightWiggle + height * 0.03,
      0,
    );
    wallParts.push(cap);
  }

  const wallMesh = new THREE.Mesh(mergeOrFirst(wallParts), lambert(TANG_PALETTE.hangHuang));
  wallMesh.name = "rammedEarthWall_main";
  group.add(wallMesh);

  if (broken && grassParts.length > 0) {
    const grassMesh = new THREE.Mesh(mergeOrFirst(grassParts), lambert(TANG_PALETTE.taiLv));
    grassMesh.name = "rammedEarthWall_grass";
    group.add(grassMesh);
  }

  return group;
}

// ──────────────────────────────────────────────────────────────────────────
// 5. buildPagoda — 多层塔
// ──────────────────────────────────────────────────────────────────────────

/**
 * 多层塔: 每层方形墙体 + 水平檐口 (出挑薄板); 顶层用完整歇山顶; 塔刹 (cone + 球).
 *
 * 中国塔的真正几何: 中间层之间用**水平檐口**分隔, 不是歇山顶.
 * 只有最顶层才用完整 hipRoof 作为塔的"顶冠".
 *
 * @param levels    层数 (3-7)
 * @param baseSize  底层边长
 */
export function buildPagoda(levels: number, baseSize: number): THREE.Group {
  const group = new THREE.Group();
  group.name = `pagoda_${levels}level`;

  const clampedLevels = Math.max(3, Math.min(7, Math.floor(levels)));
  const levelHeight = baseSize * 0.65;     // 每层墙体高
  const eaveThick = levelHeight * 0.08;    // 檐口板厚
  const eaveOverhang = 1.4;                // 檐口宽 / 墙宽 比例 (出挑 40%)
  const shrink = 0.88;                     // 每层缩小比例

  let currentY = 0;
  let currentSize = baseSize;

  for (let i = 0; i < clampedLevels; i++) {
    // 1. 层身 (zhuHong 朱红 墙体)
    const bodyGeom = new THREE.BoxGeometry(currentSize, levelHeight, currentSize);
    bodyGeom.translate(0, currentY + levelHeight / 2, 0);
    const bodyMesh = new THREE.Mesh(bodyGeom, lambert(TANG_PALETTE.zhuHong));
    bodyMesh.name = `pagoda_body_${i}`;
    group.add(bodyMesh);

    currentY += levelHeight;

    // 2. 顶层用完整歇山顶, 中间层用水平檐口
    if (i === clampedLevels - 1) {
      const topRoofH = levelHeight * 0.6;
      const topRoof = buildHipRoof(
        currentSize * eaveOverhang,
        currentSize * eaveOverhang,
        topRoofH,
      );
      topRoof.position.y = currentY;
      topRoof.name = "pagoda_topRoof";
      group.add(topRoof);
      currentY += topRoofH + eaveThick;
      break;
    }

    // 中间层: 纯水平檐口 (daiHei 黛黑瓦, 向四周出挑)
    const eaveGeom = new THREE.BoxGeometry(
      currentSize * eaveOverhang,
      eaveThick,
      currentSize * eaveOverhang,
    );
    eaveGeom.translate(0, currentY + eaveThick / 2, 0);
    const eaveMesh = new THREE.Mesh(eaveGeom, lambert(TANG_PALETTE.daiHei));
    eaveMesh.name = `pagoda_eave_${i}`;
    group.add(eaveMesh);

    currentY += eaveThick + levelHeight * 0.04; // 小间隔
    currentSize *= shrink;
  }

  // 3. 塔刹 (高 cone + 小球) — 立在最顶层 hipRoof 之上
  const finialParts: THREE.BufferGeometry[] = [];
  const spireH = baseSize * 0.7;
  const spire = new THREE.ConeGeometry(currentSize * 0.18, spireH, 8);
  spire.translate(0, currentY + spireH / 2, 0);
  finialParts.push(spire);

  const ball = new THREE.SphereGeometry(currentSize * 0.12, 8, 6);
  ball.translate(0, currentY + spireH + currentSize * 0.1, 0);
  finialParts.push(ball);

  const finialMesh = new THREE.Mesh(mergeOrFirst(finialParts), lambert(TANG_PALETTE.jinHuang));
  finialMesh.name = "pagoda_finial";
  group.add(finialMesh);

  return group;
}

// ──────────────────────────────────────────────────────────────────────────
// 6. buildColumn — 柱
// ──────────────────────────────────────────────────────────────────────────

/**
 * 柱: low-poly cylinder + 柱础 box.
 *
 * @param height 柱高 (含柱础)
 * @param color  柱身颜色, 默认 zhuHong
 */
export function buildColumn(
  height: number,
  color: number = TANG_PALETTE.zhuHong,
): THREE.Group {
  const group = new THREE.Group();
  group.name = "column";

  const baseHeight = height * 0.08;
  const baseSize = height * 0.12;
  const shaftRadius = height * 0.045;
  const shaftHeight = height - baseHeight;

  // 柱础 (shiHui 灰白)
  const baseGeom = new THREE.BoxGeometry(baseSize, baseHeight, baseSize);
  baseGeom.translate(0, baseHeight / 2, 0);
  const baseMesh = new THREE.Mesh(baseGeom, lambert(TANG_PALETTE.shiHui));
  baseMesh.name = "column_base";
  group.add(baseMesh);

  // 柱身 (low-poly 8 segments)
  const shaftGeom = new THREE.CylinderGeometry(shaftRadius, shaftRadius, shaftHeight, 8);
  shaftGeom.translate(0, baseHeight + shaftHeight / 2, 0);
  const shaftMesh = new THREE.Mesh(shaftGeom, lambert(color));
  shaftMesh.name = "column_shaft";
  group.add(shaftMesh);

  return group;
}

// ──────────────────────────────────────────────────────────────────────────
// 7. buildStele — 碑
// ──────────────────────────────────────────────────────────────────────────

/**
 * 碑: shiHui 灰白长方体 + 顶部圆角 cap + 正面凹陷 (题字感).
 */
export function buildStele(height: number): THREE.Group {
  const group = new THREE.Group();
  group.name = "stele";

  const width = height * 0.35;
  const thickness = height * 0.12;

  // 主碑身
  const bodyGeom = new THREE.BoxGeometry(width, height * 0.88, thickness);
  bodyGeom.translate(0, height * 0.44, 0);
  const bodyMesh = new THREE.Mesh(bodyGeom, lambert(TANG_PALETTE.shiHui));
  bodyMesh.name = "stele_body";
  group.add(bodyMesh);

  // 顶部 cap (圆角 — 用扁圆柱模拟)
  const capGeom = new THREE.CylinderGeometry(width / 2, width / 2, height * 0.12, 12);
  capGeom.rotateX(Math.PI / 2);
  capGeom.scale(1, 1, thickness / width);
  capGeom.translate(0, height * 0.88 + height * 0.04, 0);
  const capMesh = new THREE.Mesh(capGeom, lambert(TANG_PALETTE.shiHui));
  capMesh.name = "stele_cap";
  group.add(capMesh);

  // 正面凹陷 (题字感) — 用 emissive 暗色 small box, 略 inset 到正面
  const inscriptionMat = new THREE.MeshLambertMaterial({
    color: 0x1a1612,
    emissive: 0x0a0806,
  });
  const inscriptionGeom = new THREE.BoxGeometry(
    width * 0.7,
    height * 0.6,
    thickness * 0.15,
  );
  inscriptionGeom.translate(0, height * 0.42, thickness / 2 - thickness * 0.04);
  const inscriptionMesh = new THREE.Mesh(inscriptionGeom, inscriptionMat);
  inscriptionMesh.name = "stele_inscription";
  group.add(inscriptionMesh);

  return group;
}

// ──────────────────────────────────────────────────────────────────────────
// 8. buildSimpleHall — 简易大殿
// ──────────────────────────────────────────────────────────────────────────

/**
 * 简易大殿: 4 柱 + 中墙 + hipRoof.
 *
 * @param width  殿宽
 * @param depth  殿进深
 * @param height 柱高 (墙高)
 */
export function buildSimpleHall(
  width: number,
  depth: number,
  height: number,
): THREE.Group {
  const group = new THREE.Group();
  group.name = "simpleHall";

  // ── 4 柱 ──
  const columnPositions: Array<[number, number]> = [
    [-width / 2 + width * 0.08, -depth / 2 + depth * 0.08],
    [width / 2 - width * 0.08, -depth / 2 + depth * 0.08],
    [-width / 2 + width * 0.08, depth / 2 - depth * 0.08],
    [width / 2 - width * 0.08, depth / 2 - depth * 0.08],
  ];

  for (const [cx, cz] of columnPositions) {
    const col = buildColumn(height, TANG_PALETTE.zhuHong);
    col.position.set(cx, 0, cz);
    group.add(col);
  }

  // ── 中间墙 (zhuHong 红墙) ──
  // 后墙
  const wallThick = Math.min(width, depth) * 0.04;
  const wallHeight = height * 0.85;
  const backWallGeom = new THREE.BoxGeometry(width * 0.78, wallHeight, wallThick);
  backWallGeom.translate(0, wallHeight / 2 + height * 0.08, depth / 2 - depth * 0.12);
  const backWallMesh = new THREE.Mesh(backWallGeom, lambert(TANG_PALETTE.zhuHong));
  backWallMesh.name = "simpleHall_backWall";
  group.add(backWallMesh);

  // 左右侧墙 (较短)
  const sideWallLen = depth * 0.55;
  const leftWallGeom = new THREE.BoxGeometry(wallThick, wallHeight, sideWallLen);
  leftWallGeom.translate(-width / 2 + width * 0.12, wallHeight / 2 + height * 0.08, 0);
  const leftWallMesh = new THREE.Mesh(leftWallGeom, lambert(TANG_PALETTE.zhuHong));
  leftWallMesh.name = "simpleHall_leftWall";
  group.add(leftWallMesh);

  const rightWallGeom = new THREE.BoxGeometry(wallThick, wallHeight, sideWallLen);
  rightWallGeom.translate(width / 2 - width * 0.12, wallHeight / 2 + height * 0.08, 0);
  const rightWallMesh = new THREE.Mesh(rightWallGeom, lambert(TANG_PALETTE.zhuHong));
  rightWallMesh.name = "simpleHall_rightWall";
  group.add(rightWallMesh);

  // ── 横梁 (柱顶一圈, 连接 4 柱, muSe 木色) ──
  // 让屋顶有明确的"承重梁"视觉, 不再悬浮于柱顶之上
  const beamThick = height * 0.06;
  const beamY = height - beamThick / 2;
  const beamSize = Math.min(width, depth) * 0.92;
  // 前梁 + 后梁 (沿 x 方向)
  const beamFG = new THREE.BoxGeometry(width * 0.98, beamThick, beamThick);
  beamFG.translate(0, beamY, depth / 2 - depth * 0.08);
  const beamFM = new THREE.Mesh(beamFG, lambert(TANG_PALETTE.muSe));
  beamFM.name = "simpleHall_beam_front";
  group.add(beamFM);
  const beamBG = new THREE.BoxGeometry(width * 0.98, beamThick, beamThick);
  beamBG.translate(0, beamY, -depth / 2 + depth * 0.08);
  const beamBM = new THREE.Mesh(beamBG, lambert(TANG_PALETTE.muSe));
  beamBM.name = "simpleHall_beam_back";
  group.add(beamBM);
  // 左右梁 (沿 z 方向)
  const beamLG = new THREE.BoxGeometry(beamThick, beamThick, depth * 0.98);
  beamLG.translate(-width / 2 + width * 0.08, beamY, 0);
  const beamLM = new THREE.Mesh(beamLG, lambert(TANG_PALETTE.muSe));
  beamLM.name = "simpleHall_beam_left";
  group.add(beamLM);
  const beamRG = new THREE.BoxGeometry(beamThick, beamThick, depth * 0.98);
  beamRG.translate(width / 2 - width * 0.08, beamY, 0);
  const beamRM = new THREE.Mesh(beamRG, lambert(TANG_PALETTE.muSe));
  beamRM.name = "simpleHall_beam_right";
  group.add(beamRM);

  // ── 4 柱顶斗拱 (让屋顶 "坐" 在斗拱上) ──
  const bracketScale = Math.min(width, depth) * 0.10;
  for (const [cx, cz] of columnPositions) {
    const bracket = buildBracketSet(bracketScale);
    bracket.position.set(cx, height + beamThick * 0.5, cz);
    group.add(bracket);
  }

  // ── 顶部 hipRoof — 紧贴梁/斗拱顶面 ──
  const roof = buildHipRoof(width * 1.15, depth * 1.15, height * 0.5);
  roof.position.y = height + bracketScale * 1.5; // 斗拱高度之上
  group.add(roof);

  return group;
}
