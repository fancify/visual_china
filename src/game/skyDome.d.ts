export interface SkyDomePolicy {
  anchoring: "camera-centered";
  renderSpace: "world-sky-dome";
  screenSpace: false;
  radius: number;
}

export interface SkyBodyStyle {
  textureTreatment: string;
  minScale: number;
  maxScale: number;
  glowOpacity: number;
  radiusMultiplier: number;
}

export interface CelestialDomeVectorInput {
  timeOfDay: number;
  body: "sun" | "moon";
  radius?: number;
}

export interface CelestialDomeVector {
  x: number;
  y: number;
  z: number;
  altitude: number;
}

export const skyDomePolicy: SkyDomePolicy;

export const skyBodyStyle: {
  moon: SkyBodyStyle;
  sun: SkyBodyStyle;
};

export function celestialDomeVector(
  input: CelestialDomeVectorInput
): CelestialDomeVector;
