import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshPhongMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector3
} from "three";
import {
  buildCloudMountGeometry,
  CLOUD_MOUNT_COLOR
} from "./mounts/mountCloud.js";

/**
 * 10 种坐骑（mount，含步行模式）。
 *
 * 设计目标：
 * - 都用 low-poly Three primitives，零外部 asset
 * - 优先复用 "front-left-leg" 等命名，让 main loop 继续走通用 leg pose
 * - 每种 mount 暴露 saddleHeight + saddleX，让骑手坐稳在背上中央
 * - 整体尺寸跟原木马接近（背高 ~1.85m），方便骑手位置兼容
 */

export type MountId =
  | "none"
  | "horse"
  | "ox"
  | "sheep"
  | "donkey"
  | "fox"
  | "pig"
  | "cloud"
  | "chicken"
  | "boar";

export interface MountDefinition {
  id: MountId;
  /** 中文显示名（UI 上展示） */
  name: string;
  /** 简短副标题，显示在选项卡片下方 */
  description: string;
}

export const MOUNT_DEFINITIONS: MountDefinition[] = [
  { id: "none", name: "步行", description: "脱去坐骑，慢步山河。" },
  { id: "horse", name: "木马", description: "经典枣红木马，平稳。" },
  { id: "ox", name: "黄牛", description: "宽身长角，沉稳跋涉。" },
  { id: "sheep", name: "绵羊", description: "蓬松米白，山道灵巧。" },
  { id: "donkey", name: "毛驴", description: "灰身长耳，轻便代步。" },
  { id: "fox", name: "灵狐", description: "橙红长尾，山林灵兽。" },
  { id: "pig", name: "家猪", description: "粉灰肉色，乡土田园伙伴。" },
  { id: "cloud", name: "筋斗云", description: "祥云悬空，腾云疾行。" },
  { id: "chicken", name: "灵鸡", description: "双足金羽，骑感独特。" },
  { id: "boar", name: "野猪", description: "獠牙竖耳，山林彪悍。" }
];

export interface MountHandle {
  mount: Group;
  /**
   * 动画腿引用，按 name 索引。优先复用 woodHorseLegPose 输出的 key:
   * "front-left-leg" / "front-right-leg" / "back-left-leg" / "back-right-leg"。
   * 鸡只暴露两条腿，因此 size=2。
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
  // 腿 geometry 不复用——不同 mount 的腿粗细/长度都不一样，单独建更简单。
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

function buildNoMount(): MountHandle {
  return {
    mount: new Group(),
    legsByName: new Map(),
    saddleHeight: 0,
    saddleX: 0
  };
}

function buildBirdLegs(specs: LegSpec[], material: MeshPhongMaterial): Mesh[] {
  const toeGeometry = new BoxGeometry(0.11, 0.03, 0.03);
  return specs.map((spec) => {
    const leg = new Mesh(
      new CylinderGeometry(
        spec.radiusTop,
        spec.radiusBottom,
        spec.length,
        5
      ),
      material
    );
    leg.name = spec.name;
    leg.position.set(spec.x, spec.y, spec.z);
    leg.rotation.z = spec.baseRotation;

    const toeOffsets: Array<[number, number, number, number]> = [
      [0.06, -spec.length * 0.5 + 0.01, 0, 0],
      [0.05, -spec.length * 0.5 + 0.01, 0.05, 0.24],
      [0.05, -spec.length * 0.5 + 0.01, -0.05, -0.24]
    ];
    toeOffsets.forEach(([x, y, z, rotationY]) => {
      const toe = new Mesh(toeGeometry, material);
      toe.position.set(x, y, z);
      toe.rotation.y = rotationY;
      leg.add(toe);
    });

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

/** 灵狐：细长短腿，鞍位比大坐骑低一档，但仍保持可骑乘。 */
export function buildFox(): MountHandle {
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

  // 狐身改成更细长苗条，避免比马/驴还粗壮。
  const body = new Mesh(new BoxGeometry(1.7, 0.55, 0.55), furMaterial);
  body.name = "mount-fox-body";
  body.position.y = 0.78;

  const chest = new Mesh(new SphereGeometry(0.34, 8, 6), tipMaterial);
  chest.position.set(0.42, 0.72, 0);
  chest.scale.set(1.18, 0.62, 0.82);

  const neck = new Mesh(new BoxGeometry(0.32, 0.46, 0.42), furMaterial);
  neck.position.set(0.75, 1.05, 0);
  neck.rotation.z = -0.3;

  const head = new Mesh(new BoxGeometry(0.54, 0.42, 0.46), furMaterial);
  head.position.set(1.08, 1.28, 0);

  const muzzle = new Mesh(new ConeGeometry(0.14, 0.3, 4), tipMaterial);
  muzzle.position.set(1.37, 1.2, 0);
  muzzle.rotation.z = -Math.PI / 2;

  // 尖耳：两个 triangle cone
  const earGeometry = new ConeGeometry(0.1, 0.24, 4);
  const earLeft = new Mesh(earGeometry, furMaterial);
  earLeft.position.set(1.02, 1.52, 0.16);
  const earRight = new Mesh(earGeometry, furMaterial);
  earRight.position.set(1.02, 1.52, -0.16);

  // 长尾：先算橙尾尖端，再反推白尖中心，确保两段在几何上首尾相接。
  const tailBaseHeight = 0.78;
  const tailBaseTilt = 0.4;
  const tailBaseRotation = Math.PI / 2 + tailBaseTilt;
  const tailBasePosition = new Vector3(-1.08, 0.97, 0);
  const tailBaseDirection = new Vector3(
    -Math.cos(tailBaseTilt),
    -Math.sin(tailBaseTilt),
    0
  );
  const tailBaseTipPosition = tailBasePosition
    .clone()
    .add(tailBaseDirection.clone().multiplyScalar(tailBaseHeight * 0.5));

  const tailBase = new Mesh(new ConeGeometry(0.15, tailBaseHeight, 5), furMaterial);
  tailBase.name = "mount-fox-tail-base";
  tailBase.position.copy(tailBasePosition);
  tailBase.rotation.set(0, 0, tailBaseRotation);

  const tailTipHeight = 0.39;
  const tailTipBend = 0.1;
  const tailTipRotation = tailBaseRotation + tailTipBend;
  const tailTipDirection = new Vector3(
    -Math.cos(tailBaseTilt + tailTipBend),
    -Math.sin(tailBaseTilt + tailTipBend),
    0
  );
  const tailTipPosition = tailBaseTipPosition
    .clone()
    .add(tailTipDirection.clone().multiplyScalar(tailTipHeight * 0.5));

  const tailTip = new Mesh(new ConeGeometry(0.12, tailTipHeight, 5), tipMaterial);
  tailTip.name = "mount-fox-tail-tip";
  tailTip.position.copy(tailTipPosition);
  tailTip.rotation.set(0, 0, tailTipRotation);

  // 黑眼睛点缀
  const eyeGeometry = new SphereGeometry(0.03, 6, 6);
  const eyeLeft = new Mesh(eyeGeometry, darkMaterial);
  eyeLeft.position.set(1.24, 1.31, 0.13);
  const eyeRight = new Mesh(eyeGeometry, darkMaterial);
  eyeRight.position.set(1.24, 1.31, -0.13);

  // 狐狸腿短细
  const legs = buildLegs(
    [
      { name: "front-left-leg", x: 0.6, z: 0.22, y: 0.28, length: 0.55, radiusTop: 0.06, radiusBottom: 0.07, baseRotation: 0.08 },
      { name: "front-right-leg", x: 0.6, z: -0.22, y: 0.28, length: 0.55, radiusTop: 0.06, radiusBottom: 0.07, baseRotation: -0.08 },
      { name: "back-left-leg", x: -0.6, z: 0.22, y: 0.28, length: 0.55, radiusTop: 0.06, radiusBottom: 0.07, baseRotation: -0.08 },
      { name: "back-right-leg", x: -0.6, z: -0.22, y: 0.28, length: 0.55, radiusTop: 0.06, radiusBottom: 0.07, baseRotation: 0.08 }
    ],
    darkMaterial
  );

  // 狐狸偏矮，鞍随 body 同步下调，避免骑手悬空。
  const saddle = new Mesh(new BoxGeometry(0.54, 0.1, 0.54), saddleMaterial);
  saddle.position.set(-0.04, 1.18, 0);

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
    saddleHeight: 1.25,
    saddleX: -0.04
  };
}

function buildPig(): MountHandle {
  const furMaterial = new MeshPhongMaterial({
    color: 0xc89c8c,
    flatShading: true,
    shininess: 4
  });
  const bellyMaterial = new MeshPhongMaterial({
    color: 0xd2a99a,
    flatShading: true,
    shininess: 3
  });
  const snoutMaterial = new MeshPhongMaterial({
    color: 0xb5887e,
    flatShading: true,
    shininess: 5
  });
  const darkMaterial = new MeshPhongMaterial({
    color: 0x1a1410,
    flatShading: true
  });
  const saddleMaterial = new MeshPhongMaterial({
    color: 0x4a3528,
    flatShading: true
  });

  const body = new Mesh(new BoxGeometry(1.5, 0.5, 0.6), furMaterial);
  body.name = "mount-pig-body";
  body.position.y = 0.55;

  const chest = new Mesh(new SphereGeometry(0.4, 8, 6), bellyMaterial);
  chest.position.set(0.32, 0.5, 0);
  chest.scale.set(1.2, 0.7, 1.0);

  const head = new Mesh(new BoxGeometry(0.42, 0.36, 0.42), furMaterial);
  head.position.set(0.85, 0.85, 0);

  const snout = new Mesh(new CylinderGeometry(0.13, 0.15, 0.18, 8), snoutMaterial);
  snout.position.set(1.1, 0.78, 0);
  snout.rotation.z = Math.PI / 2;

  const earGeometry = new BoxGeometry(0.15, 0.2, 0.05);
  const earLeft = new Mesh(earGeometry, furMaterial);
  earLeft.position.set(0.78, 1.0, 0.2);
  earLeft.rotation.set(0.6, 0, 0.52);
  const earRight = new Mesh(earGeometry, furMaterial);
  earRight.position.set(0.78, 1.0, -0.2);
  earRight.rotation.set(0.6, 0, -0.52);

  const eyeGeometry = new SphereGeometry(0.04, 6, 6);
  const eyeLeft = new Mesh(eyeGeometry, darkMaterial);
  eyeLeft.position.set(0.99, 0.88, 0.14);
  const eyeRight = new Mesh(eyeGeometry, darkMaterial);
  eyeRight.position.set(0.99, 0.88, -0.14);

  const tail = new Mesh(
    new TorusGeometry(0.12, 0.04, 8, 16, Math.PI * 1.5),
    furMaterial
  );
  tail.position.set(-0.85, 0.65, 0);
  tail.rotation.z = -Math.PI / 2;

  const legs = buildLegs(
    [
      { name: "front-left-leg", x: 0.45, z: 0.18, y: 0.225, length: 0.45, radiusTop: 0.1, radiusBottom: 0.12, baseRotation: 0.06 },
      { name: "front-right-leg", x: 0.45, z: -0.18, y: 0.225, length: 0.45, radiusTop: 0.1, radiusBottom: 0.12, baseRotation: -0.06 },
      { name: "back-left-leg", x: -0.45, z: 0.18, y: 0.225, length: 0.45, radiusTop: 0.1, radiusBottom: 0.12, baseRotation: -0.06 },
      { name: "back-right-leg", x: -0.45, z: -0.18, y: 0.225, length: 0.45, radiusTop: 0.1, radiusBottom: 0.12, baseRotation: 0.06 }
    ],
    darkMaterial
  );

  const saddle = new Mesh(new BoxGeometry(0.5, 0.1, 0.5), saddleMaterial);
  saddle.position.set(-0.05, 0.85, 0);

  const mount = new Group();
  mount.name = "mount-pig";
  mount.add(
    body,
    chest,
    head,
    snout,
    earLeft,
    earRight,
    eyeLeft,
    eyeRight,
    tail,
    ...legs,
    saddle
  );

  return {
    mount,
    legsByName: new Map(legs.map((leg) => [leg.name, leg])),
    saddleHeight: 0.92,
    saddleX: -0.05
  };
}

function buildBoar(): MountHandle {
  const furMaterial = new MeshPhongMaterial({
    color: 0x4a3526,
    flatShading: true,
    shininess: 5
  });
  const bellyMaterial = new MeshPhongMaterial({
    color: 0x6a4a35,
    flatShading: true
  });
  const accentMaterial = new MeshPhongMaterial({
    color: 0x2c1f15,
    flatShading: true
  });
  const tuskMaterial = new MeshPhongMaterial({
    color: 0xe8e4d5,
    flatShading: true,
    shininess: 25
  });
  const darkMaterial = new MeshPhongMaterial({
    color: 0x140a05,
    flatShading: true
  });
  const saddleMaterial = new MeshPhongMaterial({
    color: 0x4a3528,
    flatShading: true
  });

  // 野猪保持同级坐骑体量，但更修长、前肩更强壮。
  const body = new Mesh(new BoxGeometry(1.55, 0.55, 0.55), furMaterial);
  body.name = "mount-boar-body";
  body.position.y = 0.6;

  const shoulder = new Mesh(new SphereGeometry(0.42, 8, 6), furMaterial);
  shoulder.position.set(0.45, 0.7, 0);
  shoulder.scale.set(1.3, 1.1, 1.05);

  const belly = new Mesh(new SphereGeometry(0.34, 8, 6), bellyMaterial);
  belly.position.set(-0.15, 0.45, 0);
  belly.scale.set(1.4, 0.7, 0.95);

  const head = new Mesh(new BoxGeometry(0.45, 0.34, 0.42), furMaterial);
  head.position.set(0.92, 0.78, 0);

  const snout = new Mesh(new CylinderGeometry(0.13, 0.16, 0.28, 8), accentMaterial);
  snout.rotation.z = Math.PI / 2;
  snout.position.set(1.22, 0.72, 0);

  const tuskGeometry = new ConeGeometry(0.028, 0.12, 4);
  const tuskLeft = new Mesh(tuskGeometry, tuskMaterial);
  tuskLeft.name = "mount-boar-tusk-left";
  tuskLeft.position.set(1.2, 0.75, 0.1);
  tuskLeft.rotation.set(0, 0, Math.PI / 2 - 0.5);
  const tuskRight = new Mesh(tuskGeometry, tuskMaterial);
  tuskRight.name = "mount-boar-tusk-right";
  tuskRight.position.set(1.2, 0.75, -0.1);
  tuskRight.rotation.set(0, 0, Math.PI / 2 - 0.5);

  const earGeometry = new ConeGeometry(0.08, 0.2, 4);
  const earLeft = new Mesh(earGeometry, furMaterial);
  earLeft.position.set(0.78, 1.05, 0.16);
  const earRight = new Mesh(earGeometry, furMaterial);
  earRight.position.set(0.78, 1.05, -0.16);

  const bristleSpine: Mesh[] = [];
  for (let i = 0; i < 6; i += 1) {
    const t = i / 5;
    const bristle = new Mesh(new ConeGeometry(0.04, 0.18, 4), accentMaterial);
    bristle.name = `mount-boar-bristle-${i + 1}`;
    bristle.position.set(0.55 - t * 1.1, 0.92 - t * 0.05, 0);
    bristleSpine.push(bristle);
  }

  const eyeGeometry = new SphereGeometry(0.04, 6, 6);
  const eyeLeft = new Mesh(eyeGeometry, darkMaterial);
  eyeLeft.position.set(1.05, 0.86, 0.16);
  const eyeRight = new Mesh(eyeGeometry, darkMaterial);
  eyeRight.position.set(1.05, 0.86, -0.16);

  const tail = new Mesh(new BoxGeometry(0.05, 0.08, 0.05), accentMaterial);
  tail.position.set(-0.85, 0.55, 0);
  const tailTip = new Mesh(new ConeGeometry(0.06, 0.1, 5), accentMaterial);
  tailTip.position.set(-0.85, 0.45, 0);
  tailTip.rotation.x = Math.PI;

  const legs = buildLegs(
    [
      { name: "front-left-leg", x: 0.55, z: 0.18, y: 0.27, length: 0.55, radiusTop: 0.1, radiusBottom: 0.12, baseRotation: 0.06 },
      { name: "front-right-leg", x: 0.55, z: -0.18, y: 0.27, length: 0.55, radiusTop: 0.1, radiusBottom: 0.12, baseRotation: -0.06 },
      { name: "back-left-leg", x: -0.55, z: 0.18, y: 0.27, length: 0.55, radiusTop: 0.1, radiusBottom: 0.12, baseRotation: -0.06 },
      { name: "back-right-leg", x: -0.55, z: -0.18, y: 0.27, length: 0.55, radiusTop: 0.1, radiusBottom: 0.12, baseRotation: 0.06 }
    ],
    darkMaterial
  );

  const saddle = new Mesh(new BoxGeometry(0.5, 0.1, 0.5), saddleMaterial);
  saddle.position.set(-0.05, 0.95, 0);

  const mount = new Group();
  mount.name = "mount-boar";
  mount.add(
    body,
    shoulder,
    belly,
    head,
    snout,
    tuskLeft,
    tuskRight,
    earLeft,
    earRight,
    ...bristleSpine,
    eyeLeft,
    eyeRight,
    tail,
    tailTip,
    ...legs,
    saddle
  );

  return {
    mount,
    legsByName: new Map(legs.map((leg) => [leg.name, leg])),
    saddleHeight: 1.02,
    saddleX: -0.05
  };
}

function buildCloud(): MountHandle {
  const cloudMaterial = new MeshPhongMaterial({
    color: CLOUD_MOUNT_COLOR,
    emissive: 0xb8b2cd,
    emissiveIntensity: 0.72,
    flatShading: true,
    shininess: 12
  });
  const swirlMaterial = new MeshPhongMaterial({
    color: 0xf6f0fb,
    emissive: 0xc5bed8,
    emissiveIntensity: 0.55,
    flatShading: true,
    shininess: 18
  });

  const body = new Mesh(buildCloudMountGeometry(), cloudMaterial);
  body.name = "mount-cloud-body";
  body.position.y = 0.68;

  const swirlLeft = new Mesh(new BoxGeometry(0.22, 0.06, 0.18), swirlMaterial);
  swirlLeft.position.set(0.18, 1.0, 0.2);
  swirlLeft.rotation.z = 0.28;
  const swirlCenter = new Mesh(new BoxGeometry(0.26, 0.06, 0.2), swirlMaterial);
  swirlCenter.position.set(0.0, 1.05, 0.0);
  const swirlRight = new Mesh(new BoxGeometry(0.22, 0.06, 0.18), swirlMaterial);
  swirlRight.position.set(-0.16, 0.99, -0.18);
  swirlRight.rotation.z = -0.22;

  const mount = new Group();
  mount.name = "mount-cloud";
  mount.add(body, swirlLeft, swirlCenter, swirlRight);

  return {
    mount,
    legsByName: new Map(),
    saddleHeight: 1.02,
    saddleX: 0
  };
}

function buildChicken(): MountHandle {
  const featherMaterial = new MeshPhongMaterial({
    color: 0xc04935,
    flatShading: true,
    shininess: 4
  });
  const altFeatherMaterial = new MeshPhongMaterial({
    color: 0xe8d4a8,
    flatShading: true,
    shininess: 3
  });
  const combMaterial = new MeshPhongMaterial({
    color: 0xc41a1a,
    flatShading: true
  });
  const beakMaterial = new MeshPhongMaterial({
    color: 0xe5b54a,
    flatShading: true
  });
  const legMaterial = new MeshPhongMaterial({
    color: 0xd9a64a,
    flatShading: true
  });
  const darkMaterial = new MeshPhongMaterial({
    color: 0x140e08,
    flatShading: true
  });
  const saddleMaterial = new MeshPhongMaterial({
    color: 0x4a3528,
    flatShading: true
  });

  const body = new Mesh(new SphereGeometry(0.32, 8, 6), featherMaterial);
  body.name = "mount-chicken-body";
  body.position.set(0, 0.55, 0);
  body.scale.set(1.0, 0.9, 0.85);

  const neck = new Mesh(new SphereGeometry(0.16, 8, 6), altFeatherMaterial);
  neck.position.set(0.08, 0.74, 0);
  neck.scale.set(0.9, 1.0, 0.8);

  const head = new Mesh(new SphereGeometry(0.18, 8, 6), altFeatherMaterial);
  head.position.set(0.2, 0.92, 0);

  const combGeometry = new ConeGeometry(0.06, 0.16, 4);
  const combLeft = new Mesh(combGeometry, combMaterial);
  combLeft.position.set(0.14, 1.07, 0);
  combLeft.rotation.z = 0.12;
  const combMiddle = new Mesh(combGeometry, combMaterial);
  combMiddle.position.set(0.2, 1.12, 0);
  const combRight = new Mesh(combGeometry, combMaterial);
  combRight.position.set(0.26, 1.07, 0);
  combRight.rotation.z = -0.12;

  const wattle = new Mesh(new SphereGeometry(0.05, 6, 6), combMaterial);
  wattle.position.set(0.32, 0.78, 0);

  const beak = new Mesh(new ConeGeometry(0.05, 0.12, 4), beakMaterial);
  beak.position.set(0.36, 0.88, 0);
  beak.rotation.z = -Math.PI / 2;

  const eyeGeometry = new SphereGeometry(0.025, 6, 6);
  const eyeLeft = new Mesh(eyeGeometry, darkMaterial);
  eyeLeft.position.set(0.3, 0.96, 0.07);
  const eyeRight = new Mesh(eyeGeometry, darkMaterial);
  eyeRight.position.set(0.3, 0.96, -0.07);

  const wingGeometry = new BoxGeometry(0.3, 0.04, 0.18);
  const wingLeft = new Mesh(wingGeometry, altFeatherMaterial);
  wingLeft.position.set(0.0, 0.6, 0.3);
  wingLeft.rotation.z = 0.15;
  const wingRight = new Mesh(wingGeometry, altFeatherMaterial);
  wingRight.position.set(0.0, 0.6, -0.3);
  wingRight.rotation.z = -0.15;

  const tailCenter = new Mesh(new BoxGeometry(0.1, 0.32, 0.08), featherMaterial);
  tailCenter.position.set(-0.32, 0.82, 0);
  const tailLeft = new Mesh(new BoxGeometry(0.1, 0.32, 0.08), darkMaterial);
  tailLeft.position.set(-0.32, 0.78, 0.08);
  tailLeft.rotation.z = 0.44;
  const tailRight = new Mesh(new BoxGeometry(0.1, 0.32, 0.08), darkMaterial);
  tailRight.position.set(-0.32, 0.78, -0.08);
  tailRight.rotation.z = -0.44;

  const legs = buildBirdLegs(
    [
      { name: "front-left-leg", x: 0.0, z: 0.13, y: 0.18, length: 0.36, radiusTop: 0.04, radiusBottom: 0.05, baseRotation: 0.08 },
      { name: "front-right-leg", x: 0.0, z: -0.13, y: 0.18, length: 0.36, radiusTop: 0.04, radiusBottom: 0.05, baseRotation: -0.08 }
    ],
    legMaterial
  );

  const saddle = new Mesh(new BoxGeometry(0.32, 0.06, 0.32), saddleMaterial);
  saddle.position.set(0, 0.78, 0);

  const mount = new Group();
  mount.name = "mount-chicken";
  mount.add(
    body,
    neck,
    head,
    combLeft,
    combMiddle,
    combRight,
    wattle,
    beak,
    eyeLeft,
    eyeRight,
    wingLeft,
    wingRight,
    tailCenter,
    tailLeft,
    tailRight,
    ...legs,
    saddle
  );

  return {
    mount,
    legsByName: new Map(legs.map((leg) => [leg.name, leg])),
    saddleHeight: 0.85,
    saddleX: 0
  };
}

const MOUNT_BUILDERS: Record<MountId, () => MountHandle> = {
  none: buildNoMount,
  horse: buildHorse,
  ox: buildOx,
  sheep: buildSheep,
  donkey: buildDonkey,
  fox: buildFox,
  pig: buildPig,
  cloud: buildCloud,
  chicken: buildChicken,
  boar: buildBoar
};

export function createMount(id: MountId): MountHandle {
  const builder = MOUNT_BUILDERS[id];
  if (!builder) {
    throw new Error(`Unknown mount id: ${id}`);
  }
  return builder();
}
