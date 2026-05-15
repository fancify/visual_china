import {
  Box3,
  Color,
  DataTexture,
  Group,
  LinearFilter,
  Mesh,
  MeshStandardMaterial,
  RGBAFormat,
  Sprite,
  SpriteMaterial,
  Vector3
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const SWORD_GLB_URL = "/models/skeletal/Meshy_AI_Antique_dagger_with_b_0514200048_texture.glb";

/** 剑 GLB 的 transform 参数。runtime 可改（由 #offset-panel 调），加载完后由 attachSwordGltf 应用到 scene。 */
export const SWORD_TRANSFORM = {
  rotX: -2.762,
  rotY: 2.828,
  rotZ: -0.842,
  posX: -0.050,
  posY: -0.030,
  posZ: 0.020,
  scale: 0.470
};

/** 把 SWORD_TRANSFORM 应用到 scene（每次 slider 改后调用）。 */
export function applySwordTransform(scene: Group): void {
  scene.rotation.order = "ZXY";
  scene.rotation.set(SWORD_TRANSFORM.rotX, SWORD_TRANSFORM.rotY, SWORD_TRANSFORM.rotZ);
  scene.position.set(SWORD_TRANSFORM.posX, SWORD_TRANSFORM.posY, SWORD_TRANSFORM.posZ);
  scene.scale.setScalar(SWORD_TRANSFORM.scale);
}

export function createSwordFlightVisual(): Group {
  const root = new Group();
  root.name = "sword-flight-visual";
  root.scale.setScalar(1);
  return root;
}

/** 浏览器端异步加载剑 GLB 并 attach 到 placeholder root。Node 测试环境不要调。 */
export async function attachSwordGltf(root: Group): Promise<void> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(SWORD_GLB_URL);
  const scene = gltf.scene;

  // 保留 Meshy 给的 baseColor + texture map（让剑柄/挡手保持原木质/金属色），
  // 只调 PBR 参数让金属感更强：剑刃 texture 是亮金属色 → 高 metalness 下自然反光，
  // 剑柄 texture 是深色 → 低反光仍显原色。整个 mesh 单一 material，无法分区域染。
  scene.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as MeshStandardMaterial[];
    for (const mat of mats) {
      if (!mat) continue;
      mat.metalness = 0.85; // 高金属感让剑刃反光更亮
      mat.roughness = 0.25; // 低粗糙度让反光更锐
      // 2026-05-15: Meshy 默认 emissive=#ffffff intensity=1 让剑自己发光
      // 跟场景光照解耦 → 夜里也刺眼。强制关掉。
      if (mat.emissive) mat.emissive.setHex(0x000000);
      mat.emissiveIntensity = 0;
      mat.needsUpdate = true;
    }
  });

  // Meshy 剑的特殊原始朝向（PCA 测出）：剑身躺在 XY 平面里、沿对角线 +45°，
  // 三步旋转让剑身水平 + 剑尖朝 +X（character 前进方向）：Z -π/4 → X -π/2 → Y π。
  // 用 'ZXY' Euler 顺序保证旋转应用顺序。具体值在 SWORD_TRANSFORM 里，可被 panel 实时改。
  applySwordTransform(scene);

  root.add(scene);

  // 暴露到 window 方便浏览器 console 调参
  if (typeof window !== "undefined") {
    (window as unknown as { __swordDebug?: unknown }).__swordDebug = { root, scene };
  }
}

export function createCloudFlightVisual(): Group {
  const root = new Group();
  root.name = "cloud-flight-visual";
  root.scale.set(0.65, 1, 0.65);

  const seat = createSmokeSprite("cloud-seat-layer", 0xf0e0b6, 0.72);
  seat.position.set(0.1, -0.18, 0);
  seat.scale.set(3.65, 1.08, 1);
  seat.userData.baseY = seat.position.y;
  seat.userData.baseScaleX = seat.scale.x;
  seat.userData.baseScaleY = seat.scale.y;
  root.add(seat);

  const puffs: Array<[number, number, number, number, number, number]> = [
    [0.06, 0.02, 0, 1.86, 0.96, 0.84],
    [-0.58, -0.02, 0.06, 1.54, 0.82, 0.78],
    [0.7, -0.03, -0.06, 1.48, 0.78, 0.76],
    [1.2, -0.08, 0.08, 1.36, 0.76, 0.72],
    [-1.16, -0.12, 0.12, 1.1, 0.58, 0.66],
    [0.02, 0.1, -0.58, 1.36, 0.66, 0.66],
    [0.42, 0.08, 0.58, 1.44, 0.68, 0.68],
    [-0.46, 0.06, -0.54, 1.2, 0.58, 0.62],
    [0.08, -0.17, 0.0, 2.15, 0.62, 0.72],
    [0.92, -0.18, 0.34, 1.22, 0.46, 0.56],
    [-0.94, -0.2, -0.34, 1.18, 0.44, 0.54],
    [1.64, -0.16, -0.04, 1.16, 0.58, 0.54],
    [-1.62, -0.22, 0.02, 0.86, 0.4, 0.46],
    [0.7, -0.25, -0.48, 1.02, 0.36, 0.44],
    [-0.62, -0.25, 0.48, 0.98, 0.34, 0.42],
    [1.96, -0.24, 0.12, 0.98, 0.46, 0.44],
    [-1.98, -0.28, -0.1, 0.66, 0.3, 0.34],
    [0.0, -0.31, 0.0, 2.55, 0.42, 0.58],
    [0.36, 0.2, 0.0, 1.08, 0.54, 0.48],
    [-0.3, 0.18, 0.25, 0.96, 0.5, 0.44],
    [0.78, 0.12, -0.36, 0.88, 0.44, 0.42],
    [-0.78, 0.1, -0.28, 0.9, 0.44, 0.42],
    [1.28, 0.02, 0.38, 0.96, 0.48, 0.44],
    [-1.28, -0.02, -0.38, 0.72, 0.34, 0.36],
    [1.52, -0.04, -0.4, 0.88, 0.42, 0.4],
    [-1.46, -0.1, 0.42, 0.64, 0.32, 0.34],
    [0.18, -0.36, -0.3, 1.52, 0.34, 0.42],
    [-0.2, -0.36, 0.3, 1.48, 0.34, 0.4],
    [0.98, -0.34, -0.08, 1.14, 0.36, 0.38],
    [2.14, -0.08, -0.22, 0.78, 0.38, 0.36],
    [2.14, -0.08, 0.22, 0.78, 0.38, 0.36],
    [1.72, 0.08, 0.0, 1.0, 0.5, 0.42],
    [-1.0, -0.36, 0.08, 0.98, 0.3, 0.32]
  ];

  puffs.forEach(([x, y, z, scaleX, scaleY, opacity], index) => {
    const blob = createSmokeSprite(`cloud-puff-${index + 1}`, 0xf7efd8, opacity);
    blob.name = `cloud-puff-${index + 1}`;
    blob.position.set(x, y, z);
    blob.scale.set(scaleX, scaleY, 1);
    blob.userData.baseY = y;
    blob.userData.baseScaleX = blob.scale.x;
    blob.userData.baseScaleY = blob.scale.y;
    blob.userData.baseOpacity = opacity;
    blob.userData.phase = index * 0.75;
    root.add(blob);
  });

  const shadows: Array<[number, number, number, number, number, number]> = [
    [0.0, -0.4, 0, 2.4, 0.46, 0.46],
    [-0.8, -0.36, 0.18, 1.34, 0.36, 0.34],
    [0.86, -0.36, -0.16, 1.4, 0.36, 0.34],
    [-1.42, -0.34, -0.08, 0.92, 0.28, 0.28],
    [1.48, -0.32, 0.08, 1.2, 0.36, 0.34],
    [2.08, -0.28, 0.0, 0.82, 0.3, 0.26],
    [0.18, -0.34, -0.56, 1.08, 0.26, 0.26],
    [0.28, -0.34, 0.58, 1.08, 0.26, 0.26]
  ];
  shadows.forEach(([x, y, z, scaleX, scaleY, opacity], index) => {
    const shadow = createSmokeSprite(`cloud-shadow-${index + 1}`, 0xa9966e, opacity);
    shadow.position.set(x, y, z);
    shadow.scale.set(scaleX, scaleY, 1);
    shadow.userData.baseY = y;
    shadow.userData.baseScaleX = scaleX;
    shadow.userData.baseScaleY = scaleY;
    shadow.userData.baseOpacity = opacity;
    shadow.userData.phase = index * 0.62;
    root.add(shadow);
  });

  const highlights: Array<[number, number, number, number, number, number]> = [
    [0.0, 0.26, -0.06, 1.15, 0.32, 0.5],
    [0.58, 0.18, 0.32, 0.9, 0.28, 0.42],
    [-0.56, 0.16, -0.32, 0.88, 0.26, 0.4],
    [1.05, 0.04, -0.22, 0.9, 0.26, 0.4],
    [-1.02, 0.02, 0.22, 0.76, 0.22, 0.34],
    [0.3, 0.12, 0.62, 0.72, 0.2, 0.32],
    [-0.18, 0.14, -0.66, 0.72, 0.2, 0.32],
    [1.42, -0.04, 0.06, 0.76, 0.24, 0.34],
    [1.9, 0.0, 0.0, 0.62, 0.22, 0.3]
  ];
  highlights.forEach(([x, y, z, scaleX, scaleY, opacity], index) => {
    const highlight = createSmokeSprite(`cloud-highlight-${index + 1}`, 0xfff2ce, opacity);
    highlight.position.set(x, y, z);
    highlight.scale.set(scaleX, scaleY, 1);
    highlight.userData.baseY = y;
    highlight.userData.baseScaleX = scaleX;
    highlight.userData.baseScaleY = scaleY;
    highlight.userData.baseOpacity = opacity;
    highlight.userData.phase = index * 0.7;
    root.add(highlight);
  });

  const curls: Array<[string, number, number, number, number, number, number]> = [
    ["cloud-curl-left", -0.98, -0.08, -0.42, 1.08, 0.34, -0.24],
    ["cloud-curl-right", 1.02, -0.1, 0.42, 1.18, 0.36, 0.18],
    ["cloud-curl-front", 0.0, -0.06, 0.68, 1.2, 0.32, 0.08],
    ["cloud-curl-rear", -1.55, -0.19, -0.08, 0.86, 0.28, -0.18]
  ];
  curls.forEach(([name, x, y, z, scaleX, scaleY, rotation], index) => {
    const curl = createSmokeSprite(name, 0xd0bd8d, 0.42);
    curl.position.set(x, y, z);
    curl.scale.set(scaleX, scaleY, 1);
    curl.material.rotation = rotation;
    curl.userData.baseY = y;
    curl.userData.baseScaleX = scaleX;
    curl.userData.baseScaleY = scaleY;
    curl.userData.phase = index * 0.9;
    root.add(curl);
  });

  return root;
}

export function updateCloudFlightVisual(root: Group, speed: number, dt: number): void {
  const speedFactor = Math.min(Math.max(speed / 8, 0), 1);
  const drift = (root.userData.cloudDrift ?? 0) + dt * (1.1 + speedFactor * 4.2);
  root.userData.cloudDrift = drift;

  for (const child of root.children) {
    if (
      child.name.startsWith("cloud-puff") ||
      child.name.startsWith("cloud-shadow") ||
      child.name.startsWith("cloud-highlight")
    ) {
      const mesh = child as Sprite;
      const baseY = Number(mesh.userData.baseY ?? mesh.position.y);
      const baseScaleX = Number(mesh.userData.baseScaleX ?? mesh.scale.x);
      const baseScaleY = Number(mesh.userData.baseScaleY ?? mesh.scale.y);
      const baseOpacity = Number(mesh.userData.baseOpacity ?? mesh.material.opacity);
      const phase = Number(mesh.userData.phase ?? 0);
      const pulse = Math.sin(drift + phase) * 0.018;
      mesh.position.y = baseY + pulse - speedFactor * 0.018;
      mesh.scale.x = baseScaleX * (1 + speedFactor * 0.08 + Math.sin(drift * 0.8 + phase) * 0.025);
      mesh.scale.y = baseScaleY * (1 + speedFactor * 0.12 + Math.cos(drift + phase) * 0.035);
      mesh.material.opacity = Math.min(0.94, baseOpacity + speedFactor * 0.08);
    }

    if (child.name.startsWith("cloud-curl")) {
      const mesh = child as Sprite;
      const baseY = Number(mesh.userData.baseY ?? mesh.position.y);
      const baseScaleX = Number(mesh.userData.baseScaleX ?? mesh.scale.x);
      const phase = Number(mesh.userData.phase ?? 0);
      mesh.position.y = baseY + Math.sin(drift * 0.9 + phase) * 0.012;
      mesh.scale.x = baseScaleX * (1 + speedFactor * 0.22);
    }

  }
}

let smokeTexture: DataTexture | null = null;

function createSmokeSprite(name: string, color: number, opacity: number): Sprite {
  const material = new SpriteMaterial({
    map: getSmokeTexture(),
    color,
    transparent: true,
    opacity,
    depthWrite: true,
    depthTest: true,
    alphaTest: 0.02
  });
  const sprite = new Sprite(material);
  sprite.name = name;
  sprite.renderOrder = 32;
  // 保存原始颜色给 tintCloudFlightVisual 用（sprite 不响应光照，需要手动 tint）
  sprite.userData.baseColorHex = color;
  return sprite;
}

/**
 * 2026-05-15: Sprite 不响应 Three.js 灯光，所以筋斗云在黑夜里依旧雪白刺眼。
 * 每帧根据场景 ambient 亮度 + 色调手动 tint 所有云朵 sprite。
 * 入参 brightness 0..1 表示场景明暗（夜里 ~0.15, 中午 ~1.0），tintColor 是场景环境色。
 */
export function tintCloudFlightVisual(root: Group, brightness: number, tintColor: Color): void {
  const b = Math.max(0.05, Math.min(1, brightness));
  for (const child of root.children) {
    const sprite = child as Sprite;
    const mat = sprite.material as SpriteMaterial | undefined;
    if (!mat || !mat.color) continue;
    const baseHex = Number(sprite.userData.baseColorHex);
    if (!Number.isFinite(baseHex)) continue;
    mat.color.setHex(baseHex).multiply(tintColor).multiplyScalar(b);
  }
}

function getSmokeTexture(): DataTexture {
  if (smokeTexture) return smokeTexture;

  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = (x / (size - 1)) * 2 - 1;
      const ny = (y / (size - 1)) * 2 - 1;
      const radius = Math.sqrt(nx * nx + ny * ny);
      const falloff = Math.max(0, 1 - radius);
      const core = Math.pow(falloff, 1.15);
      const grain = Math.sin(x * 0.63 + y * 0.37) * 0.06 + Math.sin(x * 0.21 - y * 0.51) * 0.05;
      const alpha = Math.max(0, Math.min(1, core * 1.18 + grain * falloff));
      const index = (y * size + x) * 4;
      data[index] = 255;
      data[index + 1] = 255;
      data[index + 2] = 255;
      data[index + 3] = Math.round(alpha * 255);
    }
  }

  smokeTexture = new DataTexture(data, size, size, RGBAFormat);
  smokeTexture.magFilter = LinearFilter;
  smokeTexture.minFilter = LinearFilter;
  smokeTexture.needsUpdate = true;
  return smokeTexture;
}
