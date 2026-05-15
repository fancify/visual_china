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

export interface StarDomeSiderealInput {
  timeOfDay: number;
  dayCount: number;
}

export const skyDomePolicy: SkyDomePolicy = {
  anchoring: "camera-centered",
  renderSpace: "world-sky-dome",
  screenSpace: false,
  radius: 360
};

export const skyBodyStyle: {
  moon: SkyBodyStyle;
  sun: SkyBodyStyle;
} = {
  moon: {
    textureTreatment: "flat-distant-disc",
    minScale: 22.5,
    maxScale: 31.5,
    glowOpacity: 0.12,
    radiusMultiplier: 0.86
  },
  sun: {
    textureTreatment: "soft-sky-glow",
    minScale: 42,
    maxScale: 62,
    glowOpacity: 0.32,
    radiusMultiplier: 0.98
  }
};

const QINLING_REFERENCE_LATITUDE_DEG = 34;
const SIDEREAL_ADVANCE_PER_SOLAR_DAY = 1.00273790935;

export const northernCelestialPole = new Vector3(
  0,
  Math.sin((QINLING_REFERENCE_LATITUDE_DEG * Math.PI) / 180),
  -Math.cos((QINLING_REFERENCE_LATITUDE_DEG * Math.PI) / 180)
).normalize();

export function starDomeSiderealAngle(
  { timeOfDay, dayCount }: StarDomeSiderealInput
): number {
  const turns = dayCount * SIDEREAL_ADVANCE_PER_SOLAR_DAY + timeOfDay / 24;
  return (((turns % 1) + 1) % 1) * Math.PI * 2;
}

export function celestialDomeVector(
  { timeOfDay, body, radius = skyDomePolicy.radius }: CelestialDomeVectorInput
): CelestialDomeVector {
  const bodyOffset = body === "moon" ? 12 : 0;
  const phase = (((timeOfDay + bodyOffset - 6 + 24) % 24) / 24) * Math.PI * 2;
  const altitude = Math.sin(phase);

  return {
    x: Math.cos(phase) * radius,
    y: altitude * radius * 0.82,
    z: -radius * 0.42,
    altitude
  };
}
import { Vector3 } from "three";
