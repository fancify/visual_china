// Qinling 切片地理 + 投影常量——atlas / 3D / hydrography / content 共用，
// 改 bounds 时只改这里 + 跑 npm run qinling:dem:build-real。
//
// 跟 scripts/qinling-dem-common.mjs 的 qinlingBounds 必须同值（构建期 + 运行
// 期一致）。脚本暂时不能直接 import 这个 .js（pipeline 限制），手工保持同步。

// 2026-05 Phase 2：bounds 扩到全中国。所有 hardcoded {x,y} 已迁移成
// {lat,lon}，bounds 改后自动重投影，不再漂移。
export const qinlingRegionBounds = {
  west: 73.0,
  east: 135.0,
  south: 18.0,
  north: 53.0
};

export const qinlingRegionWorld = {
  // 保持 u/°lon = 27.6，不拉长东西向比例：
  // width = round(27.6 × 62°) = 1711。
  width: 1711,
  // 用 cos(midLat) 校正南北物理尺度，避免全国画幅被纵向拉长：
  // midLat = 35.5°，depth = round(27.6 × 35° / cos(35.5°)) = 1186。
  depth: 1186
};
