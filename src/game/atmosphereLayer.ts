import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Color,
  type CanvasTexture
} from "three";

import { skyDomePolicy } from "./skyDome.js";
import {
  createCircleTexture,
  createCloudTexture,
  createMoonTexture,
  createStarDomePositions
} from "./proceduralTextures";

export interface SkyDomeHandle {
  group: Group;
  shell: Mesh;
  shellMaterial: ShaderMaterial;
  starDome: Points;
  starDomeMaterial: PointsMaterial;
  sunDisc: Sprite;
  sunDiscMaterial: SpriteMaterial;
  moonDisc: Sprite;
  moonDiscMaterial: SpriteMaterial;
}

/**
 * 自定义 sky shader：
 * - 顶部 zenithColor → 地平线 horizonColor 的渐变（一次 fragment shader 完成，
 *   不需要每帧 CPU 计算）
 * - 底部稍暗、轻雾感（fadeBottom 系数）
 * - 时间相位驱动 sun/moon disc 用 sprite，单独控制
 *
 * EnvironmentController.computeVisuals() 每帧产出 `skyColor`，runtime 把
 * `horizonColor` 设为它，`zenithColor` 在它基础上拉低饱和度并偏蓝，得到
 * "上深下浅"的天穹效果。这是替代之前 MeshBasicMaterial 单色 shell 的最低成本
 * 升级，浏览器开销几乎不变。
 */
const SKY_VERTEX = /* glsl */ `
  varying vec3 vWorldPos;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const SKY_FRAGMENT = /* glsl */ `
  uniform vec3 zenithColor;
  uniform vec3 horizonColor;
  uniform vec3 groundColor;
  uniform float horizonSoftness;
  varying vec3 vWorldPos;
  void main() {
    vec3 dir = normalize(vWorldPos);
    float t = smoothstep(-0.05, 0.65, dir.y);
    vec3 sky = mix(horizonColor, zenithColor, t);
    float groundMix = smoothstep(0.0, -0.18, dir.y);
    sky = mix(sky, groundColor, groundMix * horizonSoftness);
    gl_FragColor = vec4(sky, 1.0);
  }
`;

function makeSkyShellMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: SKY_VERTEX,
    fragmentShader: SKY_FRAGMENT,
    uniforms: {
      zenithColor: { value: new Color(0x4d7d96) },
      horizonColor: { value: new Color(0xb6c4be) },
      groundColor: { value: new Color(0x14201f) },
      horizonSoftness: { value: 0.55 }
    },
    side: BackSide,
    depthTest: false,
    depthWrite: false,
    fog: false
  });
}

export function createSkyDome(): SkyDomeHandle {
  const group = new Group();
  group.renderOrder = -1000;

  const shellMaterial = makeSkyShellMaterial();
  const shell = new Mesh(
    new SphereGeometry(skyDomePolicy.radius, 48, 24),
    shellMaterial
  );
  shell.renderOrder = -1000;
  group.add(shell);

  const starDomeGeometry = new BufferGeometry();
  starDomeGeometry.setAttribute(
    "position",
    new BufferAttribute(
      createStarDomePositions(360, skyDomePolicy.radius * 0.92),
      3
    )
  );
  const starDomeMaterial = new PointsMaterial({
    color: 0xf1f5ff,
    size: 1.1,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
    fog: false
  });
  const starDome = new Points(starDomeGeometry, starDomeMaterial);
  starDome.renderOrder = -999;
  group.add(starDome);

  const sunDiscMaterial = new SpriteMaterial({
    map: createCircleTexture(
      "rgba(255, 244, 203, 0.9)",
      "rgba(255, 194, 91, 0)",
      256
    ),
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
    fog: false
  });
  const sunDisc = new Sprite(sunDiscMaterial);
  sunDisc.renderOrder = -998;
  group.add(sunDisc);

  const moonDiscMaterial = new SpriteMaterial({
    map: createMoonTexture(256),
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
    fog: false
  });
  const moonDisc = new Sprite(moonDiscMaterial);
  moonDisc.renderOrder = -998;
  group.add(moonDisc);

  return {
    group,
    shell,
    shellMaterial,
    starDome,
    starDomeMaterial,
    sunDisc,
    sunDiscMaterial,
    moonDisc,
    moonDiscMaterial
  };
}

/**
 * 当 EnvironmentController 重新算完一帧 visuals 后调用，把当前 sky shader 的
 * 颜色 uniform 同步过去。zenith 比 horizon 更深更冷一些，模拟空气透视。
 */
export function applySkyVisuals(
  handle: SkyDomeHandle,
  options: {
    skyColor: Color;
    starOpacity: number;
  }
): void {
  const horizon = options.skyColor;
  const zenith = horizon.clone().multiplyScalar(0.62).offsetHSL(0.012, -0.05, -0.04);
  const ground = horizon.clone().multiplyScalar(0.18);

  handle.shellMaterial.uniforms.horizonColor.value.copy(horizon);
  handle.shellMaterial.uniforms.zenithColor.value.copy(zenith);
  handle.shellMaterial.uniforms.groundColor.value.copy(ground);
  handle.starDomeMaterial.opacity = options.starOpacity;
}

export interface CloudLayerHandle {
  group: Group;
  sprites: Sprite[];
  texture: CanvasTexture;
  material: SpriteMaterial;
}

/**
 * 7 个云朵 sprite 共享同一个 SpriteMaterial。原版每个云朵 new 一个 material，
 * 这里改成共享，减少 7 → 1 个 material 实例。每帧改 opacity / color 时改的是
 * 共享 material，所有云朵同步变化（视觉上无差别）。
 */
export function createCloudLayer(): CloudLayerHandle {
  const group = new Group();
  const texture = createCloudTexture();
  const material = new SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    opacity: 0.18
  });
  const sprites: Sprite[] = [];

  for (let index = 0; index < 7; index += 1) {
    const cloud = new Sprite(material);
    cloud.renderOrder = 10;
    cloud.scale.set(54 + index * 7, 18 + (index % 3) * 5, 1);
    cloud.userData.baseX = -140 + index * 48;
    cloud.userData.baseZ = -96 + (index % 4) * 58;
    cloud.userData.phase = index * 0.73;
    sprites.push(cloud);
    group.add(cloud);
  }

  return { group, sprites, texture, material };
}

export interface PrecipitationHandle {
  points: Points;
  material: PointsMaterial;
  geometry: BufferGeometry;
  positions: Float32Array;
  offsets: number[];
  count: number;
}

/**
 * 雨/雪粒子系统。粒子数 240（原版 480 减半，视觉差别 minimal）。
 * `points.visible = false` 由 main 循环根据 weather 控制；不可见时主循环
 * 也不更新 positions，CPU 完全空闲。
 */
export function createPrecipitationLayer(count = 240): PrecipitationHandle {
  const geometry = new BufferGeometry();
  const positions = new Float32Array(count * 3);
  const offsets: number[] = [];

  for (let index = 0; index < count; index += 1) {
    positions[index * 3] = (Math.random() - 0.5) * 50;
    positions[index * 3 + 1] = Math.random() * 26 + 4;
    positions[index * 3 + 2] = (Math.random() - 0.5) * 50;
    offsets.push(Math.random() * Math.PI * 2);
  }

  geometry.setAttribute("position", new BufferAttribute(positions, 3));

  const material = new PointsMaterial({
    color: 0xd6eef8,
    size: 0.18,
    transparent: true,
    opacity: 0,
    depthWrite: false
  });
  const points = new Points(geometry, material);
  points.visible = false;
  points.frustumCulled = true;

  return { points, material, geometry, positions, offsets, count };
}

// MeshBasicMaterial 引用一下避免 import 警告（以前 sky shell 用过它，现在改 shader）
void MeshBasicMaterial;
