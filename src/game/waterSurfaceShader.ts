import { Color, ShaderMaterial, Vector3 } from "three";

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
  varying vec3 vWorldPosition;
  varying vec3 vViewDirection;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPosition = wp.xyz;
    vViewDirection = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const FRAGMENT = /* glsl */ `
  uniform vec3 uBaseColor;
  uniform vec3 uHighlightColor;
  uniform vec3 uSunDirection;
  uniform float uTime;
  uniform float uOpacity;
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
    float ripple1 = sin(worldXZ.x * 0.18 + worldXZ.y * 0.05 + uTime * 0.4);
    float ripple2 = sin(worldXZ.x * -0.07 + worldXZ.y * 0.21 + uTime * 0.55);
    float ripple = (ripple1 * 0.5 + ripple2 * 0.5) * 0.5 + 0.5;

    // value noise 给"水纹细节"
    float fineNoise = wn_noise(worldXZ * 0.62 + uTime * vec2(0.18, 0.12));

    // Fresnel：vViewDirection 与"上方"夹角越大（视线越平）水面越亮
    vec3 normalUp = vec3(0.0, 1.0, 0.0);
    float ndotv = max(0.0, dot(vViewDirection, normalUp));
    float fresnel = pow(1.0 - ndotv, 3.0);

    // 太阳高光：sun 方向越接近 view-up 反射方向越亮（粗糙近似）
    vec3 sunDir = normalize(uSunDirection);
    vec3 reflectDir = reflect(-vViewDirection, normalUp);
    float sunGlint = pow(max(0.0, dot(reflectDir, sunDir)), 28.0);

    vec3 color = uBaseColor;
    color += uHighlightColor * (ripple * 0.18 + fineNoise * 0.08);
    color = mix(color, uHighlightColor, fresnel * 0.45);
    color += uHighlightColor * sunGlint * 0.7;

    gl_FragColor = vec4(color, uOpacity);
  }
`;

export interface WaterSurfaceShaderHandle {
  material: ShaderMaterial;
  setTime(time: number): void;
  setSunDirection(direction: Vector3): void;
  setBaseColor(color: Color): void;
  setOpacity(opacity: number): void;
}

export function createWaterSurfaceMaterial(): WaterSurfaceShaderHandle {
  const material = new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uBaseColor: { value: new Color(0x6aa7b0) },
      uHighlightColor: { value: new Color(0xd9efef) },
      uSunDirection: { value: new Vector3(110, 160, 24).normalize() },
      uTime: { value: 0 },
      uOpacity: { value: 0.32 }
    },
    transparent: true,
    depthWrite: false
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
    }
  };
}

