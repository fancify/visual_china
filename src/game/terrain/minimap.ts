// terrain/minimap.ts —
//
// 双模式 minimap (compact 角落 / fullscreen 全屏):
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
  update(cameraWorldX: number, cameraWorldZ: number, cameraYaw: number): void;
  setMode(mode: "compact" | "fullscreen"): void;
  dispose(): void;
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
  graticule: "rgba(216, 200, 175, 0.2)"
};

// POI 视觉分类: 形状 + 颜色 + size 跟 hierarchy 联动
const CATEGORY_STYLE: Record<PoiCategory, { color: string; shape: "circle" | "square" | "triangle" | "diamond" }> = {
  city: { color: "#ffd28a", shape: "circle" },
  relic: { color: "#ffa674", shape: "square" },
  scenic: { color: "#9ad29b", shape: "triangle" },
  transport: { color: "#9ccdd8", shape: "diamond" }
};

const HIERARCHY_RADIUS: Record<string, number> = {
  gravity: 5,
  large: 4,
  medium: 3,
  small: 2
};

// id → 中文 label (UI 装饰, 跟 doc 解耦)
const POI_LABELS: Record<string, string> = {
  changan: "长安",
  luoyang: "洛阳",
  yangzhou: "扬州",
  taiyuan: "太原",
  youzhou: "幽州",
  yizhou: "益州",
  liangzhou: "凉州",
  lingwu: "灵武",
  shanzhou: "鄯州",
  huashan: "华山",
  songshan: "嵩山",
  taishan: "泰山",
  taibaishan: "太白山",
  lushan: "庐山",
  "zhongnan-shan": "终南山",
  "baima-si": "白马寺",
  "famen-si": "法门寺",
  "longmen-shiku": "龙门石窟",
  "mogao-caves": "莫高窟",
  "wangchuan-bieye": "辋川别业",
  "xingjiao-si": "兴教寺",
  "baoxie-dao": "褒斜道",
  "chencang-dao": "陈仓道",
  "jinniu-dao": "金牛道",
  "lizhi-dao": "荔枝道",
  "micang-dao": "米仓道",
  "qishan-dao": "岐山道",
  "tangluo-dao": "傥骆道",
  "ziwu-dao": "子午道"
};

function poiLabel(id: string): string {
  return POI_LABELS[id] ?? id;
}

interface MinimapState {
  mode: "compact" | "fullscreen";
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
  document.body.appendChild(canvas);

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

  function applyCSS(): void {
    canvas.style.position = "fixed";
    canvas.style.borderRadius = state.mode === "compact" ? "4px" : "8px";
    canvas.style.border = `1px solid ${state.mode === "compact" ? PALETTE.border : PALETTE.borderHi}`;
    canvas.style.background = state.mode === "compact" ? PALETTE.bgCompact : PALETTE.bgFullscreen;
    canvas.style.boxShadow = state.mode === "fullscreen" ? "0 10px 40px rgba(0,0,0,0.6)" : "none";
    canvas.style.cursor = state.mode === "fullscreen" ? (state.dragging ? "grabbing" : "grab") : "default";

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
    } else {
      // Fullscreen: 占 viewport 大半中央
      const vw = Math.round(window.innerWidth * 0.9);
      const vh = Math.round(window.innerHeight * 0.9);
      canvas.style.width = `${vw}px`;
      canvas.style.height = `${vh}px`;
      canvas.style.left = `${Math.round((window.innerWidth - vw) / 2)}px`;
      canvas.style.top = `${Math.round((window.innerHeight - vh) / 2)}px`;
      canvas.style.right = canvas.style.bottom = "auto";
      canvas.style.pointerEvents = "auto";
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

  function update(cameraWorldX: number, cameraWorldZ: number, cameraYaw: number): void {
    lastCamX = cameraWorldX;
    lastCamZ = cameraWorldZ;
    lastCamYaw = cameraYaw;

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

    // 经纬网格 (仅 fullscreen)
    drawGraticule();

    // POI markers — hierarchy 按 zoom 渐进显示:
    //   - compact: 只显示 gravity (核心 5 节点, 不挤)
    //   - fullscreen fit-zoom: gravity + large
    //   - fullscreen 1.5×+: 添 medium
    //   - fullscreen 3×+: 添 small (全 4 档)
    const fitScale = computeFitScale(w, h);
    const zoomFactor = state.pixelsPerUnit / fitScale;
    const showLarge = state.mode === "fullscreen";
    const showMedium = state.mode === "fullscreen" && zoomFactor > 1.5;
    const showSmall = state.mode === "fullscreen" && zoomFactor > 3.0;

    ctx.font = "10px -apple-system, sans-serif";
    for (const poi of POI_REGISTRY) {
      const visible =
        poi.hierarchy === "gravity" ||
        (poi.hierarchy === "large" && showLarge) ||
        (poi.hierarchy === "medium" && showMedium) ||
        (poi.hierarchy === "small" && showSmall);
      if (!visible) continue;

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
        poi.hierarchy === "gravity" ||
        (poi.hierarchy === "large" && state.mode === "fullscreen" && zoomFactor > 1.1) ||
        (poi.hierarchy === "medium" && showMedium) ||
        (poi.hierarchy === "small" && showSmall);
      if (labelable) {
        ctx.fillStyle = PALETTE.text;
        const label = poiLabel(poi.id);
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
      const hint = "M 关闭 · 滚轮 缩放 · 拖拽 移动";
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
      setMode(state.mode === "compact" ? "fullscreen" : "compact");
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
    update(lastCamX, lastCamZ, lastCamYaw);
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
    update(lastCamX, lastCamZ, lastCamYaw);
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
    update(lastCamX, lastCamZ, lastCamYaw);
  }

  function setMode(mode: "compact" | "fullscreen"): void {
    if (mode === state.mode) return;
    state.mode = mode;
    if (mode === "fullscreen") {
      // 进入 fullscreen 时, view 默认 fit 整图, center 在 China 中心
      state.centerX = worldCenterX;
      state.centerZ = worldCenterZ;
      applyCSS();
      resizeBackingStore();
      state.pixelsPerUnit = computeFitScale(getCanvasSize().w, getCanvasSize().h) * 0.95;
    } else {
      applyCSS();
      resizeBackingStore();
    }
    update(lastCamX, lastCamZ, lastCamYaw);
  }

  // initial layout
  applyCSS();
  resizeBackingStore();

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
  }

  return { canvas, ctx, update, setMode, dispose };
}
