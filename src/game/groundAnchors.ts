import type { Object3D } from "three";

import type { DemWorldBounds, TerrainSamplerLike } from "./demSampler";

export type GroundAnchorCategory =
  | "city"
  | "path"
  | "scenic"
  | "ancient"
  | "scenery"
  | "label";

export interface GroundAnchor {
  object: Object3D;
  worldX: number;
  worldZ: number;
  baseOffset: number;
  category: GroundAnchorCategory;
  customReanchor?: (sampler: TerrainSamplerLike) => void;
}

export class GroundAnchorRegistry {
  private anchors = new Map<string, GroundAnchor>();

  register(id: string, anchor: GroundAnchor): void {
    this.anchors.set(id, anchor);
  }

  unregister(id: string): void {
    this.anchors.delete(id);
  }

  reanchor(sampler: TerrainSamplerLike, chunkBounds?: DemWorldBounds): void {
    for (const anchor of this.anchors.values()) {
      if (chunkBounds && !anchor.customReanchor && !anchorInChunkBounds(anchor, chunkBounds)) {
        continue;
      }
      applyAnchor(anchor, sampler);
    }
  }

  reanchorAll(sampler: TerrainSamplerLike): void {
    this.reanchor(sampler);
  }
}

function applyAnchor(anchor: GroundAnchor, sampler: TerrainSamplerLike): void {
  if (anchor.customReanchor) {
    anchor.customReanchor(sampler);
    return;
  }
  anchor.object.position.y =
    sampler.sampleSurfaceHeight(anchor.worldX, anchor.worldZ) + anchor.baseOffset;
}

function anchorInChunkBounds(anchor: GroundAnchor, bounds: DemWorldBounds): boolean {
  const insideHalfOpen =
    anchor.worldX >= bounds.minX &&
    anchor.worldX < bounds.maxX &&
    anchor.worldZ >= bounds.minZ &&
    anchor.worldZ < bounds.maxZ;
  if (insideHalfOpen) {
    return true;
  }

  // 正常 chunk 用半开区间；零宽 bounds 只用于调用方显式兜底最外缘。
  return (
    bounds.minX === bounds.maxX &&
    anchor.worldX === bounds.maxX &&
    anchor.worldZ >= bounds.minZ &&
    anchor.worldZ <= bounds.maxZ
  ) || (
    bounds.minZ === bounds.maxZ &&
    anchor.worldZ === bounds.maxZ &&
    anchor.worldX >= bounds.minX &&
    anchor.worldX <= bounds.maxX
  );
}
