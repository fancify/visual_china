/**
 * POI Archetype Demo
 *
 * 展示 8 类 archetype × 各 variant = 17 个 placeholder 模型, 网格排布。
 * 鼠标 OrbitControls; 每个 model 下方 HTML overlay label 显示名字。
 */

import "./style.css";

import {
  AmbientLight,
  Color,
  DirectionalLight,
  GridHelper,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import {
  listAllArchetypeVariants,
  resolvePoiModel,
} from "./game/poi/models/registry.js";

const app = document.getElementById("app");
if (!app) throw new Error("#app element not found");

// === Scene 基础 ===
const scene = new Scene();
scene.background = new Color(0xc8c4ba); // 略带暖色的浅米色 (唐绢底色感)

const camera = new PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  500
);
camera.position.set(30, 22, 30);
camera.lookAt(0, 0, 0);

const renderer = new WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false;
app.appendChild(renderer.domElement);

// === Lights ===
const ambient = new AmbientLight(0xffffff, 0.55);
scene.add(ambient);

const sun = new DirectionalLight(0xfff4e0, 0.85);
sun.position.set(10, 20, 8);
scene.add(sun);

// === Ground ===
const ground = new Mesh(
  new PlaneGeometry(80, 80),
  new MeshBasicMaterial({ color: 0xa8a294 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.05;
scene.add(ground);

const grid = new GridHelper(80, 16, 0x8b8474, 0x8b8474);
(grid.material as { opacity?: number; transparent?: boolean }).opacity = 0.25;
(grid.material as { opacity?: number; transparent?: boolean }).transparent =
  true;
scene.add(grid);

// === Lay out models in a 5×4 grid ===
const entries = listAllArchetypeVariants();
const cellSize = 10;
const cols = 5;

// HTML overlay for labels
const labelLayer = document.createElement("div");
labelLayer.style.position = "fixed";
labelLayer.style.top = "0";
labelLayer.style.left = "0";
labelLayer.style.width = "100%";
labelLayer.style.height = "100%";
labelLayer.style.pointerEvents = "none";
labelLayer.style.fontFamily = "'PingFang SC', 'Helvetica Neue', sans-serif";
document.body.appendChild(labelLayer);

const labelMeta: Array<{ el: HTMLElement; pos: Vector3 }> = [];

entries.forEach((entry, idx) => {
  const col = idx % cols;
  const row = Math.floor(idx / cols);
  const x = (col - (cols - 1) / 2) * cellSize;
  const z = (row - 1) * cellSize;

  const builder = resolvePoiModel(entry);
  const group = builder();
  group.position.set(x, 0, z);
  scene.add(group);

  // Label
  const label = document.createElement("div");
  label.style.position = "absolute";
  label.style.transform = "translate(-50%, 0)";
  label.style.padding = "4px 10px";
  label.style.background = "rgba(40, 30, 25, 0.75)";
  label.style.color = "#f4e4c1";
  label.style.borderRadius = "3px";
  label.style.fontSize = "13px";
  label.style.whiteSpace = "nowrap";
  label.style.letterSpacing = "0.05em";

  // 显示文本: archetype + variant/size (中文友好)
  const labelText = formatLabel(entry);
  label.textContent = labelText;
  labelLayer.appendChild(label);

  labelMeta.push({
    el: label,
    pos: new Vector3(x, -0.2, z + 4), // 模型下方稍前
  });
});

function formatLabel(entry: {
  archetype: string;
  size?: string;
  variant?: string;
}): string {
  const cn: Record<string, string> = {
    city: "城市",
    mountain: "山水",
    mausoleum: "陵墓",
    ruin: "废墟",
    pass: "关塞",
    temple: "寺观",
    cave: "石窟",
    node: "节点",
  };
  const variantCn: Record<string, string> = {
    small: "小型",
    medium: "中型",
    large: "大型",
    tomb: "一般墓",
    imperial: "帝陵",
    minor: "一般关",
    major: "重关",
    small_temple: "小寺",
    grand: "大寺",
    taoist: "道观",
    bridge: "桥",
    ferry: "渡口",
    port: "港口",
    tower: "名楼",
  };
  const base = cn[entry.archetype] ?? entry.archetype;
  const sub = entry.size ?? entry.variant;
  return sub && variantCn[sub] ? `${base} · ${variantCn[sub]}` : base;
}

// === OrbitControls ===
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 1, 0);

// === Resize ===
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// === Render loop ===
function update3DToScreen(world: Vector3): { x: number; y: number; visible: boolean } {
  const p = world.clone().project(camera);
  const visible = p.z > -1 && p.z < 1;
  return {
    x: (p.x * 0.5 + 0.5) * window.innerWidth,
    y: (-p.y * 0.5 + 0.5) * window.innerHeight,
    visible,
  };
}

function tick(): void {
  controls.update();

  // Update label positions
  for (const meta of labelMeta) {
    const screen = update3DToScreen(meta.pos);
    if (screen.visible) {
      meta.el.style.display = "";
      meta.el.style.left = `${screen.x}px`;
      meta.el.style.top = `${screen.y}px`;
    } else {
      meta.el.style.display = "none";
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

// === Header HUD ===
const hud = document.createElement("div");
hud.style.position = "fixed";
hud.style.top = "10px";
hud.style.left = "10px";
hud.style.padding = "8px 14px";
hud.style.background = "rgba(40, 30, 25, 0.78)";
hud.style.color = "#f4e4c1";
hud.style.borderRadius = "4px";
hud.style.fontFamily = "'PingFang SC', 'Helvetica Neue', sans-serif";
hud.style.fontSize = "13px";
hud.style.pointerEvents = "none";
hud.innerHTML = `
  <div style="font-size: 15px; font-weight: 500; margin-bottom: 4px;">大唐 755 POI 视觉原型库</div>
  <div style="opacity: 0.85;">8 类 archetype × 17 variant — 鼠标拖拽旋转 / 滚轮缩放</div>
`;
document.body.appendChild(hud);
