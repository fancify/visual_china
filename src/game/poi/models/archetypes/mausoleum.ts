/**
 * Mausoleum archetype builder.
 *
 * 2 variants:
 *   - tomb:     单层方台 + 小棱锥顶 + 1 个石翁仲 (~2m × 2m × 1.5m)
 *   - imperial: 三层阶梯封土 + 神道 + 2 对华表 + 2 对石马 (~6m × 4m × 2m)
 *
 * 复用 tangParts: buildHuaBiao, buildColumn.
 */

import * as THREE from "three";
import {
  TANG_PALETTE,
  buildHuaBiao,
  buildColumn,
} from "../tangParts.js";

export type MausoleumVariant = "tomb" | "imperial";

/**
 * Build a Tang-style 墓/陵.
 *
 * @param variant tomb (一般墓) | imperial (帝陵)
 * @returns       THREE.Group, name = `mausoleum_<variant>`
 */
export function buildMausoleum(variant: MausoleumVariant): THREE.Group {
  switch (variant) {
    case "tomb":
      return buildTomb();
    case "imperial":
      return buildImperialMausoleum();
    default: {
      // exhaustive check
      const _exhaustive: never = variant;
      return _exhaustive;
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────
// tomb (~2m × 2m × 1.5m): 单层方台 + 小棱锥 + 1 石翁仲
// ──────────────────────────────────────────────────────────────────────────

function buildTomb(): THREE.Group {
  const group = new THREE.Group();
  group.name = "mausoleum_tomb";

  const rammedMat = new THREE.MeshLambertMaterial({
    color: TANG_PALETTE.hangHuang,
  });

  // 单层方台
  const baseGeom = new THREE.BoxGeometry(2, 0.6, 2);
  const base = new THREE.Mesh(baseGeom, rammedMat);
  base.name = "tomb_base";
  base.position.y = 0.3;
  group.add(base);

  // 顶部小棱锥 (4 面 cone, 旋转 π/4 让棱朝前)
  const peakGeom = new THREE.ConeGeometry(0.8, 0.6, 4);
  const peak = new THREE.Mesh(peakGeom, rammedMat);
  peak.name = "tomb_peak";
  peak.rotation.y = Math.PI / 4;
  peak.position.y = 0.9;
  group.add(peak);

  // 1 个石翁仲 = buildColumn(1.0, shiHui) + 头 sphere (在台前 1m 处)
  const wengzhong = new THREE.Group();
  wengzhong.name = "tomb_wengzhong";

  const body = buildColumn(1.0, TANG_PALETTE.shiHui);
  body.name = "tomb_wengzhong_body";
  wengzhong.add(body);

  const headMat = new THREE.MeshLambertMaterial({
    color: TANG_PALETTE.shiHui,
  });
  const headGeom = new THREE.SphereGeometry(0.15, 12, 8);
  const head = new THREE.Mesh(headGeom, headMat);
  head.name = "tomb_wengzhong_head";
  head.position.y = 1.0 + 0.1;
  wengzhong.add(head);

  // 台前 1m (取 -z 为前)
  wengzhong.position.set(0, 0, -2.0);
  group.add(wengzhong);

  return group;
}

// ──────────────────────────────────────────────────────────────────────────
// imperial (~6m × 4m × 2m): 三层阶梯封土 + 神道 + 2 对华表 + 2 对石马
// ──────────────────────────────────────────────────────────────────────────

function buildImperialMausoleum(): THREE.Group {
  const group = new THREE.Group();
  group.name = "mausoleum_imperial";

  const rammedMat = new THREE.MeshLambertMaterial({
    color: TANG_PALETTE.hangHuang,
  });
  const stoneMat = new THREE.MeshLambertMaterial({
    color: TANG_PALETTE.shiHui,
  });

  // 三层阶梯封土 (底/中/锥顶)
  const bottomGeom = new THREE.BoxGeometry(2.4, 0.5, 2.4);
  const bottom = new THREE.Mesh(bottomGeom, rammedMat);
  bottom.name = "imperial_mound_bottom";
  bottom.position.y = 0.25;
  group.add(bottom);

  const midGeom = new THREE.BoxGeometry(1.7, 0.5, 1.7);
  const mid = new THREE.Mesh(midGeom, rammedMat);
  mid.name = "imperial_mound_mid";
  mid.position.y = 0.75;
  group.add(mid);

  const topGeom = new THREE.ConeGeometry(0.85, 0.7, 4);
  const top = new THREE.Mesh(topGeom, rammedMat);
  top.name = "imperial_mound_top";
  top.rotation.y = Math.PI / 4;
  top.position.y = 1.35;
  group.add(top);

  // 神道 (从封土前向前延伸 8m, 灰白石板)
  const spiritPathGeom = new THREE.BoxGeometry(0.6, 0.05, 8);
  const spiritPath = new THREE.Mesh(spiritPathGeom, stoneMat);
  spiritPath.name = "imperial_spiritPath";
  spiritPath.position.set(0, 0.025, -4);
  group.add(spiritPath);

  // 神道两侧装饰 (z 从 -1 到 -7)

  // 2 对华表
  const huabiaoFront1 = buildHuaBiao(1.5);
  huabiaoFront1.name = "imperial_huabiao_front_left";
  huabiaoFront1.position.set(-0.8, 0, -2);
  group.add(huabiaoFront1);

  const huabiaoFront2 = buildHuaBiao(1.5);
  huabiaoFront2.name = "imperial_huabiao_front_right";
  huabiaoFront2.position.set(0.8, 0, -2);
  group.add(huabiaoFront2);

  const huabiaoBack1 = buildHuaBiao(1.5);
  huabiaoBack1.name = "imperial_huabiao_back_left";
  huabiaoBack1.position.set(-1.0, 0, -5);
  group.add(huabiaoBack1);

  const huabiaoBack2 = buildHuaBiao(1.5);
  huabiaoBack2.name = "imperial_huabiao_back_right";
  huabiaoBack2.position.set(1.0, 0, -5);
  group.add(huabiaoBack2);

  // 2 对石马 (BoxGeometry 身 + 小 cone 头)
  const horsePositions: ReadonlyArray<{
    name: string;
    x: number;
    z: number;
  }> = [
    { name: "imperial_horse_front_left", x: -0.6, z: -3 },
    { name: "imperial_horse_front_right", x: 0.6, z: -3 },
    { name: "imperial_horse_back_left", x: -0.6, z: -6 },
    { name: "imperial_horse_back_right", x: 0.6, z: -6 },
  ];

  for (const spec of horsePositions) {
    const horse = new THREE.Group();
    horse.name = spec.name;

    const bodyGeom = new THREE.BoxGeometry(0.5, 0.4, 1);
    const body = new THREE.Mesh(bodyGeom, stoneMat);
    body.name = spec.name + "_body";
    body.position.y = 0.2;
    horse.add(body);

    // 头 = cone, 朝向神道方向 (+z 朝向封土; 头朝外, -z 倒置朝前)
    const headGeom = new THREE.ConeGeometry(0.18, 0.4, 8);
    const head = new THREE.Mesh(headGeom, stoneMat);
    head.name = spec.name + "_head";
    // cone 默认尖朝 +y; 旋转使尖朝 -z (向前)
    head.rotation.x = -Math.PI / 2;
    head.position.set(0, 0.45, -0.55);
    horse.add(head);

    horse.position.set(spec.x, 0, spec.z);
    group.add(horse);
  }

  return group;
}
