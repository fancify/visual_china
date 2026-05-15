import { Vector3 } from "three";
import type { TerrainSurfaceSampler } from "./demoTerrain.js";

/**
 * WASD 输入 + 朝向控制 + 终点高度采样 + 速度计算。
 *
 * Movement model — 简化 BotW-style：
 * - WASD 输入解读为 2D 方向（无视相机旋转，世界坐标系内 W=+X, S=-X,
 *   D=-Z, A=+Z）。M1 阶段先这样，相机相对的版本留给 M2。
 * - 输入 magnitude>0 时，character heading 平滑插值朝输入方向；同时
 *   沿当前 heading 前进。Shift 加速到 runSpeed。
 * - 无输入时速度衰减到 0，character 停在原地但不"反向滑回"。
 * - 地面 Y 通过 sampler 在 position.x/z 处采样，character.position.y 跟随。
 */

export interface KeyboardInputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  shift: boolean;
  ascend: boolean;
  descend: boolean;
  cycleTravelMode: boolean;
  /** 最近一次按下的数字键（1-9）；tick 消费后清零。用于直接播放某个 clip。 */
  directClipDigit: number | null;
}

export interface KeyboardInputHandle {
  state: KeyboardInputState;
  dispose(): void;
}

export function createKeyboardInput(): KeyboardInputHandle {
  const state: KeyboardInputState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    shift: false,
    ascend: false,
    descend: false,
    cycleTravelMode: false,
    directClipDigit: null
  };
  let cycleKeyDown = false;

  const update = (event: KeyboardEvent, down: boolean): void => {
    switch (event.code) {
      case "KeyW":
      case "ArrowUp":
        state.forward = down;
        break;
      case "KeyS":
      case "ArrowDown":
        state.backward = down;
        break;
      case "KeyA":
      case "ArrowLeft":
        state.left = down;
        break;
      case "KeyD":
      case "ArrowRight":
        state.right = down;
        break;
      case "ShiftLeft":
      case "ShiftRight":
        state.shift = down;
        break;
      case "Space":
        state.ascend = down;
        break;
      case "KeyC":
        state.descend = down;
        break;
      case "KeyP":
        state.cycleTravelMode = down && !cycleKeyDown;
        cycleKeyDown = down;
        break;
      case "Digit1":
      case "Digit2":
      case "Digit3":
      case "Digit4":
      case "Digit5":
      case "Digit6":
      case "Digit7":
      case "Digit8":
      case "Digit9":
        if (down) state.directClipDigit = parseInt(event.code.slice(5), 10);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  const onDown = (e: KeyboardEvent): void => update(e, true);
  const onUp = (e: KeyboardEvent): void => update(e, false);
  window.addEventListener("keydown", onDown);
  window.addEventListener("keyup", onUp);

  return {
    state,
    dispose() {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    }
  };
}

export interface CharacterControllerOptions {
  walkSpeed?: number;
  runSpeed?: number;
  /** heading 插值系数 (每帧 lerp 比例)。0.15 = 较快转向，~6 帧到位。 */
  headingLerp?: number;
  /** 输入解除时的速度衰减系数。值越小停得越快。 */
  decel?: number;
  sampler: TerrainSurfaceSampler;
  /** 初始世界坐标 (xz 平面)。Y 自动 sample。 */
  initialPosition?: { x: number; z: number };
}

export type MovementMode = "idle" | "walk" | "run";

export interface CharacterControllerHandle {
  /** 当前世界坐标。直接读取，writable 给子类用。 */
  position: Vector3;
  /** 当前 heading（弧度，0 = +X 方向）。 */
  getHeading(): number;
  setHeading(value: number): void;
  /** 当前移动速度（m/s）。 */
  getSpeed(): number;
  /** idle/walk/run — 派生自 speed 与 shift 状态。 */
  getMode(): MovementMode;
  update(dt: number, input: KeyboardInputState, inputYaw?: number): void;
}

/** 把 angle 归一化到 (-π, π]。 */
function shortestAngleDelta(target: number, current: number): number {
  let delta = target - current;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;
  return delta;
}

export function createCharacterController(
  options: CharacterControllerOptions
): CharacterControllerHandle {
  const {
    walkSpeed = 1.8,
    runSpeed = 4.5,
    headingLerp = 0.15,
    decel = 0.85,
    sampler,
    initialPosition = { x: 0, z: 0 }
  } = options;

  const position = new Vector3(
    initialPosition.x,
    sampler.sampleSurfaceHeight(initialPosition.x, initialPosition.z),
    initialPosition.z
  );
  let heading = 0;
  let speed = 0;
  let mode: MovementMode = "idle";

  return {
    position,
    getHeading() {
      return heading;
    },
    setHeading(value) {
      heading = value;
    },
    getSpeed() {
      return speed;
    },
    getMode() {
      return mode;
    },
    update(dt, input, inputYaw = 0) {
      // 输入向量（世界坐标，未旋转）。
      let inputX = 0;
      let inputZ = 0;
      if (input.forward) inputX += 1; // +X = "前"
      if (input.backward) inputX -= 1;
      if (input.left) inputZ -= 1;
      if (input.right) inputZ += 1;

      const magnitude = Math.hypot(inputX, inputZ);
      if (magnitude > 0) {
        inputX /= magnitude;
        inputZ /= magnitude;
        // 目标 heading：atan2(-inputZ, inputX) 让 +X 方向 = 0 rad，
        // 与 cos(h)/-sin(h) 推导前向一致。
        const targetHeading = Math.atan2(-inputZ, inputX) + inputYaw;
        heading += shortestAngleDelta(targetHeading, heading) * headingLerp;

        const targetSpeed = input.shift ? runSpeed : walkSpeed;
        speed = targetSpeed;
        mode = input.shift ? "run" : "walk";

        const forwardX = Math.cos(heading);
        const forwardZ = -Math.sin(heading);
        position.x += forwardX * speed * dt;
        position.z += forwardZ * speed * dt;
      } else {
        speed *= decel;
        if (speed < 0.02) {
          speed = 0;
          mode = "idle";
        }
      }

      position.y = sampler.sampleSurfaceHeight(position.x, position.z);
    }
  };
}
