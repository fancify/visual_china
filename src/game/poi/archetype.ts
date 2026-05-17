/**
 * POI archetype 推断 — 把 284 个 POI 自动分到 8 类视觉原型。
 *
 * 分类来自 `docs/05-epoch/tang-755/POI-INVENTORY-NATURAL-V2.md` 的整理:
 *   - cities/  → city (S/M/L 依 visual_hierarchy)
 *   - scenic/  → mountain
 *   - relics/  → 由文件名细分: mausoleum / ruin / temple / cave / node
 *   - transport/ → pass / node
 *
 * Override 字典处理边界 case (如周原在 relics 但实质山水遗址)。
 *
 * 使用方:
 *   - scripts/build-poi-registry.mjs (build-time, 扫所有 docs 输出 registry)
 *   - runtime POI loader (按 archetype 选 3D model)
 */

export type PoiArchetype =
  | "city" // 城市: 城墙 + 内部建筑群
  | "mountain" // 山水: 自然 terrain + 标记 (山门/碑亭)
  | "mausoleum" // 陵墓: 覆斗封土 + 神道 + 双阙
  | "ruin" // 古都废墟 / 古战场: 残破夯土
  | "pass" // 关塞: 关楼 + 两山夹峙
  | "temple" // 寺观: 中式建筑群 + 塔
  | "cave" // 石窟: 山崖凿窟 + 露天大佛
  | "node"; // 节点: 桥/渡/港/单体名楼

export type PoiSize = "small" | "medium" | "large";

export type PoiVariant =
  // mausoleum variants
  | "imperial" // 帝陵
  | "tomb" // 一般墓 (附葬陵 / 名臣墓)
  // pass variants
  | "minor" // 一般关
  | "major" // 重关 (潼关 / 剑门 / 玉门)
  // temple variants
  | "small_temple"
  | "grand" // 大寺 (国清 / 灵岩)
  | "taoist" // 道观 (楼观台 / 阳台宫)
  // node variants
  | "bridge"
  | "ferry"
  | "port"
  | "tower"; // 名楼 (滕王阁 / 黄鹤楼)

export interface ArchetypeResult {
  archetype: PoiArchetype;
  size?: PoiSize;
  variant?: PoiVariant;
}

/**
 * 个体 override — 当文件夹 + 文件名规则推不出正确分类时用。
 * key = POI doc filename (不含 .md)
 */
const OVERRIDES: Record<string, ArchetypeResult> = {
  // 周原 在 relics 但实质山水/遗址 anchor
  周原: { archetype: "ruin" },

  // 五丈原 / 隆中 / 鹿门别业 / 兰亭 在 relics 但实质是山水/隐居 anchor
  // 视觉上仍取 ruin (有遗址/碑亭/小屋)
  隆中: { archetype: "temple", variant: "small_temple" }, // 武侯祠
  五丈原: { archetype: "ruin" },
  鹿门别业: { archetype: "mountain" }, // 鹿门山隐居地, 视觉是山水
  兰亭: { archetype: "mountain" }, // 兰亭故地, 山水隐居

  // 楼观台 / 王屋山阳台宫 / 天台山 = 道教祖庭
  楼观台: { archetype: "temple", variant: "taoist" },
  王屋山阳台宫: { archetype: "temple", variant: "taoist" },
  天台山: { archetype: "mountain" }, // 天台山是山 + 国清寺; 视觉取山水, 寺为子条目

  // 巍山祖庭 (南诏祖庭) — 山顶寺
  巍山祖庭: { archetype: "temple", variant: "grand" },

  // 大昭寺红山宫 / 雍布拉康藏王陵 = 吐蕃建筑, 视觉特殊
  大昭寺红山宫: { archetype: "temple", variant: "grand" }, // 实际是宫城, 简化为大寺
  雍布拉康藏王陵: { archetype: "mausoleum", variant: "imperial" },

  // 武川镇 / 龙城 / 统万城 / 邺城 / 建康 / 殷墟 = 古都废墟
  武川镇: { archetype: "ruin" },
  龙城: { archetype: "ruin" },
  统万城: { archetype: "ruin" },

  // 涿鹿 / 牧野 / 长平 / 巨鹿 / 鸿门 / 垓下 / 官渡 / 街亭 / 赤壁 / 淝水 = 古战场, 视觉取 ruin
  // (默认推断已是 ruin)

  // 商丘 / 临淄 / 镐京 / 阿房宫 / 汉魏洛阳故城 / 平城 — 默认推断 ruin 已对

  // 灵岩寺 / 草堂寺 / 凉州大云寺 / 曹溪南华寺 — 默认推断 temple 已对

  // 莫高窟 在 cities 还是 relics? 实际未独立 doc; 是 沙州 子条目
  // 克孜尔石窟 在 relics, 文件名含"石窟" 默认 cave ✓

  // 北魏邙山陵群 / 南朝陵墓石刻群 / 唐六陵 — 默认 mausoleum (含"陵") ✓

  // 节点: 灞桥 / 蒲津渡 / 瓜洲渡 / 邗沟入江口 / 三门峡砥柱 / 名楼 / 港口 / 市舶
  // 默认推断: 含"桥"/"渡"/"港"/"楼"/"市舶" 都能推到 node + 正确 variant ✓

  // 三门峡砥柱 = 黄河险段, 视觉特殊 (中流孤峰)
  三门峡砥柱: { archetype: "ruin" }, // 砥柱被淹, 取废墟

  // 钩鱼台等若有, 加 override

  // 函谷关 = 关塞 (transport/ 文件夹 不在 — 实际在 relics/ — 古函谷关 + 函谷新关 + 魏函谷关)
  // 默认推断: 文件名含"关" → pass ✓ (即使在 relics/ 下也按文件名)

  // 赤岭碑 = 唐蕃界碑, 视觉特殊
  赤岭碑: { archetype: "ruin" }, // 立碑遗址

  // 居庸关 / 武关 / 萧关 / 剑门关 / 阳平关 / 倒马关 / 紫荆关 / 大震关 / 井陉关 / 玉门关 / 阳关 / 雁门关 / 散关 / 潼关
  // 默认含"关" → pass ✓

  // ---- 城市的 override (个体专属模型) — 暂留位, 实际 model 还未做 ----
  // 长安: 三重城 + 朱雀大街 + 大明宫 (高精度专属模型)
  // 洛阳: 三重城 + 洛水穿城
  // 这些 override 在 model registry 中处理, 不在 archetype 推断
};

/**
 * 推断 city 的 size 档位:
 *   - 都城 (长安/洛阳): visual_hierarchy=gravity → large
 *   - 大都督府 / 大州 (太原/扬州/益州/幽州/凉州/江都/广州 等): large
 *   - 中州 (一般府/州治): medium
 *   - 小州 / 县 / 边远州: small
 *
 * 输入 visualHierarchy 来自 frontmatter `visual_hierarchy`:
 *   - gravity / large → large
 *   - medium → medium
 *   - small → small (但很少 POI doc 用 small)
 */
function inferCitySize(visualHierarchy: string | undefined): PoiSize {
  if (visualHierarchy === "gravity" || visualHierarchy === "large") return "large";
  if (visualHierarchy === "medium") return "medium";
  return "small";
}

/**
 * 推断 pass 的 size 档位:
 *   - 重关 (visualHierarchy=large): major (关楼宏伟)
 *   - 一般关: minor
 */
function inferPassVariant(visualHierarchy: string | undefined): PoiVariant {
  return visualHierarchy === "large" || visualHierarchy === "gravity"
    ? "major"
    : "minor";
}

/**
 * 推断 mausoleum 的 variant:
 *   - 帝陵 (xx 陵 / xx 帝陵 / xx 帝墓): imperial
 *   - 一般墓: tomb
 */
function inferMausoleumVariant(fileName: string): PoiVariant {
  if (
    fileName.includes("帝陵") ||
    fileName.includes("帝墓") ||
    fileName.includes("泰陵") || // 隋文帝
    /^唐(献|昭|乾|桥|定|惠|庄|建|端|崇|丰|景|光|庄|齐|温|庄|靖|章)陵$/.test(fileName) // 唐帝陵
  ) {
    return "imperial";
  }
  // 北魏邙山陵群 / 南朝陵墓石刻群 — 帝陵群, 也取 imperial
  if (fileName.includes("陵群")) return "imperial";
  return "tomb";
}

/**
 * 推断 node 的 variant (桥/渡/港/楼)
 */
function inferNodeVariant(fileName: string): PoiVariant {
  if (fileName.includes("桥")) return "bridge";
  if (fileName.includes("渡") || fileName.includes("津")) return "ferry";
  if (fileName.includes("港") || fileName.includes("市舶")) return "port";
  if (fileName.includes("楼") || fileName.includes("阁") || fileName.includes("台")) return "tower";
  // 邗沟入江口 / 三门峡砥柱 等水系节点 — 取 ferry 作默认
  return "ferry";
}

/**
 * 推断 temple 的 variant:
 *   - 道观 (含"观"/"宫"): taoist
 *   - 大寺 (visualHierarchy=large): grand
 *   - 一般寺: small_temple
 */
function inferTempleVariant(
  fileName: string,
  visualHierarchy: string | undefined
): PoiVariant {
  // 道观判定
  if (
    fileName.includes("观") ||
    fileName.endsWith("宫") || // 阳台宫
    fileName.includes("祖庭") // 道教祖庭
  ) {
    return "taoist";
  }
  // 大寺 (大云寺 / 灵岩寺 / 国清寺 等)
  if (visualHierarchy === "large" || visualHierarchy === "gravity") {
    return "grand";
  }
  return "small_temple";
}

/**
 * 主推断函数
 *
 * @param filePath POI doc 的相对路径, e.g. 'docs/05-epoch/tang-755/cities/长安.md'
 * @param fileName POI doc 文件名 (不含 .md), e.g. '长安'
 * @param category frontmatter 中 category 字段值 ('city' / 'relic' / 'scenic' / 'transport')
 * @param visualHierarchy frontmatter 中 visual_hierarchy 字段值
 */
export function inferArchetype(
  filePath: string,
  fileName: string,
  _category: string | undefined,
  visualHierarchy: string | undefined
): ArchetypeResult {
  // 1. Override 字典 (个体例外)
  if (OVERRIDES[fileName]) return OVERRIDES[fileName];

  // 2. cities/ → city + size
  if (filePath.includes("/cities/")) {
    return { archetype: "city", size: inferCitySize(visualHierarchy) };
  }

  // 3. scenic/ → mountain
  if (filePath.includes("/scenic/")) {
    return { archetype: "mountain" };
  }

  // 4. transport/ → pass / node
  if (filePath.includes("/transport/")) {
    if (fileName.includes("关")) {
      return { archetype: "pass", variant: inferPassVariant(visualHierarchy) };
    }
    if (fileName.includes("道")) {
      // 驿道 - 实际是 path, 不渲染为 POI model; 但 registry 仍保留
      return { archetype: "node", variant: "ferry" }; // placeholder, runtime 可能跳过
    }
    // 其他 transport (桥/渡 等若放 transport/)
    return { archetype: "node", variant: inferNodeVariant(fileName) };
  }

  // 5. relics/ → 多种, 按文件名细分
  if (filePath.includes("/relics/")) {
    // 陵墓 (含"陵"/"墓")
    if (fileName.includes("陵") || fileName.includes("墓")) {
      return {
        archetype: "mausoleum",
        variant: inferMausoleumVariant(fileName),
      };
    }
    // 石窟
    if (fileName.includes("石窟")) {
      return { archetype: "cave" };
    }
    // 关塞 (在 relics/ 下的关, e.g. 函谷关)
    if (fileName.includes("关")) {
      return { archetype: "pass", variant: inferPassVariant(visualHierarchy) };
    }
    // 寺观 (寺/庵/庙/观/宫/祖庭)
    if (
      fileName.includes("寺") ||
      fileName.includes("庵") ||
      fileName.includes("庙") ||
      fileName.includes("观") ||
      fileName.endsWith("宫") ||
      fileName.includes("祖庭")
    ) {
      return {
        archetype: "temple",
        variant: inferTempleVariant(fileName, visualHierarchy),
      };
    }
    // 名楼 / 阁 / 台 (滕王阁 / 黄鹤楼 / 鹳雀楼 / 铜雀台)
    if (
      fileName.includes("楼") ||
      fileName.includes("阁") ||
      fileName.includes("台")
    ) {
      return { archetype: "node", variant: "tower" };
    }
    // 桥 / 渡 / 津
    if (
      fileName.includes("桥") ||
      fileName.includes("渡") ||
      fileName.includes("津")
    ) {
      return { archetype: "node", variant: inferNodeVariant(fileName) };
    }
    // 港 / 市舶
    if (fileName.includes("港") || fileName.includes("市舶")) {
      return { archetype: "node", variant: "port" };
    }
    // 其他 (古都废墟 / 古战场 / 周边文明遗址 等)
    return { archetype: "ruin" };
  }

  // 6. fallback
  return { archetype: "ruin" };
}
