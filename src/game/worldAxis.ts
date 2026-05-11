/**
 * 山河中国 · Three.js 引擎约定
 *
 * 这一层**只描述 3D 引擎几何**，不带任何"东南西北"地理语义。
 * 地理方向（北→世界哪个方向）由 mapOrientation.js 单独定义。
 *
 * Three.js / WebGL 右手坐标系约定：
 *
 *   +X 轴 = 屏幕右（camera default right axis）
 *   +Y 轴 = 屏幕上 / 高度方向（camera default up axis）
 *   -Z 轴 = 相机默认朝向（camera default forward）
 *   +Z 轴 = 相机背后（camera default backward）
 *
 * 这是 OpenGL 默认相机姿态——不可改变（Three.js camera matrix 内置）。
 *
 * 设计原则：让"地理北"映射到 -Z 方向，这样 Three.js 默认相机姿态
 * 自然就是"朝北看"，不需要任何 180° 翻转，所有方向（屏幕右=东、屏幕远=北）
 * 同时成立。"+Z=北"是错误的契约——见 mapOrientation.js 注释。
 */

export interface EngineAxisVector {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface EngineAxisContract {
  readonly description: string;
}

/** Three.js 右手系下，相机默认 forward 是 -Z 方向。 */
export const ENGINE_CAMERA_FORWARD_AXIS: EngineAxisVector = Object.freeze({ x: 0, y: 0, z: -1 });

/** Three.js 默认相机 right axis（屏幕右）= +X。 */
export const ENGINE_CAMERA_RIGHT_AXIS: EngineAxisVector = Object.freeze({ x: 1, y: 0, z: 0 });

/** Three.js 默认相机 up axis（屏幕上）= +Y。 */
export const ENGINE_CAMERA_UP_AXIS: EngineAxisVector = Object.freeze({ x: 0, y: 1, z: 0 });

export const ENGINE_AXIS_CONTRACT: EngineAxisContract = Object.freeze({
  description:
    "Three.js right-handed: +X right, +Y up, -Z forward (camera default). " +
    "No geographic meaning here—see mapOrientation for north/east mapping."
});
