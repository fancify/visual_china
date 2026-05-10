export interface TerrainLodBreakdown {
  L0: number;
  L1: number;
  L2: number;
  hidden: number;
}

// chunk 实际尺寸 ~15u/边（real-DEM build 113×96 grid, world 1711×1186）。
// 视野半径 2 个 chunk → 视野内最远 chunk 中心约 30-35u。
// 阈值按 chunk-size proportional：L0_DISTANCE = 2 chunk radii (close 不 morph),
// L1_DISTANCE = 4 chunk radii (full morph)。morph 区间约 30→42u，玩家慢移就能看到过渡。
const L0_DISTANCE = 30;
const L1_DISTANCE = 90;
const L0_TO_L1_MORPH_WIDTH = (L1_DISTANCE - L0_DISTANCE) * 0.2;

export function computeLodMorph(distance: number): number {
  if (!Number.isFinite(distance) || distance <= L0_DISTANCE) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(1, (distance - L0_DISTANCE) / L0_TO_L1_MORPH_WIDTH)
  );
}

export function resolveLodMorphOverride(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : null;
}

export function shouldKeepTerrainLodVertexAtL0(
  x: number,
  z: number,
  width: number,
  depth: number
): boolean {
  const halfWidth = width * 0.5;
  const halfDepth = depth * 0.5;
  const epsilon = 1e-5;

  return (
    Math.abs(Math.abs(x) - halfWidth) <= epsilon ||
    Math.abs(Math.abs(z) - halfDepth) <= epsilon
  );
}

export function summarizeChunkLodMorphs(
  visibleMorphs: readonly number[],
  hidden: number
): TerrainLodBreakdown {
  return visibleMorphs.reduce<TerrainLodBreakdown>(
    (summary, morph) => {
      if (morph < 0.5) {
        summary.L0 += 1;
      } else {
        summary.L1 += 1;
      }
      return summary;
    },
    { L0: 0, L1: 0, L2: 0, hidden }
  );
}

export function formatTerrainLodBreakdown(summary: TerrainLodBreakdown): string {
  return `LOD: L0=${summary.L0} L1=${summary.L1} L2=${summary.L2} hidden=${summary.hidden}`;
}
