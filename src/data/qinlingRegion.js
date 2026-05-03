// Qinling 切片地理 + 投影常量——atlas / 3D / hydrography / content 共用，
// 改 bounds 时只改这里 + 跑 npm run qinling:dem:build-real。
//
// 跟 scripts/qinling-dem-common.mjs 的 qinlingBounds 必须同值（构建期 + 运行
// 期一致）。脚本暂时不能直接 import 这个 .js（pipeline 限制），手工保持同步。

export const qinlingRegionBounds = {
  west: 103.5,
  east: 109,
  south: 30.4,
  north: 35.4
};

export const qinlingRegionWorld = {
  width: 180,
  depth: 240
};
