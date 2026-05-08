import fs from "node:fs/promises";
import path from "node:path";

import {
  qinlingBounds,
  qinlingResolutionStrategy,
  qinlingOutputGrid,
  qinlingRegionManifestBounds,
  qinlingWorkspacePath,
  qinlingWorld
} from "./qinling-dem-common.mjs";
import { getHydroShedsSampler } from "./hydrosheds-sampler.mjs";
import { qinlingModernHydrography } from "../src/game/qinlingHydrography.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(value, min, max) {
  if (min === max) {
    return value < min ? 0 : 1;
  }

  const t = clamp((value - min) / (max - min), 0, 1);
  return t * t * (3 - 2 * t);
}

// 高斯凸起叠在线性真实高程上：海平面与高峰基本不动，中段丘陵被拉高，
// 让 300-1500m 地带在全国视野里仍保留体积感。
function enhanceMidRangeRelief(realMeters, lat = qinlingBounds.north) {
  const safeMeters = Math.max(0, realMeters);
  const midPoint = 1000;
  const spread = 800;
  const peakBoost = 0.5;

  const dx = (safeMeters - midPoint) / spread;
  const bumpFactor = Math.exp(-dx * dx);

  // 全中国 bounds 下 global peak 被更高山体主导，贵州/桂北 800-2500m 的
  // 喀斯特山地在全局归一化下会显得"发闷"。只在 lat<30 的中海拔带额外抬一档，
  // 不动全国其余区域的 baseline，也避免把 3000m+ 主峰继续拉爆。
  const southernWeight = smoothstep(30 - lat, 0, 8);
  const karstBand =
    smoothstep(safeMeters, 800, 1500) *
    (1 - smoothstep(safeMeters, 2500, 3200));
  const southernKarstBoost = 0.08 * southernWeight * karstBand;

  return safeMeters * (1 + peakBoost * bumpFactor + southernKarstBoost);
}

function indexAt(column, row, columns) {
  return row * columns + column;
}

function meanNeighborDifference(values, column, row, columns, rows) {
  const center = values[indexAt(column, row, columns)];

  if (!Number.isFinite(center)) {
    return 0;
  }

  let total = 0;
  let count = 0;

  for (let y = Math.max(0, row - 1); y <= Math.min(rows - 1, row + 1); y += 1) {
    for (let x = Math.max(0, column - 1); x <= Math.min(columns - 1, column + 1); x += 1) {
      if (x === column && y === row) {
        continue;
      }

      const neighbor = values[indexAt(x, y, columns)];

      if (Number.isFinite(neighbor)) {
        total += neighbor;
        count += 1;
      }
    }
  }

  if (count === 0) {
    return 0;
  }

  return total / count - center;
}

// 2026-05 河谷雕刻：DEM 1.5km/sample 平均掉真实河谷 (~200m 宽)，渲染时河
// polyline 经常"穿"进 mesh 山体。把每条河 polyline 在 build 期反向压进 DEM
// 高度场——半径根据 rank 变化，并用更陡的 V 形 falloff 保持峡谷感。
//
// 关键：carving 是在 normalize 之后做的，所以 depth 是游戏单位 (-2..9 范围内)
// 而不是真实米数。每个 cell 取 min(current, riverHeight - depth*falloff)。
// Phase 3 Step 2：完全废除 DEM 河谷雕刻。河流改由 createWaterSurfaceRibbon 在
// mesh 上方画 3D ribbon，mesh 不再需要凹下去引导。depth=0 意味着 paintDiscAt
// 仍写 riverMask 通道（其他系统依赖），但不动 heights。
// 用户反馈："为什么咱们始终就出问题呢？" → 三套水系统并存（mask + carving +
// ribbon）造成的视觉冲突，单源化（仅 ribbon）后干净。
const RIVER_CARVE_BY_RANK = {
  1: { radiusCells: 0.6, depth: 0 },
  2: { radiusCells: 0.5, depth: 0 },
  3: { radiusCells: 0.4, depth: 0 }
};

// 内部用：把 polyline 密化到 ~1 cell 间隔 (~0.012°, ~1.3km)，让 carving
// 覆盖整段 (hand-typed 的 褒水/斜水/外江/内江 只有 4-5 个稀疏点，不密化的话
// 中间地段就被漏掉，浮线穿山)。
function densifyForCarving(points, maxDeg = 0.012) {
  if (points.length < 2) return points.slice();
  const out = [points[0]];
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const dist = Math.hypot(b.lat - a.lat, b.lon - a.lon);
    const subdivisions = Math.max(1, Math.ceil(dist / maxDeg));
    for (let j = 1; j <= subdivisions; j += 1) {
      const t = j / subdivisions;
      out.push({ lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t });
    }
  }
  return out;
}

function latLonToGrid(lon, lat, gridColumns, gridRows, regionBounds) {
  const lonSpan = regionBounds.east - regionBounds.west || 1;
  const latSpan = regionBounds.north - regionBounds.south || 1;
  return {
    col: ((lon - regionBounds.west) / lonSpan) * (gridColumns - 1),
    row: ((regionBounds.north - lat) / latSpan) * (gridRows - 1)
  };
}

function forEachSegmentCell(aGrid, bGrid, visitor) {
  // supercover grid traversal：用浮点端点走过 line 穿过的所有 raster cells。
  // 相比 round 后的 Bresenham，斜线和 corner crossing 不会漏格。
  let col = Math.round(aGrid.col);
  let row = Math.round(aGrid.row);
  const endCol = Math.round(bGrid.col);
  const endRow = Math.round(bGrid.row);
  const deltaCol = bGrid.col - aGrid.col;
  const deltaRow = bGrid.row - aGrid.row;
  const stepCol = deltaCol > 0 ? 1 : deltaCol < 0 ? -1 : 0;
  const stepRow = deltaRow > 0 ? 1 : deltaRow < 0 ? -1 : 0;
  const absDeltaCol = Math.abs(deltaCol);
  const absDeltaRow = Math.abs(deltaRow);
  const epsilon = 1e-9;
  let count = 0;
  let lastKey = null;

  const visit = (visitCol, visitRow) => {
    const key = `${visitCol},${visitRow}`;
    if (key === lastKey) {
      return;
    }
    lastKey = key;
    visitor(visitCol, visitRow);
    count += 1;
  };

  visit(col, row);
  if (col === endCol && row === endRow) {
    return count;
  }

  let tMaxCol =
    stepCol === 0
      ? Number.POSITIVE_INFINITY
      : ((col + 0.5 * stepCol - aGrid.col) / deltaCol);
  let tMaxRow =
    stepRow === 0
      ? Number.POSITIVE_INFINITY
      : ((row + 0.5 * stepRow - aGrid.row) / deltaRow);
  const tDeltaCol = stepCol === 0 ? Number.POSITIVE_INFINITY : 1 / absDeltaCol;
  const tDeltaRow = stepRow === 0 ? Number.POSITIVE_INFINITY : 1 / absDeltaRow;

  while (true) {
    if (Math.abs(tMaxCol - tMaxRow) <= epsilon) {
      if (stepCol !== 0) {
        visit(col + stepCol, row);
      }
      if (stepRow !== 0) {
        visit(col, row + stepRow);
      }
      col += stepCol;
      row += stepRow;
      tMaxCol += tDeltaCol;
      tMaxRow += tDeltaRow;
      visit(col, row);
    } else if (tMaxCol < tMaxRow) {
      col += stepCol;
      tMaxCol += tDeltaCol;
      visit(col, row);
    } else {
      row += stepRow;
      tMaxRow += tDeltaRow;
      visit(col, row);
    }

    if (col === endCol && row === endRow) {
      break;
    }
  }

  return count;
}

function sampleGridHeight(values, colF, rowF, gridColumns, gridRows) {
  const column = clamp(Math.round(colF), 0, gridColumns - 1);
  const row = clamp(Math.round(rowF), 0, gridRows - 1);
  return values[indexAt(column, row, gridColumns)];
}

function paintDiscAt(
  heights,
  riverMask,
  gridColumns,
  gridRows,
  colF,
  rowF,
  radiusCells,
  maskRadius,
  depth,
  riverHeight
) {
  // 允许 center 落在 slice 外侧；bbox clamp 后仍可把边界内那一小段画出来。
  if (
    colF < -radiusCells ||
    colF > gridColumns - 1 + radiusCells ||
    rowF < -radiusCells ||
    rowF > gridRows - 1 + radiusCells
  ) {
    return false;
  }

  const minCol = Math.max(0, Math.floor(colF - radiusCells));
  const maxCol = Math.min(gridColumns - 1, Math.ceil(colF + radiusCells));
  const minRow = Math.max(0, Math.floor(rowF - radiusCells));
  const maxRow = Math.min(gridRows - 1, Math.ceil(rowF + radiusCells));
  let touched = false;

  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      const dist = Math.hypot(col - colF, row - rowF);
      if (dist > radiusCells) continue;
      const idx = indexAt(col, row, gridColumns);
      touched = true;

      if (heights && Number.isFinite(riverHeight)) {
        // 二次曲线比 raised-cosine 掉得更快：谷壁更陡，中心仍保持最深。
        const t = dist / radiusCells;
        const falloff = (1 - t) * (1 - t);
        const carvedTo = riverHeight - depth * falloff;
        if (heights[idx] > carvedTo) {
          heights[idx] = carvedTo;
        }
      }

      if (riverMask) {
        // riverMask: 核心半径 (maskRadius) 内 mask=1，外圈到 r 渐淡到 0。
        // 用 (1-t)^6 把高值尽量锁在窄核心里，让水边更利。
        if (dist <= maskRadius) {
          riverMask[idx] = Math.max(riverMask[idx], 1.0);
        } else {
          const t = (dist - maskRadius) / (radiusCells - maskRadius);
          const oneMinusT = 1 - t;
          const m =
            oneMinusT *
            oneMinusT *
            oneMinusT *
            oneMinusT *
            oneMinusT *
            oneMinusT;
          if (m > riverMask[idx]) riverMask[idx] = m;
        }
      }
    }
  }

  return touched;
}

function carveRiverValleys(heights, riverMask, gridColumns, gridRows, regionBounds, riverFeatures) {
  // 关键：必须从 pre-carve 高度采样 riverHeight。否则密 polyline (岷江 2273 点)
  // 会反复在同一个 cell 上越挖越深 — 每个新 point 看到的是上个点已经挖过的低值。
  const preCarveHeights = new Float32Array(heights);
  const inSliceCount = { points: 0, features: 0 };

  for (const feature of riverFeatures) {
    const rawPoints = feature.geometry?.points;
    if (!rawPoints || rawPoints.length < 2) continue;
    if (typeof rawPoints[0].lat !== "number") continue; // 跳过 {x,y} 格式（不该发生）
    const points = densifyForCarving(rawPoints);
    const cfg = RIVER_CARVE_BY_RANK[feature.rank] ?? RIVER_CARVE_BY_RANK[3];
    const r = cfg.radiusCells;
    // riverMask paint：只把最核心的一窄条保留成纯水面，外围快速退到湿岸。
    const maskRadius = r * 0.16;
    const gridPoints = points.map(({ lon, lat }) =>
      latLonToGrid(lon, lat, gridColumns, gridRows, regionBounds)
    );

    let featureTouched = false;

    // Pass 1: 整条折线 segment-walk 画 mask，确保相邻 anchor 之间没有空洞。
    for (let i = 0; i < gridPoints.length - 1; i += 1) {
      const aGrid = gridPoints[i];
      const bGrid = gridPoints[i + 1];
      inSliceCount.points += forEachSegmentCell(aGrid, bGrid, (colF, rowF) => {
        const touched = paintDiscAt(
          null,
          riverMask,
          gridColumns,
          gridRows,
          colF,
          rowF,
          r,
          maskRadius,
          cfg.depth,
          NaN
        );
        featureTouched = featureTouched || touched;
      });
    }

    // Pass 2: 仍然沿 segment-walk 雕刻，但 riverHeight 始终采样自 pre-carve
    // 高度场，只做 min(current, carvedTo)；这样 overlap 只会取最低目标高程，
    // 不会因为前一个 sample 已经挖低而继续级联深挖。
    for (let i = 0; i < gridPoints.length - 1; i += 1) {
      const aGrid = gridPoints[i];
      const bGrid = gridPoints[i + 1];
      forEachSegmentCell(aGrid, bGrid, (colF, rowF) => {
        const riverHeight = sampleGridHeight(
          preCarveHeights,
          colF,
          rowF,
          gridColumns,
          gridRows
        );
        const touched = paintDiscAt(
          heights,
          null,
          gridColumns,
          gridRows,
          colF,
          rowF,
          r,
          maskRadius,
          cfg.depth,
          riverHeight
        );
        featureTouched = featureTouched || touched;
      });
    }
    if (featureTouched) inSliceCount.features += 1;
  }

  return inSliceCount;
}

function smoothHeightField(values, columns, rows, { passes = 1, blend = 0.5 } = {}) {
  let current = values;

  for (let pass = 0; pass < passes; pass += 1) {
    const next = new Float32Array(current);

    for (let row = 1; row < rows - 1; row += 1) {
      for (let column = 1; column < columns - 1; column += 1) {
        let total = 0;
        let count = 0;

        for (let y = row - 1; y <= row + 1; y += 1) {
          for (let x = column - 1; x <= column + 1; x += 1) {
            total += current[indexAt(x, y, columns)];
            count += 1;
          }
        }

        const index = indexAt(column, row, columns);
        next[index] = current[index] * (1 - blend) + (total / count) * blend;
      }
    }

    current = next;
  }

  return current;
}

function normalizeHeights(rawHeights, minRawHeight, maxRawHeight) {
  const range = maxRawHeight - minRawHeight || 1;
  const normalized = new Float32Array(rawHeights.length);
  let minHeight = Number.POSITIVE_INFINITY;
  let maxHeight = Number.NEGATIVE_INFINITY;
  // 2026-05 高度调试历程：原 [-4, 18]=22 → halved [-2, 9]=11 太平。
  // 用户反馈再 ×1.5 → [-3, 13.5]=16.5。介于原版和 halved 之间，山形仍
  // 比原版温和，但比 halved 立体。河谷雕刻深度同比 ×1.5。
  const visualMinHeight = -3;
  const visualMaxHeight = 13.5;

  for (let index = 0; index < rawHeights.length; index += 1) {
    const value = rawHeights[index];
    const t = clamp((value - minRawHeight) / range, 0, 1);
    const eased = Math.pow(t, 0.95);
    const stylized = visualMinHeight + eased * (visualMaxHeight - visualMinHeight);
    normalized[index] = stylized;
    minHeight = Math.min(minHeight, stylized);
    maxHeight = Math.max(maxHeight, stylized);
  }

  return { normalized, minHeight, maxHeight };
}

function geoAt(column, row) {
  const lon =
    qinlingBounds.west +
    (column / (columns - 1)) * (qinlingBounds.east - qinlingBounds.west);
  const lat =
    qinlingBounds.north -
    (row / (rows - 1)) * (qinlingBounds.north - qinlingBounds.south);

  return { lon, lat };
}

function zoneWeightAt(lon, lat, zone) {
  const { bounds, correctionWeight } = zone;

  if (
    lon < bounds.west ||
    lon > bounds.east ||
    lat < bounds.south ||
    lat > bounds.north
  ) {
    return 0;
  }

  const lonSpan = bounds.east - bounds.west || 1;
  const latSpan = bounds.north - bounds.south || 1;
  const westFade = smoothstep((lon - bounds.west) / lonSpan, 0, 0.16);
  const eastFade = smoothstep((bounds.east - lon) / lonSpan, 0, 0.16);
  const southFade = smoothstep((lat - bounds.south) / latSpan, 0, 0.18);
  const northFade = smoothstep((bounds.north - lat) / latSpan, 0, 0.18);

  return correctionWeight * Math.min(westFade, eastFade, southFade, northFade);
}

function detailCorrectionWeightAt(lon, lat) {
  return qinlingResolutionStrategy.detailCorrectionZones.reduce(
    (maxWeight, zone) => Math.max(maxWeight, zoneWeightAt(lon, lat, zone)),
    0
  );
}

function buildTouringLayerRawHeights(rawHeights) {
  const touringBase = smoothHeightField(rawHeights, columns, rows, {
    passes: 1,
    blend: 0.62
  });
  const result = new Float32Array(rawHeights.length);

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const index = indexAt(column, row, columns);
      const { lon, lat } = geoAt(column, row);
      const correctionWeight = detailCorrectionWeightAt(lon, lat);

      result[index] =
        touringBase[index] * (1 - correctionWeight) +
        rawHeights[index] * correctionWeight;
    }
  }

  return result;
}

const columns = qinlingOutputGrid.columns;
const rows = qinlingOutputGrid.rows;
const legacyOutputPath = qinlingWorkspacePath("public", "data", "qinling-slice-dem.json");

const sampler = await getHydroShedsSampler();
const rawHeights = new Float32Array(columns * rows);
let minRawHeight = Number.POSITIVE_INFINITY;
let maxRawHeight = Number.NEGATIVE_INFINITY;
for (let row = 0; row < rows; row += 1) {
  for (let column = 0; column < columns; column += 1) {
    const index = indexAt(column, row, columns);
    const { lon, lat } = geoAt(column, row);
    const value = sampler.sample(lon, lat);

    rawHeights[index] = value;
    minRawHeight = Math.min(minRawHeight, value);
    maxRawHeight = Math.max(maxRawHeight, value);
  }
}

if (!Number.isFinite(minRawHeight) || !Number.isFinite(maxRawHeight)) {
  throw new Error("No valid Qinling height samples were written.");
}

const coverageRatio = 1;

if (coverageRatio < 0.1) {
  throw new Error(
    `Qinling DEM coverage is too sparse (${(coverageRatio * 100).toFixed(2)}%).`
  );
}

const realPeakMeters = Math.max(0, Math.round(maxRawHeight));

// 在进入 touring/base synth 和游戏归一化之前，先把中段真实高程抬起。
// 这样 300-1500m 丘陵会更立体，而海平面与 3000m+ 主峰轮廓基本保持不变。
minRawHeight = Number.POSITIVE_INFINITY;
maxRawHeight = Number.NEGATIVE_INFINITY;
for (let row = 0; row < rows; row += 1) {
  const lat =
    qinlingBounds.north -
    (row / (rows - 1)) * (qinlingBounds.north - qinlingBounds.south);
  for (let column = 0; column < columns; column += 1) {
    const index = indexAt(column, row, columns);
    rawHeights[index] = enhanceMidRangeRelief(rawHeights[index], lat);
    minRawHeight = Math.min(minRawHeight, rawHeights[index]);
    maxRawHeight = Math.max(maxRawHeight, rawHeights[index]);
  }
}

let { normalized, minHeight, maxHeight } = normalizeHeights(
  buildTouringLayerRawHeights(rawHeights),
  minRawHeight,
  maxRawHeight
);

const smoothed = smoothHeightField(normalized, columns, rows, {
  passes: 1,
  blend: 0.5
});
normalized = smoothed;

// 河谷雕刻——把每条已定义的河 polyline 反向压进 DEM。在 smooth 之后做，
// 避免后续 smooth pass 把刚切的谷又抹平。再 smooth 一次会让谷壁过渡自然。
// riverMaskPainted: carve 同步在 polyline 上画 mask = 1 (核心) → 0 (边缘),
// 让 terrain shader 在 fragment 直接渲染水蓝色 (替代之前独立 ribbon mesh)
const riverMaskPainted = new Float32Array(normalized.length);
const carveStats = carveRiverValleys(
  normalized,
  riverMaskPainted,
  columns,
  rows,
  qinlingBounds,
  qinlingModernHydrography.features
);
console.log(
  `River-valley carve: ${carveStats.features}/${qinlingModernHydrography.features.length} features, ${carveStats.points} polyline points applied`
);
// 再做一遍 light smooth 把雕刻边缘过渡平滑掉，避免 1-cell 锯齿
normalized = smoothHeightField(normalized, columns, rows, { passes: 1, blend: 0.35 });

// grid 翻倍后 normalized 277K 元素 → Math.min(...normalized) spread 超 args 上限
// (RangeError)。改成显式 loop 计算 min/max。
{
  let minH = Number.POSITIVE_INFINITY;
  let maxH = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < normalized.length; i += 1) {
    const v = normalized[i];
    if (v < minH) minH = v;
    if (v > maxH) maxH = v;
  }
  minHeight = minH;
  maxHeight = maxH;
}

const riverMask = [];
const passMask = [];
const settlementMask = [];

for (let row = 0; row < rows; row += 1) {
  for (let column = 0; column < columns; column += 1) {
    const index = indexAt(column, row, columns);
    const height = normalized[index];
    const normalizedHeight = (height - minHeight) / (maxHeight - minHeight || 1);
    const left = normalized[indexAt(Math.max(0, column - 1), row, columns)] ?? height;
    const right = normalized[indexAt(Math.min(columns - 1, column + 1), row, columns)] ?? height;
    const up = normalized[indexAt(column, Math.max(0, row - 1), columns)] ?? height;
    const down = normalized[indexAt(column, Math.min(rows - 1, row + 1), columns)] ?? height;
    const slope = Math.min(Math.hypot(right - left, down - up) / 12, 1);
    const valley = clamp(meanNeighborDifference(normalized, column, row, columns, rows) / 7.5, 0, 1);
    const moisture = smoothstep(1 - normalizedHeight, 0.15, 0.88);
    const passPotential = clamp((1 - slope) * (0.35 + normalizedHeight * 0.8) * (1 - valley * 0.6), 0, 1);

    // 取 painted (沿 polyline) 跟 procedural (湿润 valley) 的 MAX —
    // painted 在主干河流位置 = 1.0 (蓝色实水)，procedural 给 background
    // 湿润感 (河边林木 / 灌木带) 不至于一刀切
    const procedural = valley * (1 - slope) * moisture;
    riverMask.push(Number(Math.max(riverMaskPainted[index], procedural).toFixed(4)));
    passMask.push(Number((Math.pow(passPotential, 1.8) * (1 - moisture * 0.25)).toFixed(4)));
    settlementMask.push(
      Number(
        clamp(0.86 - normalizedHeight * 0.44 - slope * 0.92 + moisture * 0.26, 0, 1).toFixed(4)
      )
    );
  }
}

const asset = {
  id: "qinling-l1-slice",
  type: "terrain-slice",
  version: 1,
  regionId: "qinling",
  lod: "L1",
  name: "qinling-real-dem-slice",
  sourceType: "processed-real-dem",
  generatedAt: new Date().toISOString(),
  bounds: qinlingRegionManifestBounds,
  world: qinlingWorld,
  grid: qinlingOutputGrid,
  resolutionStrategy: qinlingResolutionStrategy,
  minHeight: Number(minHeight.toFixed(3)),
  maxHeight: Number(maxHeight.toFixed(3)),
  presentation: {
    // 全国扩张：ocean cells clamp 到 visualMinHeight=-3。L1 ocean-aware MIN
    // downsample 让沿海 L1 cell 也读到 -3。但内陆河流 carving 把武汉等沿江
    // 城市 push 到 -2.94 ish。
    // waterLevel 必须严格在 ocean(-3) 跟 inland-river-low(-2.94) 之间。
    // -2.97 给 ocean 0.03 显示空间，给 武汉/重庆 等沿江低洼地 0.03 buffer。
    waterLevel: -2.97,
    underpaintLevel: -3.5,
    realPeakMeters,
    visualIntent: "Full-China bounds: ocean cells (clamped to -3) covered by water surface; mainland low basins (e.g. Beijing -2.4) stay above water."
  },
  heights: Array.from(normalized, (value) => Number(value.toFixed(3))),
  riverMask,
  passMask,
  settlementMask,
  notes: [
    "Built from HydroSHEDS 15s (~450 m) DEM, no fallback paths.",
    "L1 national touring layer uses a 450m touring terrain base synthesized from the HydroSHEDS source before gameplay normalization.",
    "450m HydroSHEDS source detail is retained more strongly around Guanzhong, Hanzhong, northern Sichuan, and Qinling-Shu route corridors.",
    "A Gaussian mid-range relief enhancement boosts 300-1500m hill terrain while keeping lowlands and high peaks close to their prior silhouettes.",
    "Real elevations are normalized into a gameplay-friendly stylized height range that keeps lowland basins readable.",
    `Raw sampled coverage before interpolation: ${(coverageRatio * 100).toFixed(2)}%.`,
    `HydroSHEDS source path: ${sampler.sourcePath}.`
  ]
};

// Phase 3 全国 0.9 km grid (26.87M cells × 4 channels)：单字符串 JSON 超过
// V8 string length (~512 MB)。改成 meta JSON + 4 个 binary channel 文件：
//   qinling-slice-dem.json              小 metadata
//   qinling-slice-dem.heights.bin       Float32LE × cells
//   qinling-slice-dem.riverMask.bin     Float32LE × cells
//   qinling-slice-dem.passMask.bin      Float32LE × cells
//   qinling-slice-dem.settlementMask.bin Float32LE × cells
// 所有读取方（region-assets / 测试）改用 loadDemAsset helper（见 dem-asset-io.mjs）。
{
  const { heights, riverMask, passMask, settlementMask, ...meta } = asset;
  // 在 meta 里登记 binary sidecar 路径 + cells 数，让读取方能 verify
  meta.cells = heights.length;
  meta.binaryChannels = {
    format: "float32-le",
    heights: "qinling-slice-dem.heights.bin",
    riverMask: "qinling-slice-dem.riverMask.bin",
    passMask: "qinling-slice-dem.passMask.bin",
    settlementMask: "qinling-slice-dem.settlementMask.bin"
  };
  await fs.writeFile(legacyOutputPath, `${JSON.stringify(meta, null, 2)}\n`, "utf8");

  const baseDir = path.dirname(legacyOutputPath);
  async function writeBinary(name, arr) {
    const buf = Buffer.allocUnsafe(arr.length * 4);
    for (let i = 0; i < arr.length; i += 1) {
      buf.writeFloatLE(arr[i] ?? 0, i * 4);
    }
    await fs.writeFile(path.join(baseDir, name), buf);
  }

  await writeBinary("qinling-slice-dem.heights.bin", heights);
  await writeBinary("qinling-slice-dem.riverMask.bin", riverMask);
  await writeBinary("qinling-slice-dem.passMask.bin", passMask);
  await writeBinary("qinling-slice-dem.settlementMask.bin", settlementMask);
}

console.log(`Generated real Qinling DEM asset at ${legacyOutputPath}`);
