/**
 * 山河中国 · 地图方向契约
 *
 * 这一层定义**地理方向**（北/东/南/西）映射到 3D 世界轴的方式。
 *
 * 设计原则：让"北"对应 Three.js 默认相机朝向（-Z）。
 * 这样玩家默认就是朝北看，不需要任何 180° 翻转：
 *   - 北 = -Z 方向 → 屏幕远处 = 北 ✓
 *   - 东 = +X 方向 → 屏幕右 = 东 ✓
 *   - 上 = +Y 方向 → 天空在屏幕顶 ✓
 *
 * 历史：早期契约用 `+Z = 北` 把"地理"和"引擎"绑死，导致相机绕 Y 翻转
 * 才能朝北看，连带屏幕右 east-west 镜像反复出 bug。重构后：
 *   - worldAxis.js → 只描述 Three.js 引擎约定
 *   - mapOrientation.js（本文件）→ 决定地理方向映射
 *   - geoProjection / atlas / demSampler 用本文件常量派生坐标
 *
 * 下面的常量是**世界 (x, z) 单位向量**，z 分量按新约定 -Z=北。
 */

/** 北方在世界中的方向（与 Three.js 相机默认 forward 对齐）。 */
export const MAP_NORTH = Object.freeze({ x: 0, z: -1 });

/** 南方在世界中的方向。 */
export const MAP_SOUTH = Object.freeze({ x: 0, z: 1 });

/** 东方在世界中的方向（与屏幕 right 对齐）。 */
export const MAP_EAST = Object.freeze({ x: 1, z: 0 });

/** 西方在世界中的方向。 */
export const MAP_WEST = Object.freeze({ x: -1, z: 0 });

export const MAP_ORIENTATION_CONTRACT = Object.freeze({
  northAxis: "-z",
  eastAxis: "+x",
  description:
    "Geographic north maps to world -Z (camera default forward). " +
    "Geographic east maps to world +X (screen right). " +
    "This makes 'screen up = north' and 'screen right = east' both hold."
});

/**
 * 把经纬度投影到世界坐标 (x, z)。
 * 这是项目中唯一允许做经纬度→世界 (x, z) 投影的函数。
 *
 * 按本文件契约：北 = -Z，所以 lat 越大 → world.z 越小。
 */
export function projectGeoToWorld(geo, bounds, world) {
  const lonSpan = bounds.east - bounds.west || 1;
  const latSpan = bounds.north - bounds.south || 1;

  return {
    x: ((geo.lon - bounds.west) / lonSpan - 0.5) * world.width,
    // lat=south → z=+halfDepth (south); lat=north → z=-halfDepth (north)
    z: (0.5 - (geo.lat - bounds.south) / latSpan) * world.depth
  };
}

/**
 * 把世界坐标 (x, z) 反推回经纬度。
 */
export function unprojectWorldToGeo(point, bounds, world) {
  const lonSpan = bounds.east - bounds.west;
  const latSpan = bounds.north - bounds.south;

  return {
    lon: bounds.west + (point.x / world.width + 0.5) * lonSpan,
    lat: bounds.south + (0.5 - point.z / world.depth) * latSpan
  };
}

/**
 * 把世界坐标投影到 atlas 画布像素（北在画布上方，东在画布右侧）。
 *
 * 按本契约：北 = -Z，所以 z 越小（越北）→ canvas y 越小（屏幕上方）。
 */
export function projectWorldToAtlasPixel(point, world, canvas) {
  return {
    x: (point.x / world.width + 0.5) * canvas.width,
    // z=-halfDepth (north) → y=0 (top); z=+halfDepth (south) → y=canvas.height (bottom)
    y: (point.z / world.depth + 0.5) * canvas.height
  };
}

/**
 * 把 atlas 画布像素反推回世界坐标。
 */
export function unprojectAtlasPixelToWorld(pixel, world, canvas) {
  return {
    x: (pixel.x / canvas.width - 0.5) * world.width,
    z: (pixel.y / canvas.height - 0.5) * world.depth
  };
}

/**
 * 给定 row index，返回该行的纬度。
 * heights 数组 row 0 = 最北一行 → world.z = -halfDepth → lat = bounds.north。
 */
export function latitudeAtRow(row, rows, bounds) {
  const t = rows <= 1 ? 0 : row / (rows - 1);
  return bounds.north - t * (bounds.north - bounds.south);
}

/**
 * 给定 column index，返回该列的经度。
 */
export function longitudeAtColumn(column, columns, bounds) {
  const t = columns <= 1 ? 0 : column / (columns - 1);
  return bounds.west + t * (bounds.east - bounds.west);
}
