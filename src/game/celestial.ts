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

export interface CelestialVisibilityInput {
  cloudOpacity: number;
  humidity: number;
  elevationMeters: number;
  moonPhase: number;
}

export interface CelestialVisibilityModifiers {
  starVisibilityMul: number;
  milkyWayVisibilityMul: number;
  moonGlareCut: number;
}

export interface RainbowPotentialInput {
  solarAltitude: number;
  precipitationOpacity: number;
  humidity: number;
  cloudOpacity: number;
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

export function moonIlluminationFromPhase(moonPhase: number): number {
  const phase = ((moonPhase % 1) + 1) % 1;
  return (1 - Math.cos(phase * Math.PI * 2)) * 0.5;
}

export function celestialVisibilityModifiers(
  input: CelestialVisibilityInput
): CelestialVisibilityModifiers {
  const cloud = clamp(input.cloudOpacity, 0, 1);
  const humidity = clamp(input.humidity, 0, 1);
  const elevation = clamp(input.elevationMeters / 4500, 0, 1);
  const moonGlareCut = clamp(
    moonIlluminationFromPhase(input.moonPhase) * 0.34 + cloud * 0.18,
    0,
    0.62
  );
  const clarity = clamp(1 - cloud * 0.58 - humidity * 0.36 + elevation * 0.22, 0.28, 1.24);

  return {
    starVisibilityMul: clarity,
    milkyWayVisibilityMul: clamp(clarity + elevation * 0.18 - moonGlareCut * 0.48, 0.18, 1.32),
    moonGlareCut
  };
}

export function rainbowPotential(input: RainbowPotentialInput): number {
  const moisture = clamp(input.humidity * 0.58 + input.precipitationOpacity * 0.72, 0, 1);
  const lowSun =
    smoothstep(input.solarAltitude, 0.04, 0.34) *
    (1 - smoothstep(input.solarAltitude, 0.34, 0.72));
  const cloudWindow = 1 - clamp(input.cloudOpacity * 0.55, 0, 0.8);
  return clamp(moisture * lowSun * cloudWindow, 0, 1);
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
  const cloudDeckOcclusion = clamp(
    smoothstep(weatherSunCut, 0.24, 0.42) * 0.92 + fogBoost * 360,
    0,
    0.98
  );
  const cloudWeatherBoost = clamp(weatherSunCut * 0.55 + fogBoost * 110, 0, 0.5);

  return {
    daylight,
    nightReadability: clamp(0.68 + night * 0.26 - weatherSunCut * 0.1, 0.58, 0.94),
    terrainLightnessFloor: clamp(1.14 + night * 0.18 - weatherSunCut * 0.08, 1.02, 1.34),
    moonOpacity: clamp(night * (1 - cloudDeckOcclusion * 0.88), 0, 1),
    starOpacity: clamp(starGate * night * 0.98 * (1 - cloudDeckOcclusion), 0, 1),
    sunDiscOpacity: clamp(daylight * (0.86 - weatherSunCut * 0.5) * (1 - cloudDeckOcclusion), 0, 0.86),
    cloudOpacity: clamp(0.16 + cloudWeatherBoost + night * 0.08, 0.12, 0.62),
    cloudDriftSpeed: 0.008 + windStrength * 0.028
  };
}
