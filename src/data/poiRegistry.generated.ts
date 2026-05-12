// SSOT: derived from docs/05-epoch/tang-755/**/*.md frontmatter.
// DO NOT EDIT — regenerate via: node scripts/build-poi-registry.mjs
// Generated: 2026-05-12T17:12:36.656Z

export type PoiCategory = "city" | "relic" | "scenic" | "transport";
export type PoiHierarchy = "gravity" | "large" | "medium" | "small";

export interface PoiEntry {
  /** Filename stem from docs/05-epoch/tang-755/<category>/<id>.md (Tang-era romanization) */
  id: string;
  category: PoiCategory;
  lat: number;
  lon: number;
  /** Visual tier — gravity (T1) > large > medium > small */
  hierarchy: PoiHierarchy;
  /** Path to authoring markdown (for hover/link UIs). */
  docPath: string;
}

export const POI_REGISTRY: readonly PoiEntry[] = [
  { id: "changan", category: "city", lat: 34.27, lon: 108.95, hierarchy: "gravity", docPath: "docs/05-epoch/tang-755/cities/changan.md" },
  { id: "liangzhou", category: "city", lat: 37.93, lon: 102.64, hierarchy: "large", docPath: "docs/05-epoch/tang-755/cities/liangzhou.md" },
  { id: "lingwu", category: "city", lat: 37.99, lon: 106.2, hierarchy: "large", docPath: "docs/05-epoch/tang-755/cities/lingwu.md" },
  { id: "luoyang", category: "city", lat: 34.68, lon: 112.45, hierarchy: "gravity", docPath: "docs/05-epoch/tang-755/cities/luoyang.md" },
  { id: "shanzhou", category: "city", lat: 36.62, lon: 101.78, hierarchy: "large", docPath: "docs/05-epoch/tang-755/cities/shanzhou.md" },
  { id: "taiyuan", category: "city", lat: 37.73, lon: 112.48, hierarchy: "gravity", docPath: "docs/05-epoch/tang-755/cities/taiyuan.md" },
  { id: "yangzhou", category: "city", lat: 32.4, lon: 119.43, hierarchy: "gravity", docPath: "docs/05-epoch/tang-755/cities/yangzhou.md" },
  { id: "yizhou", category: "city", lat: 30.66, lon: 104.07, hierarchy: "gravity", docPath: "docs/05-epoch/tang-755/cities/yizhou.md" },
  { id: "youzhou", category: "city", lat: 39.85, lon: 116.3, hierarchy: "large", docPath: "docs/05-epoch/tang-755/cities/youzhou.md" },
  { id: "baima-si", category: "relic", lat: 34.7227, lon: 112.5944, hierarchy: "large", docPath: "docs/05-epoch/tang-755/relics/baima-si.md" },
  { id: "famen-si", category: "relic", lat: 34.4406, lon: 107.8869, hierarchy: "large", docPath: "docs/05-epoch/tang-755/relics/famen-si.md" },
  { id: "longmen-shiku", category: "relic", lat: 34.555, lon: 112.4717, hierarchy: "large", docPath: "docs/05-epoch/tang-755/relics/longmen-shiku.md" },
  { id: "mogao-caves", category: "relic", lat: 40.0478, lon: 94.8166, hierarchy: "large", docPath: "docs/05-epoch/tang-755/relics/mogao-caves.md" },
  { id: "wangchuan-bieye", category: "relic", lat: 34.08, lon: 109.32, hierarchy: "medium", docPath: "docs/05-epoch/tang-755/relics/wangchuan-bieye.md" },
  { id: "xingjiao-si", category: "relic", lat: 34.0747, lon: 108.9486, hierarchy: "large", docPath: "docs/05-epoch/tang-755/relics/xingjiao-si.md" },
  { id: "huashan", category: "scenic", lat: 34.4833, lon: 110.0833, hierarchy: "large", docPath: "docs/05-epoch/tang-755/scenic/huashan.md" },
  { id: "lushan", category: "scenic", lat: 29.55, lon: 115.97, hierarchy: "large", docPath: "docs/05-epoch/tang-755/scenic/lushan.md" },
  { id: "songshan", category: "scenic", lat: 34.5, lon: 113.04, hierarchy: "large", docPath: "docs/05-epoch/tang-755/scenic/songshan.md" },
  { id: "taibaishan", category: "scenic", lat: 34.0058, lon: 107.7833, hierarchy: "large", docPath: "docs/05-epoch/tang-755/scenic/taibaishan.md" },
  { id: "taishan", category: "scenic", lat: 36.2566, lon: 117.101, hierarchy: "large", docPath: "docs/05-epoch/tang-755/scenic/taishan.md" },
  { id: "zhongnan-shan", category: "scenic", lat: 34, lon: 108.95, hierarchy: "large", docPath: "docs/05-epoch/tang-755/scenic/zhongnan-shan.md" },
  { id: "chencang-dao", category: "transport", lat: 33.8, lon: 106.6, hierarchy: "large", docPath: "docs/05-epoch/tang-755/transport/chencang-dao.md" },
  { id: "jinniu-dao", category: "transport", lat: 33.07, lon: 107.02, hierarchy: "large", docPath: "docs/05-epoch/tang-755/transport/jinniu-dao.md" },
  { id: "micang-dao", category: "transport", lat: 32.4, lon: 106.85, hierarchy: "large", docPath: "docs/05-epoch/tang-755/transport/micang-dao.md" },
  { id: "qishan-dao", category: "transport", lat: 34.4, lon: 105.4, hierarchy: "large", docPath: "docs/05-epoch/tang-755/transport/qishan-dao.md" },
  { id: "tangluo-dao", category: "transport", lat: 33.6, lon: 107.85, hierarchy: "large", docPath: "docs/05-epoch/tang-755/transport/tangluo-dao.md" },
  { id: "ziwu-dao", category: "transport", lat: 33.5, lon: 108.85, hierarchy: "large", docPath: "docs/05-epoch/tang-755/transport/ziwu-dao.md" },
] as const;

export function poisByCategory(category: PoiCategory): readonly PoiEntry[] {
  return POI_REGISTRY.filter((p) => p.category === category);
}

export function poiById(id: string): PoiEntry | undefined {
  return POI_REGISTRY.find((p) => p.id === id);
}
