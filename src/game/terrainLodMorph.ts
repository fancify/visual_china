export interface TerrainLodBreakdown {
  L0: number;
  blend: number;
  L1: number;
  hidden: number;
}

// chunk 实际尺寸 ~15u/边（real-DEM build 113×96 grid, world 1711×1186）。
// R6 改为 vertex shader 按每个顶点 world distance morph，阈值保留 R4 语义：
// <30u 完全 L0，>90u 完全 L1。HUD 只用 chunk 中心点估算当前可见区分布。
export const TERRAIN_LOD_MORPH_START = 30;
export const TERRAIN_LOD_MORPH_END = 90;

export function computeLodMorph(distance: number): number {
  if (!Number.isFinite(distance) || distance <= TERRAIN_LOD_MORPH_START) {
    return 0;
  }

  if (distance >= TERRAIN_LOD_MORPH_END) {
    return 1;
  }

  const t =
    (distance - TERRAIN_LOD_MORPH_START) /
    (TERRAIN_LOD_MORPH_END - TERRAIN_LOD_MORPH_START);
  return t * t * (3 - 2 * t);
}

export function resolveLodMorphOverride(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : null;
}

export function summarizeChunkLodMorphs(
  visibleMorphs: readonly number[],
  hidden: number
): TerrainLodBreakdown {
  return visibleMorphs.reduce<TerrainLodBreakdown>(
    (summary, morph) => {
      if (morph <= 0) {
        summary.L0 += 1;
      } else if (morph >= 1) {
        summary.L1 += 1;
      } else {
        summary.blend += 1;
      }
      return summary;
    },
    { L0: 0, blend: 0, L1: 0, hidden }
  );
}

export function formatTerrainLodBreakdown(summary: TerrainLodBreakdown): string {
  return `LOD(center): L0=${summary.L0} blend=${summary.blend} L1=${summary.L1} hidden=${summary.hidden}`;
}
