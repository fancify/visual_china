/**
 * Mausoleum archetype builder.
 *
 * 唐风重做:
 *   - tomb:     低矮覆斗形封土 + 短神道 + 石翁仲
 *   - imperial: 多级覆斗封土 + 神道 + 石阙/华表 + 石马
 */

import * as THREE from "three";
import {
  TANG_PALETTE,
  buildColumn,
  buildHuaBiao,
} from "../tangParts.js";

export type MausoleumVariant = "tomb" | "imperial";

export function buildMausoleum(variant: MausoleumVariant): THREE.Group {
  switch (variant) {
    case "tomb":
      return buildTomb();
    case "imperial":
      return buildImperialMausoleum();
    default: {
      const _exhaustive: never = variant;
      return _exhaustive;
    }
  }
}

function buildTomb(): THREE.Group {
  const group = new THREE.Group();
  group.name = "mausoleum_tomb";
  group.rotation.y = Math.PI;

  const mound = buildSteppedMound("tomb_mound", [
    { w: 2.2, h: 0.36, d: 2.0 },
    { w: 1.55, h: 0.28, d: 1.38 },
    { w: 1.0, h: 0.18, d: 0.88 },
  ]);
  group.add(mound);

  const path = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.04, 2.6),
    new THREE.MeshLambertMaterial({ color: TANG_PALETTE.shiHui }),
  );
  path.name = "tomb_spiritPath";
  path.position.set(0, 0.02, -1.85);
  group.add(path);

  const wengzhong = buildStoneFigure("tomb_wengzhong");
  wengzhong.position.set(0.55, 0, -1.8);
  group.add(wengzhong);

  return group;
}

function buildImperialMausoleum(): THREE.Group {
  const group = new THREE.Group();
  group.name = "mausoleum_imperial";
  group.rotation.y = Math.PI;
  group.scale.setScalar(0.5);

  const mound = buildSteppedMound("imperial_mound", [
    { w: 3.2, h: 0.42, d: 3.0 },
    { w: 2.45, h: 0.36, d: 2.25 },
    { w: 1.75, h: 0.30, d: 1.55 },
    { w: 1.05, h: 0.22, d: 0.92 },
  ]);
  group.add(mound);

  const stoneMat = new THREE.MeshLambertMaterial({ color: TANG_PALETTE.shiHui });
  const spiritPath = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.05, 8), stoneMat);
  spiritPath.name = "imperial_spiritPath";
  spiritPath.position.set(0, 0.025, -4);
  group.add(spiritPath);

  for (const [x, z, tag] of [
    [-1.05, -1.65, "near_left"],
    [1.05, -1.65, "near_right"],
    [-1.25, -5.05, "far_left"],
    [1.25, -5.05, "far_right"],
  ] as const) {
    const huabiao = buildHuaBiao(1.35);
    huabiao.name = `imperial_huabiao_${tag}`;
    huabiao.position.set(x, 0, z);
    group.add(huabiao);
  }

  for (const [x, z, tag] of [
    [-0.95, -3.0, "front_left"],
    [0.95, -3.0, "front_right"],
    [-0.95, -6.0, "back_left"],
    [0.95, -6.0, "back_right"],
  ] as const) {
    const horse = buildStoneHorse(`imperial_horse_${tag}`);
    horse.position.set(x, 0, z);
    group.add(horse);
  }

  return group;
}

function buildSteppedMound(
  name: string,
  layers: ReadonlyArray<{ readonly w: number; readonly h: number; readonly d: number }>,
): THREE.Group {
  const group = new THREE.Group();
  group.name = name;
  const mat = new THREE.MeshLambertMaterial({ color: TANG_PALETTE.hangHuang });
  let y = 0;
  layers.forEach((layer, i) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(layer.w, layer.h, layer.d), mat);
    mesh.name = `${name}_layer_${i}`;
    mesh.position.y = y + layer.h / 2;
    group.add(mesh);
    y += layer.h;
  });
  return group;
}

function buildStoneFigure(name: string): THREE.Group {
  const group = new THREE.Group();
  group.name = name;
  const body = buildColumn(0.9, TANG_PALETTE.shiHui);
  body.name = `${name}_body`;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 10, 8),
    new THREE.MeshLambertMaterial({ color: TANG_PALETTE.shiHui }),
  );
  head.name = `${name}_head`;
  head.position.y = 0.98;
  group.add(head);
  return group;
}

function buildStoneHorse(name: string): THREE.Group {
  const group = new THREE.Group();
  group.name = name;
  const mat = new THREE.MeshLambertMaterial({ color: TANG_PALETTE.shiHui });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.36, 0.95), mat);
  body.name = `${name}_body`;
  body.position.y = 0.28;
  group.add(body);
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.38, 0.22), mat);
  neck.name = `${name}_neck`;
  neck.position.set(0, 0.55, -0.38);
  neck.rotation.x = -0.2;
  group.add(neck);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.32), mat);
  head.name = `${name}_head`;
  head.position.set(0, 0.72, -0.58);
  group.add(head);
  return group;
}
