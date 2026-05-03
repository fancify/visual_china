import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshPhongMaterial,
  SphereGeometry
} from "three";

/**
 * 5 种坐骑（mount）。
 *
 * 设计目标：
 * - 都用 low-poly Three primitives，零外部 asset
 * - 共享 4 条腿名（"front-left-leg" 等），main loop 走通用 leg pose
 * - 每种 mount 暴露 saddleHeight + saddleX，让骑手坐稳在背上中央
 * - 整体尺寸跟原木马接近（背高 ~1.85m），方便骑手位置兼容
 */

export type MountId = "horse" | "ox" | "sheep" | "donkey" | "fox";

export interface MountDefinition {
  id: MountId;
  /** 中文显示名（UI 上展示） */
  name: string;
  /** 简短副标题，显示在选项卡片下方 */
  description: string;
}

export const MOUNT_DEFINITIONS: MountDefinition[] = [
  { id: "horse", name: "木马", description: "经典枣红木马，平稳。" },
  { id: "ox", name: "黄牛", description: "宽身长角，沉稳跋涉。" },
  { id: "sheep", name: "绵羊", description: "蓬松米白，山道灵巧。" },
  { id: "donkey", name: "毛驴", description: "灰身长耳，轻便代步。" },
  { id: "fox", name: "灵狐", description: "橙红长尾，山林灵兽。" }
];

export interface MountHandle {
  mount: Group;
  /**
   * 4 条腿引用，按 name 索引。共用 woodHorseLegPose 输出的 key:
   * "front-left-leg" / "front-right-leg" / "back-left-leg" / "back-right-leg"。
   */
  legsByName: Map<string, Mesh>;
  /** 鞍座（骑手底部）在 mount 局部坐标的 Y 高度。 */
  saddleHeight: number;
  /** 鞍座在 mount 局部坐标的 X 位置（前后），通常接近 0。 */
  saddleX: number;
}

interface LegSpec {
  name: string;
  x: number;
  z: number;
  y: number;
  /** 腿长（cylinder height） */
  length: number;
  /** 上下半径 */
  radiusTop: number;
  radiusBottom: number;
  /** 静止状态轻微摇摆角度（让步伐有起手姿态） */
  baseRotation: number;
}

function buildLegs(specs: LegSpec[], material: MeshPhongMaterial): Mesh[] {
  // 4 条腿 geometry 不复用——不同 mount 的腿粗细/长度都不一样，单独建更简单。
  return specs.map((spec) => {
    const geometry = new CylinderGeometry(
      spec.radiusTop,
      spec.radiusBottom,
      spec.length,
      5
    );
    const leg = new Mesh(geometry, material);
    leg.name = spec.name;
    leg.position.set(spec.x, spec.y, spec.z);
    leg.rotation.z = spec.baseRotation;
    return leg;
  });
}

/** 木马（默认坐骑），尺寸跟旧版本一致。 */
function buildHorse(): MountHandle {
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
  const maneMaterial = new MeshPhongMaterial({
    color: 0xd5a35f,
    flatShading: true,
    shininess: 5
  });
  const saddleMaterial = new MeshPhongMaterial({
    color: 0x3d2a20,
    flatShading: true
  });

  const body = new Mesh(new BoxGeometry(2.55, 0.78, 0.88), woodMaterial);
  body.name = "mount-horse-body";
  body.position.y = 1.35;

  const neck = new Mesh(new BoxGeometry(0.4, 1.02, 0.48), woodMaterial);
  neck.position.set(1.12, 1.82, 0);
  neck.rotation.z = -0.35;

  const head = new Mesh(new BoxGeometry(0.92, 0.58, 0.56), darkWoodMaterial);
  head.position.set(1.62, 2.16, 0);
  head.rotation.z = -0.12;

  const mane = new Mesh(new ConeGeometry(0.24, 0.72, 4), maneMaterial);
  mane.position.set(1.22, 2.28, 0);
  mane.rotation.z = Math.PI;

  const tail = new Mesh(new ConeGeometry(0.18, 0.95, 5), darkWoodMaterial);
  tail.position.set(-1.55, 1.42, 0);
  tail.rotation.z = Math.PI / 2;

  const legs = buildLegs(
    [
      { name: "front-left-leg", x: 0.88, z: 0.38, y: 0.68, length: 1.08, radiusTop: 0.11, radiusBottom: 0.15, baseRotation: 0.1 },
      { name: "front-right-leg", x: 0.88, z: -0.38, y: 0.68, length: 1.08, radiusTop: 0.11, radiusBottom: 0.15, baseRotation: -0.1 },
      { name: "back-left-leg", x: -0.88, z: 0.38, y: 0.68, length: 1.08, radiusTop: 0.11, radiusBottom: 0.15, baseRotation: -0.1 },
      { name: "back-right-leg", x: -0.88, z: -0.38, y: 0.68, length: 1.08, radiusTop: 0.11, radiusBottom: 0.15, baseRotation: 0.1 }
    ],
    darkWoodMaterial
  );

  const saddle = new Mesh(new BoxGeometry(0.82, 0.18, 0.88), saddleMaterial);
  saddle.position.set(0.05, 1.9, 0);

  const mount = new Group();
  mount.name = "mount-horse";
  mount.add(body, neck, head, mane, tail, ...legs, saddle);

  return {
    mount,
    legsByName: new Map(legs.map((leg) => [leg.name, leg])),
    saddleHeight: 1.99,
    saddleX: 0.05
  };
}

/** 黄牛：宽身、深棕、长角朝前。 */
function buildOx(): MountHandle {
  const hideMaterial = new MeshPhongMaterial({
    color: 0x6b4628,
    flatShading: true,
    shininess: 4
  });
  const darkHideMaterial = new MeshPhongMaterial({
    color: 0x4a2f1a,
    flatShading: true,
    shininess: 3
  });
  const hornMaterial = new MeshPhongMaterial({
    color: 0xe6dcc2,
    flatShading: true,
    shininess: 14
  });
  const saddleMaterial = new MeshPhongMaterial({
    color: 0x2d1f16,
    flatShading: true
  });

  // 牛身比马更宽更矮：长 2.45、高 0.92、宽 1.18
  const body = new Mesh(new BoxGeometry(2.45, 0.92, 1.18), hideMaterial);
  body.name = "mount-ox-body";
  body.position.y = 1.28;

  const hump = new Mesh(new BoxGeometry(0.6, 0.32, 1.0), hideMaterial);
  hump.position.set(0.45, 1.84, 0);

  const neck = new Mesh(new BoxGeometry(0.55, 0.7, 0.7), hideMaterial);
  neck.position.set(1.18, 1.68, 0);
  neck.rotation.z = -0.18;

  const head = new Mesh(new BoxGeometry(0.78, 0.62, 0.7), darkHideMaterial);
  head.position.set(1.58, 1.72, 0);

  // 长角：左右对称 cone，朝前微上挑
  const hornGeometry = new ConeGeometry(0.08, 0.7, 5);
  const hornLeft = new Mesh(hornGeometry, hornMaterial);
  hornLeft.position.set(1.7, 2.05, 0.32);
  hornLeft.rotation.set(0, 0, -0.5);
  const hornRight = new Mesh(hornGeometry, hornMaterial);
  hornRight.position.set(1.7, 2.05, -0.32);
  hornRight.rotation.set(0, 0, -0.5);

  const tail = new Mesh(new CylinderGeometry(0.06, 0.04, 0.85, 4), darkHideMaterial);
  tail.position.set(-1.4, 1.45, 0);
  tail.rotation.z = -0.6;
  const tailTip = new Mesh(new SphereGeometry(0.12, 6, 6), darkHideMaterial);
  tailTip.position.set(-1.7, 1.0, 0);

  // 牛腿短而粗
  const legs = buildLegs(
    [
      { name: "front-left-leg", x: 0.85, z: 0.5, y: 0.62, length: 1.1, radiusTop: 0.16, radiusBottom: 0.2, baseRotation: 0.08 },
      { name: "front-right-leg", x: 0.85, z: -0.5, y: 0.62, length: 1.1, radiusTop: 0.16, radiusBottom: 0.2, baseRotation: -0.08 },
      { name: "back-left-leg", x: -0.85, z: 0.5, y: 0.62, length: 1.1, radiusTop: 0.16, radiusBottom: 0.2, baseRotation: -0.08 },
      { name: "back-right-leg", x: -0.85, z: -0.5, y: 0.62, length: 1.1, radiusTop: 0.16, radiusBottom: 0.2, baseRotation: 0.08 }
    ],
    darkHideMaterial
  );

  const saddle = new Mesh(new BoxGeometry(0.95, 0.16, 1.05), saddleMaterial);
  saddle.position.set(-0.05, 1.84, 0);

  const mount = new Group();
  mount.name = "mount-ox";
  mount.add(body, hump, neck, head, hornLeft, hornRight, tail, tailTip, ...legs, saddle);

  return {
    mount,
    legsByName: new Map(legs.map((leg) => [leg.name, leg])),
    saddleHeight: 1.93,
    saddleX: -0.05
  };
}

/** 绵羊：矮身、米白、堆叠球体表现羊毛。 */
function buildSheep(): MountHandle {
  const woolMaterial = new MeshPhongMaterial({
    color: 0xf2ecdc,
    flatShading: true,
    shininess: 2
  });
  const skinMaterial = new MeshPhongMaterial({
    color: 0x3a2a22,
    flatShading: true,
    shininess: 3
  });
  const saddleMaterial = new MeshPhongMaterial({
    color: 0x6b3a22,
    flatShading: true
  });

  // 羊身：较矮（高 0.7）、用大球+小球堆叠"蓬松"感
  const bodyCore = new Mesh(new SphereGeometry(0.78, 10, 8), woolMaterial);
  bodyCore.name = "mount-sheep-body";
  bodyCore.position.set(0, 1.18, 0);
  bodyCore.scale.set(1.55, 0.95, 1.05);

  const woolPuffs: Mesh[] = [];
  const puffPositions: Array<[number, number, number, number]> = [
    [0.55, 1.52, 0.32, 0.32],
    [0.55, 1.52, -0.32, 0.32],
    [-0.55, 1.5, 0.32, 0.32],
    [-0.55, 1.5, -0.32, 0.32],
    [0.0, 1.62, 0.42, 0.34],
    [0.0, 1.62, -0.42, 0.34]
  ];
  puffPositions.forEach(([x, y, z, r]) => {
    const puff = new Mesh(new SphereGeometry(r, 8, 6), woolMaterial);
    puff.position.set(x, y, z);
    woolPuffs.push(puff);
  });

  const head = new Mesh(new SphereGeometry(0.32, 8, 8), skinMaterial);
  head.position.set(1.0, 1.4, 0);
  head.scale.set(1.2, 0.95, 0.9);

  // 小角朝后弯
  const hornGeometry = new ConeGeometry(0.05, 0.22, 5);
  const hornMaterial = new MeshPhongMaterial({
    color: 0xc9b890,
    flatShading: true,
    shininess: 10
  });
  const hornLeft = new Mesh(hornGeometry, hornMaterial);
  hornLeft.position.set(0.95, 1.6, 0.18);
  hornLeft.rotation.z = 0.6;
  const hornRight = new Mesh(hornGeometry, hornMaterial);
  hornRight.position.set(0.95, 1.6, -0.18);
  hornRight.rotation.z = 0.6;

  const tail = new Mesh(new SphereGeometry(0.16, 6, 6), woolMaterial);
  tail.position.set(-1.0, 1.32, 0);

  // 羊腿短细
  const legs = buildLegs(
    [
      { name: "front-left-leg", x: 0.6, z: 0.32, y: 0.52, length: 0.85, radiusTop: 0.07, radiusBottom: 0.09, baseRotation: 0.08 },
      { name: "front-right-leg", x: 0.6, z: -0.32, y: 0.52, length: 0.85, radiusTop: 0.07, radiusBottom: 0.09, baseRotation: -0.08 },
      { name: "back-left-leg", x: -0.6, z: 0.32, y: 0.52, length: 0.85, radiusTop: 0.07, radiusBottom: 0.09, baseRotation: -0.08 },
      { name: "back-right-leg", x: -0.6, z: -0.32, y: 0.52, length: 0.85, radiusTop: 0.07, radiusBottom: 0.09, baseRotation: 0.08 }
    ],
    skinMaterial
  );

  const saddle = new Mesh(new BoxGeometry(0.7, 0.12, 0.75), saddleMaterial);
  saddle.position.set(0.0, 1.78, 0);

  const mount = new Group();
  mount.name = "mount-sheep";
  mount.add(bodyCore, ...woolPuffs, head, hornLeft, hornRight, tail, ...legs, saddle);

  return {
    mount,
    legsByName: new Map(legs.map((leg) => [leg.name, leg])),
    saddleHeight: 1.84,
    saddleX: 0.0
  };
}

/** 毛驴：跟马类似但更小，灰色，长耳。 */
function buildDonkey(): MountHandle {
  const greyMaterial = new MeshPhongMaterial({
    color: 0x8a8478,
    flatShading: true,
    shininess: 5
  });
  const darkGreyMaterial = new MeshPhongMaterial({
    color: 0x5e584d,
    flatShading: true,
    shininess: 4
  });
  const noseMaterial = new MeshPhongMaterial({
    color: 0xece2cc,
    flatShading: true
  });
  const saddleMaterial = new MeshPhongMaterial({
    color: 0x3d2a20,
    flatShading: true
  });

  const body = new Mesh(new BoxGeometry(2.05, 0.7, 0.78), greyMaterial);
  body.name = "mount-donkey-body";
  body.position.y = 1.2;

  const neck = new Mesh(new BoxGeometry(0.36, 0.85, 0.42), greyMaterial);
  neck.position.set(0.92, 1.6, 0);
  neck.rotation.z = -0.32;

  const head = new Mesh(new BoxGeometry(0.78, 0.5, 0.48), darkGreyMaterial);
  head.position.set(1.32, 1.92, 0);
  head.rotation.z = -0.1;

  const muzzle = new Mesh(new BoxGeometry(0.32, 0.28, 0.36), noseMaterial);
  muzzle.position.set(1.62, 1.78, 0);

  // 长耳：两个细 cone 朝上
  const earGeometry = new ConeGeometry(0.08, 0.42, 4);
  const earLeft = new Mesh(earGeometry, darkGreyMaterial);
  earLeft.position.set(1.18, 2.22, 0.16);
  earLeft.rotation.z = 0.08;
  const earRight = new Mesh(earGeometry, darkGreyMaterial);
  earRight.position.set(1.18, 2.22, -0.16);
  earRight.rotation.z = 0.08;

  const tail = new Mesh(new CylinderGeometry(0.05, 0.03, 0.72, 4), darkGreyMaterial);
  tail.position.set(-1.18, 1.32, 0);
  tail.rotation.z = -0.7;

  const legs = buildLegs(
    [
      { name: "front-left-leg", x: 0.7, z: 0.32, y: 0.6, length: 0.95, radiusTop: 0.09, radiusBottom: 0.12, baseRotation: 0.1 },
      { name: "front-right-leg", x: 0.7, z: -0.32, y: 0.6, length: 0.95, radiusTop: 0.09, radiusBottom: 0.12, baseRotation: -0.1 },
      { name: "back-left-leg", x: -0.7, z: 0.32, y: 0.6, length: 0.95, radiusTop: 0.09, radiusBottom: 0.12, baseRotation: -0.1 },
      { name: "back-right-leg", x: -0.7, z: -0.32, y: 0.6, length: 0.95, radiusTop: 0.09, radiusBottom: 0.12, baseRotation: 0.1 }
    ],
    darkGreyMaterial
  );

  const saddle = new Mesh(new BoxGeometry(0.7, 0.16, 0.78), saddleMaterial);
  saddle.position.set(0.0, 1.66, 0);

  const mount = new Group();
  mount.name = "mount-donkey";
  mount.add(body, neck, head, muzzle, earLeft, earRight, tail, ...legs, saddle);

  return {
    mount,
    legsByName: new Map(legs.map((leg) => [leg.name, leg])),
    saddleHeight: 1.74,
    saddleX: 0.0
  };
}

/** 灵狐：极矮但夸张拉大 → 当成"灵兽"骑乘，玩家骑在背上。长尾、橙红、尖耳。 */
function buildFox(): MountHandle {
  const furMaterial = new MeshPhongMaterial({
    color: 0xc94d2a,
    flatShading: true,
    shininess: 6
  });
  const tipMaterial = new MeshPhongMaterial({
    color: 0xf6efe2,
    flatShading: true
  });
  const darkMaterial = new MeshPhongMaterial({
    color: 0x36241a,
    flatShading: true
  });
  const saddleMaterial = new MeshPhongMaterial({
    color: 0x2d1f16,
    flatShading: true
  });

  // 灵狐放大成可骑乘大小：身长 2.2, 高 0.78
  const body = new Mesh(new BoxGeometry(2.2, 0.78, 0.82), furMaterial);
  body.name = "mount-fox-body";
  body.position.y = 1.05;
  // 圆润感：把 body 的角通过 Y 轴轻微缩腰
  body.scale.y = 1.0;

  const chest = new Mesh(new SphereGeometry(0.45, 8, 6), tipMaterial);
  chest.position.set(0.5, 0.95, 0);
  chest.scale.set(1.3, 0.7, 0.9);

  const neck = new Mesh(new BoxGeometry(0.42, 0.6, 0.55), furMaterial);
  neck.position.set(0.95, 1.42, 0);
  neck.rotation.z = -0.3;

  const head = new Mesh(new BoxGeometry(0.7, 0.55, 0.62), furMaterial);
  head.position.set(1.4, 1.72, 0);

  const muzzle = new Mesh(new ConeGeometry(0.18, 0.4, 4), tipMaterial);
  muzzle.position.set(1.78, 1.62, 0);
  muzzle.rotation.z = -Math.PI / 2;

  // 尖耳：两个 triangle cone
  const earGeometry = new ConeGeometry(0.13, 0.32, 4);
  const earLeft = new Mesh(earGeometry, furMaterial);
  earLeft.position.set(1.32, 2.05, 0.22);
  const earRight = new Mesh(earGeometry, furMaterial);
  earRight.position.set(1.32, 2.05, -0.22);

  // 长尾：分两段，末端白尖
  const tailBase = new Mesh(new ConeGeometry(0.2, 1.0, 5), furMaterial);
  tailBase.position.set(-1.4, 1.3, 0);
  tailBase.rotation.set(0, 0, Math.PI / 2 + 0.4);
  const tailTip = new Mesh(new ConeGeometry(0.16, 0.5, 5), tipMaterial);
  tailTip.position.set(-1.95, 1.6, 0);
  tailTip.rotation.set(0, 0, Math.PI / 2 + 0.55);

  // 黑眼睛点缀
  const eyeGeometry = new SphereGeometry(0.04, 6, 6);
  const eyeLeft = new Mesh(eyeGeometry, darkMaterial);
  eyeLeft.position.set(1.62, 1.82, 0.18);
  const eyeRight = new Mesh(eyeGeometry, darkMaterial);
  eyeRight.position.set(1.62, 1.82, -0.18);

  // 狐狸腿短细
  const legs = buildLegs(
    [
      { name: "front-left-leg", x: 0.78, z: 0.3, y: 0.45, length: 0.7, radiusTop: 0.08, radiusBottom: 0.1, baseRotation: 0.08 },
      { name: "front-right-leg", x: 0.78, z: -0.3, y: 0.45, length: 0.7, radiusTop: 0.08, radiusBottom: 0.1, baseRotation: -0.08 },
      { name: "back-left-leg", x: -0.78, z: 0.3, y: 0.45, length: 0.7, radiusTop: 0.08, radiusBottom: 0.1, baseRotation: -0.08 },
      { name: "back-right-leg", x: -0.78, z: -0.3, y: 0.45, length: 0.7, radiusTop: 0.08, radiusBottom: 0.1, baseRotation: 0.08 }
    ],
    darkMaterial
  );

  // 狐狸偏矮，鞍 / 骑手坐稍低
  const saddle = new Mesh(new BoxGeometry(0.7, 0.12, 0.7), saddleMaterial);
  saddle.position.set(-0.05, 1.5, 0);

  const mount = new Group();
  mount.name = "mount-fox";
  mount.add(
    body,
    chest,
    neck,
    head,
    muzzle,
    earLeft,
    earRight,
    tailBase,
    tailTip,
    eyeLeft,
    eyeRight,
    ...legs,
    saddle
  );

  return {
    mount,
    legsByName: new Map(legs.map((leg) => [leg.name, leg])),
    saddleHeight: 1.58,
    saddleX: -0.05
  };
}

const MOUNT_BUILDERS: Record<MountId, () => MountHandle> = {
  horse: buildHorse,
  ox: buildOx,
  sheep: buildSheep,
  donkey: buildDonkey,
  fox: buildFox
};

export function createMount(id: MountId): MountHandle {
  const builder = MOUNT_BUILDERS[id];
  if (!builder) {
    throw new Error(`Unknown mount id: ${id}`);
  }
  return builder();
}
