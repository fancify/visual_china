export interface CityFlattenZone {
  cityId: string;
  centerX: number;
  centerZ: number;
  /** xz plane radius - 由 outerSide × 0.65 算得（外墙 outer/2 + 0.15 缓冲带）*/
  radius: number;
  /** 强制返回的地面高度（z=0 平面上的 Y） */
  groundY: number;
}

let zones: CityFlattenZone[] = [];

export function setCityFlattenZones(next: CityFlattenZone[]): void {
  zones = next.slice();
}

export function getCityFlattenZones(): readonly CityFlattenZone[] {
  return zones;
}

export function findZoneAt(x: number, z: number): CityFlattenZone | null {
  let nearest: CityFlattenZone | null = null;
  let nearestDistanceSq = Infinity;

  for (const zone of zones) {
    const dx = x - zone.centerX;
    const dz = z - zone.centerZ;
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq > zone.radius * zone.radius) {
      continue;
    }
    if (distanceSq < nearestDistanceSq) {
      nearest = zone;
      nearestDistanceSq = distanceSq;
    }
  }

  return nearest;
}

export function flattenedY(originalY: number, x: number, z: number): number {
  const zone = findZoneAt(x, z);
  return zone ? zone.groundY : originalY;
}
