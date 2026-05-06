export const LABEL_MAX_RENDER_DISTANCE_FACTOR = 30;

type Point3 = {
  x: number;
  y: number;
  z: number;
};

type LabelVisibilityProbe = {
  position: Point3;
  scale?: {
    y: number;
  };
  userData?: {
    maxLabelDistance?: number;
  };
};

export interface LabelVisibilityInput {
  cameraPosition: Point3;
  cameraFovDeg: number;
  canvasHeightPx: number;
  maxScreenHeightPx: number;
}

export function labelMaxRenderDistance(scaleY: number): number {
  return scaleY * LABEL_MAX_RENDER_DISTANCE_FACTOR;
}

export function computeLabelShouldShow(
  label: LabelVisibilityProbe,
  input: LabelVisibilityInput
): boolean {
  const dx = label.position.x - input.cameraPosition.x;
  const dy = label.position.y - input.cameraPosition.y;
  const dz = label.position.z - input.cameraPosition.z;
  const distSq = dx * dx + dy * dy + dz * dz;
  const maxDistance =
    label.userData?.maxLabelDistance ?? LABEL_MAX_RENDER_DISTANCE_FACTOR;

  if (distSq >= maxDistance * maxDistance) {
    return false;
  }

  const spriteWorldHeight = label.scale?.y ?? 1;
  const dist = Math.sqrt(distSq);
  const fovRad = (input.cameraFovDeg * Math.PI) / 180;
  const halfViewHeightAtDistance = Math.max(dist * Math.tan(fovRad * 0.5), 0.001);
  const projectedHeightPx =
    (input.canvasHeightPx * 0.5 * spriteWorldHeight) / halfViewHeightAtDistance;

  return projectedHeightPx <= input.maxScreenHeightPx;
}

export function computeLabelVisibility(
  labels: LabelVisibilityProbe[],
  input: LabelVisibilityInput
): boolean[] {
  return labels.map((label) => computeLabelShouldShow(label, input));
}
