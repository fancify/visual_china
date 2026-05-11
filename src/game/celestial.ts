export interface CelestialCycleInput {
  timeOfDay: number;
  weatherSunCut: number;
  fogBoost: number;
  windStrength: number;
}

export interface CelestialCycleVisuals {
  daylight: number;
  nightReadability: number;
  terrainLightnessFloor: number;
  moonOpacity: number;
  starOpacity: number;
  sunDiscOpacity: number;
  cloudOpacity: number;
  cloudDriftSpeed: number;
}

export interface CelestialDiscPositionInput {
  timeOfDay: number;
  body: "sun" | "moon";
}

export interface CelestialDiscPosition {
  unit: "sky-dome-css";
  left: number;
  top: number;
  scale: number;
  horizonFade: number;
}

export interface CelestialDomeCameraOffsetInput {
  cameraHeading: number;
}

export interface CelestialDomeCameraOffset {
  unit: "vw";
  x: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(value: number, min: number, max: number): number {
  if (min === max) {
    return value < min ? 0 : 1;
  }

  const t = clamp((value - min) / (max - min), 0, 1);
  return t * t * (3 - 2 * t);
}

export function solarPhase(timeOfDay: number): number {
  return Math.sin(((timeOfDay - 6) / 24) * Math.PI * 2);
}

export function celestialDiscPosition(
  { timeOfDay, body }: CelestialDiscPositionInput
): CelestialDiscPosition {
  const bodyOffset = body === "moon" ? 12 : 0;
  const phase = (((timeOfDay + bodyOffset - 6 + 24) % 24) / 24) * Math.PI * 2;
  const altitude = Math.sin(phase);
  const left = 50 + Math.cos(phase) * 40;
  const top = 50 - altitude * 42;
  const horizonFade = smoothstep(altitude, -0.18, 0.16);

  return {
    unit: "sky-dome-css",
    left: clamp(left, 6, 94),
    top: clamp(top, 6, 84),
    scale: clamp(0.58 + horizonFade * 0.42, 0.58, 1),
    horizonFade
  };
}

export function celestialDomeCameraOffset(
  { cameraHeading }: CelestialDomeCameraOffsetInput
): CelestialDomeCameraOffset {
  const fullTurn = Math.PI * 2;
  const normalized =
    ((((cameraHeading + Math.PI) % fullTurn) + fullTurn) % fullTurn) - Math.PI;

  return {
    unit: "vw",
    x: Number(((-normalized / Math.PI) * 44).toFixed(3))
  };
}

export function celestialCycle(
  { timeOfDay, weatherSunCut, fogBoost, windStrength }: CelestialCycleInput
): CelestialCycleVisuals {
  const solar = solarPhase(timeOfDay);
  const daylight = smoothstep(solar, -0.08, 0.38);
  const night = 1 - daylight;
  // 星星不跟着 night 线性出现，而是等太阳明显落到地平线下再开启。
  const starGate = smoothstep(-solar, 0.1, 0.35);
  const cloudWeatherBoost = clamp(weatherSunCut * 0.55 + fogBoost * 110, 0, 0.5);

  return {
    daylight,
    nightReadability: clamp(0.68 + night * 0.26 - weatherSunCut * 0.1, 0.58, 0.94),
    terrainLightnessFloor: clamp(1.14 + night * 0.18 - weatherSunCut * 0.08, 1.02, 1.34),
    moonOpacity: clamp(night * (1 - weatherSunCut * 0.28), 0, 1),
    starOpacity: clamp(starGate * night * 0.98 - weatherSunCut * 0.4, 0, 1),
    sunDiscOpacity: clamp(daylight * (0.86 - weatherSunCut * 0.5), 0, 0.86),
    cloudOpacity: clamp(0.16 + cloudWeatherBoost + night * 0.08, 0.12, 0.62),
    cloudDriftSpeed: 0.008 + windStrength * 0.028
  };
}
