import {
  Color,
  MathUtils,
  type AmbientLight,
  type DirectionalLight,
  type Fog,
  Vector2,
  Vector3,
  type WebGLRenderer
} from "three";

import {
  applySkyVisuals,
  type SkyDomeHandle
} from "./atmosphereLayer.js";
import { climateContextForWorldPosition } from "./climateContext.js";
import {
  cloudVisualProfileForWeather,
  updateCloudLayer,
  type CloudLayerHandle
} from "./cloudPlanes.js";
import {
  EnvironmentController,
  formatAncientTimeOfDay,
  seasonLabel,
  sharedAtmosphericFarColor,
  skyBodyHorizonFade,
  sunDiscAspectForAltitude,
  sunDiscScaleForAltitude,
  weatherLabel
} from "./environment.js";
import {
  celestialDomeVector,
  northernCelestialPole,
  skyBodyStyle,
  skyDomePolicy,
  starDomeSiderealAngle
} from "./skyDome.js";
export {
  advancePyramidTimePreset,
  PYRAMID_TIME_PRESETS,
  pyramidTimePresetAfter,
  type PyramidTimePreset
} from "./pyramidEnvironmentControls.js";

export interface PyramidWaterSurfaceEnvironmentTarget {
  setSunDirection?(direction: Vector3): void;
  setShimmerStrength?(strength: number): void;
}

export interface PyramidCloudEnvironmentTarget {
  layer: CloudLayerHandle;
  driftSeconds: number;
  windDirection?: Vector2;
  updateDriftSeconds(nextDriftSeconds: number): void;
}

export interface PyramidEnvironmentRuntimeTargets {
  environment: EnvironmentController;
  cameraPosition: Vector3;
  elapsedSeconds: number;
  deltaSeconds: number;
  fog: Fog;
  ambientLight: AmbientLight;
  sunLight: DirectionalLight;
  moonLight: DirectionalLight;
  rimLight: DirectionalLight;
  renderer: WebGLRenderer;
  skyDome: SkyDomeHandle;
  oceanWaterSurface?: PyramidWaterSurfaceEnvironmentTarget;
  cloud?: PyramidCloudEnvironmentTarget;
}

export function pyramidEnvironmentStatus(
  environment: EnvironmentController
): string {
  return [
    formatAncientTimeOfDay(environment.state.timeOfDay),
    seasonLabel(environment.state.season),
    weatherLabel(environment.state.weather)
  ].join(" · ");
}

export function applyPyramidEnvironmentRuntime(
  targets: PyramidEnvironmentRuntimeTargets
): void {
  const {
    environment,
    cameraPosition,
    elapsedSeconds,
    deltaSeconds,
    fog,
    ambientLight,
    sunLight,
    moonLight,
    rimLight,
    renderer,
    skyDome,
    oceanWaterSurface,
    cloud
  } = targets;
  const climate = climateContextForWorldPosition(cameraPosition.x, cameraPosition.z);
  const visuals = environment.computeVisuals({ climate });

  fog.color.copy(visuals.fogColor);
  const fogT = MathUtils.clamp(visuals.fogDensity / 0.0045, 0, 1);
  fog.near = MathUtils.lerp(500, 300, fogT);
  fog.far = MathUtils.lerp(1720, 1080, fogT);

  ambientLight.color.copy(visuals.ambientColor);
  ambientLight.intensity = visuals.ambientIntensity * 0.45;
  sunLight.color.copy(visuals.sunColor);
  sunLight.intensity = visuals.sunIntensity * 0.46;
  sunLight.position.copy(visuals.sunDirection);
  moonLight.color.copy(visuals.moonColor);
  moonLight.intensity = visuals.moonOpacity * 0.34;
  moonLight.position.copy(visuals.moonDirection);
  rimLight.color.copy(visuals.rimColor);
  rimLight.intensity = visuals.rimIntensity * 0.28;

  renderer.setClearColor(visuals.skyColor);
  skyDome.group.position.copy(cameraPosition);
  skyDome.starDome.setRotationFromAxisAngle(
    northernCelestialPole,
    starDomeSiderealAngle({
      timeOfDay: environment.state.timeOfDay,
      dayCount: environment.state.dayCount
    })
  );
  const sunDomeVector = celestialDomeVector({
    timeOfDay: environment.state.timeOfDay,
    body: "sun"
  });
  const skySunDirection = new Vector3(
    sunDomeVector.x,
    sunDomeVector.y,
    sunDomeVector.z
  ).normalize();
  applySkyVisuals(skyDome, {
    skyColor: visuals.skyColor,
    skyHorizonColor: visuals.skyHorizonColor,
    horizonCoolColor: visuals.skyHorizonCoolColor,
    skyZenithColor: visuals.skyZenithColor,
    groundColor: visuals.skyGroundColor,
    starOpacity: visuals.starOpacity,
    sunDirection: skySunDirection,
    sunWarmColor: visuals.skySunWarmColor,
    sunInfluence: visuals.skySunInfluence,
    sunVisibility: skyBodyHorizonFade(sunDomeVector.altitude),
    moonPhase: visuals.moonPhase
  });

  const starTwinkleUniforms = skyDome.starDomeMaterial.userData.twinkleUniforms as
    | { twinkleTime: { value: number } }
    | undefined;
  if (starTwinkleUniforms) {
    starTwinkleUniforms.twinkleTime.value = elapsedSeconds;
  }

  const moonDomeVector = celestialDomeVector({
    timeOfDay: environment.state.timeOfDay,
    body: "moon",
    radius: skyDomePolicy.radius * skyBodyStyle.moon.radiusMultiplier
  });

  skyDome.sunDisc.position.set(sunDomeVector.x, sunDomeVector.y, sunDomeVector.z);
  const sunDiscScale = sunDiscScaleForAltitude(sunDomeVector.altitude);
  const sunDiscAspect = sunDiscAspectForAltitude(sunDomeVector.altitude);
  skyDome.sunDisc.scale.set(
    sunDiscScale * sunDiscAspect.x,
    sunDiscScale * sunDiscAspect.y,
    1
  );
  skyDome.sunDiscMaterial.color.copy(visuals.sunColor);
  skyDome.sunDiscMaterial.opacity =
    visuals.sunDiscOpacity * skyBodyHorizonFade(sunDomeVector.altitude);

  skyDome.moonDisc.position.set(moonDomeVector.x, moonDomeVector.y, moonDomeVector.z);
  skyDome.moonDisc.scale.setScalar(
    MathUtils.lerp(
      skyBodyStyle.moon.minScale,
      skyBodyStyle.moon.maxScale,
      Math.max(0, moonDomeVector.altitude)
    )
  );
  skyDome.moonDiscMaterial.color.copy(
    new Color(visuals.moonColor).lerp(new Color("#fff8e4"), 0.16)
  );
  skyDome.moonDiscMaterial.opacity =
    visuals.moonOpacity * skyBodyHorizonFade(moonDomeVector.altitude);

  oceanWaterSurface?.setSunDirection?.(visuals.sunDirection);
  oceanWaterSurface?.setShimmerStrength?.(visuals.waterShimmer * 0.42);

  if (cloud) {
    const nextDriftSeconds =
      cloud.driftSeconds + deltaSeconds * visuals.cloudDriftSpeed * 4;
    updateCloudLayer(cloud.layer, {
      playerPosition: cameraPosition,
      opacity: visuals.cloudOpacity * 0.18,
      farColor: sharedAtmosphericFarColor(visuals),
      sunWarmColor: visuals.skySunWarmColor,
      skyZenithColor: visuals.skyZenithColor,
      windDirection: cloud.windDirection ?? new Vector2(0.86, 0.5).normalize(),
      elapsedSeconds: nextDriftSeconds,
      profile: cloudVisualProfileForWeather(environment.state.weather),
      daylight: visuals.daylight,
      starOpacity: visuals.starOpacity
    });
    cloud.updateDriftSeconds(nextDriftSeconds);
  }
}
