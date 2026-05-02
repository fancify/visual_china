/**
 * 秦岭 / 关中 / 蜀道沿线真实城市坐标表。
 *
 * 数据来源：
 * - lat/lon 取自当代行政中心（Wikipedia / 中国国家基础地理信息数据），
 *   不同朝代历史治所（如汉中之"褒城"）以现代行政中心代替。
 * - tier = 京城 / 州府 / 县城，按城市的历史/当代规模分档：
 *   - 京城：长安（西安）、成都（蜀汉都城）—— 三档建筑簇里的最高档
 *   - 州府：宝鸡、汉中、广元、天水、绵阳、巴中、德阳（重要节点城市）
 *   - 县城：参考"古蜀道示意全图"里挂在古道线上的县级节点
 *
 * 跟之前 qinlingSlice.ts / qinlingAtlas.js 里手画的 "意象" POI 不同——
 * 这一组明确标 verification: "real-coord" 表示位置可以在地图上对得上，
 * "诸葛亮六出祁山"这种事件能用真实路径在地图上指着说。
 */

export type CityTier = "capital" | "prefecture" | "county";

export interface RealCity {
  /** 唯一英文 id，用于 mesh 命名、查找 */
  id: string;
  /** 中文显示名 */
  name: string;
  /** WGS84 纬度（°） */
  lat: number;
  /** WGS84 经度（°） */
  lon: number;
  tier: CityTier;
  /** 简短背景说明，一行（用于 panel hint，可空） */
  hint?: string;
}

export const realQinlingCities: RealCity[] = [
  // 京城（capital）
  {
    id: "xian",
    name: "西安",
    lat: 34.27,
    lon: 108.95,
    tier: "capital",
    hint: "古长安，关中盆地的核心，汉/唐都城"
  },
  {
    id: "chengdu",
    name: "成都",
    lat: 30.66,
    lon: 104.07,
    tier: "capital",
    hint: "成都平原核心，蜀汉都城，金牛道终点"
  },

  // 州府（prefecture）
  {
    id: "baoji",
    name: "宝鸡",
    lat: 34.36,
    lon: 107.24,
    tier: "prefecture",
    hint: "陈仓道入秦岭起点，关中西门户"
  },
  {
    id: "hanzhong",
    name: "汉中",
    lat: 33.07,
    lon: 107.03,
    tier: "prefecture",
    hint: "汉中盆地核心，秦巴间咽喉，多条蜀道交汇"
  },
  {
    id: "guangyuan",
    name: "广元",
    lat: 32.43,
    lon: 105.84,
    tier: "prefecture",
    hint: "金牛道入蜀第一城，剑门关北口"
  },
  {
    id: "tianshui",
    name: "天水",
    lat: 34.58,
    lon: 105.72,
    tier: "prefecture",
    hint: "祁山道终点，诸葛亮六出祁山的目标"
  },
  {
    id: "mianyang",
    name: "绵阳",
    lat: 31.47,
    lon: 104.74,
    tier: "prefecture",
    hint: "金牛道蜀地段重要节点"
  },
  {
    id: "bazhong",
    name: "巴中",
    lat: 31.85,
    lon: 106.77,
    tier: "prefecture",
    hint: "米仓道南端"
  },
  {
    id: "deyang",
    name: "德阳",
    lat: 31.13,
    lon: 104.40,
    tier: "prefecture",
    hint: "金牛道入成都前最后一站"
  },

  // 县城（county）
  { id: "meixian", name: "眉县", lat: 34.27, lon: 107.75, tier: "county", hint: "褒斜道关中端的入口" },
  { id: "zhouzhi", name: "周至", lat: 34.16, lon: 108.22, tier: "county", hint: "傥骆道关中端入口" },
  { id: "fengxian", name: "凤县", lat: 33.91, lon: 106.52, tier: "county", hint: "陈仓道腹心" },
  { id: "taibai", name: "太白", lat: 34.06, lon: 107.32, tier: "county", hint: "秦岭主脊腹地，褒斜道折线" },
  { id: "liuba", name: "留坝", lat: 33.62, lon: 106.92, tier: "county", hint: "褒斜道汉中端" },
  { id: "mianxian", name: "勉县", lat: 33.15, lon: 106.67, tier: "county", hint: "汉中盆地西段" },
  { id: "lueyang", name: "略阳", lat: 33.33, lon: 106.16, tier: "county", hint: "陈仓道蜀地段" },
  { id: "ningqiang", name: "宁强", lat: 32.83, lon: 106.26, tier: "county", hint: "金牛道入山口" },
  { id: "xihe", name: "西和", lat: 34.01, lon: 105.30, tier: "county", hint: "祁山道沿线" },
  { id: "chengxian", name: "成县", lat: 33.74, lon: 105.73, tier: "county", hint: "祁山道沿线" },
  { id: "lixian", name: "礼县", lat: 34.19, lon: 105.18, tier: "county", hint: "祁山堡所在，六出祁山主战场" },
  { id: "zhaohua", name: "昭化", lat: 32.32, lon: 105.65, tier: "county", hint: "金牛道剑门关后" },
  { id: "jiange", name: "剑阁", lat: 32.30, lon: 105.55, tier: "county", hint: "剑门关所在" },
  { id: "zitong", name: "梓潼", lat: 31.65, lon: 105.18, tier: "county", hint: "金牛道蜀地段" },
  { id: "nanjiang", name: "南江", lat: 32.36, lon: 106.84, tier: "county", hint: "米仓道腹心" },
  { id: "zhenba", name: "镇巴", lat: 32.55, lon: 107.90, tier: "county", hint: "荔枝道汉中端" },
  { id: "xixiang", name: "西乡", lat: 32.99, lon: 107.77, tier: "county", hint: "汉中盆地东段，子午道汉中端" }
];
