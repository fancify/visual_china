import {
  AmbientLight,
  DirectionalLight,
  Fog,
  FogExp2,
  PerspectiveCamera,
  Scene,
  Vector3,
  type WebGLRenderer
} from "three";
import {
  EnvironmentController,
  seasonLabel,
  skyBodyHorizonFade,
  sunDiscScaleForAltitude,
  weatherLabel,
  type EnvironmentVisuals,
  type WeatherState
} from "../environment.js";
import {
  applySkyVisuals,
  createSkyDome,
  type SkyDomeHandle
} from "../atmosphereLayer.js";
import {
  celestialDomeVector,
  skyBodyStyle,
  skyDomePolicy
} from "../skyDome.js";

export interface PyramidEnvironmentWaterSurface {
  setSunDirection(direction: Vector3): void;
}

export interface PyramidEnvironmentRuntimeOptions {
  scene: Scene;
  renderer: Pick<WebGLRenderer, "setClearColor">;
  camera: PerspectiveCamera;
  ambientLight: AmbientLight;
  sunLight: DirectionalLight;
  fog?: Fog | FogExp2 | null;
  waterSurfaces?: PyramidEnvironmentWaterSurface[];
  enableSkyDome?: boolean;
  ambientIntensityScale?: number;
  sunIntensityScale?: number;
  fogDensityScale?: number;
}

export interface PyramidEnvironmentRuntime {
  controller: EnvironmentController;
  skyDome: SkyDomeHandle | null;
  update(deltaSeconds: number): EnvironmentVisuals;
  setWeather(weather: WeatherState, durationSec?: number): void;
  advanceWeather(): void;
  statusText(): string;
  dispose(): void;
}

function applyFog(fog: Fog | FogExp2 | null | undefined, visuals: EnvironmentVisuals, densityScale: number): void {
  if (!fog) return;
  fog.color.copy(visuals.fogColor);
  if ("density" in fog) {
    fog.density = visuals.fogDensity * densityScale;
  }
}

function updateSkyDome(
  skyDome: SkyDomeHandle,
  camera: PerspectiveCamera,
  visuals: EnvironmentVisuals,
  timeOfDay: number,
  elapsedSeconds: number
): void {
  skyDome.group.position.copy(camera.position);
  skyDome.sunDiscMaterial.color.copy(visuals.sunColor);
  skyDome.moonDiscMaterial.color.copy(visuals.moonColor);

  applySkyVisuals(skyDome, {
    skyColor: visuals.skyColor,
    skyHorizonColor: visuals.skyHorizonColor,
    horizonCoolColor: visuals.skyHorizonCoolColor,
    skyZenithColor: visuals.skyZenithColor,
    groundColor: visuals.skyGroundColor,
    starOpacity: visuals.starOpacity,
    sunDirection: visuals.sunDirection,
    sunWarmColor: visuals.skySunWarmColor,
    sunInfluence: visuals.skySunInfluence,
    moonPhase: visuals.moonPhase
  });

  const starTwinkleUniforms = skyDome.starDomeMaterial.userData.twinkleUniforms as
    | { twinkleTime: { value: number } }
    | undefined;
  if (starTwinkleUniforms) {
    starTwinkleUniforms.twinkleTime.value = elapsedSeconds;
  }

  const sunDomeVector = celestialDomeVector({
    timeOfDay,
    body: "sun"
  });
  skyDome.sunDisc.position.set(sunDomeVector.x, sunDomeVector.y, sunDomeVector.z);
  skyDome.sunDisc.scale.setScalar(sunDiscScaleForAltitude(sunDomeVector.altitude));
  skyDome.sunDiscMaterial.opacity = visuals.sunDiscOpacity * skyBodyHorizonFade(sunDomeVector.altitude);

  const moonDomeVector = celestialDomeVector({
    timeOfDay,
    body: "moon",
    radius: skyDomePolicy.radius * skyBodyStyle.moon.radiusMultiplier
  });
  skyDome.moonDisc.position.set(moonDomeVector.x, moonDomeVector.y, moonDomeVector.z);
  skyDome.moonDisc.scale.setScalar(skyBodyStyle.moon.maxScale);
  skyDome.moonDiscMaterial.opacity = visuals.moonOpacity * skyBodyHorizonFade(moonDomeVector.altitude);
}

export function createPyramidEnvironmentRuntime(
  opts: PyramidEnvironmentRuntimeOptions
): PyramidEnvironmentRuntime {
  const controller = new EnvironmentController();
  const skyDome = opts.enableSkyDome ? createSkyDome() : null;
  const ambientIntensityScale = opts.ambientIntensityScale ?? 0.45;
  const sunIntensityScale = opts.sunIntensityScale ?? 0.38;
  const fogDensityScale = opts.fogDensityScale ?? 0.35;
  let elapsedSeconds = 0;
  let lastVisuals = controller.computeVisuals();

  if (skyDome) {
    opts.scene.add(skyDome.group);
  }

  function applyVisuals(visuals: EnvironmentVisuals): void {
    opts.scene.background = visuals.skyColor.clone();
    opts.renderer.setClearColor(visuals.skyColor);
    opts.ambientLight.color.copy(visuals.ambientColor);
    opts.ambientLight.intensity = visuals.ambientIntensity * ambientIntensityScale;
    opts.sunLight.color.copy(visuals.sunColor);
    opts.sunLight.intensity = visuals.sunIntensity * sunIntensityScale;
    opts.sunLight.position.copy(visuals.sunDirection);
    applyFog(opts.fog, visuals, fogDensityScale);
    for (const waterSurface of opts.waterSurfaces ?? []) {
      waterSurface.setSunDirection(visuals.sunDirection);
    }
    if (skyDome) {
      updateSkyDome(skyDome, opts.camera, visuals, controller.state.timeOfDay, elapsedSeconds);
    }
  }

  applyVisuals(lastVisuals);

  return {
    controller,
    skyDome,
    update(deltaSeconds: number): EnvironmentVisuals {
      elapsedSeconds += Math.max(0, deltaSeconds);
      controller.update(deltaSeconds);
      lastVisuals = controller.computeVisuals();
      applyVisuals(lastVisuals);
      return lastVisuals;
    },
    setWeather(weather: WeatherState, durationSec?: number): void {
      controller.setWeather(weather, durationSec);
    },
    advanceWeather(): void {
      controller.advanceWeather();
    },
    statusText(): string {
      const state = controller.state;
      return `时辰 ${state.timeOfDay.toFixed(1)} · ${seasonLabel(state.season)} · ${weatherLabel(state.weather)}`;
    },
    dispose(): void {
      if (skyDome) {
        opts.scene.remove(skyDome.group);
      }
    }
  };
}
