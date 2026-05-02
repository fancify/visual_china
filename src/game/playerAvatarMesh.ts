import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshPhongMaterial,
  SphereGeometry
} from "three";

import { woodHorseAvatarParts } from "./playerAvatar.js";

export interface PlayerAvatarHandle {
  /** 玩家 root group。`scene.add(player)` 后玩家所有 mesh 都在它下面。 */
  player: Group;
  /** 4 条腿的引用，按 name 索引，主循环会修改 rotation 形成步态动画。 */
  horseLegsByName: Map<string, Mesh>;
}

/**
 * 创建第三人称木马 + 骑手 mesh 组合。
 *
 * 这一坨原本散落在 main.ts 顶部 130 多行，跟 scene 初始化、shader 创建混在一起。
 * 抽出来后 main.ts 只需要 `const { player, horseLegsByName } = createPlayerAvatar(); scene.add(player);`
 *
 * 所有 material 在函数内部创建——player avatar 是单例，不需要复用到模块级。
 */
export function createPlayerAvatar(): PlayerAvatarHandle {
  const avatarPartNames = new Set(woodHorseAvatarParts.map((part) => part.name));

  if (avatarPartNames.size === 0) {
    throw new Error("Missing wood horse avatar blueprint.");
  }

  const woodMaterial = new MeshPhongMaterial({
    color: 0x8b633d,
    flatShading: true,
    shininess: 6
  });
  const darkWoodMaterial = new MeshPhongMaterial({
    color: 0x5b3d28,
    flatShading: true,
    shininess: 5
  });
  const cloakMaterial = new MeshPhongMaterial({
    color: 0xb85b3d,
    flatShading: true,
    shininess: 8
  });
  const riderMaterial = new MeshPhongMaterial({
    color: 0xe2ceb0,
    flatShading: true
  });
  const maneMaterial = new MeshPhongMaterial({
    color: 0xd5a35f,
    flatShading: true,
    shininess: 5
  });
  const saddleMaterial = new MeshPhongMaterial({
    color: 0x3d2a20,
    flatShading: true
  });
  const douliMaterial = new MeshPhongMaterial({
    // 浅竹/麦秆色斗笠，配合骑手衣袍颜色
    color: 0xc89968,
    flatShading: true,
    shininess: 4
  });
  const eyeMaterial = new MeshPhongMaterial({
    // 黑亮眼珠：shininess 调高让小球反光，不会糊成一团
    color: 0x141414,
    shininess: 80
  });

  // 用户要求"躯体稍微窄小一点"：长 2.7→2.55（-5.5%）、高 0.86→0.78（-9%）、
  // 宽 1.12→0.88（-21%，最明显的窄）。腿在 z=±0.38（仍在新宽度 ±0.44 内）、
  // 鞍 0.88 宽（贴合新躯体），均无需联动。
  const horseBody = new Mesh(new BoxGeometry(2.55, 0.78, 0.88), woodMaterial);
  horseBody.name = "wooden-horse-body";
  horseBody.position.y = 1.35;

  const horseNeck = new Mesh(new BoxGeometry(0.4, 1.02, 0.48), woodMaterial);
  horseNeck.name = "wooden-horse-neck";
  horseNeck.position.set(1.12, 1.82, 0);
  horseNeck.rotation.z = -0.35;

  const horseHead = new Mesh(new BoxGeometry(0.92, 0.58, 0.56), darkWoodMaterial);
  horseHead.name = "wooden-horse-head";
  horseHead.position.set(1.62, 2.16, 0);
  horseHead.rotation.z = -0.12;

  const horseMane = new Mesh(new ConeGeometry(0.24, 0.72, 4), maneMaterial);
  horseMane.position.set(1.22, 2.28, 0);
  horseMane.rotation.z = Math.PI;

  const horseTail = new Mesh(new ConeGeometry(0.18, 0.95, 5), darkWoodMaterial);
  horseTail.name = "wooden-horse-tail";
  horseTail.position.set(-1.55, 1.42, 0);
  horseTail.rotation.z = Math.PI / 2;

  const legSpec: Array<[string, number, number]> = [
    ["front-left-leg", 0.88, 0.38],
    ["front-right-leg", 0.88, -0.38],
    ["back-left-leg", -0.88, 0.38],
    ["back-right-leg", -0.88, -0.38]
  ];
  // 4 条腿共享 geometry，避免每条腿都新建一个 cylinder buffer。
  const legGeometry = new CylinderGeometry(0.11, 0.15, 1.08, 5);
  const horseLegs = legSpec.map(([name, x, z]) => {
    const leg = new Mesh(legGeometry, darkWoodMaterial);
    leg.name = name;
    leg.position.set(x, 0.68, z);
    leg.rotation.z =
      name === "front-left-leg" || name === "back-right-leg" ? 0.1 : -0.1;
    return leg;
  });
  const horseLegsByName = new Map(horseLegs.map((leg) => [leg.name, leg]));

  const saddle = new Mesh(new BoxGeometry(0.82, 0.18, 0.88), saddleMaterial);
  saddle.position.set(0.05, 1.9, 0);

  const rider = new Mesh(new SphereGeometry(0.36, 12, 12), riderMaterial);
  rider.name = "traveler-head";
  rider.position.set(0.05, 2.78, 0);

  const cloak = new Mesh(new ConeGeometry(0.62, 1.18, 5), cloakMaterial);
  cloak.name = "traveler-cloak";
  cloak.position.set(0, 2.2, 0);
  cloak.rotation.y = Math.PI / 5;

  // 斗笠（中式遮阳竹帽）：替换原来的红旗，给骑手一个文化标识 + 圆润可爱感。
  // ConeGeometry 默认 tip 在 +Y，rim 在 -Y——正好符合斗笠形状（顶尖底圆）。
  const douli = new Mesh(new ConeGeometry(0.55, 0.22, 12), douliMaterial);
  douli.name = "traveler-douli";
  douli.position.set(0.05, 3.18, 0);

  // 一对眼珠：放在 head sphere 前面（玩家朝向 +X），轻微抬高使脸看上去
  // 是"圆润看前方"。两眼 z 对称，间距 0.32。
  const eyeGeometry = new SphereGeometry(0.05, 8, 8);
  const eyeLeft = new Mesh(eyeGeometry, eyeMaterial);
  eyeLeft.name = "traveler-eye-left";
  eyeLeft.position.set(0.34, 2.84, 0.16);
  const eyeRight = new Mesh(eyeGeometry, eyeMaterial);
  eyeRight.name = "traveler-eye-right";
  eyeRight.position.set(0.34, 2.84, -0.16);

  const player = new Group();
  player.add(
    horseBody,
    horseNeck,
    horseHead,
    horseMane,
    horseTail,
    ...horseLegs,
    saddle,
    cloak,
    rider,
    douli,
    eyeLeft,
    eyeRight
  );

  return { player, horseLegsByName };
}
