import {
  Vector2,
  type Color,
  type MeshPhongMaterial,
  type Texture,
  type WebGLProgramParametersWithUniforms
} from "three";

import type { WindUniforms } from "./windManager";

// 与 terrainLodMorph.ts 的 HUD 估算阈值保持一致；shader 文件本地保留常量，
// 避免 Node 直接跑 .ts 测试时解析未编译的 .js 运行时 import。
// R10a-fix: 跟 terrainLodMorph.ts 同步。Scenery spawn radius 50u, morph 必须在外面起跑
// 才能让 scenery anchor (L0) 跟 terrain 渲染面对齐。
const TERRAIN_LOD_MORPH_START = 60;
const TERRAIN_LOD_MORPH_END = 120;

/**
 * 给现有 MeshPhongMaterial 注入两层 fragment 增强：
 *
 * 1. **低频 noise 层**：打破 vertex color 的纯色块感。山脊、平原边缘原本因为
 *    Gouraud 插值会显得像"塑料色块"，加一层 value-noise 能让相邻像素之间产生
 *    微小色温扰动，**让画面气质从"塑料"变成"水墨"的关键一步**。
 *
 * 2. **height fog**：在 scene 的 FogExp2 之外再加一层"按高度衰减"的雾。
 *    山顶被更多雾吞掉、河谷雾更轻，模拟真实空气透视，让秦岭主脊远看时更有
 *    "墙壁感"而不是"清晰山体"。
 *
 * 通过 onBeforeCompile 而不是改 ShaderMaterial 完整重写，可以**保留**：
 * - vertex colors（mode / 季节 / 水系 corridor influence 都还能用 CPU 改色）
 * - 光照系统（lights、shadow、ambient、rim 都不用重写）
 * - scene.fog 集成（FogExp2 仍然在前一层雾色里生效）
 */
export interface TerrainShaderEnhancerOptions {
  /** 起雾的 y 高度（含），低于这个高度无 height fog */
  heightFogStartY: number;
  /** 完全被雾吞的 y 高度（不含），高于这个高度 height fog 强度饱和 */
  heightFogEndY: number;
  /** height fog 颜色（通常等于 sky horizon 色） */
  heightFogColor: Color;
  /** height fog 最大替换比例（0-1），1 表示山顶完全是雾色 */
  heightFogMaxStrength: number;
  /** noise 强度（0-1），过大会让画面"沙化" */
  noiseStrength: number;
  /** noise 在世界空间的频率，越大越细 */
  noiseFrequency: number;
  /** 大气透视：view-space depth < 此值时无空气散射 */
  atmosphericNearDistance: number;
  /** 大气透视：view-space depth ≥ 此值时空气散射饱和 */
  atmosphericFarDistance: number;
  /** 远景色（sky horizon 共享色，调用方按 environmentVisuals 给） */
  atmosphericFarColor: Color;
  /** 大气透视最大替换比例 */
  atmosphericMaxStrength: number;
  /** R7 地表云影 cookie 贴图，按 world XZ 投影采样。 */
  cloudCookieTexture: Texture | null;
  /** world units per cookie tile。 */
  cloudCookieScale: number;
  /** 0..1，云影最大暗化比例。 */
  cloudCookieStrength: number;
  /** Time-of-day HSL 调色参数——之前每 1.85s 触发全顶点 JS recolor，现在
   * 走 shader uniform 改 fragment HSL，时间变化零 CPU 工作。 */
  terrainHueShift: number;
  terrainSaturationMul: number;
  terrainLightnessMul: number;
}

// R6：用户实测远景和地平线 fade 不明显，收窄 ramp 并提高替换比例。
// start=60 保留 default-follow 近景清晰；end=200 让 overview 远山更快融进天色。
export const terrainAtmosphericHazeDefaults = {
  startDistance: 60,
  endDistance: 200,
  strength: 0.75
} as const;

const defaults: TerrainShaderEnhancerOptions = {
  heightFogStartY: -2,
  heightFogEndY: 22,
  heightFogColor: undefined as unknown as Color, // 必须由调用方设置
  heightFogMaxStrength: 0.55,
  noiseStrength: 0.06,
  noiseFrequency: 0.18,
  // R6 大气透视：从 60u 开始，把远 chunk 在 200u 处明显溶进天色。
  // farColor 由 runtime 每帧写入 sky horizon 共享色，避免 terrain/cloud/远山色带。
  atmosphericNearDistance: terrainAtmosphericHazeDefaults.startDistance,
  atmosphericFarDistance: terrainAtmosphericHazeDefaults.endDistance,
  atmosphericFarColor: undefined as unknown as Color,
  atmosphericMaxStrength: terrainAtmosphericHazeDefaults.strength,
  cloudCookieTexture: null,
  cloudCookieScale: 80,
  cloudCookieStrength: 0.5,
  terrainHueShift: 0,
  terrainSaturationMul: 1,
  terrainLightnessMul: 1
};

interface ActiveEnhancer {
  uniforms: {
    uHeightFogStart: { value: number };
    uHeightFogEnd: { value: number };
    uHeightFogColor: { value: Color };
    uHeightFogMaxStrength: { value: number };
    uNoiseStrength: { value: number };
    uNoiseFrequency: { value: number };
    uAtmosphericFarStart: { value: number };
    uAtmosphericFarEnd: { value: number };
    uAtmosphericFarColor: { value: Color };
    uAtmosphericStrength: { value: number };
    uCloudCookie: { value: Texture | null };
    uWindDirection: { value: Vector2 };
    uWindStrength: { value: number };
    uWindTime: { value: number };
    uCloudCookieScale: { value: number };
    uCloudCookieStrength: { value: number };
    uTerrainHueShift: { value: number };
    uTerrainSaturationMul: { value: number };
    uTerrainLightnessMul: { value: number };
    uMorphStart: { value: number };
    uMorphEnd: { value: number };
    uTerrainLodMorph: { value: number };
  };
}

const enhancers = new WeakMap<MeshPhongMaterial, ActiveEnhancer>();

const NOISE_GLSL = /* glsl */ `
  // 简单 hash + value noise，浏览器友好版本
  float th_hash(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p.x + p.y) * 43758.5453123);
  }
  float th_noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(th_hash(i + vec2(0.0, 0.0)), th_hash(i + vec2(1.0, 0.0)), u.x),
      mix(th_hash(i + vec2(0.0, 1.0)), th_hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }
`;

// rgb→hsl→rgb GLSL，跟 Three.js Color.getHSL/setHSL 一致的算法。让 fragment
// 里能复现 environment 时间/季节/天气推送过来的 HSL 调色，避免 JS 每帧重染。
const HSL_GLSL = /* glsl */ `
  vec3 th_rgb2hsl(vec3 c) {
    float maxC = max(c.r, max(c.g, c.b));
    float minC = min(c.r, min(c.g, c.b));
    float l = (maxC + minC) * 0.5;
    float h = 0.0;
    float s = 0.0;
    float d = maxC - minC;
    if (d > 0.00001) {
      s = (l > 0.5) ? d / (2.0 - maxC - minC) : d / (maxC + minC);
      if (maxC == c.r)      h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
      else if (maxC == c.g) h = (c.b - c.r) / d + 2.0;
      else                  h = (c.r - c.g) / d + 4.0;
      h /= 6.0;
    }
    return vec3(h, s, l);
  }
  float th_hue2rgb(float p, float q, float t) {
    if (t < 0.0) t += 1.0;
    if (t > 1.0) t -= 1.0;
    if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
    if (t < 1.0/2.0) return q;
    if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
    return p;
  }
  vec3 th_hsl2rgb(vec3 hsl) {
    float h = hsl.x;
    float s = hsl.y;
    float l = hsl.z;
    if (s < 0.00001) return vec3(l);
    float q = (l < 0.5) ? l * (1.0 + s) : l + s - l * s;
    float p = 2.0 * l - q;
    return vec3(
      th_hue2rgb(p, q, h + 1.0/3.0),
      th_hue2rgb(p, q, h),
      th_hue2rgb(p, q, h - 1.0/3.0)
    );
  }
`;

export function attachTerrainShaderEnhancements(
  material: MeshPhongMaterial,
  options: Partial<TerrainShaderEnhancerOptions> & {
    heightFogColor: Color;
    atmosphericFarColor: Color;
  }
): void {
  const config: TerrainShaderEnhancerOptions = { ...defaults, ...options };

  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    const uniforms = {
      uHeightFogStart: { value: config.heightFogStartY },
      uHeightFogEnd: { value: config.heightFogEndY },
      uHeightFogColor: { value: config.heightFogColor.clone() },
      uHeightFogMaxStrength: { value: config.heightFogMaxStrength },
      uNoiseStrength: { value: config.noiseStrength },
      uNoiseFrequency: { value: config.noiseFrequency },
      uAtmosphericFarStart: { value: config.atmosphericNearDistance },
      uAtmosphericFarEnd: { value: config.atmosphericFarDistance },
      uAtmosphericFarColor: { value: config.atmosphericFarColor.clone() },
      uAtmosphericStrength: { value: config.atmosphericMaxStrength },
      uCloudCookie: { value: config.cloudCookieTexture },
      uWindDirection: { value: new Vector2(0.86, 0.5).normalize() },
      uWindStrength: { value: 0.4 },
      uWindTime: { value: 0 },
      uCloudCookieScale: { value: config.cloudCookieScale },
      uCloudCookieStrength: { value: config.cloudCookieStrength },
      uTerrainHueShift: { value: config.terrainHueShift },
      uTerrainSaturationMul: { value: config.terrainSaturationMul },
      uTerrainLightnessMul: { value: config.terrainLightnessMul },
      uMorphStart: { value: TERRAIN_LOD_MORPH_START },
      uMorphEnd: { value: TERRAIN_LOD_MORPH_END },
      // <0 表示用 per-vertex distance morph；0..1 仅作为 LOD_MORPH_DEMO 强制覆盖。
      uTerrainLodMorph: { value: -1 }
    };
    Object.assign(shader.uniforms, uniforms);
    enhancers.set(material, { uniforms });

    // 把 vWorldPos 传到 fragment shader
    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      /* glsl */ `
        #include <common>
        attribute vec3 positionLod0;
        attribute vec3 positionLod1;
        uniform float uMorphStart;
        uniform float uMorphEnd;
        uniform float uTerrainLodMorph;
        varying vec3 vWorldPosition;
        varying float vTerrainViewDepth;
      `
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      /* glsl */ `
        #include <begin_vertex>
        vec3 worldPos = (modelMatrix * vec4(positionLod0, 1.0)).xyz;
        float vDist = distance(cameraPosition.xz, worldPos.xz);
        float vMorph = smoothstep(uMorphStart, uMorphEnd, vDist);
        if (uTerrainLodMorph >= 0.0) {
          vMorph = clamp(uTerrainLodMorph, 0.0, 1.0);
        }
        transformed.y = mix(positionLod0.y, positionLod1.y, vMorph);
      `
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <fog_vertex>",
      /* glsl */ `
        #include <fog_vertex>
        vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vTerrainViewDepth = abs((modelViewMatrix * vec4(transformed, 1.0)).z);
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      /* glsl */ `
        #include <common>
        varying vec3 vWorldPosition;
        uniform float uHeightFogStart;
        uniform float uHeightFogEnd;
        uniform vec3 uHeightFogColor;
        uniform float uHeightFogMaxStrength;
        uniform float uNoiseStrength;
        uniform float uNoiseFrequency;
        uniform float uAtmosphericFarStart;
        uniform float uAtmosphericFarEnd;
        uniform vec3 uAtmosphericFarColor;
        uniform float uAtmosphericStrength;
        uniform sampler2D uCloudCookie;
        uniform vec2 uWindDirection;
        uniform float uWindStrength;
        uniform float uWindTime;
        uniform float uCloudCookieScale;
        uniform float uCloudCookieStrength;
        uniform float uTerrainHueShift;
        uniform float uTerrainSaturationMul;
        uniform float uTerrainLightnessMul;
        varying float vTerrainViewDepth;
        ${NOISE_GLSL}
        ${HSL_GLSL}
      `
    );

    // 在最终输出前统一注入 terrain 增强，顺序保持：base/noise → height fog →
    // 云影 cookie → 大气透视 → HSL。云影先于 haze，远处投影自然被空气感淡化。
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <output_fragment>",
      /* glsl */ `
        // ===== 长安三万里 terrain shader 增强 =====
        // 1. 低频 noise，打破纯色块感
        float ttn = th_noise(vWorldPosition.xz * uNoiseFrequency);
        outgoingLight += ttn * uNoiseStrength * vec3(0.42, 0.45, 0.32);

        // 2. height fog：高处往天空色融
        float heightT = clamp(
          (vWorldPosition.y - uHeightFogStart) /
            max(0.001, uHeightFogEnd - uHeightFogStart),
          0.0,
          1.0
        );
        outgoingLight = mix(
          outgoingLight,
          uHeightFogColor,
          heightT * uHeightFogMaxStrength
        );

        // 3. R7 云影 cookie：用 world-space XZ 采样，让阴影不跟 UV/mesh 绑定。
        // R7.1 调参 (Claude post-Playwright)：
        // - scroll 速度乘 uWindStrength → 风强度影响云移动快慢，弱风 0.4 仍有可见漂移
        // - shadowFactor 不再乘 uWindStrength → clouds 总在，风只控速度不控存在
        // - smoothstep 阈值 0.35→0.65 → cookie noise 中段也产生阴影，contrast 更明显
        // Audit-fix B6 (2026-05-11): cookie 跟 atmospheric haze 远景双重暗化（远云影
        // 被 haze 吃掉看不见）。加 nearAttn = 1 - 远景占比，让 cookie 在中近景全强、
        // 远景渐弱（远景靠 haze 接管）。
        // Codex review (2026-05-11) 纠正: 之前 smoothstep(haze_start*0.5, haze_start) =
        // smoothstep(30, 60) 让中景 30-60u cookie 快速吃掉。default-follow camera 距 player
        // 9u (不是 65u)，但视野中景就在 30-60u 范围 → 云影最常看的距离正好被 attn 干掉。
        // 改 60-120u 独立常量，比 haze 起步晚，让中景全强、只远景 fade。
        vec2 cookieUV = vWorldPosition.xz / uCloudCookieScale
          + uWindDirection * uWindTime * 0.05 * (0.4 + uWindStrength);
        float cookieValue = texture2D(uCloudCookie, cookieUV).r;
        float nearCookieAttn = 1.0 - smoothstep(60.0, 120.0, vTerrainViewDepth);
        float shadowFactor = smoothstep(0.35, 0.65, cookieValue)
          * uCloudCookieStrength
          * nearCookieAttn;
        outgoingLight *= (1.0 - shadowFactor);

        // 4. R6 大气透视：按 view-space depth 在 fragment 末端向 sky horizon
        // 共享色融，让远 chunk 的 L1 形态和 chunk 边界被天色吞掉。
        float atmosphericT = smoothstep(
          uAtmosphericFarStart,
          uAtmosphericFarEnd,
          vTerrainViewDepth
        );
        atmosphericT = pow(atmosphericT, 0.7);
        outgoingLight = mix(
          outgoingLight,
          uAtmosphericFarColor,
          atmosphericT * uAtmosphericStrength
        );

        // 5. HSL 时间/季节调色——以前 environment.terrainHueShift/SaturationMul/
        // LightnessMul 走 JS 每顶点 setHSL 重染（10000+ vertex / 帧），现在
        // shader 里做：转 HSL → shift hue → mul s/l → 转回 RGB。每帧零 CPU 工作。
        vec3 hsl = th_rgb2hsl(outgoingLight);
        hsl.x = mod(hsl.x + uTerrainHueShift + 1.0, 1.0);
        hsl.y = clamp(hsl.y * uTerrainSaturationMul, 0.0, 1.0);
        hsl.z = clamp(hsl.z * uTerrainLightnessMul, 0.0, 1.0);
        outgoingLight = th_hsl2rgb(hsl);

        #include <output_fragment>
      `
    );
  };

  material.needsUpdate = true;
}

/** 每帧调用：把 WindManager 的统一风 uniform 推进 terrain 云影 cookie。 */
export function updateTerrainShaderCloudCookie(
  material: MeshPhongMaterial,
  cloudCookieTexture: Texture,
  windUniforms: WindUniforms
): void {
  const enhancer = enhancers.get(material);
  if (!enhancer) {
    return;
  }
  enhancer.uniforms.uCloudCookie.value = cloudCookieTexture;
  enhancer.uniforms.uWindDirection.value.copy(windUniforms.direction.value);
  enhancer.uniforms.uWindStrength.value = windUniforms.strength.value;
  enhancer.uniforms.uWindTime.value = windUniforms.time.value;
  enhancer.uniforms.uCloudCookieScale.value = windUniforms.noiseScale.value;
}

/**
 * 每帧调用：把当前天空地平线色更新到 height fog 颜色，
 * 让山顶永远融到当前 sky horizon。
 */
export function updateTerrainShaderHeightFog(
  material: MeshPhongMaterial,
  fogColor: Color
): void {
  const enhancer = enhancers.get(material);
  if (!enhancer) {
    return;
  }
  enhancer.uniforms.uHeightFogColor.value.copy(fogColor);
}

/** 每帧调用：把 sky horizon 共享 farColor 推进 terrain 大气透视 uniform。 */
export function updateTerrainShaderAtmosphericFar(
  material: MeshPhongMaterial,
  atmosphericFarColor: Color
): void {
  const enhancer = enhancers.get(material);
  if (!enhancer) {
    return;
  }
  enhancer.uniforms.uAtmosphericFarColor.value.copy(atmosphericFarColor);
}

/**
 * 每帧调用：把环境的 hue/sat/light 调色推进 shader uniform。这取代了之前
 * "JS 每顶点 setHSL → 全 mesh recolor" 的热路径——时间一变就重染 10000+
 * 顶点的 ~440ms hitch 完全消失。
 */
export function updateTerrainShaderHsl(
  material: MeshPhongMaterial,
  hueShift: number,
  saturationMul: number,
  lightnessMul: number
): void {
  const enhancer = enhancers.get(material);
  if (!enhancer) {
    return;
  }
  enhancer.uniforms.uTerrainHueShift.value = hueShift;
  enhancer.uniforms.uTerrainSaturationMul.value = saturationMul;
  enhancer.uniforms.uTerrainLightnessMul.value = lightnessMul;
}

/**
 * R6 per-vertex LOD geomorph：默认由 shader 按每个顶点到 camera 的距离计算。
 * morph=null 表示关闭 dev override；数字 0..1 只服务 window.LOD_MORPH_DEMO。
 */
export function updateTerrainShaderLodMorph(
  material: MeshPhongMaterial,
  morph: number | null
): void {
  const enhancer = enhancers.get(material);
  if (!enhancer) {
    return;
  }
  if (morph === null) {
    enhancer.uniforms.uTerrainLodMorph.value = -1;
    return;
  }
  enhancer.uniforms.uTerrainLodMorph.value = Math.max(0, Math.min(1, morph));
}
