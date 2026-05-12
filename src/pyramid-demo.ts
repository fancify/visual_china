// pyramid-demo.ts —
//
// 独立 demo 页面：验证 P3 pyramid renderer 在浏览器跑通。
// 不依赖 main.ts，可对照旧版（index.html）独立看效果。
//
// 访问: http://localhost:5173/pyramid-demo.html

import {
  AmbientLight,
  Color,
  DirectionalLight,
  Fog,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer
} from "three";
import { bootstrapPyramidTerrain } from "./game/terrain/index.js";
import { projectGeoToWorld } from "./game/mapOrientation.js";
import {
  qinlingRegionBounds,
  qinlingRegionWorld
} from "./data/qinlingRegion.js";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const statusBody = document.getElementById("status-body")!;

function setStatus(text: string): void {
  statusBody.innerHTML = text;
}

const scene = new Scene();
// 长安三万里 暖金色天 调色
scene.background = new Color(0xc7d5e3);
// fog: 近景清晰 (50u) → 远景化在 350u（约 1100km 视距）淡化进背景色
scene.fog = new Fog(0xc7d5e3, 60, 350);

// 起始相机位置: 长安 (西安) 上空
const chanan = projectGeoToWorld(
  { lat: 34.27, lon: 108.95 },
  qinlingRegionBounds,
  qinlingRegionWorld
);
const camera = new PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  3000
);
camera.position.set(chanan.x, 40, chanan.z + 30);
camera.lookAt(chanan.x, 0, chanan.z);

// 灯：盛唐金光（《长安三万里》参考）
const ambient = new AmbientLight(0xfff0d4, 0.45);
scene.add(ambient);
const sun = new DirectionalLight(0xffeab8, 1.05); // 偏暖金
sun.position.set(60, 110, 40);
scene.add(sun);

// renderer
const renderer = new WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// keys
const keys = new Set<string>();
window.addEventListener("keydown", (e) => keys.add(e.key.toLowerCase()));
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

// mouse
let pointerDown = false;
let lastMouse: { x: number; y: number } = { x: 0, y: 0 };
let yaw = 0;
let pitch = -0.3;
canvas.addEventListener("pointerdown", (e) => {
  pointerDown = true;
  lastMouse = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener("pointerup", () => (pointerDown = false));
canvas.addEventListener("pointermove", (e) => {
  if (!pointerDown) return;
  const dx = e.clientX - lastMouse.x;
  const dy = e.clientY - lastMouse.y;
  yaw -= dx * 0.005;
  pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, pitch - dy * 0.005));
  lastMouse = { x: e.clientX, y: e.clientY };
});

// bootstrap pyramid
setStatus("加载 pyramid manifest...");
const handle = await bootstrapPyramidTerrain(scene, {
  baseUrl: "/data/dem",
  viewRadiusUnits: 80
});
setStatus("已加载 manifest，开始流式 chunks...");

// frame loop
const moveSpeed = 1.5;
let lastFrame = performance.now();
let frameCounter = 0;
function animate(): void {
  const now = performance.now();
  const dt = (now - lastFrame) / 1000;
  lastFrame = now;
  frameCounter += 1;

  // movement
  const fwd = new Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const right = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const v = moveSpeed * dt * 60;
  if (keys.has("w") || keys.has("arrowup")) camera.position.addScaledVector(fwd, v);
  if (keys.has("s") || keys.has("arrowdown")) camera.position.addScaledVector(fwd, -v);
  if (keys.has("a") || keys.has("arrowleft")) camera.position.addScaledVector(right, -v);
  if (keys.has("d") || keys.has("arrowright")) camera.position.addScaledVector(right, v);
  if (keys.has("e")) camera.position.y += v;
  if (keys.has("q")) camera.position.y -= v;
  if (keys.has("shift")) {
    // boost
    if (keys.has("w") || keys.has("arrowup")) camera.position.addScaledVector(fwd, v * 4);
  }

  // look
  const forward = new Vector3(
    -Math.cos(pitch) * Math.sin(yaw),
    Math.sin(pitch),
    -Math.cos(pitch) * Math.cos(yaw)
  );
  camera.lookAt(
    camera.position.x + forward.x,
    camera.position.y + forward.y,
    camera.position.z + forward.z
  );

  // update pyramid (visible chunks)
  if (frameCounter % 10 === 0) {
    handle.updateVisible(camera, scene);
  }

  // status
  if (frameCounter % 30 === 0) {
    const cacheN = handle.loader.cacheSize();
    setStatus(
      `相机 world(${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)})<br />` +
        `cache: ${cacheN} chunks<br />` +
        `FPS: ${(1 / dt).toFixed(0)}<br />` +
        `长安在 world(${chanan.x.toFixed(1)}, ${chanan.z.toFixed(1)})`
    );
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
