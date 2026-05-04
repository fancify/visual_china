let zones = [];

export function setCityFlattenZones(next) {
  zones = next.slice();
}

export function getCityFlattenZones() {
  return zones;
}

export function findZoneAt(x, z) {
  let nearest = null;
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

export function flattenedY(originalY, x, z) {
  const zone = findZoneAt(x, z);
  return zone ? zone.groundY : originalY;
}
