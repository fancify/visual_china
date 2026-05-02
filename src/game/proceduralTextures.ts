import { CanvasTexture } from "three";

/**
 * 这一组 helper 用 Canvas2D 离屏画一些简单贴图（光晕、月亮、云朵），
 * 然后 wrap 成 Three.js CanvasTexture。
 *
 * 抽到独立模块的原因：原本散落在 main.ts 头部 200 多行，跟场景初始化混在
 * 一起。它们没有任何运行时状态，是纯函数。
 */

export function createCircleTexture(
  innerColor: string,
  outerColor: string,
  size = 256
): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Failed to create texture context");
  }

  const gradient = context.createRadialGradient(
    size * 0.5,
    size * 0.5,
    size * 0.06,
    size * 0.5,
    size * 0.5,
    size * 0.45
  );
  gradient.addColorStop(0, innerColor);
  gradient.addColorStop(1, outerColor);

  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export function createMoonTexture(size = 256): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Failed to create moon texture context");
  }

  const center = size * 0.5;
  const radius = size * 0.32;
  context.clearRect(0, 0, size, size);
  context.beginPath();
  context.arc(center, center, radius, 0, Math.PI * 2);
  context.fillStyle = "rgba(232, 236, 224, 0.86)";
  context.fill();

  const markings: Array<[number, number, number, number]> = [
    [0.42, 0.42, 0.055, 0.13],
    [0.57, 0.48, 0.08, 0.1],
    [0.47, 0.61, 0.065, 0.11],
    [0.61, 0.62, 0.035, 0.09]
  ];
  markings.forEach(([x, y, r, opacity]) => {
    context.beginPath();
    context.arc(size * x, size * y, size * r, 0, Math.PI * 2);
    context.fillStyle = `rgba(120, 132, 128, ${opacity})`;
    context.fill();
  });

  context.beginPath();
  context.arc(center, center, radius, 0, Math.PI * 2);
  context.strokeStyle = "rgba(255, 255, 246, 0.22)";
  context.lineWidth = 2;
  context.stroke();

  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * 星空 dome 上的随机点分布。
 *
 * 旧版 `((index * 61) % 100) / 100` 只产 100 档 elevation，count > 100 后
 * 每档堆很多点，夜空看上去会出现明显的水平条纹。换成"球面 Fibonacci 螺旋"
 * （golden-angle azimuth + 单调 colatitude）：在球面上严格无重叠地分布
 * count 个点，5000 颗也不会出现 banding。
 *
 * 这里只取上半球（cos(phi) >= 0.08，对应高度角 ~4.6° 以上），地平线下不渲染。
 */
export function createStarDomePositions(
  count: number,
  radius: number
): Float32Array {
  const positions = new Float32Array(count * 3);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const minSinElevation = 0.08;

  for (let index = 0; index < count; index += 1) {
    // (index + 0.5) / count 在 (0, 1) 区间均匀分布；
    // 映射到 sin(elevation) ∈ [minSinElevation, 1] 实现"只用上半球"。
    const sinElevation =
      minSinElevation + ((index + 0.5) / count) * (1 - minSinElevation);
    const cosElevation = Math.sqrt(Math.max(0, 1 - sinElevation * sinElevation));
    const azimuth = index * goldenAngle;

    positions[index * 3] = Math.cos(azimuth) * cosElevation * radius;
    positions[index * 3 + 1] = sinElevation * radius;
    positions[index * 3 + 2] = Math.sin(azimuth) * cosElevation * radius;
  }

  return positions;
}

export function createCloudTexture(size = 512): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Failed to create cloud texture context");
  }

  const gradient = context.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, "rgba(255, 246, 214, 0)");
  gradient.addColorStop(0.45, "rgba(255, 246, 214, 0.38)");
  gradient.addColorStop(1, "rgba(255, 246, 214, 0)");
  context.fillStyle = gradient;

  for (let index = 0; index < 14; index += 1) {
    const x = size * (0.12 + Math.random() * 0.76);
    const y = size * (0.24 + Math.random() * 0.5);
    const radiusX = size * (0.12 + Math.random() * 0.18);
    const radiusY = size * (0.055 + Math.random() * 0.08);
    context.beginPath();
    context.ellipse(x, y, radiusX, radiusY, Math.random() * 0.4 - 0.2, 0, Math.PI * 2);
    context.fill();
  }

  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
