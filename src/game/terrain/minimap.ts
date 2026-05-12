// terrain/minimap.ts —
//
// 简易小地图：屏幕一角显示中国轮廓 + 当前 camera 位置 + 主要 POI
// 用 HTML5 Canvas 2D，不占 WebGL pipeline

import {
  projectGeoToWorld,
  unprojectWorldToGeo
} from "../mapOrientation.js";
import {
  qinlingRegionBounds,
  qinlingRegionWorld
} from "../../data/qinlingRegion.js";

export interface MinimapOptions {
  width?: number;
  height?: number;
  corner?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  margin?: number;
}

export interface MinimapHandle {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  update(cameraWorldX: number, cameraWorldZ: number, cameraYaw: number): void;
  dispose(): void;
}

const BG_COLOR = "rgba(8, 18, 19, 0.85)";
const BORDER_COLOR = "rgba(216, 230, 223, 0.4)";
const CHINA_FILL = "rgba(180, 175, 145, 0.5)";
const CHINA_STROKE = "rgba(216, 230, 223, 0.6)";
const PLAYER_COLOR = "#ffe7a8";
const POI_COLOR = "rgba(255, 231, 168, 0.85)";

const MAJOR_POIS: { lat: number; lon: number; label: string }[] = [
  { lat: 34.27, lon: 108.95, label: "长安" },
  { lat: 34.62, lon: 112.45, label: "洛阳" },
  { lat: 30.67, lon: 104.06, label: "益州" },
  { lat: 32.39, lon: 119.43, label: "扬州" },
  { lat: 37.87, lon: 112.55, label: "太原" },
  { lat: 39.9, lon: 116.4, label: "幽州" },
  { lat: 37.93, lon: 102.64, label: "凉州" },
  { lat: 40.14, lon: 94.66, label: "沙州" }
];

export function createMinimap(opts: MinimapOptions = {}): MinimapHandle {
  const width = opts.width ?? 220;
  const height = opts.height ?? 150;
  const margin = opts.margin ?? 12;
  const corner = opts.corner ?? "top-right";

  const canvas = document.createElement("canvas");
  canvas.width = width * window.devicePixelRatio;
  canvas.height = height * window.devicePixelRatio;
  canvas.style.position = "fixed";
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.style.pointerEvents = "none";
  canvas.style.borderRadius = "4px";
  canvas.style.border = `1px solid ${BORDER_COLOR}`;
  canvas.style.background = BG_COLOR;
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
  document.body.appendChild(canvas);

  const ctxMaybe = canvas.getContext("2d");
  if (!ctxMaybe) throw new Error("minimap: 2d context unavailable");
  const ctx: CanvasRenderingContext2D = ctxMaybe;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

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
  const worldWidth = Math.abs(se.x - nw.x);
  const worldDepth = Math.abs(se.z - nw.z);

  function worldToCanvas(wx: number, wz: number): { x: number; y: number } {
    const u = (wx - nw.x) / worldWidth;
    const v = (wz - nw.z) / worldDepth;
    return { x: u * width, y: v * height };
  }

  function update(cameraWorldX: number, cameraWorldZ: number, cameraYaw: number): void {
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = CHINA_FILL;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = CHINA_STROKE;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

    ctx.fillStyle = POI_COLOR;
    ctx.font = "9px -apple-system, sans-serif";
    for (const poi of MAJOR_POIS) {
      const w = projectGeoToWorld(
        { lat: poi.lat, lon: poi.lon },
        qinlingRegionBounds,
        qinlingRegionWorld
      );
      const c = worldToCanvas(w.x, w.z);
      ctx.beginPath();
      ctx.arc(c.x, c.y, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText(poi.label, c.x + 3, c.y + 3);
    }

    const p = worldToCanvas(cameraWorldX, cameraWorldZ);
    const px = Math.max(2, Math.min(width - 2, p.x));
    const py = Math.max(2, Math.min(height - 2, p.y));
    ctx.fillStyle = PLAYER_COLOR;
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PLAYER_COLOR;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(
      px + Math.sin(cameraYaw) * 8,
      py - Math.cos(cameraYaw) * 8
    );
    ctx.stroke();

    const geo = unprojectWorldToGeo(
      { x: cameraWorldX, z: cameraWorldZ },
      qinlingRegionBounds,
      qinlingRegionWorld
    );
    ctx.fillStyle = "rgba(216, 230, 223, 0.9)";
    ctx.font = "10px -apple-system, sans-serif";
    ctx.fillText(
      `${geo.lat.toFixed(2)}°N ${geo.lon.toFixed(2)}°E`,
      6,
      height - 6
    );
  }

  function dispose(): void {
    canvas.remove();
  }

  return { canvas, ctx, update, dispose };
}
