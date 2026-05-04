import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { qinlingRegionBounds, qinlingRegionWorld } from "../src/data/qinlingRegion.js";
import { projectGeoToWorld } from "../src/game/mapOrientation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.resolve(
  __dirname,
  "../src/game/data/qinlingRouteAnchors.js"
);

const ROUTE_DEFINITIONS = [
  {
    id: "chencang-road",
    labelIndex: 3,
    anchors: [
      { name: "宝鸡（古陈仓）", note: "宝鸡市陈仓故地", lat: 34.36, lon: 107.24 },
      { name: "大散关", note: "宝鸡西南秦岭西端关口", lat: 34.2, lon: 107.0 },
      { name: "凤县", note: "陈仓道中段最大居民点", lat: 33.91, lon: 106.52 },
      { name: "嘉陵江上游", note: "陈仓道沿嘉陵江上游南下", lat: 33.5, lon: 106.2 },
      { name: "略阳", note: "嘉陵江西岸入汉中前重镇", lat: 33.33, lon: 106.16 },
      { name: "勉县（古沔阳）", note: "汉中盆地西缘门户", lat: 33.15, lon: 106.67 },
      { name: "汉中", note: "汉中盆地核心", lat: 33.07, lon: 107.03 }
    ]
  },
  {
    id: "baoxie-road",
    labelIndex: 3,
    anchors: [
      { name: "眉县 斜谷北口", note: "关中入山主谷口，褒斜道自斜谷入秦岭。", lat: 34.3, lon: 107.75 },
      { name: "太白县 鹦鸽镇", note: "今属太白县的北段山口集镇；以县境内的鹦鸽镇代表褒斜道太白段，不另加偏离主线的太白县城锚点。", lat: 34.05, lon: 107.45 },
      { name: "桃川", note: "由北向西南折入桃川谷地，贴合绕太白山西侧的历史走向。", lat: 33.85, lon: 107.2 },
      { name: "留坝县", note: "褒斜道古驿密集地，张良庙所在，是褒斜道关键中段节点。", lat: 33.62, lon: 106.92 },
      { name: "武关驿", note: "留坝南下褒水谷地驿站，承接古道进入褒城前的南段通道。", lat: 33.4, lon: 106.95 },
      { name: "褒城（古汉中治所）", note: "褒水下口古治所，出山后汇入汉中盆地北缘。", lat: 33.15, lon: 106.95 },
      { name: "汉中", note: "汉中盆地核心", lat: 33.07, lon: 107.03 }
    ]
  },
  {
    id: "guanzhong-corridor",
    labelIndex: 2,
    anchors: [
      { name: "宝鸡", note: "陈仓道北口，关中西段重镇。", lat: 34.36, lon: 107.24 },
      { name: "眉县", note: "褒斜道北口，渭河南岸通行节点。", lat: 34.3, lon: 107.75 },
      { name: "周至", note: "傥骆道北口，关中西南出山口。", lat: 34.16, lon: 108.22 },
      { name: "西安", note: "子午道北口，关中东段核心。", lat: 34.27, lon: 108.95 }
    ]
  },
  {
    id: "tangluo-road",
    labelIndex: 3,
    anchors: [
      { name: "周至", note: "傥骆道关中起点，周至县城南", lat: 34.16, lon: 108.22 },
      { name: "周至 骆谷北口", note: "西安西南周至县入山口", lat: 33.97, lon: 108.3 },
      { name: "黑河源", note: "傥骆道越岭前主脊段", lat: 33.8, lon: 108.0 },
      { name: "十八盘", note: "秦岭腹地连续盘折段", lat: 33.55, lon: 107.85 },
      { name: "洋县 傥水谷口", note: "南下出谷转入洋县盆地", lat: 33.3, lon: 107.55 },
      { name: "洋县", note: "傥骆道南段主要节点", lat: 33.22, lon: 107.55 },
      { name: "汉中", note: "汉中盆地核心", lat: 33.07, lon: 107.03 }
    ]
  },
  {
    id: "ziwu-road",
    labelIndex: 3,
    anchors: [
      { name: "西安", note: "子午道关中起点，长安城南门外", lat: 34.27, lon: 108.95 },
      { name: "长安 子午谷北口", note: "西安市长安区子午峪", lat: 33.97, lon: 108.85 },
      { name: "江口", note: "宁陕县江口镇古驿", lat: 33.55, lon: 108.55 },
      { name: "腰岭关", note: "宁陕县境内秦岭主脊关口", lat: 33.32, lon: 108.4 },
      { name: "石泉北", note: "越岭后下切汉江北岸", lat: 33.05, lon: 108.25 },
      { name: "西乡 / 黄金峡", note: "子午道南段转向汉中盆地", lat: 33.0, lon: 107.75 },
      { name: "汉中", note: "汉中盆地核心", lat: 33.07, lon: 107.03 }
    ]
  },
  {
    id: "jinniu-road",
    labelIndex: 4,
    anchors: [
      { name: "汉中", note: "金牛道北端枢纽", lat: 33.07, lon: 107.03 },
      { name: "勉县（古沔阳，定军山所在）", note: "汉中西缘古沔阳", lat: 33.15, lon: 106.67 },
      { name: "宁强（古宁羌）", note: "陕川转换前的山口节点", lat: 32.83, lon: 106.26 },
      { name: "七盘关", note: "陕川界险绝关隘", lat: 32.65, lon: 106.1 },
      { name: "广元", note: "金牛道入蜀后的嘉陵江谷地大节点", lat: 32.43, lon: 105.84 },
      { name: "昭化（古葭萌）", note: "嘉陵江西岸古城", lat: 32.32, lon: 105.86 },
      { name: "剑门关", note: "剑门山口核心锁钥", lat: 32.2, lon: 105.55 },
      { name: "武连", note: "剑阁南下后的驿站节点", lat: 31.85, lon: 105.25 },
      { name: "梓潼", note: "七曲山与古驿集中的金牛道重镇", lat: 31.64, lon: 105.16 },
      { name: "绵阳", note: "入盆地后北四川平原通道", lat: 31.47, lon: 104.74 },
      { name: "德阳", note: "成都平原北部门户", lat: 31.13, lon: 104.4 },
      { name: "成都", note: "金牛道南端终点", lat: 30.66, lon: 104.07 }
    ]
  },
  {
    id: "micang-road",
    labelIndex: 2,
    anchors: [
      { name: "汉中", note: "米仓道北端枢纽", lat: 33.07, lon: 107.03 },
      { name: "南郑（古西乡）", note: "汉中南口向大巴山推进", lat: 33.0, lon: 106.95 },
      { name: "米仓山主脊", note: "越大巴山主脊核心段", lat: 32.45, lon: 106.85 },
      { name: "南江", note: "米仓道入川北后的山间节点", lat: 32.36, lon: 106.83 },
      { name: "巴中", note: "川东北盆缘城市", lat: 31.85, lon: 106.75 }
    ]
  },
  {
    id: "qishan-road",
    labelIndex: 3,
    anchors: [
      { name: "天水", note: "陇右起点，上邽方向的北伐目标", lat: 34.58, lon: 105.72 },
      { name: "祁山堡", note: "礼县祁山镇西汉水北岸孤堡，诸葛亮屯兵处，祁山道西折关键点。", lat: 34.2, lon: 105.41 },
      { name: "成县", note: "祁山道由陇南折向嘉陵江上游的中段节点", lat: 33.74, lon: 105.73 },
      { name: "白水江", note: "取略阳县白水江镇一带的嘉陵江谷地古驿，承接成县南下后转入略阳方向。", lat: 33.47, lon: 105.89 },
      { name: "略阳", note: "与陈仓道汇合的山间重镇", lat: 33.33, lon: 106.16 },
      { name: "勉县", note: "汉中盆地西缘门户", lat: 33.15, lon: 106.67 },
      { name: "汉中", note: "汉中盆地核心", lat: 33.07, lon: 107.03 }
    ]
  },
  {
    id: "lizhi-road",
    labelIndex: 2,
    anchors: [
      { name: "西安", note: "唐代长安起点", lat: 34.27, lon: 108.95 },
      { name: "西乡", note: "经子午道南下后转入巴山", lat: 33.0, lon: 107.75 },
      { name: "镇巴", note: "入大巴山南行的中转节点", lat: 32.53, lon: 107.9 },
      { name: "大竹河 / 万源附近", note: "巴山段山间通道", lat: 32.0, lon: 108.0 },
      { name: "涪陵", note: "南端终点，当前切片外保留锚点", lat: 29.7, lon: 107.39 }
    ]
  }
];

function formatNumber(value) {
  return Number(value.toFixed(2));
}

function projectAnchor(anchor) {
  const worldPoint = projectGeoToWorld(anchor, qinlingRegionBounds, qinlingRegionWorld);

  return {
    x: formatNumber(worldPoint.x),
    y: formatNumber(worldPoint.z)
  };
}

function routeModuleSource() {
  const lines = [
    "// AUTO-GENERATED by scripts/build-qinling-route-anchors.mjs — 不要手改。",
    "// 历史锚点以可核对地名 + 近似经纬度定义，优先保证史地可解释性。",
    "// 跑 `node scripts/build-qinling-route-anchors.mjs` 重新生成。",
    "",
    "export const QINLING_ROUTE_ANCHOR_GEOGRAPHY = {"
  ];

  for (const route of ROUTE_DEFINITIONS) {
    lines.push(`  "${route.id}": [`);
    for (const anchor of route.anchors) {
      lines.push(
        `    { name: ${JSON.stringify(anchor.name)}, note: ${JSON.stringify(anchor.note)}, lat: ${anchor.lat}, lon: ${anchor.lon} },`
      );
    }
    lines.push("  ],");
  }

  lines.push("};", "", "export const qinlingRouteAnchors = {");

  for (const route of ROUTE_DEFINITIONS) {
    const labelAnchor = route.anchors[route.labelIndex];
    const labelPoint = projectAnchor(labelAnchor);

    lines.push(`  "${route.id}": {`);
    lines.push("    points: [");

    for (const anchor of route.anchors) {
      const point = projectAnchor(anchor);

      lines.push(
        `      // ${anchor.name} (lat ${anchor.lat}, lon ${anchor.lon}) — ${anchor.note}`
      );
      lines.push(`      { x: ${point.x}, y: ${point.y} },`);
    }

    lines.push("    ],");
    lines.push(
      `    // label anchor: ${labelAnchor.name} (lat ${labelAnchor.lat}, lon ${labelAnchor.lon})`
    );
    lines.push(
      `    labelPoint: { x: ${labelPoint.x}, y: ${labelPoint.y} }`
    );
    lines.push("  },");
  }

  lines.push("};", "");

  return `${lines.join("\n")}\n`;
}

await writeFile(outputPath, routeModuleSource(), "utf8");
console.log(`Wrote ${path.relative(process.cwd(), outputPath)}`);
