// Qinling 切片地理 + 投影常量——atlas / 3D / hydrography / content 共用，
// 改 bounds 时只改这里 + 跑 npm run qinling:dem:build-real。
//
// 跟 scripts/qinling-dem-common.mjs 的 qinlingBounds 必须同值（构建期 + 运行
// 期一致）。脚本暂时不能直接 import 这个 .js（pipeline 限制），手工保持同步。

// 2026-05 east + south + north extension：east 117.0、south 22.0、north 40.0。
// 所有 hardcoded {x,y} 已迁移成 {lat,lon}，bounds 改后自动重投影，不再漂移。
export const qinlingRegionBounds = {
  west: 103.5,
  east: 117.0,
  south: 22.0,
  north: 40.0
};

export const qinlingRegionWorld = {
  // world.width 必须跟 east 扩展同步放大，否则横向 cell 会被压扁。
  // 这里保持 u/°lon = 27.6 不变：27.6 × 13.5° = 372.6 ≈ 373。
  width: 373,
  // 北扩到 40N 后按物理 cos(midLat) 重算 N-S 尺度：
  // midLat = 31°，depth = round(27.6 × 18 / cos(31°)) = 579。
  depth: 579
};
