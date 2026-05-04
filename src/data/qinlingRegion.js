// Qinling 切片地理 + 投影常量——atlas / 3D / hydrography / content 共用，
// 改 bounds 时只改这里 + 跑 npm run qinling:dem:build-real。
//
// 跟 scripts/qinling-dem-common.mjs 的 qinlingBounds 必须同值（构建期 + 运行
// 期一致）。脚本暂时不能直接 import 这个 .js（pipeline 限制），手工保持同步。

// 2026-05 east + south extension：110 → 110.5, 30.4 → 28.5，把 华山 / 潼关 /
// 重庆 / 涪陵 / 泸州 / 宜宾 拉进当前 slice。所有 hardcoded {x,y} 已迁移成
// {lat,lon}，bounds 改后自动重投影，不再漂移。
export const qinlingRegionBounds = {
  west: 103.5,
  east: 110.5,
  south: 28.5,
  north: 35.4
};

export const qinlingRegionWorld = {
  width: 193,
  depth: 331
};
