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
  updateRiverGroupShimmer,
  createOceanPlane,
  createLandMaskSamplerFromData,
  createLakeRenderer,
  loadLandMaskData,
  createMinimap,
  createDebugOverlay
} from "./game/terrain/index.js";
import { projectGeoToWorld, unprojectWorldToGeo } from "./game/mapOrientation.js";
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
// 远景雾：隐藏 DEM 数据边缘和海天交界，让世界读起来像继续延伸。
scene.fog = new Fog(0xc7d5e3, 360, 1250);

// 起始相机位置: 北京上空约 10km。
// 项目垂直比例: worldY = meters / 500 * 1.07，因此 10000m ≈ 21.4u。
const BEIJING_START_GEO = { lat: 39.9042, lon: 116.4074 };
const START_ALTITUDE_WORLD_Y = 21.4;
const startWorld = projectGeoToWorld(
  BEIJING_START_GEO,
  qinlingRegionBounds,
  qinlingRegionWorld
);
const camera = new PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  12000
);
// camera demo 强制 yaw=0/pitch=-0.3 (朝北 + 略下俯)
camera.position.set(startWorld.x, START_ALTITUDE_WORLD_Y, startWorld.z);
camera.lookAt(startWorld.x, 0, startWorld.z - 260);

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

// Natural Earth vector land mask feeds terrain hole-punching only. Rendering it
// as a flat underlay creates visible pale coastal slabs where DEM is missing.
setStatus("加载 coastline mask...");
const landMaskData = await loadLandMaskData("/data/china");
const landMaskSampler = createLandMaskSamplerFromData(landMaskData);

// bootstrap pyramid
setStatus("加载 pyramid manifest...");
const handle = await bootstrapPyramidTerrain(scene, {
  baseUrl: "/data/dem",
  viewRadiusUnits: 80,
  landMaskSampler
});

// 临时 debug (Y harmonization 验证 — 验完即删)
(window as unknown as { scene: Scene; camera: PerspectiveCamera; pyramidHandle: typeof handle }).scene = scene;
(window as unknown as { scene: Scene; camera: PerspectiveCamera; pyramidHandle: typeof handle }).camera = camera;
(window as unknown as { scene: Scene; camera: PerspectiveCamera; pyramidHandle: typeof handle }).pyramidHandle = handle;

// ocean plane —— 修 B7 海洋漫灌
// Y 压到 -3 — 陆地 fallback Y=0 牢牢遮住, 海洋区 chunks 不存在才露出
// 海岸的浅水/沙带视觉做在 terrain 顶点 (pyramidMesh.ts coast tint), 海面 shader
// 只负责 base + ripple + fresnel + (no sun glint, BotW 风).
const oceanPlane = createOceanPlane({ seaLevelY: -3 });
scene.add(oceanPlane);
const oceanWaterSurface = oceanPlane.userData.waterSurface as
  | { setTime(time: number): void; setSunDirection(direction: Vector3): void }
  | undefined;
oceanWaterSurface?.setSunDirection(sun.position.clone());

// lakes (Natural Earth 10m, 186 China lakes) — flat polygon meshes, Y 跟随 sampler
// 查 terrain 海拔 (青海湖 ~6.8u, 鄱阳湖 ~0.03u). Sampler 未加载的 chunk fallback 海平面.
const lakeHandle = await createLakeRenderer({
  baseUrl: "/data/lakes",
  sampler: handle.sampler,
  fallbackY: 0,
  surfaceLift: 0.05
});
scene.add(lakeHandle.group);
setStatus(`湖泊: ${lakeHandle.lakeCount} 个 polygon 加载`);

// 小地图
const minimap = createMinimap({ corner: "top-right", width: 240, height: 165 });

// debug overlay: 默认 hidden, 按 G 键切开（调试用 — chunk grid + 经纬度网格 + POI 桩）
const manifest = await handle.loader.loadManifest();
const debugOverlay = createDebugOverlay({
  manifest,
  geoGridStep: 5,
  chunkLabelStride: 2,
  showChunkGrid: true,
  showPois: true,
  showGeoGrid: true
});
debugOverlay.setVisible(false);
scene.add(debugOverlay.group);
let lodTintActive = false;
let flatShadingActive = false;
let beachTintActive = true;

window.addEventListener("keydown", (e) => {
  if (e.key === "g" || e.key === "G") {
    debugOverlay.setVisible(!debugOverlay.group.visible);
  }
  // D 键: 切 LOD tier 染色 debug — 鸟瞰看哪块是哪 tier (L0 绿/L1 蓝/L2 黄/L3 红)
  if (e.key === "d" || e.key === "D") {
    lodTintActive = !lodTintActive;
    handle.setDebugLodTint(lodTintActive);
    setStatus(lodTintActive
      ? "LOD 染色: L0 绿 / L1 蓝 / L2 黄 / L3 红 (再按 D 关)"
      : "LOD 染色关闭");
  }
  // F 键: 切 flatShading debug — 三角面分明 vs smooth blend
  if (e.key === "f" || e.key === "F") {
    flatShadingActive = !flatShadingActive;
    handle.setFlatShading(flatShadingActive);
    setStatus(flatShadingActive
      ? "Flat shading: 三角面分明 (再按 F 关 — 回 smooth)"
      : "Smooth shading 恢复");
  }
  // B 键: 切沙滩色带 — 对比海岸线原始颜色 vs 低平岸线轻微沙色过渡
  if (e.key === "b" || e.key === "B") {
    beachTintActive = !beachTintActive;
    handle.setBeachTint(beachTintActive);
    setStatus(beachTintActive
      ? "沙滩色带开启 (按 B 关闭对比)"
      : "沙滩色带关闭 (按 B 开启对比)");
  }
});

// rivers
const riverLoader = new RiverLoader({
  baseUrl: "/data/rivers",
  sampler: handle.sampler,
  landMaskSampler,
  excludeWaterSampler: lakeHandle.waterMaskSampler
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
  const waterTime = now * 0.001;
  oceanWaterSurface?.setTime(waterTime);
  lakeHandle.setTime(waterTime);
  for (const rh of loadedRiverGroups.values()) {
    if (rh) updateRiverGroupShimmer(rh.group, waterTime);
  }

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

    // Rivers: 跟 camera 联动 — 把相机 world 位置反求到 L0 chunk grid.
    // radius 跟相机高度联动: 平视 radius=16, 高空俯视 radius=28 (~3000km, 覆盖 LOD L2 范围)
    const camGeo = unprojectWorldToGeo(
      { x: camera.position.x, z: camera.position.z },
      qinlingRegionBounds,
      qinlingRegionWorld
    );
    const camChunkX = Math.floor((camGeo.lon - qinlingRegionBounds.west) / 1.0);
    const camChunkZ = Math.floor((qinlingRegionBounds.north - camGeo.lat) / 1.0);
    const riverRadius = camera.position.y > 100 ? 28 : camera.position.y > 40 ? 20 : 14;
    const candidates = riverLoader.findCandidateChunks(camChunkX, camChunkZ, riverRadius);
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

  // 内容 LOD: 按相机高度 4 级筛选 — 鸟瞰只看 gravity 地标, 低空才显细节
  // 河 (stream order): high=只 ord 7+, mid=6+, low=5+, ground=4+ (default)
  // 湖 (scalerank): high=≤2, mid=≤4, low=≤6, ground=全
  // 跟 BotW 三角法则一致 — 远只见标志性地理, 近见全细节.
  if (frameCounter % 12 === 0) {
    const alt = camera.position.y;
    let minRiverOrd: number;
    let maxLakeScalerank: number;
    if (alt > 300) { minRiverOrd = 7; maxLakeScalerank = 2; }
    else if (alt > 120) { minRiverOrd = 6; maxLakeScalerank = 4; }
    else if (alt > 50) { minRiverOrd = 5; maxLakeScalerank = 6; }
    else { minRiverOrd = 4; maxLakeScalerank = 99; }

    for (const rh of loadedRiverGroups.values()) {
      if (!rh) continue;
      for (const child of rh.group.children) {
        const m = child.name.match(/rivers-ord-(\d+)/);
        if (m) child.visible = Number(m[1]) >= minRiverOrd;
      }
    }
    for (const child of lakeHandle.group.children) {
      const sr = (child.userData?.scalerank as number | undefined) ?? 0;
      child.visible = sr <= maxLakeScalerank;
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
        `北京在 world(${startWorld.x.toFixed(1)}, ${startWorld.z.toFixed(1)})`
    );
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
