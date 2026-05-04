export const LABEL_MAX_RENDER_DISTANCE_FACTOR = 30;

type Point3 = {
  x: number;
  y: number;
  z: number;
};

type LabelVisibilityProbe = {
  position: Point3;
  userData?: {
    maxLabelDistance?: number;
  };
};

export function labelMaxRenderDistance(scaleY: number): number {
  return scaleY * LABEL_MAX_RENDER_DISTANCE_FACTOR;
}

export function computeLabelVisibility(
  cameraPosition: Point3,
  labels: LabelVisibilityProbe[]
): boolean[] {
  return labels.map((label) => {
    const dx = label.position.x - cameraPosition.x;
    const dy = label.position.y - cameraPosition.y;
    const dz = label.position.z - cameraPosition.z;
    const distSq = dx * dx + dy * dy + dz * dz;
    const maxDistance =
      label.userData?.maxLabelDistance ?? LABEL_MAX_RENDER_DISTANCE_FACTOR;

    return distSq < maxDistance * maxDistance;
  });
}
