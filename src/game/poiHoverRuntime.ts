import type { PoiInfo } from "./cityHoverHud";
import type { Intersection } from "three";
import { Object3D } from "three";

export interface HoverPoiMetadata {
  poi: PoiInfo;
}

export type HoverIntersectionPoiResolver = (
  object: Object3D,
  instanceId: number | undefined
) => PoiInfo | null;

export function attachHoverPoiMetadata(object: Object3D, poi: PoiInfo): void {
  object.userData.hoverPoi = {
    poi
  } satisfies HoverPoiMetadata;
}

export function isHoverPoiMetadata(value: unknown): value is HoverPoiMetadata {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<HoverPoiMetadata>;
  return (
    !!candidate.poi &&
    typeof candidate.poi.id === "string" &&
    typeof candidate.poi.name === "string" &&
    typeof candidate.poi.category === "string" &&
    typeof candidate.poi.worldX === "number" &&
    typeof candidate.poi.worldZ === "number"
  );
}

export function hoverPoiMetadataFromObject(object: Object3D): HoverPoiMetadata | null {
  return isHoverPoiMetadata(object.userData.hoverPoi) ? object.userData.hoverPoi : null;
}

export function findHoveredPoiFromIntersections(
  intersections: Array<Intersection<Object3D>>,
  resolvePoiFromIntersection?: HoverIntersectionPoiResolver
): PoiInfo | null {
  for (const intersection of intersections) {
    const hoverPoi = hoverPoiMetadataFromObject(intersection.object);
    if (hoverPoi) {
      return hoverPoi.poi;
    }

    const nextPoi = resolvePoiFromIntersection?.(
      intersection.object,
      intersection.instanceId
    );
    if (nextPoi) {
      return nextPoi;
    }
  }

  return null;
}
