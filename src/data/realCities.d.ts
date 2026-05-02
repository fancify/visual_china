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
  /** 详细介绍，可多段（纯文本，用 `\n\n` 分段；用于城市详情面板） */
  description?: string;
}

export const realQinlingCities: RealCity[];
