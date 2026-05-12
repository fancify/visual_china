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
import {
  bootstrapPyramidTerrain,
  RiverLoader,
  createOceanPlane,
  createMinimap
} from "./game/terrain/index.js";
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
scene.fog = new Fog(0xc7d5e3, 80, 800);

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
// 起始位置：岷山高原 (31.69°N 102.65°E) 验证 chunk seam 修复
// 用户之前在这看到陡崖条带
const minshan = projectGeoToWorld(
  { lat: 31.69, lon: 102.65 },
  qinlingRegionBounds,
  qinlingRegionWorld
);
camera.position.set(minshan.x, 40, minshan.z + 8);
camera.lookAt(minshan.x + 30, 0, minshan.z - 30);

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

// ocean plane —— 修 B7 海洋漫灌
// Y 压到 -3 — 陆地 fallback Y=0 牢牢遮住, 海洋区 chunks 不存在才露出
const oceanPlane = createOceanPlane({ seaLevelY: -3 });
scene.add(oceanPlane);

// 小地图
const minimap = createMinimap({ corner: "top-right", width: 240, height: 165 });

// rivers
const riverLoader = new RiverLoader({
  baseUrl: "/data/rivers",
  sampler: handle.sampler
});
await riverLoader.loadManifest();
const loadedRiverGroups = new Map<string, ReturnType<RiverLoader["getCachedChunk"]>>();

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

    // sync rivers — use camera-near chunks (rough L0 grid index)
    // camera 当前 chunk 用 lon/lat 反求
    const camGeoLon = chanan.x; // placeholder; use camera world XZ → lon/lat
    // simpler: iterate manifest entries within world distance
    const candidates = riverLoader.findCandidateChunks(40, 18, 3); // 长安附近 L0 chunk ~40,18
    for (const { x, z } of candidates) {
      const key = `${x}:${z}`;
      if (loadedRiverGroups.has(key)) continue;
      void riverLoader.requestChunk(x, z).then((rh) => {
        if (!rh) return;
        if (loadedRiverGroups.has(key)) return;
        scene.add(rh.group);
        loadedRiverGroups.set(key, rh);
      });
    }
  }

  // minimap (每 6 帧更新一次足够)
  if (frameCounter % 6 === 0) {
    minimap.update(camera.position.x, camera.position.z, yaw);
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
