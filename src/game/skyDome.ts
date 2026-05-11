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
    minScale: 16,
    maxScale: 22,
    glowOpacity: 0.12,
    radiusMultiplier: 0.985
  },
  sun: {
    textureTreatment: "soft-sky-glow",
    minScale: 42,
    maxScale: 62,
    glowOpacity: 0.32,
    radiusMultiplier: 0.98
  }
};

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
