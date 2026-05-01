export const densityProfiles = {
  "high-focus": {
    coordinatePolicy: "strict-geographic",
    travelSpeedMultiplier: 1,
    cameraScaleMultiplier: 1,
    detailDensityMultiplier: 1,
    eventDensityMultiplier: 1
  },
  standard: {
    coordinatePolicy: "strict-geographic",
    travelSpeedMultiplier: 1.45,
    cameraScaleMultiplier: 1.18,
    detailDensityMultiplier: 0.72,
    eventDensityMultiplier: 0.72
  },
  sparse: {
    coordinatePolicy: "strict-geographic",
    travelSpeedMultiplier: 2.25,
    cameraScaleMultiplier: 1.42,
    detailDensityMultiplier: 0.42,
    eventDensityMultiplier: 0.38
  },
  "ultra-sparse": {
    coordinatePolicy: "strict-geographic",
    travelSpeedMultiplier: 3.4,
    cameraScaleMultiplier: 1.75,
    detailDensityMultiplier: 0.22,
    eventDensityMultiplier: 0.18
  }
};

export function geoToWorld(point, bounds, world) {
  return {
    x:
      ((point.lon - bounds.west) / (bounds.east - bounds.west)) * world.width -
      world.width * 0.5,
    z:
      ((point.lat - bounds.south) / (bounds.north - bounds.south)) * world.depth -
      world.depth * 0.5
  };
}

export function worldToGeo(point, bounds, world) {
  return {
    lon: bounds.west + (point.x / world.width + 0.5) * (bounds.east - bounds.west),
    lat: bounds.south + (point.z / world.depth + 0.5) * (bounds.north - bounds.south)
  };
}

export function densityProfileForClass(densityClass) {
  return densityProfiles[densityClass] ?? densityProfiles.standard;
}
