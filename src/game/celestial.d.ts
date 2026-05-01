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

export function solarPhase(timeOfDay: number): number;

export function celestialDiscPosition(
  input: CelestialDiscPositionInput
): CelestialDiscPosition;

export function celestialDomeCameraOffset(
  input: CelestialDomeCameraOffsetInput
): CelestialDomeCameraOffset;

export function celestialCycle(input: CelestialCycleInput): CelestialCycleVisuals;
