/**
 * 全国画幅下要额外补的五大湖近似边界。
 * 这里用 8-12 个经纬度顶点描述简化 polygon，目标是视觉辨识度，不追求测绘精度。
 */

export interface ChinaLakePolygonPoint {
  lat: number;
  lon: number;
}

export interface ChinaLake {
  id: string;
  name: string;
  centerLat: number;
  centerLon: number;
  polygon: readonly ChinaLakePolygonPoint[];
}

/**
 * 五大湖：青海湖、鄱阳湖、洞庭湖、太湖、巢湖。
 * 坐标只做全国视角下的形状近似，用于离散湖面 polygon mesh 渲染。
 */
export const CHINA_LAKES: readonly ChinaLake[] = [
  {
    id: "lake-qinghai",
    name: "青海湖",
    centerLat: 36.85,
    centerLon: 100.18,
    polygon: [
      { lat: 37.1, lon: 99.55 },
      { lat: 37.2, lon: 100.0 },
      { lat: 37.15, lon: 100.5 },
      { lat: 36.95, lon: 100.85 },
      { lat: 36.65, lon: 100.8 },
      { lat: 36.55, lon: 100.4 },
      { lat: 36.55, lon: 99.85 },
      { lat: 36.75, lon: 99.55 }
    ]
  },
  {
    id: "lake-poyang",
    name: "鄱阳湖",
    centerLat: 29.1,
    centerLon: 116.2,
    polygon: [
      { lat: 29.7, lon: 116.1 },
      { lat: 29.65, lon: 116.4 },
      { lat: 29.3, lon: 116.55 },
      { lat: 29.0, lon: 116.5 },
      { lat: 28.75, lon: 116.2 },
      { lat: 28.85, lon: 116.0 },
      { lat: 29.2, lon: 115.95 },
      { lat: 29.55, lon: 116.0 }
    ]
  },
  {
    id: "lake-dongting",
    name: "洞庭湖",
    centerLat: 29.2,
    centerLon: 112.85,
    polygon: [
      { lat: 29.45, lon: 112.5 },
      { lat: 29.5, lon: 113.0 },
      { lat: 29.3, lon: 113.2 },
      { lat: 29.0, lon: 113.1 },
      { lat: 28.85, lon: 112.85 },
      { lat: 28.95, lon: 112.6 },
      { lat: 29.2, lon: 112.45 }
    ]
  },
  {
    id: "lake-tai",
    name: "太湖",
    centerLat: 31.2,
    centerLon: 120.2,
    polygon: [
      { lat: 31.45, lon: 120.05 },
      { lat: 31.5, lon: 120.3 },
      { lat: 31.35, lon: 120.45 },
      { lat: 31.1, lon: 120.45 },
      { lat: 30.95, lon: 120.3 },
      { lat: 30.95, lon: 120.05 },
      { lat: 31.1, lon: 119.95 },
      { lat: 31.3, lon: 119.95 }
    ]
  },
  {
    id: "lake-chao",
    name: "巢湖",
    centerLat: 31.55,
    centerLon: 117.45,
    polygon: [
      { lat: 31.65, lon: 117.2 },
      { lat: 31.7, lon: 117.55 },
      { lat: 31.6, lon: 117.75 },
      { lat: 31.45, lon: 117.7 },
      { lat: 31.4, lon: 117.4 },
      { lat: 31.5, lon: 117.2 }
    ]
  }
];
