import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  Points,
  PointsMaterial,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Color,
  Vector3,
  type CanvasTexture
} from "three";

import { skyDomePolicy } from "./skyDome.js";
import {
  createCircleTexture,
  createCloudTexture,
  moonPhaseTextureIndex,
  createMoonTexture,
  createStarDome
} from "./proceduralTextures";
import {
  createCloudLayer as createCloudPlaneLayer,
  type CloudLayerHandle
} from "./cloudPlanes";

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
  moonPhaseTextures: CanvasTexture[];
  moonPhaseTextureIndex: number;
}

interface StarTwinkleUniforms {
  twinkleTime: { value: number };
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
  varying vec3 vSkyDirection;
  void main() {
    vSkyDirection = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const SKY_FRAGMENT = /* glsl */ `
  uniform vec3 zenithColor;
  uniform vec3 horizonColor;
  uniform vec3 horizonCoolColor;
  uniform vec3 sunWarmColor;
  uniform vec3 groundColor;
  uniform vec3 sunDirection;
  uniform float horizonSoftness;
  uniform float sunInfluence;
  uniform float sunVisibility;
  varying vec3 vSkyDirection;
  const float PI = 3.141592653589793;
  float hgPhase(float cosTheta, float g) {
    float g2 = g * g;
    float denom = pow(max(0.0001, 1.0 - 2.0 * g * cosTheta + g2), 1.5);
    return (1.0 - g2) / (4.0 * PI * denom);
  }
  void main() {
    vec3 dir = normalize(vSkyDirection);
    vec3 sunDir3 = normalize(sunDirection);
    vec2 horizonVec = vec2(dir.x, dir.z);
    float horizonLen = length(horizonVec);
    vec2 horizonDir = horizonLen > 1e-4 ? horizonVec / horizonLen : vec2(1.0, 0.0);
    vec2 sunVec = vec2(sunDir3.x, sunDir3.z);
    float sunLen = length(sunVec);
    vec2 sunDir = sunLen > 1e-4 ? sunVec / sunLen : vec2(1.0, 0.0);
    float sunAzimuth = dot(horizonDir, sunDir);
    float sunSide = smoothstep(-0.2, 0.75, sunAzimuth);
    float horizonBand = 1.0 - smoothstep(0.02, 0.32, abs(dir.y));
    vec3 directionalHorizon = mix(horizonCoolColor, sunWarmColor, sunSide);
    vec3 horizonTint = mix(
      horizonColor,
      directionalHorizon,
      horizonBand * sunInfluence
    );
    float t = smoothstep(-0.05, 0.65, dir.y);
    vec3 sky = mix(horizonTint, zenithColor, t);
    float groundMix = smoothstep(0.0, -0.18, dir.y);
    sky = mix(sky, groundColor, groundMix * horizonSoftness);
    float sunCos = clamp(dot(dir, sunDir3), -1.0, 1.0);
    float mieForward = hgPhase(sunCos, 0.84);
    float sunAngularGlow = smoothstep(0.90, 1.0, sunCos);
    float broadSolarLift = smoothstep(0.28, 1.0, sunCos) * (1.0 - smoothstep(0.0, -0.18, dir.y));
    sky += sunWarmColor * sunInfluence * sunVisibility * (
      broadSolarLift * 0.08 +
      sunAngularGlow * 0.18 +
      clamp(mieForward * 0.045, 0.0, 0.28)
    );
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
      horizonCoolColor: { value: new Color(0x95a7bf) },
      sunWarmColor: { value: new Color(0xf3a37c) },
      groundColor: { value: new Color(0x14201f) },
      sunDirection: { value: new Vector3(1, 0, 0) },
      horizonSoftness: { value: 0.55 },
      sunInfluence: { value: 0 },
      sunVisibility: { value: 1 }
    },
    side: BackSide,
    depthTest: false,
    depthWrite: false,
    fog: false
  });
}

function installStarTwinkle(material: PointsMaterial): void {
  const twinkleUniforms: StarTwinkleUniforms = {
    twinkleTime: { value: 0 }
  };
  material.userData.twinkleUniforms = twinkleUniforms;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.twinkleTime = twinkleUniforms.twinkleTime;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
attribute float phase;
uniform float twinkleTime;
varying float vTwinkle;
varying float vHorizonFade;`
      )
      .replace(
        "#include <color_vertex>",
        `#include <color_vertex>
  vTwinkle = 0.55 + 0.45 * sin(twinkleTime * 1.6 + phase);
  vec3 starWorldDirection = normalize((modelMatrix * vec4(position, 1.0)).xyz - cameraPosition);
  vHorizonFade = smoothstep(-0.005, 0.045, starWorldDirection.y);`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying float vTwinkle;
varying float vHorizonFade;`
      )
      .replace(
        "vec4 diffuseColor = vec4( diffuse, opacity );",
        "vec4 diffuseColor = vec4( diffuse * vTwinkle, opacity * vHorizonFade );"
      )
      .replace(
        "#include <alphatest_fragment>",
        `if ( vHorizonFade <= 0.001 ) discard;
#include <alphatest_fragment>`
      );
    material.userData.shader = shader;
  };
  material.customProgramCacheKey = () => "star-twinkle-v1";
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

  // 5000 颗星，用银河带偏置的非均匀分布 + 每星亮度/色温差异。
  // vertexColors=true 让 PointsMaterial 直接采用 BufferAttribute 里的
  // 单星 RGB（已经把"亮度"乘进 RGB），所以不需要单独的 size attribute——
  // 暗星本身 RGB 接近黑色，渲染时几乎看不见，自然形成"少数明亮、多数暗淡"
  // 的分布。代价：还是单 draw call。
  const starDomeData = createStarDome(5000, skyDomePolicy.radius * 0.92);
  const starDomeGeometry = new BufferGeometry();
  starDomeGeometry.setAttribute(
    "position",
    new BufferAttribute(starDomeData.positions, 3)
  );
  starDomeGeometry.setAttribute(
    "color",
    new BufferAttribute(starDomeData.colors, 3)
  );
  starDomeGeometry.setAttribute(
    "phase",
    new BufferAttribute(starDomeData.phases, 1)
  );
  starDomeGeometry.userData.source = "real-northern-bright-stars-plus-procedural-background";
  starDomeGeometry.userData.namedStars = starDomeData.namedStars;
  starDomeGeometry.userData.milkyWay = starDomeData.milkyWay;
  const starDomeMaterial = new PointsMaterial({
    vertexColors: true,
    size: 2.25,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0,
    depthTest: true,
    depthWrite: false,
    fog: false
  });
  installStarTwinkle(starDomeMaterial);
  const starDome = new Points(starDomeGeometry, starDomeMaterial);
  starDome.renderOrder = -997;
  group.add(starDome);

  const sunDiscTexture = createCircleTexture(
    "rgba(255, 244, 214, 1)",
    "rgba(255, 206, 116, 0)",
    256,
    [
      { offset: 0, color: "rgba(255, 250, 226, 1)" },
      { offset: 0.38, color: "rgba(255, 238, 184, 0.86)" },
      { offset: 0.66, color: "rgba(255, 209, 124, 0.12)" },
      { offset: 1, color: "rgba(255, 206, 116, 0)" }
    ]
  );
  const sunDiscMaterial = new SpriteMaterial({
    map: sunDiscTexture,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
    fog: false
  });
  const sunDisc = new Sprite(sunDiscMaterial);
  sunDisc.renderOrder = -996;
  group.add(sunDisc);

  const moonPhaseTextures = Array.from({ length: 8 }, (_value, index) => {
    const texture = createMoonTexture(index / 8, 256);
    texture.userData.phaseIndex = index;
    return texture;
  });
  const defaultMoonPhaseIndex = 4;
  const moonDiscMaterial = new SpriteMaterial({
    map: moonPhaseTextures[defaultMoonPhaseIndex] ?? null,
    transparent: true,
    opacity: 0,
    alphaTest: 0.32,
    depthTest: true,
    depthWrite: true,
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
    moonDiscMaterial,
    moonPhaseTextures,
    moonPhaseTextureIndex: defaultMoonPhaseIndex
  };
}

/**
 * 当 EnvironmentController 重新算完一帧 visuals 后调用，把当前 sky shader 的
 * 颜色 uniform 同步过去。
 *
 * 参数变化：早期版本只接受 skyColor，shader 内部把 zenith 算成 horizon * 0.62；
 * 现在 environment 直接给出 horizon / zenith 双色，因为朝阳/黄昏需要"地平线
 * 暖橙、天顶蓝紫"的对比，单一 skyColor 推算不出。skyColor 仍传过来给 ground
 * 用——地下"伪反射"色继续按整体天色 18% 取。
 */
export function applySkyVisuals(
  handle: SkyDomeHandle,
  options: {
    skyColor: Color;
    skyHorizonColor: Color;
    skyZenithColor: Color;
    starOpacity: number;
    sunDirection?: Vector3;
    sunWarmColor?: Color;
    horizonCoolColor?: Color;
    groundColor?: Color;
    sunInfluence?: number;
    sunVisibility?: number;
    moonPhase?: number;
  }
): void {
  const ground = options.groundColor ?? options.skyColor.clone().multiplyScalar(0.18);

  handle.shellMaterial.uniforms.horizonColor.value.copy(options.skyHorizonColor);
  handle.shellMaterial.uniforms.zenithColor.value.copy(options.skyZenithColor);
  handle.shellMaterial.uniforms.horizonCoolColor.value.copy(
    options.horizonCoolColor ?? options.skyHorizonColor
  );
  handle.shellMaterial.uniforms.sunWarmColor.value.copy(
    options.sunWarmColor ?? options.skyHorizonColor
  );
  if (options.sunDirection) {
    handle.shellMaterial.uniforms.sunDirection.value.copy(options.sunDirection).normalize();
  }
  if (options.moonPhase !== undefined) {
    const phaseIndex = moonPhaseTextureIndex(options.moonPhase, handle.moonPhaseTextures.length);
    if (phaseIndex !== handle.moonPhaseTextureIndex) {
      handle.moonPhaseTextureIndex = phaseIndex;
      handle.moonDiscMaterial.map = handle.moonPhaseTextures[phaseIndex] ?? null;
      handle.moonDiscMaterial.needsUpdate = true;
    }
  }
  handle.shellMaterial.uniforms.groundColor.value.copy(ground);
  handle.shellMaterial.uniforms.sunInfluence.value = options.sunInfluence ?? 0;
  handle.shellMaterial.uniforms.sunVisibility.value = options.sunVisibility ?? 1;
  handle.starDomeMaterial.opacity = Math.min(1, options.starOpacity * 1.42);
  // 白天 starOpacity 接近 0，但 GPU 仍要处理 5000 个 point 的顶点+片元——
  // visible:false 让它整体跳过 draw call，省一笔白天的 GPU 浪费。
  handle.starDome.visible = options.starOpacity > 0.02;
}

export type { CloudLayerHandle } from "./cloudPlanes";

/**
 * 3D 立体云朵：每朵 = 4-6 个 SphereGeometry "puff" 拼成的 cluster。
 * - SphereGeometry 8×6 widthSegments：低多边形，单云 ~150 tris × 24 朵 ≈
 *   3.6K tris 总，对 GPU 没压力。
 * - MeshLambertMaterial：白色 + 顶部高光 / 底部偏蓝灰，云的体积感来自 lighting
 *   而不是贴图。flatShading=false 让 puff 之间过渡平滑。
 * - 旧 SpriteMaterial + canvas 贴图保留导出（兼容外部 import），但不再渲染。
 */
const CLOUD_BODY_MATERIAL = new MeshLambertMaterial({
  color: 0xfafcff,
  emissive: 0x101820,
  emissiveIntensity: 0.05,
  transparent: true,
  opacity: 0.92,
  flatShading: false
});

function createCloudCluster(): Object3D {
  const cluster = new Object3D();
  const puffCount = 4 + Math.floor(Math.random() * 3); // 4-6 puffs
  const baseRadius = 6 + Math.random() * 4; // 主泡 6-10 单位
  for (let i = 0; i < puffCount; i += 1) {
    const radius = baseRadius * (0.55 + Math.random() * 0.55);
    // 用低多边形保持云轮廓 polygon-ish (长安三万里风格里云本来就硬朗块状)。
    const geometry = new SphereGeometry(radius, 8, 6);
    const puff = new Mesh(geometry, CLOUD_BODY_MATERIAL);
    // 偏移：水平分布更宽（让云形是椭圆扁平），上下幅度小。
    puff.position.set(
      (Math.random() - 0.5) * baseRadius * 1.6,
      (Math.random() - 0.5) * baseRadius * 0.45,
      (Math.random() - 0.5) * baseRadius * 1.0
    );
    puff.scale.set(
      0.85 + Math.random() * 0.4,
      0.55 + Math.random() * 0.3, // 压扁
      0.85 + Math.random() * 0.4
    );
    cluster.add(puff);
  }
  return cluster;
}

export function createCloudLayer(): CloudLayerHandle {
  return createCloudPlaneLayer();
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
