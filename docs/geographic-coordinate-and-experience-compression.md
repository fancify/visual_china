# Geographic Coordinate And Experience Compression

更新时间：2026-05-01

## 结论

全国缩略图、区域 manifest、POI、路线和游戏平面坐标必须共用同一套严格地理坐标转换。游戏可以在高度、速度、镜头、资产密度和事件密度上做体验压缩，但不能把平面版图做非线性变形。

这意味着：

- 缩略图是地理真相层，必须严格按照中国版图和经纬度关系绘制。
- 游戏地形的 `x/z` 平面坐标必须能线性映射回经纬度。
- 新疆、青藏、高原、荒漠等非重点区域通过更快移动、更远镜头、更低细节密度、更稀事件密度压缩体验时间。
- 秦岭、关中、汉中、巴蜀、江南水网、河西走廊等重点区域保持高细节和较慢节奏。

## 坐标契约

统一转换函数位于 `src/game/geoProjection.js`：

```js
geoToWorld({ lon, lat }, bounds, world)
worldToGeo({ x, z }, bounds, world)
```

转换规则是线性的：

- `west -> -world.width / 2`
- `east -> world.width / 2`
- `south -> -world.depth / 2`
- `north -> world.depth / 2`

任何 POI、路线、剧情目标、chunk 边界和缩略图绘制都应该使用这套转换关系，而不是手写一套局部公式。

## 体验密度

`densityClass` 不改变坐标，只改变体验参数：

- `high-focus`：重点区域，低速度压缩，高细节，高事件密度。
- `standard`：普通可探索区域，中等速度和密度。
- `sparse`：大面积低密区域，提高移动速度，降低细节和事件密度。
- `ultra-sparse`：极低密区域，例如大荒漠、高原无人区，更强速度压缩和更粗资产。

当前秦岭 manifest 使用：

```json
{
  "densityClass": "high-focus",
  "coordinatePolicy": "strict-geographic"
}
```

## 为什么不采用游戏地形平面变形

平面变形会让游戏尺度短期更像主题公园，但会产生长期坐标债务：

- 缩略图与游戏位置需要维护非线性映射。
- 路线长度、行走速度、剧情触发和 lazy load 边界都会变复杂。
- 历史、地理、人文关系更容易出现事实性错位。

本项目的核心不是虚构世界，而是把真实山河关系变成可游玩的交互展览。因此地图不能撒谎，舞台可以有表现力。

## 已有验证

- `scripts/world-coordinate-contract.test.mjs` 验证地理坐标和游戏坐标严格线性互逆。
- `scripts/qinling-poi-geography.test.mjs` 验证汉中盆地 POI 落在真实汉中低地，而不是概念摆位。
- `public/data/regions/qinling/manifest.json` 已写入 `coordinatePolicy` 与 `experienceProfile`。
