/**
 * POI Map Demo — Phase 3
 *
 * 把 284 个 POI registry entry 摆到一个简化中国地图上,
 * 鼠标 hover 显示名字 + 一句话简介, 点击展开 markdown 详情面板.
 *
 * Map projection: 简化等距投影
 *   - 中国范围 lat 18-54, lon 73-135
 *   - 中心: 36N 105E
 *   - x = (lon - 105) * scaleX  (east 为 +x)
 *   - z = -(lat - 36) * scaleZ  (north 为 -z, 与项目约定一致)
 */

import "./style.css";

import {
  AmbientLight,
  Color,
  DirectionalLight,
  GridHelper,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  Scene,
  Vector2,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { resolvePoiModel } from "./game/poi/models/registry.js";

interface PoiEntry {
  id: string;
  archetype: string;
  size?: string;
  variant?: string;
  position: { lat: number; lon: number };
  visualHierarchy: string;
  displayName: string;
  oneLiner: string;
  docPath: string;
  category: string;
  aliases?: string[];
  extinctionTier?: string;
}

interface PoiRegistry {
  totalEntries: number;
  entries: PoiEntry[];
}

const app = document.getElementById("app");
if (!app) throw new Error("#app element not found");

// ============================================================
// Scene 基础
// ============================================================

const scene = new Scene();
scene.background = new Color(0xc8c4ba);

const camera = new PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.5,
  2000,
);
camera.position.set(0, 220, 280);
camera.lookAt(0, 0, 0);

const renderer = new WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
app.appendChild(renderer.domElement);

const ambient = new AmbientLight(0xffffff, 0.55);
scene.add(ambient);
const sun = new DirectionalLight(0xfff4e0, 0.85);
sun.position.set(40, 80, 30);
scene.add(sun);

// ============================================================
// Ground (中国版图简化平面)
// ============================================================

const MAP_SCALE_X = 5; // 1° 经度 ≈ 5 units
const MAP_SCALE_Z = 5; // 1° 纬度 ≈ 5 units
const CENTER_LAT = 36;
const CENTER_LON = 105;

function projectLatLon(lat: number, lon: number): { x: number; z: number } {
  return {
    x: (lon - CENTER_LON) * MAP_SCALE_X,
    z: -(lat - CENTER_LAT) * MAP_SCALE_Z, // north = -Z 与项目约定一致
  };
}

const ground = new Mesh(
  new PlaneGeometry(400, 300),
  new MeshBasicMaterial({ color: 0xb8b0a3 }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.5;
scene.add(ground);

const grid = new GridHelper(400, 40, 0x8b8474, 0x9b9484);
(grid.material as { opacity?: number; transparent?: boolean }).opacity = 0.3;
(grid.material as { opacity?: number; transparent?: boolean }).transparent =
  true;
scene.add(grid);

// ============================================================
// 加载 registry + 摆放 POI
// ============================================================

const poiMeshes: Mesh[] = [];
const poiEntryMap = new Map<Object3D, PoiEntry>();

async function loadRegistry(): Promise<PoiRegistry> {
  const res = await fetch("/data/poi-registry.json");
  if (!res.ok) throw new Error(`Failed to load registry: ${res.status}`);
  return res.json();
}

function poiScale(hierarchy: string): number {
  switch (hierarchy) {
    case "gravity":
      return 1.2;
    case "large":
      return 1.0;
    case "medium":
      return 0.65;
    case "small":
      return 0.45;
    default:
      return 0.6;
  }
}

async function placePois(): Promise<void> {
  const registry = await loadRegistry();
  console.log(`Loaded ${registry.totalEntries} POI entries`);

  for (const entry of registry.entries) {
    // Skip POI with missing geo (e.g. 驿道)
    if (entry.position.lat === 0 && entry.position.lon === 0) continue;

    const builder = resolvePoiModel(entry);
    const group = builder();
    const { x, z } = projectLatLon(entry.position.lat, entry.position.lon);
    group.position.set(x, 0, z);
    const s = poiScale(entry.visualHierarchy);
    group.scale.set(s, s, s);

    // Attach entry data for raycast hit
    group.traverse((obj) => {
      if (obj instanceof Mesh) {
        poiMeshes.push(obj);
        poiEntryMap.set(obj, entry);
      }
    });

    scene.add(group);
  }
  console.log(`Placed ${poiMeshes.length} mesh objects from POI registry`);
}

// ============================================================
// Tooltip overlay
// ============================================================

const tooltip = document.createElement("div");
tooltip.id = "poi-tooltip";
Object.assign(tooltip.style, {
  position: "fixed",
  top: "0",
  left: "0",
  padding: "8px 14px",
  background: "rgba(20, 15, 10, 0.92)",
  color: "#f4e4c1",
  border: "1px solid rgba(244, 228, 193, 0.5)",
  borderRadius: "4px",
  fontFamily: "'PingFang SC', 'Helvetica Neue', sans-serif",
  fontSize: "13px",
  letterSpacing: "0.04em",
  lineHeight: "1.5",
  maxWidth: "320px",
  pointerEvents: "none",
  boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
  zIndex: "100",
  display: "none",
} as Partial<CSSStyleDeclaration>);
document.body.appendChild(tooltip);

function showTooltip(entry: PoiEntry, screenX: number, screenY: number): void {
  tooltip.innerHTML = `
    <div style="font-size: 15px; font-weight: 600; margin-bottom: 4px;">
      ${entry.displayName}
    </div>
    <div style="opacity: 0.7; font-size: 11px; margin-bottom: 6px;">
      ${entry.archetype}${entry.size ? " · " + entry.size : ""}${entry.variant ? " · " + entry.variant : ""}
    </div>
    <div style="opacity: 0.92;">${entry.oneLiner.slice(0, 120)}${entry.oneLiner.length > 120 ? "…" : ""}</div>
    <div style="margin-top: 6px; opacity: 0.6; font-size: 11px;">点击展开详情</div>
  `;
  tooltip.style.left = `${screenX + 12}px`;
  tooltip.style.top = `${screenY + 12}px`;
  tooltip.style.display = "block";
}

function hideTooltip(): void {
  tooltip.style.display = "none";
}

// ============================================================
// Detail panel
// ============================================================

const detailPanel = document.createElement("div");
detailPanel.id = "poi-detail-panel";
Object.assign(detailPanel.style, {
  position: "fixed",
  top: "0",
  right: "0",
  width: "min(540px, 50vw)",
  height: "100vh",
  background: "rgba(15, 12, 8, 0.96)",
  color: "#f4e4c1",
  fontFamily: "'PingFang SC', 'Helvetica Neue', sans-serif",
  fontSize: "14px",
  lineHeight: "1.7",
  padding: "20px 28px",
  overflowY: "auto",
  borderLeft: "1px solid rgba(244, 228, 193, 0.3)",
  boxShadow: "-4px 0 20px rgba(0,0,0,0.5)",
  zIndex: "200",
  display: "none",
} as Partial<CSSStyleDeclaration>);
document.body.appendChild(detailPanel);

function renderMarkdownBasic(md: string): string {
  // 轻量 markdown render — 不引外部 dep
  // 移除 frontmatter
  const body = md.replace(/^---\n[\s\S]*?\n---\n/, "").trim();
  return body
    .replace(/^#### (.+)$/gm, '<h4 style="margin: 1.4em 0 0.4em; color: #d4b876;">$1</h4>')
    .replace(/^### (.+)$/gm, '<h3 style="margin: 1.5em 0 0.5em; color: #e0c688;">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="margin: 1.6em 0 0.6em; color: #f0d896; border-bottom: 1px solid rgba(244,228,193,0.2); padding-bottom: 0.3em;">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="margin: 0 0 0.8em; color: #fff0c0; font-size: 1.6em;">$1</h1>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong style=\"color: #f8e8b8;\">$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/^> (.+)$/gm, '<blockquote style="border-left: 3px solid rgba(244,228,193,0.4); padding-left: 1em; margin: 1em 0; opacity: 0.85; font-style: italic;">$1</blockquote>')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '<span style="color: #c9a55a; text-decoration: underline;">$1</span>')
    .replace(/^- (.+)$/gm, '<li style="margin: 0.2em 0;">$1</li>')
    .replace(/(<li[\s\S]*?<\/li>\s*)+/g, '<ul style="padding-left: 1.5em; margin: 0.6em 0;">$&</ul>')
    .split(/\n\n+/)
    .map((para) => {
      if (para.startsWith("<")) return para;
      return `<p style="margin: 0.6em 0;">${para.replace(/\n/g, "<br>")}</p>`;
    })
    .join("\n");
}

async function showDetail(entry: PoiEntry): Promise<void> {
  detailPanel.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
      <div>
        <div style="font-size: 11px; opacity: 0.6; letter-spacing: 0.1em;">${entry.archetype.toUpperCase()}</div>
        <div style="font-size: 22px; font-weight: 600; margin-top: 2px;">${entry.displayName}</div>
        ${entry.aliases ? `<div style="opacity: 0.6; font-size: 12px; margin-top: 4px;">别名: ${entry.aliases.join(" / ")}</div>` : ""}
      </div>
      <button id="poi-detail-close" style="background: none; border: 1px solid rgba(244,228,193,0.4); color: #f4e4c1; padding: 6px 10px; cursor: pointer; border-radius: 3px; font-size: 13px;">✕ 关闭</button>
    </div>
    <div style="opacity: 0.5; font-size: 11px; margin-bottom: 18px;">加载详情中…</div>
  `;
  detailPanel.style.display = "block";

  const closeBtn = document.getElementById("poi-detail-close");
  if (closeBtn) {
    closeBtn.onclick = () => {
      detailPanel.style.display = "none";
    };
  }

  try {
    const res = await fetch(`/${entry.docPath}`);
    if (!res.ok) throw new Error(`Failed to fetch ${entry.docPath}: ${res.status}`);
    const md = await res.text();
    const rendered = renderMarkdownBasic(md);

    detailPanel.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; position: sticky; top: -20px; background: rgba(15, 12, 8, 0.98); padding: 20px 0 8px; margin-top: -20px;">
        <div>
          <div style="font-size: 11px; opacity: 0.6; letter-spacing: 0.1em;">${entry.archetype.toUpperCase()}${entry.size ? " · " + entry.size : ""}${entry.variant ? " · " + entry.variant : ""}</div>
          <div style="font-size: 22px; font-weight: 600; margin-top: 2px;">${entry.displayName}</div>
          ${entry.aliases ? `<div style="opacity: 0.6; font-size: 12px; margin-top: 4px;">别名: ${entry.aliases.join(" / ")}</div>` : ""}
        </div>
        <button id="poi-detail-close" style="background: none; border: 1px solid rgba(244,228,193,0.4); color: #f4e4c1; padding: 6px 10px; cursor: pointer; border-radius: 3px; font-size: 13px;">✕ 关闭</button>
      </div>
      <div>${rendered}</div>
    `;

    const cb2 = document.getElementById("poi-detail-close");
    if (cb2) cb2.onclick = () => { detailPanel.style.display = "none"; };
  } catch (e) {
    detailPanel.innerHTML += `<div style="color: #ff8866; margin-top: 12px;">加载失败: ${(e as Error).message}</div>`;
  }
}

// ============================================================
// Raycaster (hover + click)
// ============================================================

const raycaster = new Raycaster();
const mouse = new Vector2();
let hoveredEntry: PoiEntry | null = null;

function onMouseMove(ev: MouseEvent): void {
  mouse.x = (ev.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(ev.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(poiMeshes, false);
  if (hits.length > 0) {
    const top = hits[0]!.object;
    const entry = poiEntryMap.get(top);
    if (entry) {
      hoveredEntry = entry;
      showTooltip(entry, ev.clientX, ev.clientY);
      renderer.domElement.style.cursor = "pointer";
      return;
    }
  }
  hoveredEntry = null;
  hideTooltip();
  renderer.domElement.style.cursor = "default";
}

function onClick(ev: MouseEvent): void {
  // 防止 close button 点击触发详情
  const target = ev.target as HTMLElement;
  if (target && target.id === "poi-detail-close") return;
  if (hoveredEntry) {
    void showDetail(hoveredEntry);
  }
}

renderer.domElement.addEventListener("mousemove", onMouseMove);
renderer.domElement.addEventListener("click", onClick);

// ============================================================
// OrbitControls + Resize + Render loop
// ============================================================

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 0, 0);
controls.maxPolarAngle = Math.PI * 0.49; // 不能转到地面以下

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function tick(): void {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

// ============================================================
// HUD
// ============================================================

const hud = document.createElement("div");
Object.assign(hud.style, {
  position: "fixed",
  top: "10px",
  left: "10px",
  padding: "10px 16px",
  background: "rgba(40, 30, 25, 0.85)",
  color: "#f4e4c1",
  borderRadius: "4px",
  fontFamily: "'PingFang SC', 'Helvetica Neue', sans-serif",
  fontSize: "13px",
  pointerEvents: "none",
  zIndex: "50",
} as Partial<CSSStyleDeclaration>);
hud.innerHTML = `
  <div style="font-size: 16px; font-weight: 600; margin-bottom: 4px;">大唐 755 POI 地图</div>
  <div style="opacity: 0.85; font-size: 12px;">284 个 POI · 鼠标 hover 查看 · 点击展开详情</div>
  <div style="opacity: 0.65; font-size: 11px; margin-top: 4px;">拖拽旋转视角 · 滚轮缩放 · 右键平移</div>
`;
document.body.appendChild(hud);

// ============================================================
// Boot
// ============================================================

void placePois().then(() => {
  tick();
});
