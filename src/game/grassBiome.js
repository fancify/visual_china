export const GRASS_DENSITY_MULTIPLIER = {
  none: 0,
  sparse: 0.2,
  normal: 1,
  lush: 1.4
};

export function grassDensityAt(_worldX, _worldZ, elevation, geoLat, geoLon) {
  if (elevation > 2.5) {
    return "none";
  }

  if (geoLon < 95 && geoLat > 35 && geoLat < 43) {
    return "sparse";
  }

  if (geoLon < 100 && geoLat > 25 && geoLat < 40 && elevation > 1) {
    return "sparse";
  }

  if (geoLon > 110 && geoLat > 22 && geoLat < 32) {
    return "lush";
  }

  return "normal";
}
