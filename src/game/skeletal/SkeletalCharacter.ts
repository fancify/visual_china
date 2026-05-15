import {
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  Bone,
  Box3,
  Group,
  LoopOnce,
  LoopRepeat,
  Object3D,
  Vector3
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export interface SkeletalCharacterHandle {
  root: Group;
  mixer: AnimationMixer;
  clips: Record<string, AnimationClip>;
  play(name: string, opts?: PlayOptions): void;
  update(dt: number): void;
  current(): string | null;
  /** 测量到的角色默认高度（米），未缩放前。Mixamo Y-Bot 系约 1.83m。 */
  defaultHeightMeters: number;
  /** 当前应用的高度。改这个会等比缩放 root。 */
  setHeightMeters(meters: number): void;
  currentHeightMeters(): number;
  /** 调整各 bone 的局部 scale 改变身材比例。所有字段独立可选，1.0 = 不改。 */
  setProportions(profile: ProportionProfile): void;
  /** 返回当前 profile 副本。 */
  currentProportions(): ProportionProfile;
  /** Mixamo bone 名 → Bone 引用，方便外部挂物体（M2 御剑的 right hand）。 */
  bones: Map<string, Bone>;
  /**
   * 让脚底贴地需要 root.position.y 额外加上此值。
   * 实现原理：根据 bind pose box.min.y 计算（已考虑缩放）。
   * 用法：root.position.y = terrainSurfaceHeight + getFootYOffset()。
   */
  getFootYOffset(): number;
}

export interface PlayOptions {
  fadeSeconds?: number;
  loop?: boolean;
  timeScale?: number;
}

export interface ProportionProfile {
  /** 头大小。Bone scale uniform on Head. BotW 风格略小 0.92-0.96。 */
  head?: number;
  /** 肩宽。Bone scale x on Shoulder bones。BotW 男 1.0 女 0.88。 */
  shoulderWidth?: number;
  /** 上臂 + 前臂的横向粗细（x z 同步）。BotW 系普遍 0.78-0.85。 */
  armWidth?: number;
  /** 胯宽。Bone scale x on UpLeg。男 0.92 女 1.02。 */
  hipWidth?: number;
  /** 大腿小腿粗细。BotW 0.80-0.88。 */
  legWidth?: number;
  /** 躯干宽（Spine bones x）。BotW 0.84-0.92。 */
  torsoWidth?: number;
  /** 腿长比 — UpLeg + Leg 的 y scale。1.0 = 不改；1.05 略拉长腿；BotW 0.98-1.05。 */
  legLength?: number;
}

export interface LoadOptions {
  /** 目标身高（米）。未指定则保留模型原始高度。 */
  heightMeters?: number;
  /** 加载完成后立即应用的比例 profile。 */
  proportions?: ProportionProfile;
}

/** Mixamo bone name 工具——支持有/无 mixamorig 前缀两种。 */
const BONE_ALIAS: Record<string, string[]> = {
  Head: ["mixamorigHead", "Head"],
  LeftShoulder: ["mixamorigLeftShoulder", "LeftShoulder"],
  RightShoulder: ["mixamorigRightShoulder", "RightShoulder"],
  LeftArm: ["mixamorigLeftArm", "LeftArm"],
  RightArm: ["mixamorigRightArm", "RightArm"],
  LeftForeArm: ["mixamorigLeftForeArm", "LeftForeArm"],
  RightForeArm: ["mixamorigRightForeArm", "RightForeArm"],
  LeftUpLeg: ["mixamorigLeftUpLeg", "LeftUpLeg"],
  RightUpLeg: ["mixamorigRightUpLeg", "RightUpLeg"],
  LeftLeg: ["mixamorigLeftLeg", "LeftLeg"],
  RightLeg: ["mixamorigRightLeg", "RightLeg"],
  Spine: ["mixamorigSpine", "Spine"],
  Spine1: ["mixamorigSpine1", "Spine1"],
  Spine2: ["mixamorigSpine2", "Spine2"]
};

function indexBones(root: Object3D): Map<string, Bone> {
  const map = new Map<string, Bone>();
  root.traverse((node) => {
    if ((node as Bone).isBone) {
      map.set(node.name, node as Bone);
    }
  });
  return map;
}

function findBone(bones: Map<string, Bone>, alias: string): Bone | null {
  const candidates = BONE_ALIAS[alias] ?? [alias];
  for (const name of candidates) {
    const bone = bones.get(name);
    if (bone) return bone;
  }
  return null;
}

const DEFAULT_FADE = 0.25;

function measureHeight(root: Group): number {
  const box = new Box3().setFromObject(root);
  const size = new Vector3();
  box.getSize(size);
  return size.y;
}

export async function loadSkeletalCharacter(
  url: string,
  options: LoadOptions = {}
): Promise<SkeletalCharacterHandle> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url);

  const root = gltf.scene as Group;
  root.traverse((node) => {
    node.castShadow = true;
    node.receiveShadow = true;
  });

  const defaultHeight = measureHeight(root);
  let currentHeight = defaultHeight;
  if (options.heightMeters && options.heightMeters > 0) {
    const scale = options.heightMeters / defaultHeight;
    root.scale.setScalar(scale);
    currentHeight = options.heightMeters;
  }

  const bones = indexBones(root);
  const profile: ProportionProfile = {};

  function applyProportions(next: ProportionProfile): void {
    // 合并到 active profile（独立字段，未传不改）
    Object.assign(profile, next);

    const setBoneXYZ = (alias: string, x?: number, y?: number, z?: number) => {
      const bone = findBone(bones, alias);
      if (!bone) return;
      bone.scale.set(x ?? bone.scale.x, y ?? bone.scale.y, z ?? bone.scale.z);
    };

    if (next.head !== undefined) {
      const v = next.head;
      setBoneXYZ("Head", v, v, v);
    }
    if (next.shoulderWidth !== undefined) {
      // 肩宽走 shoulder bone x；arm length 不变。
      setBoneXYZ("LeftShoulder", next.shoulderWidth);
      setBoneXYZ("RightShoulder", next.shoulderWidth);
    }
    if (next.armWidth !== undefined) {
      const v = next.armWidth;
      ["LeftArm", "RightArm", "LeftForeArm", "RightForeArm"].forEach((b) => {
        setBoneXYZ(b, v, undefined, v);
      });
    }
    if (next.hipWidth !== undefined) {
      setBoneXYZ("LeftUpLeg", next.hipWidth, undefined, undefined);
      setBoneXYZ("RightUpLeg", next.hipWidth, undefined, undefined);
    }
    if (next.legWidth !== undefined) {
      const v = next.legWidth;
      // 注意：UpLeg 的 x 已被 hipWidth 占用，这里只动 z + Leg 的 x/z。
      ["LeftLeg", "RightLeg"].forEach((b) => {
        setBoneXYZ(b, v, undefined, v);
      });
      // UpLeg 的 z 单独管粗细（x 给 hipWidth）。
      ["LeftUpLeg", "RightUpLeg"].forEach((b) => {
        setBoneXYZ(b, undefined, undefined, v);
      });
    }
    if (next.torsoWidth !== undefined) {
      const v = next.torsoWidth;
      ["Spine", "Spine1", "Spine2"].forEach((b) => setBoneXYZ(b, v, undefined, v));
    }
    if (next.legLength !== undefined) {
      const v = next.legLength;
      ["LeftUpLeg", "RightUpLeg", "LeftLeg", "RightLeg"].forEach((b) =>
        setBoneXYZ(b, undefined, v, undefined)
      );
    }
  }

  if (options.proportions) {
    applyProportions(options.proportions);
  }

  const mixer = new AnimationMixer(root);
  const clips: Record<string, AnimationClip> = {};
  for (const clip of gltf.animations) {
    clips[clip.name] = clip;
  }

  const actions: Record<string, AnimationAction> = {};
  let currentName: string | null = null;

  function getOrCreateAction(name: string): AnimationAction {
    const cached = actions[name];
    if (cached) return cached;
    const clip = clips[name];
    if (!clip) {
      throw new Error(`Clip not found: ${name}. Available: ${Object.keys(clips).join(", ")}`);
    }
    const action = mixer.clipAction(clip);
    action.setLoop(LoopRepeat, Infinity);
    actions[name] = action;
    return action;
  }

  // bind pose box (在所有 scale/proportion 之后测一次，作为脚底偏移的依据)
  const bindPoseBox = new Box3().setFromObject(root);
  const bindPoseMinY = bindPoseBox.min.y;

  return {
    root,
    mixer,
    clips,
    bones,
    defaultHeightMeters: defaultHeight,
    current() {
      return currentName;
    },
    setHeightMeters(meters: number) {
      if (meters <= 0) return;
      const scale = meters / defaultHeight;
      root.scale.setScalar(scale);
      currentHeight = meters;
    },
    currentHeightMeters() {
      return currentHeight;
    },
    setProportions(next: ProportionProfile) {
      applyProportions(next);
    },
    currentProportions() {
      return { ...profile };
    },
    getFootYOffset() {
      // bindPoseMinY 是在加载完成 + scale 应用后测的 world-space min.y。
      // root.position.y 当前为 0；要让脚底（=bindPoseMinY，因为 box.min.y 是
      // 几何最低点的 world y）落在 ground.y，需要 root.position.y = ground.y - bindPoseMinY。
      return -bindPoseMinY;
    },
    play(name, opts = {}) {
      const fade = opts.fadeSeconds ?? DEFAULT_FADE;
      const next = getOrCreateAction(name);
      next.setLoop(opts.loop === false ? LoopOnce : LoopRepeat, opts.loop === false ? 1 : Infinity);
      next.timeScale = opts.timeScale ?? 1;
      next.enabled = true;
      next.setEffectiveTimeScale(opts.timeScale ?? 1);
      next.setEffectiveWeight(1);

      if (currentName && currentName !== name) {
        const prev = actions[currentName];
        if (prev) {
          prev.crossFadeTo(next, fade, false);
        }
      }
      next.reset().play();
      currentName = name;
    },
    update(dt) {
      mixer.update(dt);
    }
  };
}
