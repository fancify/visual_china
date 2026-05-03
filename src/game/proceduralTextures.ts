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
  // 月盘主体必须是实心 alpha=1，否则星点会穿过 disc。
  context.fillStyle = "rgba(232, 236, 224, 1)";
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

export interface StarDomeData {
  positions: Float32Array;
  colors: Float32Array;
  phases: Float32Array;
}

/**
 * 程序化星空 dome：上半球随机分布 + 银河平面密度偏置 + 单星亮度/色温差异。
 *
 * 用户反馈"等距均匀分布是非常不对的"。Fibonacci 螺旋虽然消除 banding，
 * 但在视觉上仍是均匀的（每个区域密度一致）。真实夜空里：
 *   - 银河方向恒星密度比离银面远的方向高 5-10 倍（visual 上是一条亮带）
 *   - 大部分星很暗（log-normal 亮度分布），只有少数明亮指标星
 *   - 颜色不是纯白，主序星根据光谱型分布偏黄/橙/红/蓝
 *
 * 用确定性 LCG 伪随机（不用 Math.random()）保证每次 build 出同一片星空，
 * 调试体验稳定。开销：5000 点 × 24 字节属性 = 120KB GPU buffer，单次
 * 上传，零运行时压力。
 */
export function createStarDome(count: number, radius: number): StarDomeData {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const phases = new Float32Array(count);

  // LCG 伪随机：seed=137 写死保证可复现
  let seed = 137;
  const rand = (): number => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };

  // 银河北极方向（向上 + 向南偏 + 向东偏，稍微倾斜一点出彩）
  const galPole = normalize3({ x: 0.30, y: 0.85, z: 0.40 });
  // 与银极正交的两个基向量（任意一对正交基都行）
  const galE1 = normalize3(orthogonalVector(galPole));
  const galE2 = cross3(galPole, galE1);

  // 0.45 比例银河带：随机方位 + 小俯仰角（接近银面）
  // 0.55 比例全天散布：上半球均匀
  const galacticBandRatio = 0.45;
  const minSinElevation = 0.06;

  for (let index = 0; index < count; index += 1) {
    let dx: number, dy: number, dz: number;

    if (rand() < galacticBandRatio) {
      // 银河带：在 galPole 的赤道上随机方位 + 高斯小偏角
      const azimuth = rand() * Math.PI * 2;
      // 偏离银面的角度，集中在 ±10° 以内
      const tiltCos = Math.cos((rand() - 0.5) * 0.35);
      const tiltSin = Math.sin((rand() - 0.5) * 0.35);
      // 银面方向 = cos(azimuth)*galE1 + sin(azimuth)*galE2，乘以 tiltCos
      // 加 tiltSin*galPole 偏出银面
      const planeX = Math.cos(azimuth) * galE1.x + Math.sin(azimuth) * galE2.x;
      const planeY = Math.cos(azimuth) * galE1.y + Math.sin(azimuth) * galE2.y;
      const planeZ = Math.cos(azimuth) * galE1.z + Math.sin(azimuth) * galE2.z;
      dx = planeX * tiltCos + galPole.x * tiltSin;
      dy = planeY * tiltCos + galPole.y * tiltSin;
      dz = planeZ * tiltCos + galPole.z * tiltSin;
    } else {
      // 全天均匀：上半球（sin(elev) ∈ [minSinElev, 1]）
      const sinElev = minSinElevation + rand() * (1 - minSinElevation);
      const cosElev = Math.sqrt(Math.max(0, 1 - sinElev * sinElev));
      const azimuth = rand() * Math.PI * 2;
      dx = Math.cos(azimuth) * cosElev;
      dy = sinElev;
      dz = Math.sin(azimuth) * cosElev;
    }

    // 强制提到地平线以上（dy < minSinElevation 的星点压回到水平面附近）
    if (dy < minSinElevation) {
      dy = minSinElevation + Math.abs(dy - minSinElevation) * 0.6;
      const norm = Math.sqrt(dx * dx + dy * dy + dz * dz);
      dx /= norm;
      dy /= norm;
      dz /= norm;
    }

    positions[index * 3] = dx * radius;
    positions[index * 3 + 1] = dy * radius;
    positions[index * 3 + 2] = dz * radius;

    // 亮度幂律分布：rand()^2.5 偏向 0，少数明亮、多数暗淡
    const brightnessFactor = Math.pow(rand(), 2.5);
    const brightness = 0.25 + brightnessFactor * 0.75;

    // 色温分布：70% 白、15% 黄、8% 橙红、7% 蓝
    const tintRoll = rand();
    let r: number, g: number, b: number;
    if (tintRoll < 0.70) {
      r = 1.0; g = 1.0; b = 1.0;
    } else if (tintRoll < 0.85) {
      r = 1.0; g = 0.92; b = 0.78;
    } else if (tintRoll < 0.93) {
      r = 1.0; g = 0.78; b = 0.55;
    } else {
      r = 0.75; g = 0.86; b = 1.0;
    }

    colors[index * 3] = r * brightness;
    colors[index * 3 + 1] = g * brightness;
    colors[index * 3 + 2] = b * brightness;
    phases[index] = rand() * Math.PI * 2;
  }

  return { positions, colors, phases };
}

function normalize3(v: { x: number; y: number; z: number }) {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function cross3(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number }
) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}

function orthogonalVector(v: { x: number; y: number; z: number }) {
  // 找一个 v 的正交向量：用 v 与 axis 中较不平行的一个 cross
  const axis = Math.abs(v.x) < 0.5
    ? { x: 1, y: 0, z: 0 }
    : { x: 0, y: 1, z: 0 };
  return cross3(v, axis);
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
