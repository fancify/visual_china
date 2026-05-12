// terrain/debugOverlay.ts —
//
// 调试用 3D overlay: 让我们看清 chunk grid / 经纬度网格 / 已知 POI 桩
// 在物理空间里是否对齐.
//
// 包含:
//   1. Lat/Lon grid lines — 每 5° 一条, 黄色细线 + 度数标签
//   2. Chunk grid wireframe — L0 chunk 边界, 蓝色
//   3. Chunk id labels — 每 N chunk 立柱 + canvas-texture (chunkX,chunkZ)
//   4. POI 测试桩 — 已知 lon/lat 的彩色立柱 + 标签

import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CylinderGeometry,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  Sprite,
  SpriteMaterial
} from "three";
import { projectGeoToWorld } from "../mapOrientation.js";
import {
  qinlingRegionBounds,
  qinlingRegionWorld
} from "../../data/qinlingRegion.js";
import type { PyramidManifest } from "./pyramidTypes.js";

interface KnownPoi {
  lat: number;
  lon: number;
  label: string;
  color: number;
}

const KNOWN_POIS: KnownPoi[] = [
  { lat: 34.27, lon: 108.95, label: "长安", color: 0xff5050 },
  { lat: 34.62, lon: 112.45, label: "洛阳", color: 0xffaa50 },
  { lat: 31.69, lon: 102.65, label: "岷山测试点", color: 0xff00ff },
  { lat: 40.14, lon: 94.66, label: "沙州", color: 0xffff50 },
  { lat: 39.9, lon: 116.4, label: "幽州", color: 0x50ffff },
  { lat: 30.67, lon: 104.06, label: "益州", color: 0x50ff50 },
  { lat: 32.39, lon: 119.43, label: "扬州", color: 0xff80c0 }
];

const STAKE_HEIGHT = 60;

function buildLabelSprite(text: string, color = "#ffffff"): Sprite {
  const lines = text.split("\n");
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = lines.length > 1 ? 128 : 96;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = color;
  ctx.font = lines.length > 1 ? "bold 26px -apple-system, sans-serif" : "bold 32px -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lineH = canvas.height / (lines.length + 1);
  for (let i = 0; i < lines.length; i += 1) {
    ctx.fillText(lines[i], canvas.width / 2, lineH * (i + 1));
  }
  const tex = new CanvasTexture(canvas);
  const mat = new SpriteMaterial({ map: tex, depthTest: false });
  const sprite = new Sprite(mat);
  sprite.scale.set(12, 4.5, 1);
  return sprite;
}

function buildStake(worldX: number, worldZ: number, label: string, color: number): Group {
  const group = new Group();
  const geom = new CylinderGeometry(0.4, 0.4, STAKE_HEIGHT, 6);
  geom.translate(0, STAKE_HEIGHT / 2, 0);
  const mat = new MeshBasicMaterial({ color, depthTest: false });
  const cyl = new Mesh(geom, mat);
  cyl.renderOrder = 100;
  group.add(cyl);

  const labelSprite = buildLabelSprite(label, `#${color.toString(16).padStart(6, "0")}`);
  labelSprite.position.set(0, STAKE_HEIGHT + 3, 0);
  labelSprite.renderOrder = 101;
  group.add(labelSprite);

  group.position.set(worldX, 0, worldZ);
  return group;
}

export interface DebugOverlayHandle {
  group: Group;
  setVisible(v: boolean): void;
  dispose(): void;
}

export interface DebugOverlayOptions {
  manifest: PyramidManifest;
  geoGridStep?: number;
  showChunkGrid?: boolean;
  chunkLabelStride?: number;
  showPois?: boolean;
  showGeoGrid?: boolean;
}

export function createDebugOverlay(opts: DebugOverlayOptions): DebugOverlayHandle {
  const group = new Group();
  group.name = "debug-overlay";

  const geoGridStep = opts.geoGridStep ?? 5;
  const chunkLabelStride = opts.chunkLabelStride ?? 5;
  const showChunkGrid = opts.showChunkGrid ?? true;
  const showPois = opts.showPois ?? true;
  const showGeoGrid = opts.showGeoGrid ?? true;

  if (showGeoGrid) {
    const lineMat = new LineBasicMaterial({
      color: 0xfff088,
      transparent: true,
      opacity: 0.45,
      depthTest: false
    });
    const lineY = 5;
    // 经线
    for (
      let lon = Math.ceil(qinlingRegionBounds.west / geoGridStep) * geoGridStep;
      lon <= qinlingRegionBounds.east;
      lon += geoGridStep
    ) {
      const points: number[] = [];
      const STEPS = 36;
      for (let i = 0; i <= STEPS; i += 1) {
        const lat =
          qinlingRegionBounds.south +
          (qinlingRegionBounds.north - qinlingRegionBounds.south) * (i / STEPS);
        const w = projectGeoToWorld({ lat, lon }, qinlingRegionBounds, qinlingRegionWorld);
        points.push(w.x, lineY, w.z);
      }
      const geom = new BufferGeometry();
      geom.setAttribute("position", new BufferAttribute(new Float32Array(points), 3));
      const line = new Line(geom, lineMat);
      line.renderOrder = 90;
      group.add(line);
      const w0 = projectGeoToWorld(
        { lat: qinlingRegionBounds.north, lon },
        qinlingRegionBounds,
        qinlingRegionWorld
      );
      const label = buildLabelSprite(`${lon}°E`, "#ffe7a8");
      label.position.set(w0.x, lineY + 4, w0.z);
      group.add(label);
    }
    // 纬线
    for (
      let lat = Math.ceil(qinlingRegionBounds.south / geoGridStep) * geoGridStep;
      lat <= qinlingRegionBounds.north;
      lat += geoGridStep
    ) {
      const points: number[] = [];
      const STEPS = 36;
      for (let i = 0; i <= STEPS; i += 1) {
        const lon =
          qinlingRegionBounds.west +
          (qinlingRegionBounds.east - qinlingRegionBounds.west) * (i / STEPS);
        const w = projectGeoToWorld({ lat, lon }, qinlingRegionBounds, qinlingRegionWorld);
        points.push(w.x, lineY, w.z);
      }
      const geom = new BufferGeometry();
      geom.setAttribute("position", new BufferAttribute(new Float32Array(points), 3));
      const line = new Line(geom, lineMat);
      line.renderOrder = 90;
      group.add(line);
      const w0 = projectGeoToWorld(
        { lat, lon: qinlingRegionBounds.west },
        qinlingRegionBounds,
        qinlingRegionWorld
      );
      const label = buildLabelSprite(`${lat}°N`, "#ffe7a8");
      label.position.set(w0.x - 2, lineY + 4, w0.z);
      group.add(label);
    }
  }

  if (showChunkGrid) {
    const L0Meta = opts.manifest.tiers.L0;
    const sizeDeg = L0Meta.chunkSizeDeg;
    const [xMin, xMax] = L0Meta.chunkRangeX;
    const [zMin, zMax] = L0Meta.chunkRangeZ;
    const wireY = 25; // 高一点超过山脊好看
    // 每个 chunk 用不同色 — chunk seam 一眼可辨
    function chunkColor(x: number, z: number): number {
      // 棋盘色 + 强对比, 让 seam 必然可见
      const checker = (x + z) % 2 === 0;
      return checker ? 0xff5060 : 0x40c8ff; // 红/蓝交替
    }
    for (let x = xMin; x <= xMax; x += 1) {
      for (let z = zMin; z <= zMax; z += 1) {
        const west = opts.manifest.bounds.west + x * sizeDeg;
        const east = west + sizeDeg;
        const north = opts.manifest.bounds.north - z * sizeDeg;
        const south = north - sizeDeg;
        const nw = projectGeoToWorld(
          { lat: north, lon: west },
          qinlingRegionBounds,
          qinlingRegionWorld
        );
        const ne = projectGeoToWorld(
          { lat: north, lon: east },
          qinlingRegionBounds,
          qinlingRegionWorld
        );
        const se = projectGeoToWorld(
          { lat: south, lon: east },
          qinlingRegionBounds,
          qinlingRegionWorld
        );
        const sw = projectGeoToWorld(
          { lat: south, lon: west },
          qinlingRegionBounds,
          qinlingRegionWorld
        );
        const pts = new Float32Array([
          nw.x, wireY, nw.z,
          ne.x, wireY, ne.z,
          se.x, wireY, se.z,
          sw.x, wireY, sw.z,
          nw.x, wireY, nw.z
        ]);
        const geom = new BufferGeometry();
        geom.setAttribute("position", new BufferAttribute(pts, 3));
        // 每个 chunk 不同色，强 line opacity
        const wireMat = new LineBasicMaterial({
          color: chunkColor(x, z),
          transparent: true,
          opacity: 0.85,
          depthTest: false,
          linewidth: 2
        });
        const line = new Line(geom, wireMat);
        line.renderOrder = 91;
        group.add(line);

        if (x % chunkLabelStride === 0 && z % chunkLabelStride === 0) {
          const cx = (nw.x + se.x) / 2;
          const cz = (nw.z + se.z) / 2;
          const lonW = opts.manifest.bounds.west + x * sizeDeg;
          const latN = opts.manifest.bounds.north - z * sizeDeg;
          const checker = (x + z) % 2 === 0;
          const labelColor = checker ? "#ff8080" : "#80d8ff";
          const label = buildLabelSprite(
            `(${x},${z})\n${lonW}°E ${latN}°N`,
            labelColor
          );
          label.position.set(cx, wireY + 8, cz);
          label.scale.set(7, 4, 1);
          group.add(label);
        }
      }
    }
  }

  if (showPois) {
    for (const poi of KNOWN_POIS) {
      const w = projectGeoToWorld(
        { lat: poi.lat, lon: poi.lon },
        qinlingRegionBounds,
        qinlingRegionWorld
      );
      const stake = buildStake(
        w.x,
        w.z,
        `${poi.label} (${poi.lat}°N ${poi.lon}°E)`,
        poi.color
      );
      group.add(stake);
    }
  }

  function setVisible(v: boolean): void {
    group.visible = v;
  }
  function dispose(): void {
    group.traverse((obj) => {
      if ((obj as Mesh).geometry) (obj as Mesh).geometry?.dispose();
      const mat = (obj as Mesh).material;
      if (mat) {
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat.dispose();
      }
    });
  }
  return { group, setVisible, dispose };
}
