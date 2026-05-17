// terrain/minimap.ts —
//
// 三模式 minimap (collapsed 收起 / compact 角落 / fullscreen 全屏):
//   - collapsed: 隐藏地图, 只留文字按钮
//   - compact: 屏幕一角缩略图, fit-to-canvas 整中国, pointer-events 透传
//   - fullscreen (M 键切): 占大半屏, 鼠标滚轮 zoom, 拖拽 pan, 显示完整 POI label
// 跟 3D 主画面 + debugOverlay 共用 POI_REGISTRY (SSOT — Tang docs frontmatter 派生).

import {
  projectGeoToWorld,
  unprojectWorldToGeo
} from "../mapOrientation.js";
import {
  qinlingRegionBounds,
  qinlingRegionWorld
} from "../../data/qinlingRegion.js";
import {
  POI_REGISTRY,
  type PoiEntry,
  type PoiCategory
} from "../../data/poiRegistry.generated.js";

export interface MinimapOptions {
  /** compact mode 占位大小 */
  width?: number;
  height?: number;
  corner?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  margin?: number;
  /** 全屏切换键, 默认 'm' */
  fullscreenKey?: string;
}

export interface MinimapHandle {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  update(cameraWorldX: number, cameraWorldZ: number, cameraYaw: number, timeOfDay?: number): void;
  setMode(mode: MinimapMode): void;
  dispose(): void;
}

export type MinimapMode = "collapsed" | "compact" | "fullscreen";
export type MinimapTerrainKind = "ocean" | "lowland" | "hill" | "mountain" | "plateau";

type MinimapPoiVisibilityInput = Pick<PoiEntry, "id" | "hierarchy">;

interface MinimapDemAsset {
  bounds: {
    west: number;
    east: number;
    south: number;
    north: number;
  };
  grid: {
    columns: number;
    rows: number;
  };
  heights: number[];
  riverMask?: number[];
}

export interface MinimapTerrainColorSample {
  height: number;
  river: number;
  shade: number;
  fallbackKind: MinimapTerrainKind;
}

export interface MinimapRgb {
  r: number;
  g: number;
  b: number;
}

export interface MinimapNightOverlay {
  color: string;
  alpha: number;
}

const COMPACT_CITY_IDS = new Set(["changan", "taiyuan", "yangzhou", "yizhou"]);

export function minimapPoiVisibleInMode(
  poi: MinimapPoiVisibilityInput,
  mode: MinimapMode,
  zoomFactor: number
): boolean {
  if (mode === "collapsed") return false;
  if (mode === "compact") {
    return COMPACT_CITY_IDS.has(poi.id);
  }

  return (
    poi.hierarchy === "gravity" ||
    poi.hierarchy === "large" ||
    (poi.hierarchy === "medium" && zoomFactor > 1.5) ||
    (poi.hierarchy === "small" && zoomFactor > 3.0)
  );
}

function approximateEastCoastLongitude(lat: number): number {
  if (lat >= 40.8) return 121.0 + (lat - 40.8) * 0.55;
  if (lat >= 37.2) return 119.1 + (lat - 37.2) * 0.48;
  if (lat >= 31.0) return 121.2 - (lat - 31.0) * 0.07;
  if (lat >= 27.0) return 119.0 + (lat - 27.0) * 0.18;
  if (lat >= 23.0) return 116.2 + (lat - 23.0) * 0.7;
  return 109.0 + (lat - 18.0) * 1.25;
}

export function abstractMinimapTerrainKindForGeo(
  lat: number,
  lon: number
): MinimapTerrainKind {
  const inBohaiBay = lat >= 37.0 && lat <= 41.2 && lon >= 117.4 && lon <= 122.5;
  const inYellowSea = lat >= 31.0 && lat <= 38.6 && lon >= 120.2 && lon <= 126.0;
  const inBeibuGulf = lat >= 18.0 && lat <= 22.3 && lon >= 106.2 && lon <= 110.2;
  const inBayOfBengal = lat >= 18.0 && lat <= 23.5 && lon >= 88.0 && lon <= 94.5;
  if (inBohaiBay || inYellowSea || inBeibuGulf || inBayOfBengal) {
    return "ocean";
  }

  const coastLon = approximateEastCoastLongitude(lat);
  if ((lon > coastLon && lat < 42.8) || (lat < 21.8 && lon > 108.2)) {
    return "ocean";
  }
  if (lon >= 78 && lon <= 103 && lat >= 27.0 && lat <= 38.6) {
    return "plateau";
  }
  if (
    (lon >= 73 && lon <= 96 && lat >= 39.0 && lat <= 49.5) ||
    (lon >= 96 && lon <= 106 && lat >= 25.0 && lat <= 33.5) ||
    (lon >= 102 && lon <= 112.5 && lat >= 31.0 && lat <= 35.3)
  ) {
    return "mountain";
  }
  if (
    (lon >= 111 && lon <= 116.8 && lat >= 35.0 && lat <= 41.5) ||
    (lon >= 106.5 && lon <= 117.5 && lat >= 24.0 && lat <= 28.5) ||
    (lon >= 116 && lon <= 120.5 && lat >= 24.0 && lat <= 29.5) ||
    (lon >= 101 && lon <= 108 && lat >= 38.0 && lat <= 42.5)
  ) {
    return "hill";
  }
  return "lowland";
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(value: number, min: number, max: number): number {
  if (min === max) return value < min ? 0 : 1;
  const t = clamp01((value - min) / (max - min));
  return t * t * (3 - 2 * t);
}

export function minimapNightOverlayForTime(timeOfDay: number): MinimapNightOverlay {
  const normalized = ((timeOfDay % 24) + 24) % 24;
  const evening = smoothstep(normalized, 17.6, 20.2);
  const dawnClear = smoothstep(normalized, 5.2, 7.2);
  const night = normalized >= 12 ? evening : 1 - dawnClear;
  return {
    color: "#0b2235",
    alpha: Math.round(clamp01(night) * 0.42 * 1000) / 1000
  };
}

function mixRgb(a: MinimapRgb, b: MinimapRgb, t: number): MinimapRgb {
  return {
    r: Math.round(lerp(a.r, b.r, t)),
    g: Math.round(lerp(a.g, b.g, t)),
    b: Math.round(lerp(a.b, b.b, t))
  };
}

function shadeRgb(color: MinimapRgb, shade: number): MinimapRgb {
  const s = lerp(0.72, 1.22, clamp01(shade));
  return {
    r: Math.round(Math.max(0, Math.min(255, color.r * s))),
    g: Math.round(Math.max(0, Math.min(255, color.g * s))),
    b: Math.round(Math.max(0, Math.min(255, color.b * s)))
  };
}

export function minimapTerrainColorForSample(
  sample: MinimapTerrainColorSample
): MinimapRgb {
  if (sample.fallbackKind === "ocean" && sample.height <= 2) {
    return shadeRgb({ r: 44, g: 91, b: 111 }, sample.shade);
  }

  const height = Math.max(0, sample.height);
  let base: MinimapRgb;
  if (height > 2600) {
    base = mixRgb({ r: 133, g: 120, b: 83 }, { r: 188, g: 176, b: 126 }, clamp01((height - 2600) / 2600));
  } else if (height > 1200) {
    base = mixRgb({ r: 108, g: 123, b: 76 }, { r: 143, g: 128, b: 87 }, clamp01((height - 1200) / 1400));
  } else if (height > 420) {
    base = mixRgb({ r: 123, g: 145, b: 86 }, { r: 101, g: 121, b: 75 }, clamp01((height - 420) / 780));
  } else {
    base = mixRgb({ r: 127, g: 151, b: 88 }, { r: 161, g: 159, b: 98 }, clamp01(height / 420));
  }

  const shaded = shadeRgb(base, sample.shade);
  const river = clamp01(sample.river);
  return river > 0.18
    ? mixRgb(shaded, { r: 70, g: 128, b: 149 }, Math.min(0.72, river * 0.72))
    : shaded;
}

// 调色板 — BotW 灵感: 暖纸张色 + 浅墨笔触
const PALETTE = {
  bgCompact: "rgba(18, 22, 28, 0.85)",
  bgFullscreen: "rgba(40, 30, 22, 0.96)", // 暖纸色
  paper: "rgba(220, 200, 165, 0.18)", // 微透 parchment 底
  border: "rgba(216, 200, 175, 0.55)",
  borderHi: "rgba(255, 230, 180, 0.85)",
  text: "rgba(230, 215, 180, 0.95)",
  textDim: "rgba(180, 170, 140, 0.75)",
  player: "#ffe7a8",
  playerStroke: "rgba(0, 0, 0, 0.6)",
  graticule: "rgba(216, 200, 175, 0.2)",
  ocean: "rgba(48, 96, 114, 0.78)",
  oceanInk: "rgba(108, 157, 166, 0.32)",
  lowland: "rgba(150, 151, 96, 0.78)",
  hill: "rgba(129, 136, 82, 0.84)",
  mountain: "rgba(92, 103, 74, 0.92)",
  plateau: "rgba(142, 122, 84, 0.86)",
  coast: "rgba(231, 207, 139, 0.5)",
  ink: "rgba(34, 48, 38, 0.28)"
};

// POI 视觉分类: 形状 + 颜色 + size 跟 hierarchy 联动
const CATEGORY_STYLE: Record<PoiCategory, { color: string; shape: "circle" | "square" | "triangle" | "diamond" }> = {
  city: { color: "#ffd28a", shape: "circle" },
  relic: { color: "#ffa674", shape: "square" },
  scenic: { color: "#9ad29b", shape: "triangle" },
  transport: { color: "#9ccdd8", shape: "diamond" }
};

const CATEGORY_LABEL: Record<PoiCategory, string> = {
  city: "城邑",
  relic: "古迹",
  scenic: "山川",
  transport: "交通"
};

const POI_CATEGORIES: readonly PoiCategory[] = ["city", "relic", "scenic", "transport"];

interface MinimapPoiKindItem {
  id: string;
  name: string;
  order: number;
}

interface MinimapPoiKindGroup {
  category: PoiCategory;
  kinds: MinimapPoiKindItem[];
}

function escapeSidebarHtml(value: string | number | undefined | null): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function minimapPoiKindGroups(): MinimapPoiKindGroup[] {
  return POI_CATEGORIES.map((category) => {
    const kinds = [...new Map(
      POI_REGISTRY
        .filter((poi) => poi.category === category)
        .map((poi) => [poi.kind, {
          id: poi.kind,
          name: poi.kindName,
          order: poi.kindOrder
        }])
    ).values()].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "zh-Hans-CN"));
    return { category, kinds };
  }).filter((group) => group.kinds.length > 0);
}

const HIERARCHY_RADIUS: Record<string, number> = {
  gravity: 5,
  large: 4,
  medium: 3,
  small: 2
};

function poiLabel(poi: PoiEntry): string {
  return poi.name || poi.id;
}

interface MinimapState {
  mode: MinimapMode;
  /** view center in world coords */
  centerX: number;
  centerZ: number;
  /** canvas pixels per world unit; higher = more zoomed in */
  pixelsPerUnit: number;
  /** drag state */
  dragging: boolean;
  dragLastX: number;
  dragLastY: number;
}

export function createMinimap(opts: MinimapOptions = {}): MinimapHandle {
  const compactW = opts.width ?? 240;
  const compactH = opts.height ?? 165;
  const margin = opts.margin ?? 12;
  const corner = opts.corner ?? "top-right";
  const fullscreenKey = (opts.fullscreenKey ?? "m").toLowerCase();

  const canvas = document.createElement("canvas");
  const ctxMaybe = canvas.getContext("2d");
  if (!ctxMaybe) throw new Error("minimap: 2d context unavailable");
  const ctx = ctxMaybe;
  const sidebar = document.createElement("aside");
  const openButton = document.createElement("button");
  document.body.appendChild(canvas);
  document.body.append(sidebar, openButton);

  // World bounds covered by map
  const nw = projectGeoToWorld(
    { lat: qinlingRegionBounds.north, lon: qinlingRegionBounds.west },
    qinlingRegionBounds,
    qinlingRegionWorld
  );
  const se = projectGeoToWorld(
    { lat: qinlingRegionBounds.south, lon: qinlingRegionBounds.east },
    qinlingRegionBounds,
    qinlingRegionWorld
  );
  const worldWidthAll = Math.abs(se.x - nw.x);
  const worldDepthAll = Math.abs(se.z - nw.z);
  const worldCenterX = (nw.x + se.x) / 2;
  const worldCenterZ = (nw.z + se.z) / 2;

  function computeFitScale(canvasW: number, canvasH: number): number {
    return Math.min(canvasW / worldWidthAll, canvasH / worldDepthAll);
  }

  const state: MinimapState = {
    mode: "compact",
    centerX: worldCenterX,
    centerZ: worldCenterZ,
    pixelsPerUnit: computeFitScale(compactW, compactH),
    dragging: false,
    dragLastX: 0,
    dragLastY: 0
  };

  // Latest camera state (for re-draw on state changes)
  let lastCamX = 0;
  let lastCamZ = 0;
  let lastCamYaw = 0;
  let lastTimeOfDay = 12;
  let terrainAtlasCanvas: HTMLCanvasElement | null = null;
  const poiKindGroups = minimapPoiKindGroups();
  const activePoiKinds = new Set<string>(
    poiKindGroups.flatMap((group) => group.kinds.map((kind) => kind.id))
  );

  function positionCollapsedButton(): void {
    openButton.style.top = openButton.style.left = openButton.style.right = openButton.style.bottom = "auto";
    switch (corner) {
      case "top-right":
        openButton.style.top = `${margin}px`;
        openButton.style.right = `${margin}px`;
        break;
      case "top-left":
        openButton.style.top = `${margin}px`;
        openButton.style.left = `${margin}px`;
        break;
      case "bottom-right":
        openButton.style.bottom = `${margin}px`;
        openButton.style.right = `${margin}px`;
        break;
      case "bottom-left":
        openButton.style.bottom = `${margin}px`;
        openButton.style.left = `${margin}px`;
        break;
    }
  }

  function applySidebarCSS(fullscreenBounds: { left: number; top: number; width: number; height: number } | null): void {
    sidebar.style.position = "fixed";
    sidebar.style.zIndex = "24";
    sidebar.style.boxSizing = "border-box";
    sidebar.style.padding = "14px 12px";
    sidebar.style.border = `1px solid ${PALETTE.borderHi}`;
    sidebar.style.borderRadius = "8px";
    sidebar.style.background = "rgba(31, 23, 16, 0.94)";
    sidebar.style.boxShadow = "0 10px 40px rgba(0,0,0,0.45)";
    sidebar.style.color = PALETTE.text;
    sidebar.style.font = "12px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    sidebar.style.pointerEvents = "auto";
    sidebar.style.display = state.mode === "fullscreen" && fullscreenBounds ? "grid" : "none";
    sidebar.style.gap = "8px";
    sidebar.style.alignContent = "start";
    sidebar.style.overflow = "auto";
    sidebar.style.scrollbarWidth = "thin";
    if (!fullscreenBounds) return;
    const width = 136;
    sidebar.style.width = `${width}px`;
    sidebar.style.height = `${fullscreenBounds.height}px`;
    sidebar.style.left = `${Math.max(margin, fullscreenBounds.left - width - 10)}px`;
    sidebar.style.top = `${fullscreenBounds.top}px`;
  }

  function renderSidebar(): void {
    sidebar.innerHTML = `
      <div style="font-weight: 700; color: #f7d99a; margin-bottom: 2px;">类型</div>
      ${poiKindGroups.map((group) => `
        <section style="display: grid; gap: 5px; padding-top: 3px;">
          <div style="display: flex; align-items: center; gap: 6px; color: rgba(247, 217, 154, 0.82); font-size: 11px; font-weight: 700;">
            <span style="width: 7px; height: 7px; border-radius: 999px; background: ${CATEGORY_STYLE[group.category].color};"></span>
            <span>${CATEGORY_LABEL[group.category]}</span>
          </div>
          ${group.kinds.map((kind) => `
            <label style="display: flex; align-items: center; gap: 7px; cursor: pointer; line-height: 1.35; padding-left: 2px;">
              <input type="checkbox" data-poi-kind="${escapeSidebarHtml(kind.id)}" ${activePoiKinds.has(kind.id) ? "checked" : ""} style="accent-color: ${CATEGORY_STYLE[group.category].color};">
              <span>${escapeSidebarHtml(kind.name)}</span>
            </label>
          `).join("")}
        </section>
      `).join("")}
    `;
  }

  function applyCSS(): void {
    canvas.style.position = "fixed";
    canvas.style.zIndex = "23";
    canvas.style.borderRadius = state.mode === "compact" ? "4px" : "8px";
    canvas.style.border = `1px solid ${state.mode === "compact" ? PALETTE.border : PALETTE.borderHi}`;
    canvas.style.background = state.mode === "compact" ? PALETTE.bgCompact : PALETTE.bgFullscreen;
    canvas.style.boxShadow = state.mode === "fullscreen" ? "0 10px 40px rgba(0,0,0,0.6)" : "none";
    canvas.style.cursor = state.mode === "fullscreen" ? (state.dragging ? "grabbing" : "grab") : "default";

    openButton.type = "button";
    openButton.textContent = "地图";
    openButton.style.position = "fixed";
    openButton.style.zIndex = "24";
    openButton.style.padding = "7px 11px";
    openButton.style.color = "#f7d99a";
    openButton.style.background = "rgba(31, 23, 16, 0.84)";
    openButton.style.border = `1px solid ${PALETTE.border}`;
    openButton.style.borderRadius = "4px";
    openButton.style.cursor = "pointer";
    openButton.style.font = "12px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    openButton.style.display = state.mode === "collapsed" ? "block" : "none";
    positionCollapsedButton();

    if (state.mode === "collapsed") {
      canvas.style.display = "none";
      canvas.style.pointerEvents = "none";
      applySidebarCSS(null);
      return;
    }

    canvas.style.display = "block";
    if (state.mode === "compact") {
      canvas.style.width = `${compactW}px`;
      canvas.style.height = `${compactH}px`;
      canvas.style.pointerEvents = "none";
      canvas.style.top = canvas.style.left = canvas.style.right = canvas.style.bottom = "auto";
      switch (corner) {
        case "top-right":
          canvas.style.top = `${margin}px`;
          canvas.style.right = `${margin}px`;
          break;
        case "top-left":
          canvas.style.top = `${margin}px`;
          canvas.style.left = `${margin}px`;
          break;
        case "bottom-right":
          canvas.style.bottom = `${margin}px`;
          canvas.style.right = `${margin}px`;
          break;
        case "bottom-left":
          canvas.style.bottom = `${margin}px`;
          canvas.style.left = `${margin}px`;
          break;
      }
      applySidebarCSS(null);
    } else {
      // Fullscreen: 占 viewport 大半中央
      const sidebarBudget = 156;
      const vw = Math.round(Math.min(window.innerWidth * 0.86, window.innerWidth - sidebarBudget - margin * 3));
      const vh = Math.round(window.innerHeight * 0.9);
      const left = Math.round((window.innerWidth - vw + sidebarBudget) / 2);
      const top = Math.round((window.innerHeight - vh) / 2);
      canvas.style.width = `${vw}px`;
      canvas.style.height = `${vh}px`;
      canvas.style.left = `${left}px`;
      canvas.style.top = `${top}px`;
      canvas.style.right = canvas.style.bottom = "auto";
      canvas.style.pointerEvents = "auto";
      applySidebarCSS({ left, top, width: vw, height: vh });
    }
  }

  function resizeBackingStore(): void {
    const cssW = parseInt(canvas.style.width, 10) || compactW;
    const cssH = parseInt(canvas.style.height, 10) || compactH;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
  }

  function getCanvasSize(): { w: number; h: number } {
    return {
      w: parseInt(canvas.style.width, 10) || compactW,
      h: parseInt(canvas.style.height, 10) || compactH
    };
  }

  function worldToCanvas(wx: number, wz: number): { x: number; y: number } {
    const { w, h } = getCanvasSize();
    return {
      x: (wx - state.centerX) * state.pixelsPerUnit + w / 2,
      y: (wz - state.centerZ) * state.pixelsPerUnit + h / 2
    };
  }

  function canvasToWorld(cx: number, cy: number): { x: number; z: number } {
    const { w, h } = getCanvasSize();
    return {
      x: (cx - w / 2) / state.pixelsPerUnit + state.centerX,
      z: (cy - h / 2) / state.pixelsPerUnit + state.centerZ
    };
  }

  function canvasToGeo(cx: number, cy: number): { lat: number; lon: number } {
    const wp = canvasToWorld(cx, cy);
    return unprojectWorldToGeo(
      { x: wp.x, z: wp.z },
      qinlingRegionBounds,
      qinlingRegionWorld
    );
  }

  function terrainFill(kind: MinimapTerrainKind): string {
    switch (kind) {
      case "ocean":
        return PALETTE.ocean;
      case "plateau":
        return PALETTE.plateau;
      case "mountain":
        return PALETTE.mountain;
      case "hill":
        return PALETTE.hill;
      case "lowland":
      default:
        return PALETTE.lowland;
    }
  }

  function sampleDemHeight(asset: MinimapDemAsset, col: number, row: number): number {
    const x = Math.max(0, Math.min(asset.grid.columns - 1, col));
    const y = Math.max(0, Math.min(asset.grid.rows - 1, row));
    return asset.heights[y * asset.grid.columns + x] ?? 0;
  }

  function geoForDemCell(asset: MinimapDemAsset, col: number, row: number): { lat: number; lon: number } {
    const u = asset.grid.columns <= 1 ? 0 : col / (asset.grid.columns - 1);
    const v = asset.grid.rows <= 1 ? 0 : row / (asset.grid.rows - 1);
    return {
      lon: lerp(asset.bounds.west, asset.bounds.east, u),
      lat: lerp(asset.bounds.north, asset.bounds.south, v)
    };
  }

  function buildMinimapTerrainAtlas(asset: MinimapDemAsset): HTMLCanvasElement {
    const atlas = document.createElement("canvas");
    atlas.width = asset.grid.columns;
    atlas.height = asset.grid.rows;
    const atlasCtx = atlas.getContext("2d");
    if (!atlasCtx) throw new Error("minimap: terrain atlas context unavailable");
    const image = atlasCtx.createImageData(asset.grid.columns, asset.grid.rows);
    const data = image.data;

    for (let row = 0; row < asset.grid.rows; row += 1) {
      for (let col = 0; col < asset.grid.columns; col += 1) {
        const height = sampleDemHeight(asset, col, row);
        const west = sampleDemHeight(asset, col - 1, row);
        const east = sampleDemHeight(asset, col + 1, row);
        const north = sampleDemHeight(asset, col, row - 1);
        const south = sampleDemHeight(asset, col, row + 1);
        const slopeLight = ((west - east) * 0.0016 + (south - north) * 0.0011);
        const shade = clamp01(0.54 + slopeLight);
        const geo = geoForDemCell(asset, col, row);
        const fallbackKind = abstractMinimapTerrainKindForGeo(geo.lat, geo.lon);
        const river = asset.riverMask?.[row * asset.grid.columns + col] ?? 0;
        const color = minimapTerrainColorForSample({ height, river, shade, fallbackKind });
        const index = (row * asset.grid.columns + col) * 4;
        data[index] = color.r;
        data[index + 1] = color.g;
        data[index + 2] = color.b;
        data[index + 3] = 255;
      }
    }

    atlasCtx.putImageData(image, 0, 0);
    return atlas;
  }

  async function loadMinimapTerrainAtlas(): Promise<void> {
    const response = await fetch("/data/china-lowres-dem.json");
    if (!response.ok) throw new Error(`minimap DEM fetch failed: HTTP ${response.status}`);
    const asset = (await response.json()) as MinimapDemAsset;
    terrainAtlasCanvas = buildMinimapTerrainAtlas(asset);
    update(lastCamX, lastCamZ, lastCamYaw, lastTimeOfDay);
  }

  function drawTerrainAtlas(): boolean {
    if (!terrainAtlasCanvas) return false;
    const nw = projectGeoToWorld(
      { lat: qinlingRegionBounds.north, lon: qinlingRegionBounds.west },
      qinlingRegionBounds,
      qinlingRegionWorld
    );
    const se = projectGeoToWorld(
      { lat: qinlingRegionBounds.south, lon: qinlingRegionBounds.east },
      qinlingRegionBounds,
      qinlingRegionWorld
    );
    const topLeft = worldToCanvas(nw.x, nw.z);
    const bottomRight = worldToCanvas(se.x, se.z);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(
      terrainAtlasCanvas,
      topLeft.x,
      topLeft.y,
      bottomRight.x - topLeft.x,
      bottomRight.y - topLeft.y
    );
    return true;
  }

  function drawTerrainBaseMap(): void {
    if (!drawTerrainAtlas()) {
      drawAbstractTerrainMap();
    }
  }

  function drawNightOverlay(timeOfDay: number): void {
    const overlay = minimapNightOverlayForTime(timeOfDay);
    if (overlay.alpha <= 0) return;
    const { w, h } = getCanvasSize();
    ctx.save();
    ctx.globalAlpha = overlay.alpha;
    ctx.fillStyle = overlay.color;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  function drawAbstractTerrainMap(): void {
    const { w, h } = getCanvasSize();
    const cell = state.mode === "fullscreen" ? 7 : 4;
    for (let y = 0; y < h; y += cell) {
      for (let x = 0; x < w; x += cell) {
        const geo = canvasToGeo(x + cell * 0.5, y + cell * 0.5);
        const kind = abstractMinimapTerrainKindForGeo(geo.lat, geo.lon);
        ctx.fillStyle = terrainFill(kind);
        ctx.fillRect(x, y, cell + 0.5, cell + 0.5);
      }
    }

    drawMountainBrushes();
  }

  function drawMountainBrushes(): void {
    const ranges = [
      { points: [[78, 43], [84, 43.5], [91, 42.3], [97, 40.8]], width: 3.2 },
      { points: [[91, 31.5], [96, 32.4], [101, 31.2]], width: 5.0 },
      { points: [[102, 34], [106, 34.2], [110.5, 33.5], [113, 32.6]], width: 3.6 },
      { points: [[111.5, 40.5], [113.2, 38.2], [114.5, 35.8]], width: 2.6 },
      { points: [[107, 26.4], [111, 25.4], [115.5, 25.8], [118.8, 27.2]], width: 2.4 }
    ] as const;

    ctx.save();
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ranges.forEach((range) => {
      ctx.lineWidth = range.width * (state.mode === "fullscreen" ? 1.35 : 0.8);
      ctx.beginPath();
      range.points.forEach(([lon, lat], index) => {
        const wp = projectGeoToWorld({ lat, lon }, qinlingRegionBounds, qinlingRegionWorld);
        const c = worldToCanvas(wp.x, wp.z);
        if (index === 0) ctx.moveTo(c.x, c.y);
        else ctx.lineTo(c.x, c.y);
      });
      ctx.stroke();
    });
    ctx.restore();
  }

  function drawPoiMarker(c: { x: number; y: number }, poi: PoiEntry, radius: number): void {
    const style = CATEGORY_STYLE[poi.category];
    ctx.fillStyle = style.color;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    switch (style.shape) {
      case "circle":
        ctx.arc(c.x, c.y, radius, 0, Math.PI * 2);
        break;
      case "square":
        ctx.rect(c.x - radius, c.y - radius, radius * 2, radius * 2);
        break;
      case "triangle":
        ctx.moveTo(c.x, c.y - radius);
        ctx.lineTo(c.x + radius, c.y + radius);
        ctx.lineTo(c.x - radius, c.y + radius);
        ctx.closePath();
        break;
      case "diamond":
        ctx.moveTo(c.x, c.y - radius);
        ctx.lineTo(c.x + radius, c.y);
        ctx.lineTo(c.x, c.y + radius);
        ctx.lineTo(c.x - radius, c.y);
        ctx.closePath();
        break;
    }
    ctx.fill();
    ctx.stroke();
  }

  function drawGraticule(): void {
    // 经纬度网格 — fullscreen mode 显示, compact 隐藏 (太挤)
    if (state.mode !== "fullscreen") return;
    const { w, h } = getCanvasSize();
    ctx.strokeStyle = PALETTE.graticule;
    ctx.lineWidth = 0.5;
    ctx.font = "10px -apple-system, sans-serif";
    ctx.fillStyle = PALETTE.textDim;
    const step = 5; // 每 5° 一条
    // 经线
    for (let lon = Math.ceil(qinlingRegionBounds.west / step) * step; lon <= qinlingRegionBounds.east; lon += step) {
      const top = projectGeoToWorld({ lat: qinlingRegionBounds.north, lon }, qinlingRegionBounds, qinlingRegionWorld);
      const bot = projectGeoToWorld({ lat: qinlingRegionBounds.south, lon }, qinlingRegionBounds, qinlingRegionWorld);
      const c1 = worldToCanvas(top.x, top.z);
      const c2 = worldToCanvas(bot.x, bot.z);
      ctx.beginPath();
      ctx.moveTo(c1.x, c1.y);
      ctx.lineTo(c2.x, c2.y);
      ctx.stroke();
      if (c1.y > 0 && c1.y < h && c1.x > 0 && c1.x < w) {
        ctx.fillText(`${lon}°E`, c1.x + 2, 12);
      }
    }
    // 纬线
    for (let lat = Math.ceil(qinlingRegionBounds.south / step) * step; lat <= qinlingRegionBounds.north; lat += step) {
      const lft = projectGeoToWorld({ lat, lon: qinlingRegionBounds.west }, qinlingRegionBounds, qinlingRegionWorld);
      const rgt = projectGeoToWorld({ lat, lon: qinlingRegionBounds.east }, qinlingRegionBounds, qinlingRegionWorld);
      const c1 = worldToCanvas(lft.x, lft.z);
      const c2 = worldToCanvas(rgt.x, rgt.z);
      ctx.beginPath();
      ctx.moveTo(c1.x, c1.y);
      ctx.lineTo(c2.x, c2.y);
      ctx.stroke();
      if (c1.x > 0 && c1.x < w && c1.y > 0 && c1.y < h) {
        ctx.fillText(`${lat}°N`, 2, c1.y - 2);
      }
    }
  }

  function update(cameraWorldX: number, cameraWorldZ: number, cameraYaw: number, timeOfDay = lastTimeOfDay): void {
    lastCamX = cameraWorldX;
    lastCamZ = cameraWorldZ;
    lastCamYaw = cameraYaw;
    lastTimeOfDay = timeOfDay;

    // Compact 模式下 viewport 跟随相机 (相机在中心), fit-zoom 整中国
    if (state.mode === "compact") {
      const { w, h } = getCanvasSize();
      state.centerX = worldCenterX;
      state.centerZ = worldCenterZ;
      state.pixelsPerUnit = computeFitScale(w, h);
    }

    const { w, h } = getCanvasSize();
    ctx.clearRect(0, 0, w, h);

    // Parchment 底色
    ctx.fillStyle = PALETTE.paper;
    ctx.fillRect(0, 0, w, h);

    // DEM 鸟瞰底图：加载前降级到抽象 2D 海陆/山带。
    drawTerrainBaseMap();
    drawNightOverlay(timeOfDay);

    // 经纬网格 (仅 fullscreen)
    drawGraticule();

    // POI markers — hierarchy 按 zoom 渐进显示:
    //   - compact: 只显示 gravity (核心 5 节点, 不挤)
    //   - fullscreen fit-zoom: gravity + large
    //   - fullscreen 1.5×+: 添 medium
    //   - fullscreen 3×+: 添 small (全 4 档)
    const fitScale = computeFitScale(w, h);
    const zoomFactor = state.pixelsPerUnit / fitScale;
    ctx.font = "10px -apple-system, sans-serif";
    for (const poi of POI_REGISTRY) {
      if (!activePoiKinds.has(poi.kind)) continue;
      if (!minimapPoiVisibleInMode(poi, state.mode, zoomFactor)) continue;

      const wp = projectGeoToWorld(
        { lat: poi.lat, lon: poi.lon },
        qinlingRegionBounds,
        qinlingRegionWorld
      );
      const c = worldToCanvas(wp.x, wp.z);
      if (c.x < -50 || c.x > w + 50 || c.y < -20 || c.y > h + 20) continue;

      const radius = (HIERARCHY_RADIUS[poi.hierarchy] ?? 3) * (state.mode === "fullscreen" ? 1.2 : 0.9);
      drawPoiMarker(c, poi, radius);

      // Label: gravity 始终标; 其他档 zoom 进显标
      const labelable =
        (state.mode === "compact" && COMPACT_CITY_IDS.has(poi.id)) ||
        poi.hierarchy === "gravity" ||
        (poi.hierarchy === "large" && state.mode === "fullscreen" && zoomFactor > 1.1) ||
        (poi.hierarchy === "medium" && state.mode === "fullscreen" && zoomFactor > 1.5) ||
        (poi.hierarchy === "small" && state.mode === "fullscreen" && zoomFactor > 3.0);
      if (labelable) {
        ctx.fillStyle = PALETTE.text;
        const label = poiLabel(poi);
        ctx.fillText(label, c.x + radius + 2, c.y + 3);
      }
    }

    // Player compass arrow
    const p = worldToCanvas(cameraWorldX, cameraWorldZ);
    if (p.x > 0 && p.x < w && p.y > 0 && p.y < h) {
      ctx.fillStyle = PALETTE.player;
      ctx.strokeStyle = PALETTE.playerStroke;
      ctx.lineWidth = 1.5;
      // 三角箭头, 指向 cameraYaw
      const ax = p.x + Math.sin(cameraYaw) * 8;
      const ay = p.y - Math.cos(cameraYaw) * 8;
      const lx = p.x + Math.sin(cameraYaw - Math.PI * 0.85) * 6;
      const ly = p.y - Math.cos(cameraYaw - Math.PI * 0.85) * 6;
      const rx = p.x + Math.sin(cameraYaw + Math.PI * 0.85) * 6;
      const ry = p.y - Math.cos(cameraYaw + Math.PI * 0.85) * 6;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(lx, ly);
      ctx.lineTo(p.x, p.y);
      ctx.lineTo(rx, ry);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // 底部 status: 坐标 + mode + 操作提示
    const geo = unprojectWorldToGeo(
      { x: cameraWorldX, z: cameraWorldZ },
      qinlingRegionBounds,
      qinlingRegionWorld
    );
    ctx.fillStyle = PALETTE.text;
    ctx.font = state.mode === "fullscreen" ? "12px -apple-system, sans-serif" : "10px -apple-system, sans-serif";
    ctx.fillText(
      `${geo.lat.toFixed(2)}°N ${geo.lon.toFixed(2)}°E`,
      6,
      h - 6
    );
    if (state.mode === "fullscreen") {
      ctx.fillStyle = PALETTE.textDim;
      ctx.font = "11px -apple-system, sans-serif";
      const hint = "M 切换 · 滚轮 缩放 · 拖拽 移动";
      const metrics = ctx.measureText(hint);
      ctx.fillText(hint, w - metrics.width - 6, h - 6);
      // top-left mode label
      ctx.fillStyle = PALETTE.text;
      ctx.font = "13px -apple-system, sans-serif";
      ctx.fillText("地图 · 天宝十四载", 8, 18);
    } else {
      // compact mode tiny "M open" hint
      ctx.fillStyle = PALETTE.textDim;
      ctx.font = "9px -apple-system, sans-serif";
      ctx.fillText("M 展开", w - 40, 12);
    }
  }

  // ─── Interaction handlers (fullscreen 模式 active) ─────────────────

  function onKeydown(e: KeyboardEvent): void {
    if (e.key.toLowerCase() === fullscreenKey) {
      cycleMode();
    } else if (state.mode === "fullscreen" && e.key === "Escape") {
      setMode("compact");
    }
  }

  function onWheel(e: WheelEvent): void {
    if (state.mode !== "fullscreen") return;
    e.preventDefault();
    // Zoom in/out around mouse position
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const worldBefore = canvasToWorld(cx, cy);
    const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2;
    const minScale = computeFitScale(getCanvasSize().w, getCanvasSize().h) * 0.6;
    const maxScale = computeFitScale(getCanvasSize().w, getCanvasSize().h) * 30;
    state.pixelsPerUnit = Math.max(minScale, Math.min(maxScale, state.pixelsPerUnit * factor));
    // Keep mouse-pointed world position at same canvas position
    const worldAfter = canvasToWorld(cx, cy);
    state.centerX += worldBefore.x - worldAfter.x;
    state.centerZ += worldBefore.z - worldAfter.z;
    update(lastCamX, lastCamZ, lastCamYaw, lastTimeOfDay);
  }

  function onPointerDown(e: PointerEvent): void {
    if (state.mode !== "fullscreen") return;
    state.dragging = true;
    state.dragLastX = e.clientX;
    state.dragLastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    applyCSS();
  }
  function onPointerMove(e: PointerEvent): void {
    if (!state.dragging) return;
    const dx = e.clientX - state.dragLastX;
    const dy = e.clientY - state.dragLastY;
    state.dragLastX = e.clientX;
    state.dragLastY = e.clientY;
    state.centerX -= dx / state.pixelsPerUnit;
    state.centerZ -= dy / state.pixelsPerUnit;
    update(lastCamX, lastCamZ, lastCamYaw, lastTimeOfDay);
  }
  function onPointerUp(e: PointerEvent): void {
    if (state.dragging) {
      state.dragging = false;
      try { canvas.releasePointerCapture(e.pointerId); } catch {}
      applyCSS();
    }
  }

  function onResize(): void {
    applyCSS();
    resizeBackingStore();
    update(lastCamX, lastCamZ, lastCamYaw, lastTimeOfDay);
  }

  function cycleMode(): void {
    if (state.mode === "compact") setMode("fullscreen");
    else if (state.mode === "fullscreen") setMode("collapsed");
    else setMode("compact");
  }

  function setMode(mode: MinimapMode): void {
    if (mode === state.mode) return;
    state.mode = mode;
    if (mode === "fullscreen") {
      // 进入 fullscreen 时, view 默认 fit 整图, center 在 China 中心
      state.centerX = worldCenterX;
      state.centerZ = worldCenterZ;
      applyCSS();
      resizeBackingStore();
      state.pixelsPerUnit = computeFitScale(getCanvasSize().w, getCanvasSize().h) * 0.95;
    } else if (mode === "collapsed") {
      applyCSS();
    } else {
      applyCSS();
      resizeBackingStore();
    }
    update(lastCamX, lastCamZ, lastCamYaw, lastTimeOfDay);
  }

  openButton.addEventListener("click", () => {
    setMode("compact");
  });
  sidebar.addEventListener("change", (event) => {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    const kind = input?.dataset.poiKind;
    if (!input || !kind) return;
    if (input.checked) activePoiKinds.add(kind);
    else activePoiKinds.delete(kind);
    renderSidebar();
    update(lastCamX, lastCamZ, lastCamYaw, lastTimeOfDay);
  });

  // initial layout
  renderSidebar();
  applyCSS();
  resizeBackingStore();
  void loadMinimapTerrainAtlas().catch((error: unknown) => {
    console.warn("minimap DEM atlas unavailable; using abstract fallback", error);
  });

  // event listeners
  window.addEventListener("keydown", onKeydown);
  window.addEventListener("resize", onResize);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);

  function dispose(): void {
    window.removeEventListener("keydown", onKeydown);
    window.removeEventListener("resize", onResize);
    canvas.remove();
    sidebar.remove();
    openButton.remove();
  }

  return { canvas, ctx, update, setMode, dispose };
}
