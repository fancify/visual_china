import type { Color, MeshPhongMaterial, WebGLProgramParametersWithUniforms } from "three";

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
  /** 远山逐青：水平距离 < 此值时无空气散射 */
  atmosphericNearDistance: number;
  /** 远山逐青：水平距离 ≥ 此值时空气散射饱和 */
  atmosphericFarDistance: number;
  /** 远山色（千里江山图 远景色，调用方按 environmentVisuals 给） */
  atmosphericFarColor: Color;
  /** 远山最大替换比例 */
  atmosphericMaxStrength: number;
  /** Time-of-day HSL 调色参数——之前每 1.85s 触发全顶点 JS recolor，现在
   * 走 shader uniform 改 fragment HSL，时间变化零 CPU 工作。 */
  terrainHueShift: number;
  terrainSaturationMul: number;
  terrainLightnessMul: number;
  /** Rim light：山脊/边缘 Fresnel 高光，跟太阳色保持一致——黄昏时山脊
   * 镶金边，模拟 Expedition 33 + 千里江山图 山棱光感。 */
  rimColor: Color;
  rimStrength: number;
  /** Fresnel 指数，越大 rim 越窄（只挑最锐利的边缘）。2.5 接近经典 rim。 */
  rimPower: number;
}

const defaults: TerrainShaderEnhancerOptions = {
  heightFogStartY: -2,
  heightFogEndY: 22,
  heightFogColor: undefined as unknown as Color, // 必须由调用方设置
  heightFogMaxStrength: 0.55,
  noiseStrength: 0.06,
  noiseFrequency: 0.18,
  // 千里江山图 远山逐青：以 80 单元（约一个主峰直径）开始空气散射，180 完全融。
  // farColor 默认是冷调 teal，runtime 用 environmentVisuals.skyHorizonColor 跟天色保持一致。
  atmosphericNearDistance: 80,
  atmosphericFarDistance: 180,
  atmosphericFarColor: undefined as unknown as Color,
  atmosphericMaxStrength: 0.42,
  terrainHueShift: 0,
  terrainSaturationMul: 1,
  terrainLightnessMul: 1,
  rimColor: undefined as unknown as Color,
  // ⚠ 默认 0：低多边形 flat-shaded terrain 上 fresnel 在大量三角面都接近 1
  // （normal 跟视线接近垂直），rim 整体 wash-out 山地。0.32 实测整张图变灰
  // 失彩。Rim 留给后续给 city wall / pagoda / peak mesh 这种有清晰轮廓的
  // 物体用。terrain 这一档保持 0 直到调出更好的 mask（按高度梯度 / 法线
  // 锐度过滤）。
  rimStrength: 0,
  rimPower: 3.5
};

interface ActiveEnhancer {
  uniforms: {
    uHeightFogStart: { value: number };
    uHeightFogEnd: { value: number };
    uHeightFogColor: { value: Color };
    uHeightFogMaxStrength: { value: number };
    uNoiseStrength: { value: number };
    uNoiseFrequency: { value: number };
    uAtmosphericNear: { value: number };
    uAtmosphericFar: { value: number };
    uAtmosphericFarColor: { value: Color };
    uAtmosphericMaxStrength: { value: number };
    uTerrainHueShift: { value: number };
    uTerrainSaturationMul: { value: number };
    uTerrainLightnessMul: { value: number };
    uRimColor: { value: Color };
    uRimStrength: { value: number };
    uRimPower: { value: number };
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
    rimColor: Color;
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
      uAtmosphericNear: { value: config.atmosphericNearDistance },
      uAtmosphericFar: { value: config.atmosphericFarDistance },
      uAtmosphericFarColor: { value: config.atmosphericFarColor.clone() },
      uAtmosphericMaxStrength: { value: config.atmosphericMaxStrength },
      uTerrainHueShift: { value: config.terrainHueShift },
      uTerrainSaturationMul: { value: config.terrainSaturationMul },
      uTerrainLightnessMul: { value: config.terrainLightnessMul },
      uRimColor: { value: config.rimColor.clone() },
      uRimStrength: { value: config.rimStrength },
      uRimPower: { value: config.rimPower }
    };
    Object.assign(shader.uniforms, uniforms);
    enhancers.set(material, { uniforms });

    // 把 vWorldPos + view-space normal 传到 fragment shader（rim 用 normal）。
    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      /* glsl */ `
        #include <common>
        varying vec3 vWorldPosition;
        varying vec3 vViewNormal;
        varying vec3 vViewPosition;
      `
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <fog_vertex>",
      /* glsl */ `
        #include <fog_vertex>
        vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vViewNormal = normalize(normalMatrix * normal);
        vViewPosition = (modelViewMatrix * vec4(transformed, 1.0)).xyz;
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      /* glsl */ `
        #include <common>
        varying vec3 vWorldPosition;
        varying vec3 vViewNormal;
        varying vec3 vViewPosition;
        uniform float uHeightFogStart;
        uniform float uHeightFogEnd;
        uniform vec3 uHeightFogColor;
        uniform float uHeightFogMaxStrength;
        uniform float uNoiseStrength;
        uniform float uNoiseFrequency;
        uniform float uAtmosphericNear;
        uniform float uAtmosphericFar;
        uniform vec3 uAtmosphericFarColor;
        uniform float uAtmosphericMaxStrength;
        uniform float uTerrainHueShift;
        uniform float uTerrainSaturationMul;
        uniform float uTerrainLightnessMul;
        uniform vec3 uRimColor;
        uniform float uRimStrength;
        uniform float uRimPower;
        ${NOISE_GLSL}
        ${HSL_GLSL}
      `
    );

    // 在最终输出前注入 noise + HSL + height fog + 远山逐青
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <output_fragment>",
      /* glsl */ `
        // ===== 千里江山图 terrain shader 增强 =====
        // 1. 低频 noise，打破纯色块感
        float ttn = th_noise(vWorldPosition.xz * uNoiseFrequency);
        outgoingLight += ttn * uNoiseStrength * vec3(0.42, 0.45, 0.32);

        // 2. HSL 时间/季节调色——以前 environment.terrainHueShift/SaturationMul/
        // LightnessMul 走 JS 每顶点 setHSL 重染（10000+ vertex / 帧），现在
        // shader 里做：转 HSL → shift hue → mul s/l → 转回 RGB。每帧零 CPU 工作。
        vec3 hsl = th_rgb2hsl(outgoingLight);
        hsl.x = mod(hsl.x + uTerrainHueShift + 1.0, 1.0);
        hsl.y = clamp(hsl.y * uTerrainSaturationMul, 0.0, 1.0);
        hsl.z = clamp(hsl.z * uTerrainLightnessMul, 0.0, 1.0);
        outgoingLight = th_hsl2rgb(hsl);

        // 3. height fog：高处往天空色融
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

        // 4. 远山逐青（千里江山图 air perspective）：水平距离越远越向冷青色融。
        // 跟 height fog 不同——它不挑高度，平地远处也跟着变青。这是王希孟原画
        // 最经典的笔法：近山深绿，远山转石青/石绿。
        float horizDist = length(vWorldPosition.xz - cameraPosition.xz);
        float atmosphericT = clamp(
          (horizDist - uAtmosphericNear) /
            max(0.001, uAtmosphericFar - uAtmosphericNear),
          0.0,
          1.0
        );
        outgoingLight = mix(
          outgoingLight,
          uAtmosphericFarColor,
          atmosphericT * uAtmosphericMaxStrength
        );

        // 5. Rim light（边缘 Fresnel）：山脊镶金边——dot(view, normal) 接近 0
        // 时（normal 几乎垂直于视线，正是看到的山棱轮廓）rim 强度最大。
        // 配合 sun 色 + dawn/dusk 暖色，黄昏时山脊会被金光描边。
        vec3 viewDir = normalize(-vViewPosition);
        float rimFresnel = pow(
          1.0 - clamp(dot(normalize(vViewNormal), viewDir), 0.0, 1.0),
          uRimPower
        );
        outgoingLight += uRimColor * (rimFresnel * uRimStrength);

        #include <output_fragment>
      `
    );
  };

  material.needsUpdate = true;
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

/**
 * 每帧调用：把远山色更新——白天用冷青、黄昏用暖橙混冷色（让远山有 dawn/dusk
 * 一致的色温），夜里近黑。runtime 直接拿 environmentVisuals.skyZenithColor
 * 跟一个 region "石青色" mix 一下出结果。
 */
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
 * 每帧调用：让 rim 颜色随 sun/dawn-dusk 一起变。runtime 直接拿 visuals.sunColor
 * 推过来——黄昏时 sunColor 已经混过 twilight，rim 自动镶金。
 */
export function updateTerrainShaderRim(
  material: MeshPhongMaterial,
  rimColor: Color
): void {
  const enhancer = enhancers.get(material);
  if (!enhancer) {
    return;
  }
  enhancer.uniforms.uRimColor.value.copy(rimColor);
}
