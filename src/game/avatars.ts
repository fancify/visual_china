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
 * 5 种骑手 avatar（含 default = 旧 wood-horse rider）。
 *
 * avatar 局部坐标系：以 saddle 顶面为 y=0，朝向 +X 方向（跟 mount 一致）。
 * main.ts 把 avatar group 整体放到 mount.saddleHeight + saddleX 上方即可。
 *
 * 每个 avatar 高 ~1.5–1.7m（含帽子），半径 ~0.4m，避免穿模到坐骑两侧。
 */

export type AvatarId = "default" | "wenren" | "wujiang" | "youxia" | "nongfu";

export interface AvatarDefinition {
  id: AvatarId;
  name: string;
  description: string;
}

export const AVATAR_DEFINITIONS: AvatarDefinition[] = [
  { id: "default", name: "原游侠", description: "斗笠 + 红袍，旅程之始的形象。" },
  { id: "wenren", name: "文人", description: "灰蓝长袍 + 幞头，背书袋。" },
  { id: "wujiang", name: "武将", description: "红袍方甲 + 兜鍪，腰悬利剑。" },
  { id: "youxia", name: "游侠", description: "深褐短打 + 斗笠，背行囊。" },
  { id: "nongfu", name: "农夫", description: "浅黄短衣 + 草帽，肩扛锄。" }
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
const eyeGeometry = new SphereGeometry(0.045, 6, 6);

/** 把眼睛安在 head sphere 前方（+X 朝向）。 */
function addEyes(target: Group, headY: number): void {
  const left = new Mesh(eyeGeometry, eyeMaterial);
  left.position.set(0.28, headY, 0.13);
  const right = new Mesh(eyeGeometry, eyeMaterial);
  right.position.set(0.28, headY, -0.13);
  target.add(left, right);
}

/** 通用躯干（骑姿）：头 + 上身 + 大腿（坐姿弯曲）。返回 group + 头部 Y 高度。 */
function buildSeatedTorso(
  materials: BodyMaterials,
  options: { torsoSize?: [number, number, number]; thighThickness?: number } = {}
): { group: Group; headY: number } {
  const group = new Group();

  const torsoSize = options.torsoSize ?? [0.55, 0.7, 0.42];
  const thighThickness = options.thighThickness ?? 0.18;

  // 躯干：略前倾（往 +X）以贴合"骑马含腰"姿势
  const torso = new Mesh(
    new BoxGeometry(torsoSize[0], torsoSize[1], torsoSize[2]),
    materials.garment
  );
  torso.position.set(0.0, 0.55, 0);
  torso.rotation.z = -0.08;
  group.add(torso);

  // 大腿：分腿坐在鞍两侧，微前弯
  const thighGeometry = new CylinderGeometry(thighThickness, thighThickness, 0.55, 5);
  const thighLeft = new Mesh(thighGeometry, materials.garment);
  thighLeft.position.set(0.18, 0.18, 0.22);
  thighLeft.rotation.set(0, 0, Math.PI / 2 - 0.2);
  const thighRight = new Mesh(thighGeometry, materials.garment);
  thighRight.position.set(0.18, 0.18, -0.22);
  thighRight.rotation.set(0, 0, Math.PI / 2 - 0.2);
  group.add(thighLeft, thighRight);

  // 手臂：双手前伸（握缰）
  const armGeometry = new CylinderGeometry(0.07, 0.08, 0.5, 5);
  const armLeft = new Mesh(armGeometry, materials.garment);
  armLeft.position.set(0.28, 0.6, 0.22);
  armLeft.rotation.set(0, 0, Math.PI / 2 - 0.5);
  const armRight = new Mesh(armGeometry, materials.garment);
  armRight.position.set(0.28, 0.6, -0.22);
  armRight.rotation.set(0, 0, Math.PI / 2 - 0.5);
  group.add(armLeft, armRight);

  // 头球
  const headY = 1.05;
  const head = new Mesh(new SphereGeometry(0.32, 12, 12), materials.skin);
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

  // 长披风（cone 罩在背后，模拟旧 cloak）
  const cloak = new Mesh(new ConeGeometry(0.55, 1.1, 5), materials.garment);
  cloak.position.set(-0.05, 0.55, 0);
  cloak.rotation.y = Math.PI / 5;
  group.add(cloak);

  // 斗笠
  const douli = new Mesh(new ConeGeometry(0.5, 0.2, 12), materials.hat);
  douli.position.set(0.05, headY + 0.34, 0);
  group.add(douli);

  return { avatar: group };
}

/** 文人：长袍灰蓝 + 幞头 + 背包袱 */
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

  const { group, headY } = buildSeatedTorso(materials, { torsoSize: [0.6, 0.78, 0.44] });

  // 长袍下摆：cone 在大腿外面盖住
  const robe = new Mesh(new ConeGeometry(0.6, 0.85, 6), materials.garment);
  robe.position.set(0.05, 0.05, 0);
  group.add(robe);

  // 幞头：方块帽 + 后方两条带
  const cap = new Mesh(new BoxGeometry(0.42, 0.22, 0.4), materials.hat);
  cap.position.set(0.0, headY + 0.32, 0);
  group.add(cap);
  const tailGeometry = new BoxGeometry(0.06, 0.22, 0.08);
  const capTailLeft = new Mesh(tailGeometry, materials.hat);
  capTailLeft.position.set(-0.18, headY + 0.18, 0.14);
  capTailLeft.rotation.z = 0.4;
  const capTailRight = new Mesh(tailGeometry, materials.hat);
  capTailRight.position.set(-0.18, headY + 0.18, -0.14);
  capTailRight.rotation.z = 0.4;
  group.add(capTailLeft, capTailRight);

  // 背后包袱：方布 + 系绳点
  const bundle = new Mesh(new BoxGeometry(0.36, 0.36, 0.32), materials.accent);
  bundle.position.set(-0.32, 0.78, 0);
  bundle.rotation.set(0.2, 0, 0.1);
  group.add(bundle);

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

  const { group, headY } = buildSeatedTorso(materials, { torsoSize: [0.6, 0.74, 0.46] });

  // 甲胄：胸前两块方块 + 肩护
  const chestPlate = new Mesh(new BoxGeometry(0.5, 0.42, 0.08), armorMaterial);
  chestPlate.position.set(0.22, 0.7, 0);
  group.add(chestPlate);
  const shoulderGeometry = new BoxGeometry(0.18, 0.18, 0.18);
  const shoulderLeft = new Mesh(shoulderGeometry, armorMaterial);
  shoulderLeft.position.set(0.05, 0.92, 0.28);
  const shoulderRight = new Mesh(shoulderGeometry, armorMaterial);
  shoulderRight.position.set(0.05, 0.92, -0.28);
  group.add(shoulderLeft, shoulderRight);

  // 头盔：圆顶 + 顶尖
  const helmet = new Mesh(new SphereGeometry(0.36, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), materials.hat);
  helmet.position.set(0.05, headY + 0.05, 0);
  group.add(helmet);
  const helmetTip = new Mesh(new ConeGeometry(0.08, 0.22, 6), materials.hat);
  helmetTip.position.set(0.05, headY + 0.42, 0);
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

/** 游侠：深褐短打 + 斗笠 + 行囊 */
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

  const { group, headY } = buildSeatedTorso(materials, { torsoSize: [0.52, 0.66, 0.4] });

  // 腰带
  const belt = new Mesh(new BoxGeometry(0.56, 0.08, 0.42), materials.accent);
  belt.position.set(0.0, 0.36, 0);
  group.add(belt);

  // 斗笠（比 default 更宽更平）
  const douli = new Mesh(new ConeGeometry(0.58, 0.16, 14), materials.hat);
  douli.position.set(0.05, headY + 0.32, 0);
  group.add(douli);

  // 行囊：椭圆背在肩上
  const pack = new Mesh(new SphereGeometry(0.28, 8, 6), materials.accent);
  pack.position.set(-0.32, 0.7, 0);
  pack.scale.set(0.9, 1.1, 0.7);
  group.add(pack);

  // 短刀别在腰
  const dagger = new Mesh(new BoxGeometry(0.04, 0.32, 0.04), materials.accent);
  dagger.position.set(-0.08, 0.28, -0.32);
  dagger.rotation.x = -0.3;
  group.add(dagger);

  return { avatar: group };
}

/** 农夫：浅黄短衣 + 草帽 + 肩扛锄 */
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

  const { group, headY } = buildSeatedTorso(materials, { torsoSize: [0.54, 0.66, 0.4] });

  // 草帽：宽 cone（比 youxia 更宽更扁）
  const hat = new Mesh(new ConeGeometry(0.62, 0.18, 14), materials.hat);
  hat.position.set(0.05, headY + 0.34, 0);
  group.add(hat);
  // 帽尖（尖顶草帽）
  const hatTip = new Mesh(new ConeGeometry(0.18, 0.18, 8), materials.hat);
  hatTip.position.set(0.05, headY + 0.5, 0);
  group.add(hatTip);

  // 肩扛锄头：竖长杆 + 端头方块
  const handle = new Mesh(new CylinderGeometry(0.04, 0.04, 1.0, 5), materials.accent);
  handle.position.set(-0.18, 0.95, 0.28);
  handle.rotation.set(0, 0, 0.5);
  group.add(handle);
  const blade = new Mesh(new BoxGeometry(0.18, 0.16, 0.06), materials.accent);
  blade.position.set(-0.55, 1.32, 0.28);
  group.add(blade);

  // 腰间小布带
  const sash = new Mesh(new BoxGeometry(0.56, 0.06, 0.42), materials.accent);
  sash.position.set(0.0, 0.34, 0);
  group.add(sash);

  return { avatar: group };
}

const AVATAR_BUILDERS: Record<AvatarId, () => AvatarHandle> = {
  default: buildDefaultAvatar,
  wenren: buildWenrenAvatar,
  wujiang: buildWujiangAvatar,
  youxia: buildYouxiaAvatar,
  nongfu: buildNongfuAvatar
};

export function createAvatar(id: AvatarId): AvatarHandle {
  const builder = AVATAR_BUILDERS[id];
  if (!builder) {
    throw new Error(`Unknown avatar id: ${id}`);
  }
  return builder();
}
