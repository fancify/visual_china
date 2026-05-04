export interface RealElevationAssetLike {
  minHeight: number;
  maxHeight: number;
  presentation?: {
    realPeakMeters?: number;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * 把游戏高度近似反推为真实海拔（米）。
 * 当前 DEM 在 build 期经过非线性增强，因此这里只能做 HUD 级线性近似。
 */
export function gameHeightToRealMeters(
  gameY: number,
  asset: RealElevationAssetLike
): number {
  const minHeight = Number.isFinite(asset.minHeight) ? asset.minHeight : -3;
  const maxHeight = Number.isFinite(asset.maxHeight) ? asset.maxHeight : 13;
  const realPeakMeters = asset.presentation?.realPeakMeters ?? 3700;

  if (!(maxHeight > minHeight) || !Number.isFinite(gameY)) {
    return 0;
  }

  const normalized = clamp((gameY - minHeight) / (maxHeight - minHeight), 0, 1);
  return Math.max(0, Math.round(normalized * realPeakMeters));
}
