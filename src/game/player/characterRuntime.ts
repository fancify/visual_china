import {
  Euler,
  Group,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  Scene,
  Vector3
} from "three";

import {
  createCharacterController,
  type CharacterControllerHandle,
  type KeyboardInputState,
  type MovementMode
} from "../skeletal/CharacterController.js";
import { computeCharacterTilt } from "../skeletal/CharacterTilt.js";
import {
  createFlightController,
  cycleTravelMode,
  type FlightControllerHandle,
  type FlightMode,
  type TravelMode
} from "../skeletal/FlightModes.js";
import {
  loadSkeletalCharacter,
  type SkeletalCharacterHandle
} from "../skeletal/SkeletalCharacter.js";
import { resolveCharacterAsset } from "../skeletal/characterAssets.js";
import { resolveTravelAnimationMode } from "../skeletal/flightAnimationMode.js";
import {
  applySwordTransform,
  attachSwordGltf,
  createCloudFlightVisual,
  createSwordFlightVisual,
  updateCloudFlightVisual
} from "../skeletal/flightVisuals.js";

export interface TerrainSurfaceSampler {
  sampleSurfaceHeight(x: number, z: number): number;
}

export interface CharacterPlayerScale {
  characterHeight: number;
  walkSpeed: number;
  runSpeed: number;
  swordMinClearance: number;
  swordMaxClearance: number;
  cloudMinClearance: number;
  cloudMaxClearance: number;
  verticalSpeed: number;
  cameraDistance: number;
  cameraHeight: number;
}

export interface CharacterPlayerRuntimeOptions {
  scene: Scene;
  sampler: TerrainSurfaceSampler;
  initialPosition: { x: number; z: number };
  search?: string;
  scale?: Partial<CharacterPlayerScale>;
}

export interface CharacterPlayerSnapshot {
  position: Vector3;
  heading: number;
  speed: number;
  travelMode: TravelMode;
  movementMode: MovementMode;
  currentClip: string | null;
}

export interface CharacterPlayerRuntime {
  character: SkeletalCharacterHandle;
  controller: CharacterControllerHandle;
  flightController: FlightControllerHandle;
  swordVisual: Group;
  cloudVisual: Group;
  update(dt: number, input: KeyboardInputState, cameraYaw: number): CharacterPlayerSnapshot;
  position(): Vector3;
  heading(): number;
  travelMode(): TravelMode;
  snapshot(): CharacterPlayerSnapshot;
  setTravelMode(mode: TravelMode): void;
  setHeading(value: number): void;
  dispose(): void;
}

export interface CameraFollowInput {
  target: { x: number; y: number; z: number };
  heading: number;
  cameraYaw: number;
  cameraPitch: number;
  distance: number;
  height?: number;
}

export interface CameraFollowPose {
  position: Vector3;
  lookAt: Vector3;
}

interface IdleOffsetSpec {
  bone: string;
  axis: "x" | "y" | "z";
  value: number;
}

export const MODEL_FORWARD_YAW_OFFSET = Math.PI / 2;

const IDLE_RELAX_OFFSETS: IdleOffsetSpec[] = [
  { bone: "LeftUpLeg", axis: "z", value: -0.03 },
  { bone: "RightUpLeg", axis: "z", value: 0.19 },
  { bone: "LeftArm", axis: "z", value: 0.15 },
  { bone: "RightArm", axis: "z", value: 0.03 },
  { bone: "LeftShoulder", axis: "z", value: 0.01 },
  { bone: "RightShoulder", axis: "z", value: 0.09 },
  { bone: "LeftForeArm", axis: "z", value: 0.22 },
  { bone: "RightForeArm", axis: "z", value: -0.12 },
  { bone: "LeftShoulder", axis: "x", value: -0.06 },
  { bone: "RightShoulder", axis: "x", value: -0.15 },
  { bone: "LeftArm", axis: "x", value: -0.1 },
  { bone: "RightArm", axis: "x", value: -0.21 },
  { bone: "LeftForeArm", axis: "x", value: 0.33 },
  { bone: "RightForeArm", axis: "x", value: 0.38 },
  { bone: "LeftShoulder", axis: "y", value: -0.17 },
  { bone: "RightShoulder", axis: "y", value: 0.26 },
  { bone: "LeftForeArm", axis: "y", value: 0 },
  { bone: "RightForeArm", axis: "y", value: 0.37 }
];

const SWORD_IDLE_OFFSETS: IdleOffsetSpec[] = [
  { bone: "Head", axis: "x", value: 0.06 },
  { bone: "Head", axis: "y", value: -1.0 },
  { bone: "Head", axis: "z", value: 0.57 }
];

const SWORD_BODY_TRANSFORM = {
  yaw: 1.658,
  pitch: 0.049,
  roll: 0
};

export function characterPlayerScaleDefaults(): CharacterPlayerScale {
  return {
    characterHeight: 0.6,
    walkSpeed: 1.8,
    runSpeed: 3.2,
    swordMinClearance: 8,
    swordMaxClearance: 24,
    cloudMinClearance: 20,
    cloudMaxClearance: 72,
    verticalSpeed: 12,
    cameraDistance: 22,
    cameraHeight: 3.2
  };
}

export function mergeCharacterPlayerScale(
  scale: Partial<CharacterPlayerScale> = {}
): CharacterPlayerScale {
  return { ...characterPlayerScaleDefaults(), ...scale };
}

export function characterInputFromKeySet(keys: Set<string>): KeyboardInputState {
  const normalized = new Set(Array.from(keys, (key) => key.toLowerCase()));
  const directClipDigit = Array.from(normalized)
    .map((key) => /^alt\+([1-9])$/.exec(key)?.[1])
    .find((digit): digit is string => digit !== undefined);

  return {
    forward: normalized.has("w") || normalized.has("arrowup"),
    backward: normalized.has("s") || normalized.has("arrowdown"),
    left: normalized.has("a") || normalized.has("arrowleft"),
    right: normalized.has("d") || normalized.has("arrowright"),
    shift: normalized.has("shift"),
    ascend: normalized.has(" ") || normalized.has("space") || normalized.has("spacebar"),
    descend: normalized.has("c"),
    cycleTravelMode: normalized.has("p"),
    directClipDigit: directClipDigit ? Number(directClipDigit) : null
  };
}

export function clampFlightHeightAboveGround(
  currentY: number,
  groundY: number,
  mode: FlightMode,
  scale: CharacterPlayerScale = characterPlayerScaleDefaults()
): number {
  const minClearance = mode === "cloud" ? scale.cloudMinClearance : scale.swordMinClearance;
  const maxClearance = mode === "cloud" ? scale.cloudMaxClearance : scale.swordMaxClearance;
  return Math.max(groundY + minClearance, Math.min(groundY + maxClearance, currentY));
}

// 2026-05-15: 解耦 orbit pivot 和 lookAt
//   - ORBIT_PIVOT_HEIGHT (0.6)：相机绕"角色头部"旋转 — 默认角色 characterHeight = 0.6m
//   - LOOK_HEIGHT (0.3)：lookAt 在角色 visual center（高 0.6m 的一半）
//   - 看天时 (pitch 大负): pitch 把 lookAt y 也往上推，使 view frustum 含更多天空
//     (lookAt.y = LOOK_HEIGHT + 上推量；这样 close-cam 不影响居中、sky-view 视角自然朝上)
/**
 * Mutable runtime offsets for character mesh Y position in different modes.
 * - ground: 默认地面贴地微调（替代 characterAsset.extraYOffset）
 * - sword: 脚踩剑面所需的抬高量
 * - cloud: 脚踩云面所需的抬高量
 * 这些值可以通过 DebugPanel 实时改，调好后硬编码进默认值。
 */
export const characterMountOffsets = {
  ground: -0.014,
  sword: 0.023,
  cloud: 0.137
};

/**
 * Mutable 角色 emissive 强度。Meshy AI 默认导出 emissive=1（角色全亮无视光照），
 * 调到 0 会让夜里看不清。这里取中间值，让夜里仍有最低可视度。
 * DebugPanel 实时改，调好后硬编码。
 */
export const characterEmissive = {
  intensity: 0.2
};

/** 在 forceOpaqueMaterials 时收集的所有角色 material，让 setter 能批量更新。 */
const characterMaterialRefs = new Set<MeshStandardMaterial>();

/** 用 characterEmissive.intensity 同步所有角色 material 的 emissive 强度。 */
export function applyCharacterEmissive(): void {
  for (const mat of characterMaterialRefs) {
    mat.emissiveIntensity = characterEmissive.intensity;
    mat.needsUpdate = true;
  }
}

const ORBIT_PIVOT_HEIGHT = 0.6;
const LOOK_HEIGHT = 0.3;
const SKY_LOOK_LIFT_FACTOR = 1.0;     // pitch 每负 1 rad，lookAt 升高 1m
const CAMERA_MIN_ABOVE_GROUND = 0.3;
const CAMERA_PITCH_LIMIT = Math.PI / 2 - 0.05;
export function cameraFollowPoseForCharacterPlayer({
  target,
  heading,
  cameraYaw,
  cameraPitch,
  distance,
  height = 3.2
}: CameraFollowInput): CameraFollowPose {
  void height;
  const clampedPitch = Math.max(-CAMERA_PITCH_LIMIT, Math.min(CAMERA_PITCH_LIMIT, cameraPitch));
  const azimuth = heading + cameraYaw;
  const horizontal = Math.cos(clampedPitch) * distance;
  const orbitPivotY = target.y + ORBIT_PIVOT_HEIGHT;
  const rawCamY = orbitPivotY + Math.sin(clampedPitch) * distance;
  const camY = Math.max(target.y + CAMERA_MIN_ABOVE_GROUND, rawCamY);
  // pitch >= 0：lookAt 锁角色中心（让人物在屏幕中央）
  // pitch < 0：lookAt 随 pitch 抬升，view frustum 朝上含天空
  const skyLift = clampedPitch < 0 ? -clampedPitch * SKY_LOOK_LIFT_FACTOR * distance / 2 : 0;
  return {
    position: new Vector3(
      target.x - Math.cos(azimuth) * horizontal,
      camY,
      target.z + Math.sin(azimuth) * horizontal
    ),
    lookAt: new Vector3(target.x, target.y + LOOK_HEIGHT + skyLift, target.z)
  };
}

export function applyCameraFollowPose(camera: PerspectiveCamera, pose: CameraFollowPose): void {
  camera.position.copy(pose.position);
  camera.lookAt(pose.lookAt);
}

function isAnyMovementInput(input: KeyboardInputState): boolean {
  return input.forward || input.backward || input.left || input.right || input.shift || input.ascend || input.descend;
}

function resolveClip(target: string, names: string[], preferred: string[] = []): string | null {
  for (const candidate of preferred) {
    const match = names.find((name) => name === candidate);
    if (match) return match;
  }
  const lower = target.toLowerCase();
  const exact = names.find((name) => name.toLowerCase() === lower);
  if (exact) return exact;
  if (lower.length < 3) return null;
  return (
    names.find((name) => name.toLowerCase().includes(lower)) ??
    names.find((name) => lower.includes(name.toLowerCase()) && name.length >= 3) ??
    null
  );
}

function forceOpaqueMaterials(root: Object3D): void {
  root.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh) return;
    const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as Material[];
    for (const material of materials) {
      material.transparent = false;
      material.opacity = 1;
      material.depthWrite = true;
      material.alphaTest = 0;
      // 2026-05-15: 杀掉 Meshy AI 默认导出的塑料感 + 全白自发光。
      // Meshy 导出的 GLB 经常带 emissive=#ffffff intensity=1，导致角色自己发全白光、
      // 完全无视场景光照（白天黑夜一样亮）—— 这是"夜里角色刺眼"的真因。
      // 但 emissive 完全归零 → 夜里角色变成黑剪影，看不清。保留 0.2 自发光强度作为最低
      // 可见度 (debug 面板可调)，让 specular 几乎消失但角色不至于完全融入夜色。
      const std = material as MeshStandardMaterial;
      if (typeof std.metalness === "number") std.metalness = 0;
      if (typeof std.roughness === "number") std.roughness = 0.95;
      if ("envMapIntensity" in std) std.envMapIntensity = 0;
      if (std.emissive) std.emissive.setHex(0xffffff);
      if (typeof std.emissiveIntensity === "number") {
        std.emissiveIntensity = characterEmissive.intensity;
        characterMaterialRefs.add(std);
      }
      material.needsUpdate = true;
    }
  });
}

function applyOffsetList(character: SkeletalCharacterHandle, list: IdleOffsetSpec[]): void {
  for (const offset of list) {
    const bone = character.bones.get(offset.bone) ?? character.bones.get(`mixamorig${offset.bone}`);
    if (bone) bone.rotation[offset.axis] += offset.value;
  }
}

function applyIdleRelaxOffsets(
  character: SkeletalCharacterHandle,
  movementMode: MovementMode,
  travelMode: TravelMode
): void {
  if (movementMode !== "idle") return;
  applyOffsetList(character, IDLE_RELAX_OFFSETS);
  if (travelMode === "sword") {
    applyOffsetList(character, SWORD_IDLE_OFFSETS);
  }
}

function syncFlightVisuals(
  swordVisual: Group,
  cloudVisual: Group,
  travelMode: TravelMode,
  flightController: FlightControllerHandle,
  anchor: Vector3
): void {
  swordVisual.visible = travelMode === "sword";
  cloudVisual.visible = travelMode === "cloud";
  swordVisual.position.set(anchor.x, anchor.y + 0.04, anchor.z);
  swordVisual.rotation.y = flightController.getHeading();
  cloudVisual.position.set(anchor.x, anchor.y + 0.08, anchor.z);
  cloudVisual.rotation.y = flightController.getHeading();
}

export async function createCharacterPlayerRuntime(
  options: CharacterPlayerRuntimeOptions
): Promise<CharacterPlayerRuntime> {
  const scale = mergeCharacterPlayerScale(options.scale);
  const characterAsset = resolveCharacterAsset(options.search ?? window.location.search);
  const character = await loadSkeletalCharacter(characterAsset.url, {
    heightMeters: scale.characterHeight
  });
  options.scene.add(character.root);
  if (characterAsset.forceOpaqueMaterials) {
    forceOpaqueMaterials(character.root);
  }

  const controller = createCharacterController({
    sampler: options.sampler,
    initialPosition: options.initialPosition,
    walkSpeed: scale.walkSpeed,
    runSpeed: scale.runSpeed
  });
  const flightController = createFlightController({
    initialPosition: {
      x: controller.position.x,
      y: controller.position.y + scale.swordMinClearance,
      z: controller.position.z
    },
    minAltitude: -1000,
    maxAltitude: 1000,
    minClearance: scale.swordMinClearance,
    verticalSpeed: scale.verticalSpeed
  });

  const swordVisual = createSwordFlightVisual();
  const cloudVisual = createCloudFlightVisual();
  // 2026-05-15: cloud + sword 视觉按比例缩到匹配 characterHeight (默认 0.6m)。
  // 原本 visual 是按 ~1.7m 假想角色尺寸设计的；按 height ratio 缩放。
  const VISUAL_DESIGN_HEIGHT = 1.7;
  const visualScale = scale.characterHeight / VISUAL_DESIGN_HEIGHT;
  swordVisual.scale.multiplyScalar(visualScale);
  cloudVisual.scale.multiplyScalar(visualScale);
  swordVisual.visible = false;
  cloudVisual.visible = false;
  options.scene.add(swordVisual, cloudVisual);
  void attachSwordGltf(swordVisual).catch((error: unknown) => {
    console.error("[character-runtime] failed to attach sword GLB", error);
  });

  const characterEuler = new Euler(0, 0, 0, "YXZ");
  const clipsList = characterAsset.digitKeyClips ?? Object.keys(character.clips);
  let lockedClip = false;
  let lastMode: MovementMode | null = null;
  let travelMode: TravelMode = "ground";
  let previousCycleHeld = false;

  function playMode(mode: MovementMode): void {
    if (lockedClip) return;
    if (mode === lastMode) return;
    const clip = resolveClip(mode, Object.keys(character.clips), characterAsset.clipPreferences?.[mode]);
    if (clip) {
      character.play(clip, { timeScale: characterAsset.clipTimeScale?.[mode] ?? 1 });
    }
    lastMode = mode;
  }

  function syncGroundCharacter(): void {
    character.root.position.copy(controller.position);
    character.root.position.y += character.getFootYOffset() + characterMountOffsets.ground;
    const tilt = computeCharacterTilt({
      heading: controller.getHeading(),
      position: { x: controller.position.x, z: controller.position.z },
      sampler: options.sampler
    });
    characterEuler.set(
      tilt.pitch,
      controller.getHeading() + MODEL_FORWARD_YAW_OFFSET,
      tilt.roll
    );
    character.root.rotation.copy(characterEuler);
  }

  function syncFlightCharacter(): void {
    character.root.position.copy(flightController.position);
    // 用 mutable characterMountOffsets.ground 替代静态 characterAsset.extraYOffset
    // (DebugPanel 可调；调好后硬编码到默认值)
    character.root.position.y += character.getFootYOffset() + characterMountOffsets.ground;
    if (travelMode === "sword") {
      character.root.position.y += characterMountOffsets.sword;
    } else if (travelMode === "cloud") {
      character.root.position.y += characterMountOffsets.cloud;
    }
    const bodyYaw = travelMode === "sword" ? SWORD_BODY_TRANSFORM.yaw : 0;
    const bodyPitch = travelMode === "sword" ? SWORD_BODY_TRANSFORM.pitch : 0;
    const bodyRoll = travelMode === "sword" ? SWORD_BODY_TRANSFORM.roll : 0;
    characterEuler.set(
      bodyPitch,
      flightController.getHeading() + MODEL_FORWARD_YAW_OFFSET + bodyYaw,
      bodyRoll
    );
    character.root.rotation.copy(characterEuler);
  }

  function setTravelMode(nextMode: TravelMode): void {
    if (nextMode === travelMode) return;
    const current = travelMode === "ground" ? controller.position : flightController.position;
    const groundY = options.sampler.sampleSurfaceHeight(current.x, current.z);
    travelMode = nextMode;
    lockedClip = false;
    lastMode = null;
    if (nextMode === "ground") {
      controller.position.set(current.x, groundY, current.z);
      flightController.setMode("ground", groundY);
      syncGroundCharacter();
      return;
    }
    flightController.position.set(current.x, current.y, current.z);
    flightController.setMode(nextMode, groundY);
    flightController.position.y = clampFlightHeightAboveGround(
      flightController.position.y,
      groundY,
      nextMode,
      scale
    );
    syncFlightCharacter();
  }

  function snapshot(): CharacterPlayerSnapshot {
    const active = travelMode === "ground" ? controller : flightController;
    return {
      position: active.position.clone(),
      heading: active.getHeading(),
      speed: active.getSpeed(),
      travelMode,
      movementMode: travelMode === "ground" ? controller.getMode() : "idle",
      currentClip: character.current()
    };
  }

  function update(dt: number, input: KeyboardInputState, cameraYaw: number): CharacterPlayerSnapshot {
    if (input.directClipDigit !== null) {
      const clip = clipsList[input.directClipDigit - 1];
      if (clip) {
        character.play(clip);
        lockedClip = true;
        lastMode = null;
      }
    }
    if (lockedClip && isAnyMovementInput(input)) {
      lockedClip = false;
    }
    if (input.cycleTravelMode && !previousCycleHeld) {
      setTravelMode(cycleTravelMode(travelMode));
    }
    previousCycleHeld = input.cycleTravelMode;

    let mode: MovementMode = "idle";
    if (travelMode === "ground") {
      controller.setHeading(cameraYaw);
      controller.update(dt, input, cameraYaw);
      syncGroundCharacter();
      mode = resolveTravelAnimationMode(travelMode, controller.getMode(), input.shift);
    } else {
      flightController.setHeading(cameraYaw);
      flightController.update(dt, input, cameraYaw);
      syncFlightCharacter();
      if (travelMode === "cloud") {
        updateCloudFlightVisual(cloudVisual, flightController.getSpeed(), dt);
      }
      mode = resolveTravelAnimationMode(travelMode, "idle", input.shift);
    }

    playMode(mode);
    character.update(dt);
    applyIdleRelaxOffsets(character, mode, travelMode);
    syncFlightVisuals(
      swordVisual,
      cloudVisual,
      travelMode,
      flightController,
      travelMode === "ground" ? controller.position : flightController.position
    );
    return snapshot();
  }

  syncGroundCharacter();
  playMode("idle");
  syncFlightVisuals(swordVisual, cloudVisual, travelMode, flightController, controller.position);

  return {
    character,
    controller,
    flightController,
    swordVisual,
    cloudVisual,
    update,
    position() {
      return travelMode === "ground" ? controller.position : flightController.position;
    },
    heading() {
      return travelMode === "ground" ? controller.getHeading() : flightController.getHeading();
    },
    travelMode() {
      return travelMode;
    },
    snapshot,
    setTravelMode,
    setHeading(value: number) {
      controller.setHeading(value);
      flightController.setHeading(value);
      if (travelMode === "ground") syncGroundCharacter();
      else syncFlightCharacter();
    },
    dispose() {
      options.scene.remove(character.root, swordVisual, cloudVisual);
      const sword = swordVisual.children[0] as Group | undefined;
      if (sword) applySwordTransform(sword);
    }
  };
}
