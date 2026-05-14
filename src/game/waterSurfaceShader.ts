import { Color, ShaderMaterial, UniformsLib, UniformsUtils, Vector3 } from "three";
import { WATER_SURFACE_COLOR, WATER_SURFACE_OPACITY } from "./terrain/waterStyle.js";

/**
 * 整区水面 shader：菲涅尔 + 时间相位涟漪 + 太阳高光。
 *
 * 这是"远处水光"的视觉源——玩家在关中眺望渭河方向时，看到的不再是一块
 * 半透明色板，而是一片随时间起伏的水面。
 *
 * 不做"全场景反射"——浏览器里 reflection RT 太贵。改用：
 *   - 视线-水面法线 dot 决定 Fresnel 强度（视线越平，水面越亮）
 *   - 时间相位 + 多频 sin 在水面叠出"涟漪"
 *   - 太阳方向 dot 计算高光斑（玩家朝向太阳方向看时水面更刺眼）
 *
 * 这套加起来在 GPU 上几乎免费（一个 PlaneGeometry，几行 GLSL），
 * 但视觉气质提升非常明显。
 */
const VERTEX = /* glsl */ `
  #include <fog_pars_vertex>
  varying vec3 vWorldPosition;
  varying vec3 vViewDirection;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPosition = wp.xyz;
    vViewDirection = normalize(cameraPosition - wp.xyz);
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;
const FRAGMENT = /* glsl */ `
  #include <fog_pars_fragment>
  uniform vec3 uBaseColor;
  uniform vec3 uDeepWaterColor;
  uniform vec3 uHighlightColor;
  uniform vec3 uSunDirection;
  uniform float uTime;
  uniform float uOpacity;
  uniform float uShimmerStrength;
  uniform float uCoastColorStrength;
  uniform float uCoastBandScale;
  uniform sampler2D uCoastDistanceMap;
  uniform float uUseCoastDistanceMap;
  uniform vec2 uCoastMapOrigin;
  uniform vec2 uCoastMapSize;
  // 太阳高光乘子。湖默认 1.0 (保留 Phong 光斑); ocean 显式 0 (BotW 不做 specular).
  uniform float uSunGlintStrength;
  varying vec3 vWorldPosition;
  varying vec3 vViewDirection;

  // 简单 hash + value noise，避免引入纹理
  float wn_hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float wn_noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(wn_hash(i + vec2(0.0, 0.0)), wn_hash(i + vec2(1.0, 0.0)), u.x),
      mix(wn_hash(i + vec2(0.0, 1.0)), wn_hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  void main() {
    // 多频 sin 叠出沿河方向的涟漪
    vec2 worldXZ = vWorldPosition.xz;
    float ripple1 = sin(worldXZ.x * 0.18 + worldXZ.y * 0.05 + uTime * 0.28);
    float ripple2 = sin(worldXZ.x * -0.07 + worldXZ.y * 0.21 + uTime * 0.36);
    float ripple = (ripple1 * 0.5 + ripple2 * 0.5) * 0.5 + 0.5;

    // value noise 给"水纹细节"
    float fineNoise = wn_noise(worldXZ * 0.62 + uTime * vec2(0.10, 0.07));

    // Fresnel：vViewDirection 与"上方"夹角越大（视线越平）水面越亮
    vec3 normalUp = vec3(0.0, 1.0, 0.0);
    float ndotv = max(0.0, dot(vViewDirection, normalUp));
    float fresnel = pow(1.0 - ndotv, 3.0);

    // 太阳高光：sun 方向越接近 view-up 反射方向越亮（粗糙近似）
    // BotW 不做这个 — ocean 设 uSunGlintStrength=0 完全关掉；湖默认 1.0 保留
    vec3 sunDir = normalize(uSunDirection);
    vec3 reflectDir = reflect(-vViewDirection, normalUp);
    float sunGlint = pow(max(0.0, dot(reflectDir, sunDir)), 28.0);

    float coastDistance = uUseCoastDistanceMap > 0.5
      ? texture2D(uCoastDistanceMap, vec2(
          clamp((vWorldPosition.x - uCoastMapOrigin.x) / uCoastMapSize.x, 0.0, 1.0),
          clamp((vWorldPosition.z - uCoastMapOrigin.y) / uCoastMapSize.y, 0.0, 1.0)
        )).r
      : 1.0;
    float deepT = smoothstep(0.08, max(0.09, uCoastBandScale), coastDistance);

    vec3 color = mix(uBaseColor, uDeepWaterColor, deepT * uCoastColorStrength);
    color += uHighlightColor * (ripple * 0.055 + fineNoise * 0.025) * uShimmerStrength;
    color = mix(color, uHighlightColor, fresnel * 0.16 * uShimmerStrength);
    color += uHighlightColor * sunGlint * 0.22 * uShimmerStrength * uSunGlintStrength;

    gl_FragColor = vec4(color, uOpacity);
    #include <fog_fragment>
  }
`;

export interface WaterSurfaceShaderOptions {
  baseColor?: Color | number | string;
  deepWaterColor?: Color | number | string;
  highlightColor?: Color | number | string;
  opacity?: number;
  shimmerStrength?: number;
  coastColorStrength?: number;
  coastBandScale?: number;
  coastDistanceMap?: { value: unknown };
  coastMapOrigin?: { x: number; y: number };
  coastMapSize?: { x: number; y: number };
  /** 太阳高光强度乘子。默认 1.0（保留原 Phong glint）；BotW 风格 ocean 设 0。 */
  sunGlintStrength?: number;
}

export interface WaterSurfaceShaderHandle {
  material: ShaderMaterial;
  setTime(time: number): void;
  setSunDirection(direction: Vector3): void;
  setBaseColor(color: Color): void;
  setOpacity(opacity: number): void;
  setShimmerStrength(strength: number): void;
}

function resolveColor(value: Color | number | string | undefined, fallback: Color): Color {
  if (value instanceof Color) return value.clone();
  if (value !== undefined) return new Color(value);
  return fallback.clone();
}

export function createWaterSurfaceMaterial(
  opts: WaterSurfaceShaderOptions = {}
): WaterSurfaceShaderHandle {
  const baseColor = resolveColor(opts.baseColor, WATER_SURFACE_COLOR);
  const deepWaterColor = resolveColor(opts.deepWaterColor, new Color(0x1e5f78));
  const highlightColor = resolveColor(opts.highlightColor, new Color(0xcfe6ea));
  const material = new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: UniformsUtils.merge([
      UniformsLib.fog,
      {
        uBaseColor: { value: baseColor },
        uDeepWaterColor: { value: deepWaterColor },
        uHighlightColor: { value: highlightColor },
        uSunDirection: { value: new Vector3(110, 160, 24).normalize() },
        uTime: { value: 0 },
        uOpacity: { value: opts.opacity ?? WATER_SURFACE_OPACITY },
        uShimmerStrength: { value: opts.shimmerStrength ?? 0.22 },
        uCoastColorStrength: { value: opts.coastColorStrength ?? 0 },
        uCoastBandScale: { value: opts.coastBandScale ?? 0.35 },
        uCoastDistanceMap: opts.coastDistanceMap ?? { value: null },
        uUseCoastDistanceMap: { value: opts.coastDistanceMap ? 1 : 0 },
        uCoastMapOrigin: { value: opts.coastMapOrigin ?? { x: -855.5, y: -593 } },
        uCoastMapSize: { value: opts.coastMapSize ?? { x: 1711, y: 1186 } },
        uSunGlintStrength: { value: opts.sunGlintStrength ?? 1.0 }
      }
    ]),
    transparent: true,
    depthWrite: false,
    fog: true
  });

  return {
    material,
    setTime(time) {
      material.uniforms.uTime.value = time;
    },
    setSunDirection(direction) {
      material.uniforms.uSunDirection.value.copy(direction).normalize();
    },
    setBaseColor(color) {
      material.uniforms.uBaseColor.value.copy(color);
    },
    setOpacity(opacity) {
      material.uniforms.uOpacity.value = opacity;
    },
    setShimmerStrength(strength) {
      material.uniforms.uShimmerStrength.value = strength;
    }
  };
}
