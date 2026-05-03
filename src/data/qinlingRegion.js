// Qinling 切片地理 + 投影常量——atlas / 3D / hydrography / content 共用，
// 改 bounds 时只改这里 + 跑 npm run qinling:dem:build-real。
//
// 跟 scripts/qinling-dem-common.mjs 的 qinlingBounds 必须同值（构建期 + 运行
// 期一致）。脚本暂时不能直接 import 这个 .js（pipeline 限制），手工保持同步。

// 2026-05 east extension（refactor #63 让这步成为一行配置改动）：109 → 110
// 把 兵马俑(109.27)/秦始皇陵(109.25)/半坡(109.07) 收进切片。所有 hardcoded
// {x,y} 已迁移成 {lat,lon}，bounds 改后自动重投影，不再漂移。
// 华山 (110.08°E) 还差 0.08°，等下次 E110 archive 下载后再扩到 110.5。
export const qinlingRegionBounds = {
  west: 103.5,
  east: 110,
  south: 30.4,
  north: 35.4
};

export const qinlingRegionWorld = {
  width: 180,
  depth: 240
};
