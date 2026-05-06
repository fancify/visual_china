import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshPhongMaterial,
  ConeGeometry,
  SphereGeometry
} from "three";

/**
 * 6 种骑手 avatar（含 default = 旧 wood-horse rider）。
 *
 * avatar 局部坐标系：以 saddle 顶面为 y=0，朝向 +X 方向（跟 mount 一致）。
 * main.ts 把 avatar group 整体放到 mount.saddleHeight + saddleX 上方即可。
 *
 * 每个 avatar 高 ~1.5–1.7m（含帽子），半径 ~0.4m，避免穿模到坐骑两侧。
 */

export type AvatarId =
  | "default"
  | "wenren"
  | "wujiang"
  | "youxia"
  | "nongfu"
  | "monk";

export interface AvatarDefinition {
  id: AvatarId;
  name: string;
  description: string;
}

export const AVATAR_DEFINITIONS: AvatarDefinition[] = [
  { id: "default", name: "原游侠", description: "斗笠 + 红袍，旅程之始的形象。" },
  { id: "wenren", name: "文人", description: "灰蓝长袍 + 幞头，简洁文士形象。" },
  { id: "wujiang", name: "武将", description: "红袍方甲 + 兜鍪，腰悬利剑。" },
  { id: "youxia", name: "游侠", description: "深褐短打 + 斗笠，轻装行路。" },
  { id: "nongfu", name: "农夫", description: "浅黄短衣 + 草帽，朴素田家打扮。" },
  { id: "monk", name: "僧人", description: "杏黄僧袍 + 光头 + 颈挂佛珠。" }
];

export interface AvatarHandle {
  avatar: Group;
}

interface BodyMaterials {
  /** 头/手肤色 */
  skin: MeshPhongMaterial;
  /** 身上主色（袍/衣） */
  garment: MeshPhongMaterial;
  /** 头饰 / 帽 */
  hat: MeshPhongMaterial;
  /** 配饰（腰带/包/兵器把柄） */
  accent: MeshPhongMaterial;
}

const sharedSkinHex = 0xe2ceb0;
const eyeMaterial = new MeshPhongMaterial({ color: 0x141414, shininess: 80 });
// 眼睛 r 0.06 → 0.025："就两个小点"，避免大球眼睛诡异感。
// 眼珠：往大调一档（0.025 → 0.045）+ 推到头表面（X 0.20 → 0.30）才能看见。
const eyeGeometry = new SphereGeometry(0.045, 6, 6);

/** 把眼睛安在 head sphere 前方表面（+X 朝向）。
 * head 在 (0.05, headY, 0) 半径 0.30 → 前表面 X ≈ 0.32。眼珠 X=0.30 让它"露出"
 * 头表面而不是埋在球里。Z ±0.10 给眼距，Y headY-0.04 略低于眼正中（更像看
 * 前方稍下）。 */
function addEyes(target: Group, headY: number): void {
  const left = new Mesh(eyeGeometry, eyeMaterial);
  left.name = "avatar-eye-left";
  left.position.set(0.30, headY - 0.04, 0.1);
  const right = new Mesh(eyeGeometry, eyeMaterial);
  right.name = "avatar-eye-right";
  right.position.set(0.30, headY - 0.04, -0.1);
  target.add(left, right);
}

/** 通用躯干（骑姿）：头 + 上身 + 大腿（坐姿弯曲）。返回 group + 头部 Y 高度。 */
function buildSeatedTorso(
  materials: BodyMaterials,
  options: { torsoSize?: [number, number, number]; thighThickness?: number } = {}
): { group: Group; headY: number } {
  const group = new Group();

  // 反馈循环：先太粗（0.55×0.42）→ 太细（0.34×0.22）→ 现在中间值。
  // width 0.42（窄但不瘦），depth 0.28（前后明显薄于宽）。
  // thighThickness 0.10 保留（腿能看出两根）。
  const torsoSize = options.torsoSize ?? [0.42, 0.46, 0.28];
  const thighThickness = options.thighThickness ?? 0.11;
  const torsoCenterY = 0.62;
  const headY = 1.1;

  // 躯干：略前倾（往 +X）以贴合"骑马含腰"姿势
  const torso = new Mesh(
    new BoxGeometry(torsoSize[0], torsoSize[1], torsoSize[2]),
    materials.garment
  );
  torso.name = "avatar-torso";
  torso.position.set(0.0, torsoCenterY, 0);
  torso.rotation.z = -0.08;
  group.add(torso);

  // 肩头球已移除：用户反馈"不用加，胳膊直接接到身上"。手臂根部下移到 torso
  // 中部位置，足够视觉接住，不需要额外几何过渡。

  // 大腿：分腿坐在鞍两侧，微前弯
  const thighGeometry = new CylinderGeometry(thighThickness, thighThickness, 0.55, 5);
  const thighLeft = new Mesh(thighGeometry, materials.garment);
  thighLeft.name = "avatar-thigh-left";
  thighLeft.position.set(0.18, 0.18, 0.22);
  thighLeft.rotation.set(0, 0, Math.PI / 2 - 0.2);
  const thighRight = new Mesh(thighGeometry, materials.garment);
  thighRight.name = "avatar-thigh-right";
  thighRight.position.set(0.18, 0.18, -0.22);
  thighRight.rotation.set(0, 0, Math.PI / 2 - 0.2);
  group.add(thighLeft, thighRight);

  // 手臂：双手前伸（握缰）
  const armGeometry = new CylinderGeometry(0.07, 0.08, 0.5, 5);
  const armLeft = new Mesh(armGeometry, materials.garment);
  armLeft.name = "avatar-arm-left";
  // 胳膊位置三轮迭代：0.62 → 0.55 → 0.45 → 0.32。
  // 用户反馈"肩膀不要超过躯干最高处" — torso 顶 ≈ 0.85，position.y 0.32 后
  // arm cylinder 上端最高点 ≈ 0.32 + 0.12 = 0.44，远低于 torso 顶。
  // rotation 也调到 π/2 - 0.7（更斜往下），让 arm 自然 hang 而不是前伸。
  armLeft.position.set(0.22, 0.32, 0.22);
  armLeft.rotation.set(0, 0, Math.PI / 2 - 0.7);
  const armRight = new Mesh(armGeometry, materials.garment);
  armRight.name = "avatar-arm-right";
  armRight.position.set(0.22, 0.32, -0.22);
  armRight.rotation.set(0, 0, Math.PI / 2 - 0.7);
  group.add(armLeft, armRight);

  const neck = new Mesh(new CylinderGeometry(0.1, 0.12, 0.09, 6), materials.skin);
  neck.name = "avatar-neck";
  neck.position.set(0.04, 0.845, 0);
  group.add(neck);

  // 头球
  // 头 r 0.22 → 0.30："头可以再大一点"，跟新窄身躯比例更协调（chibi 风）。
  const head = new Mesh(new SphereGeometry(0.30, 12, 12), materials.skin);
  head.name = "avatar-head";
  head.position.set(0.05, headY, 0);
  group.add(head);

  addEyes(group, headY);

  return { group, headY };
}

/** 默认 avatar：保留旧的"斗笠 + 红袍 + 圆头"骑手观感。 */
function buildDefaultAvatar(): AvatarHandle {
  const materials: BodyMaterials = {
    skin: new MeshPhongMaterial({ color: sharedSkinHex, flatShading: true }),
    garment: new MeshPhongMaterial({
      color: 0xb85b3d,
      flatShading: true,
      shininess: 8
    }),
    hat: new MeshPhongMaterial({
      color: 0xc89968,
      flatShading: true,
      shininess: 4
    }),
    accent: new MeshPhongMaterial({ color: 0x3d2a20, flatShading: true })
  };

  const { group, headY } = buildSeatedTorso(materials);

  // 直筒外袍：压到膝盖位置，避免旧版披风外扩成裙摆。
  const robe = new Mesh(new CylinderGeometry(0.22, 0.22, 0.58, 8), materials.garment);
  robe.position.set(0.02, 0.31, 0);
  group.add(robe);

  // 斗笠
  const douli = new Mesh(new ConeGeometry(0.5, 0.2, 12), materials.hat);
  douli.position.set(0.05, headY + 0.24, 0);
  group.add(douli);

  return { avatar: group };
}

/** 文人：长袍灰蓝 + 幞头 */
function buildWenrenAvatar(): AvatarHandle {
  const materials: BodyMaterials = {
    skin: new MeshPhongMaterial({ color: sharedSkinHex, flatShading: true }),
    garment: new MeshPhongMaterial({
      color: 0x4a5e72,
      flatShading: true,
      shininess: 6
    }),
    hat: new MeshPhongMaterial({
      color: 0x1f2a36,
      flatShading: true,
      shininess: 8
    }),
    accent: new MeshPhongMaterial({ color: 0xc6a368, flatShading: true })
  };

  const { group, headY } = buildSeatedTorso(materials, { torsoSize: [0.44, 0.48, 0.30] });

  // 长袍直上直下，到膝盖附近即可。
  const robe = new Mesh(new CylinderGeometry(0.23, 0.23, 0.62, 8), materials.garment);
  robe.position.set(0.04, 0.31, 0);
  group.add(robe);

  // 幞头：只保留方帽主形，去掉细小帽带。
  const cap = new Mesh(new BoxGeometry(0.42, 0.22, 0.4), materials.hat);
  cap.position.set(0.0, headY + 0.2, 0);
  group.add(cap);

  return { avatar: group };
}

/** 武将：红袍 + 方甲 + 头盔 + 腰悬剑 */
function buildWujiangAvatar(): AvatarHandle {
  const materials: BodyMaterials = {
    skin: new MeshPhongMaterial({ color: sharedSkinHex, flatShading: true }),
    garment: new MeshPhongMaterial({
      color: 0x8a2424,
      flatShading: true,
      shininess: 14
    }),
    hat: new MeshPhongMaterial({
      color: 0x6c5a2a,
      flatShading: true,
      shininess: 24
    }),
    accent: new MeshPhongMaterial({
      color: 0x2a2a2a,
      flatShading: true,
      shininess: 30
    })
  };

  const armorMaterial = new MeshPhongMaterial({
    color: 0xb29a52,
    flatShading: true,
    shininess: 30
  });

  const { group, headY } = buildSeatedTorso(materials, { torsoSize: [0.46, 0.50, 0.32] });

  // 甲胄：胸前两块方块 + 肩护
  const chestPlate = new Mesh(new BoxGeometry(0.5, 0.42, 0.08), armorMaterial);
  chestPlate.position.set(0.22, 0.7, 0);
  group.add(chestPlate);
  const shoulderGeometry = new BoxGeometry(0.18, 0.18, 0.18);
  const shoulderLeft = new Mesh(shoulderGeometry, armorMaterial);
  shoulderLeft.position.set(0.05, 0.82, 0.28);
  const shoulderRight = new Mesh(shoulderGeometry, armorMaterial);
  shoulderRight.position.set(0.05, 0.82, -0.28);
  group.add(shoulderLeft, shoulderRight);

  // 头盔：圆顶 + 顶尖
  const helmet = new Mesh(new SphereGeometry(0.36, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), materials.hat);
  helmet.position.set(0.05, headY + 0.02, 0);
  group.add(helmet);
  const helmetTip = new Mesh(new ConeGeometry(0.08, 0.22, 6), materials.hat);
  helmetTip.position.set(0.05, headY + 0.28, 0);
  group.add(helmetTip);

  // 腰间剑：长方块 + 圆柄
  const sword = new Mesh(new BoxGeometry(0.06, 0.7, 0.06), materials.accent);
  sword.position.set(-0.05, 0.4, 0.35);
  sword.rotation.x = 0.4;
  group.add(sword);
  const hilt = new Mesh(new CylinderGeometry(0.05, 0.05, 0.16, 6), armorMaterial);
  hilt.position.set(-0.05, 0.72, 0.32);
  hilt.rotation.x = 0.4;
  group.add(hilt);

  return { avatar: group };
}

/** 游侠：深褐短打 + 斗笠 */
function buildYouxiaAvatar(): AvatarHandle {
  const materials: BodyMaterials = {
    skin: new MeshPhongMaterial({ color: sharedSkinHex, flatShading: true }),
    garment: new MeshPhongMaterial({
      color: 0x4a3322,
      flatShading: true,
      shininess: 6
    }),
    hat: new MeshPhongMaterial({
      color: 0xb89866,
      flatShading: true,
      shininess: 4
    }),
    accent: new MeshPhongMaterial({ color: 0x6b3a22, flatShading: true })
  };

  const { group, headY } = buildSeatedTorso(materials, { torsoSize: [0.40, 0.46, 0.28] });

  const tunic = new Mesh(new CylinderGeometry(0.20, 0.20, 0.5, 8), materials.garment);
  tunic.position.set(0.04, 0.29, 0);
  group.add(tunic);

  // 腰带
  const belt = new Mesh(new BoxGeometry(0.56, 0.08, 0.42), materials.accent);
  belt.position.set(0.0, 0.36, 0);
  group.add(belt);

  // 斗笠（比 default 更宽更平）
  const douli = new Mesh(new ConeGeometry(0.58, 0.16, 14), materials.hat);
  douli.position.set(0.05, headY + 0.23, 0);
  group.add(douli);

  // 短刀别在腰
  const dagger = new Mesh(new BoxGeometry(0.04, 0.32, 0.04), materials.accent);
  dagger.position.set(-0.08, 0.28, -0.32);
  dagger.rotation.x = -0.3;
  group.add(dagger);

  return { avatar: group };
}

/** 农夫：浅黄短衣 + 草帽 */
function buildNongfuAvatar(): AvatarHandle {
  const materials: BodyMaterials = {
    skin: new MeshPhongMaterial({ color: sharedSkinHex, flatShading: true }),
    garment: new MeshPhongMaterial({
      color: 0xd9c47a,
      flatShading: true,
      shininess: 4
    }),
    hat: new MeshPhongMaterial({
      color: 0xd9b870,
      flatShading: true,
      shininess: 2
    }),
    accent: new MeshPhongMaterial({
      color: 0x6b4a28,
      flatShading: true,
      shininess: 6
    })
  };

  const { group, headY } = buildSeatedTorso(materials, { torsoSize: [0.42, 0.46, 0.28] });

  const tunic = new Mesh(new CylinderGeometry(0.21, 0.21, 0.5, 8), materials.garment);
  tunic.position.set(0.04, 0.29, 0);
  group.add(tunic);

  // 草帽：宽 cone（比 youxia 更宽更扁）
  const hat = new Mesh(new ConeGeometry(0.62, 0.18, 14), materials.hat);
  hat.position.set(0.05, headY + 0.24, 0);
  group.add(hat);
  // 帽尖（尖顶草帽）
  const hatTip = new Mesh(new ConeGeometry(0.18, 0.18, 8), materials.hat);
  hatTip.position.set(0.05, headY + 0.38, 0);
  group.add(hatTip);

  // 腰间小布带
  const sash = new Mesh(new BoxGeometry(0.56, 0.06, 0.42), materials.accent);
  sash.position.set(0.0, 0.34, 0);
  group.add(sash);

  return { avatar: group };
}

/** 僧人：杏黄僧袍 + 光头 + 腰带 + 佛珠 + 左肩偏袒披布 */
function buildMonkAvatar(): AvatarHandle {
  const materials: BodyMaterials = {
    skin: new MeshPhongMaterial({
      color: 0xeed4b6,
      shininess: 50
    }),
    garment: new MeshPhongMaterial({
      color: 0xb37a3a,
      flatShading: true,
      shininess: 10
    }),
    hat: new MeshPhongMaterial({
      color: 0xb37a3a,
      flatShading: true,
      shininess: 10
    }),
    accent: new MeshPhongMaterial({
      color: 0x6e2a20,
      flatShading: true,
      shininess: 12
    })
  };
  const beadMaterial = new MeshPhongMaterial({
    color: 0x4a2e22,
    flatShading: true,
    shininess: 18
  });

  const { group, headY } = buildSeatedTorso(materials, { torsoSize: [0.44, 0.48, 0.30] });

  // 僧袍：直筒、从肩部一直披到膝盖。
  // 用户反馈"袈裟位置像胡子一样诡异"——根因是旧版 robe 只在腰下，看起来像
  // "腰部以下挂一截"。新版从肩部 (y≈0.84) 披到膝盖 (y≈0.0)，h 0.55 → 0.84，
  // position.y 0.3 → 0.42，覆盖整个躯干。
  const robe = new Mesh(
    new CylinderGeometry(0.22, 0.22, 0.84, 8),
    materials.garment
  );
  robe.name = "avatar-robe";
  robe.position.set(0.04, 0.42, 0);
  group.add(robe);

  // 腰带跟随新 robe 中部位置（约 0.40）。
  const belt = new Mesh(new BoxGeometry(0.45, 0.06, 0.32), materials.accent);
  belt.position.set(0.02, 0.40, 0);
  group.add(belt);

  // 念珠：缩到颈部一圈短弧（前胸 5 颗），围一圈反而显得乱。
  const beadGeometry = new SphereGeometry(0.05, 8, 8);
  const beadOffsets = [
    { x: 0.18, y: headY - 0.18, z: -0.14 },
    { x: 0.22, y: headY - 0.22, z: -0.07 },
    { x: 0.23, y: headY - 0.24, z: 0 },
    { x: 0.22, y: headY - 0.22, z: 0.07 },
    { x: 0.18, y: headY - 0.18, z: 0.14 }
  ];

  beadOffsets.forEach((offset) => {
    const bead = new Mesh(beadGeometry, beadMaterial);
    bead.position.set(offset.x, offset.y, offset.z);
    group.add(bead);
  });

  return { avatar: group };
}

const AVATAR_BUILDERS: Record<AvatarId, () => AvatarHandle> = {
  default: buildDefaultAvatar,
  wenren: buildWenrenAvatar,
  wujiang: buildWujiangAvatar,
  youxia: buildYouxiaAvatar,
  nongfu: buildNongfuAvatar,
  monk: buildMonkAvatar
};

export function createAvatar(id: AvatarId): AvatarHandle {
  const builder = AVATAR_BUILDERS[id];
  if (!builder) {
    throw new Error(`Unknown avatar id: ${id}`);
  }
  return builder();
}
