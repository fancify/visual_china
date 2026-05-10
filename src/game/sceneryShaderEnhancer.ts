import {
  Color,
  InstancedMesh,
  MeshLambertMaterial,
  MeshPhongMaterial,
  Vector2,
  Vector3,
  type WebGLProgramParametersWithUniforms
} from "three";

import type { WindUniforms } from "./windManager";

type SceneryShaderMaterial = MeshPhongMaterial | MeshLambertMaterial;
type SceneryShaderMaterialTarget = SceneryShaderMaterial | InstancedMesh["material"];

export interface SceneryShaderEnhancerOptions {
  /** Phase 2：预留 toon/cel 量化开关，本轮只注册 uniform。 */
  enableCelShading: boolean;
  /** Phase 2：预留轮廓 rim light 开关，本轮只注册 uniform。 */
  enableRim: boolean;
  /** Phase 5：预留草/叶风摆开关，本轮只注册 uniform。 */
  enableWindSway: boolean;
  /** Phase 6：预留季节整体 tint 开关，本轮只注册 uniform。 */
  enableSeasonalTint: boolean;
  /** 草专用：按玩家距离做圆形 LOD fade，避免 chunk 方形边界。 */
  enableGrassDistanceFade?: boolean;
  /** 与 terrain shader 共用 WindManager.uniforms，避免拆出第二套风状态。 */
  windUniforms?: WindUniforms;
  /** Phase 6：季节色，默认白色表示不改色。 */
  seasonalTint?: Color;
  /** Phase 2：rim 强度 0..1。 */
  rimStrength?: number;
  /** Phase 2：cel 量化档数，建议 2..4。 */
  celBands?: number;
}

interface SceneryShaderUniforms {
  uSceneryEnableCelShading: { value: number };
  uSceneryEnableRim: { value: number };
  uSceneryEnableWindSway: { value: number };
  uSceneryEnableSeasonalTint: { value: number };
  uSceneryWindDirection: { value: Vector2 };
  uSceneryWindStrength: { value: number };
  uSceneryWindGust: { value: number };
  uSceneryWindTime: { value: number };
  uSceneryWindNoiseScale: { value: number };
  uSceneryPlayerPos: { value: Vector3 };
  uSceneryGrassFadeStart: { value: number };
  uSceneryGrassFadeEnd: { value: number };
  uScenerySeasonalTint: { value: Color };
  uSceneryRimStrength: { value: number };
  uSceneryCelBands: { value: number };
}

interface ActiveSceneryEnhancer {
  uniforms: SceneryShaderUniforms;
}

const enhancers = new WeakMap<SceneryShaderMaterial, ActiveSceneryEnhancer>();

function boolUniform(enabled: boolean): number {
  return enabled ? 1 : 0;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function sceneryMaterials(target: SceneryShaderMaterialTarget): SceneryShaderMaterial[] {
  const materials = Array.isArray(target) ? target : [target];
  return materials.filter(
    (material): material is SceneryShaderMaterial =>
      material instanceof MeshPhongMaterial || material instanceof MeshLambertMaterial
  );
}

function createUniforms(options: SceneryShaderEnhancerOptions): SceneryShaderUniforms {
  const wind = options.windUniforms;

  return {
    uSceneryEnableCelShading: { value: boolUniform(options.enableCelShading) },
    uSceneryEnableRim: { value: boolUniform(options.enableRim) },
    uSceneryEnableWindSway: { value: boolUniform(options.enableWindSway) },
    uSceneryEnableSeasonalTint: { value: boolUniform(options.enableSeasonalTint) },
    uSceneryWindDirection: {
      value: wind?.direction.value.clone() ?? new Vector2(0.86, 0.5).normalize()
    },
    uSceneryWindStrength: { value: wind?.strength.value ?? 0 },
    uSceneryWindGust: { value: wind?.gust.value ?? 0 },
    uSceneryWindTime: { value: wind?.time.value ?? 0 },
    uSceneryWindNoiseScale: { value: wind?.noiseScale.value ?? 80 },
    uSceneryPlayerPos: { value: new Vector3(0, 0, 0) },
    uSceneryGrassFadeStart: { value: 40 },
    uSceneryGrassFadeEnd: { value: 50 },
    uScenerySeasonalTint: { value: options.seasonalTint?.clone() ?? new Color(0xffffff) },
    uSceneryRimStrength: { value: clamp01(options.rimStrength ?? 0) },
    uSceneryCelBands: { value: Math.max(1, options.celBands ?? 3) }
  };
}

export function attachSceneryShaderEnhancements(
  material: SceneryShaderMaterialTarget,
  options: SceneryShaderEnhancerOptions
): void {
  for (const targetMaterial of sceneryMaterials(material)) {
    targetMaterial.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
      const uniforms = createUniforms(options);
      Object.assign(shader.uniforms, uniforms);
      enhancers.set(targetMaterial, { uniforms });
      if (options.enableWindSway || options.enableGrassDistanceFade) {
        shader.vertexShader = shader.vertexShader
          .replace(
            "#include <common>",
            `#include <common>
uniform vec2 uSceneryWindDirection;
uniform float uSceneryWindStrength;
uniform float uSceneryWindGust;
uniform float uSceneryWindTime;
uniform float uSceneryWindNoiseScale;
uniform vec3 uSceneryPlayerPos;
uniform float uSceneryGrassFadeStart;
uniform float uSceneryGrassFadeEnd;
${options.enableGrassDistanceFade ? "varying float vSceneryGrassFade;" : ""}`
          )
          .replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>
#ifdef USE_INSTANCING
  vec3 sceneryInstanceLocal = (instanceMatrix * vec4(position, 1.0)).xyz;
#else
  vec3 sceneryInstanceLocal = position;
#endif
  vec3 sceneryWorldPos = (modelMatrix * vec4(sceneryInstanceLocal, 1.0)).xyz;
  float sceneryPlayerDist = length(sceneryWorldPos.xz - uSceneryPlayerPos.xz);
  float sceneryGrassFade = 1.0;
  if (${options.enableGrassDistanceFade ? "true" : "false"}) {
    sceneryGrassFade =
      1.0 - smoothstep(uSceneryGrassFadeStart, uSceneryGrassFadeEnd, sceneryPlayerDist);
    transformed.y -= 100.0 * (1.0 - sceneryGrassFade);
  }
  ${options.enableGrassDistanceFade ? "vSceneryGrassFade = sceneryGrassFade;" : ""}
  float scenerySwayFactor = clamp(position.y / 0.5, 0.0, 1.0);
  float sceneryWindPhase =
    uSceneryWindTime * 2.0 +
    sceneryWorldPos.x * 0.3 +
    sceneryWorldPos.z * 0.4;
  vec2 sceneryWindOffset =
    uSceneryWindDirection *
    (uSceneryWindStrength + uSceneryWindGust * 0.45) *
    sin(sceneryWindPhase) *
    0.15 *
    scenerySwayFactor;
  vec2 sceneryPlayerOffset = vec2(0.0);
  if (sceneryPlayerDist > 0.001 && sceneryPlayerDist < 3.0) {
    vec2 sceneryPlayerDir = normalize(sceneryWorldPos.xz - uSceneryPlayerPos.xz);
    sceneryPlayerOffset =
      sceneryPlayerDir *
      (1.0 - sceneryPlayerDist / 3.0) *
      0.4 *
      scenerySwayFactor;
  }
  transformed.x += sceneryWindOffset.x + sceneryPlayerOffset.x;
  transformed.z += sceneryWindOffset.y + sceneryPlayerOffset.y;`
          );
        if (options.enableGrassDistanceFade) {
          shader.fragmentShader = shader.fragmentShader
            .replace(
              "#include <common>",
              `#include <common>
varying float vSceneryGrassFade;`
            )
            .replace(
              "#include <color_fragment>",
              `#include <color_fragment>
diffuseColor.a *= vSceneryGrassFade;`
            );
        }
      }
    };
    targetMaterial.needsUpdate = true;
  }
}

export function updateSceneryShaderPlayerPosition(
  material: SceneryShaderMaterialTarget,
  playerPosition: Vector3
): void {
  for (const targetMaterial of sceneryMaterials(material)) {
    const enhancer = enhancers.get(targetMaterial);
    if (!enhancer) {
      continue;
    }
    enhancer.uniforms.uSceneryPlayerPos.value.copy(playerPosition);
  }
}

export function updateSceneryShaderWind(
  material: SceneryShaderMaterialTarget,
  windUniforms: WindUniforms
): void {
  for (const targetMaterial of sceneryMaterials(material)) {
    const enhancer = enhancers.get(targetMaterial);
    if (!enhancer) {
      continue;
    }
    enhancer.uniforms.uSceneryWindDirection.value.copy(windUniforms.direction.value);
    enhancer.uniforms.uSceneryWindStrength.value = windUniforms.strength.value;
    enhancer.uniforms.uSceneryWindGust.value = windUniforms.gust.value;
    enhancer.uniforms.uSceneryWindTime.value = windUniforms.time.value;
    enhancer.uniforms.uSceneryWindNoiseScale.value = windUniforms.noiseScale.value;
  }
}

export function updateSceneryShaderSeasonal(
  material: SceneryShaderMaterialTarget,
  seasonalTint: Color
): void {
  for (const targetMaterial of sceneryMaterials(material)) {
    const enhancer = enhancers.get(targetMaterial);
    if (!enhancer) {
      continue;
    }
    enhancer.uniforms.uScenerySeasonalTint.value.copy(seasonalTint);
  }
}
