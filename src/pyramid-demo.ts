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
  Vector2,
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
import { createPoiArchetypeLayer } from "./game/terrain/poiArchetypeLayer.js";
import { createSkyDome } from "./game/atmosphereLayer.js";
import { createCloudLayer } from "./game/cloudPlanes.js";
import {
  EnvironmentController,
  type Season,
  type Weather
} from "./game/environment.js";
import {
  advancePyramidTimePreset,
  applyPyramidEnvironmentRuntime,
  pyramidEnvironmentStatus
} from "./game/pyramidEnvironmentRuntime.js";
import { WindManager } from "./game/windManager.js";
import { setTerrainStyle, getTerrainPalette } from "./game/terrain/terrainStyle.js";
import { projectGeoToWorld, unprojectWorldToGeo } from "./game/mapOrientation.js";
import {
  qinlingRegionBounds,
  qinlingRegionWorld
} from "./data/qinlingRegion.js";
import tangThreeHundredPoems from "./data/tangThreeHundredPoems.json";
import {
  applyCameraFollowPose,
  applyCharacterEmissive,
  cameraFollowPoseForCharacterPlayer,
  characterEmissive,
  characterInputFromKeySet,
  characterMountOffsets,
  createCharacterPlayerRuntime
} from "./game/player/characterRuntime.js";
import type { TierName } from "./game/terrain/pyramidTypes.js";
import { createInputManager } from "./game/input/InputManager.js";
import { createDebugPanel } from "./game/input/DebugPanel.js";
import { tintCloudFlightVisual } from "./game/skeletal/flightVisuals.js";
import { createPyramidPoiHud } from "./game/pyramidPoiHud.js";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const statusBody = document.getElementById("status-body")!;
const preload = document.getElementById("preload")!;
const preloadPoem = document.getElementById("preload-poem")!;
const preloadPoemMeta = document.getElementById("preload-poem-meta")!;
const preloadMeta = document.getElementById("preload-meta")!;
const preloadBar = document.getElementById("preload-bar") as HTMLDivElement;
const poiPointerNdc = new Vector2();
let poiPointerActive = false;
let lastHoveredPoiId: string | null = null;
let lastPoiPointerClient: { clientX: number; clientY: number } | null = null;
let latestStatusMessage = "加载中...";
let latestNearbyPoiDebug: string | undefined;

function setStatus(text: string): void {
  latestStatusMessage = text.replace(/<br\s*\/?>/g, " · ").replace(/<[^>]+>/g, "");
  statusBody.innerHTML = text;
}

function truncateDebugText(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, Math.max(0, maxLength - 1))}…` : text;
}

const POEM_ROTATION_MS = 15_000;
let currentPreloadPoemIndex = -1;

function stripPoemParentheticals(text: string): string {
  return text
    .replace(/（[^）]*）/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/【[^】]*】/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/[\uFF08\uFF09()\[\]【】]+/g, "");
}

function sanitizePoemText(text: string): string {
  if (/一作|通：|又作|或作/.test(text)) return "";
  return stripPoemParentheticals(text)
    .replace(/\s+/g, "")
    .trim();
}

function splitPoemIntoSentenceLines(lines: string[]): string[] {
  const text = lines.map(sanitizePoemText).filter(Boolean).join("");
  const sentenceLines = text.match(/[^。！？!?]+[。！？!?]/g)?.map((line) => line.trim()) ?? [];
  if (sentenceLines.length > 0) return sentenceLines;
  return lines.map(sanitizePoemText).filter(Boolean);
}

function showRandomPreloadPoem(): void {
  let index = Math.floor(Math.random() * tangThreeHundredPoems.length);
  if (tangThreeHundredPoems.length > 1 && index === currentPreloadPoemIndex) {
    index = (index + 1) % tangThreeHundredPoems.length;
  }
  currentPreloadPoemIndex = index;
  const poem = tangThreeHundredPoems[index];
  const lines = splitPoemIntoSentenceLines(poem.lines);
  preloadPoem.textContent = lines.join("\n");
  preloadPoemMeta.textContent = `${poem.author}《${sanitizePoemText(poem.title)}》 · ${poem.eraName}（${poem.yearLabel}）`;
}

showRandomPreloadPoem();
const preloadPoemTimer = window.setInterval(showRandomPreloadPoem, POEM_ROTATION_MS);

let preloadTargetProgress = 0;
let preloadDisplayedProgress = 0;
let preloadProgressRaf = 0;

function animatePreloadProgress(): void {
  preloadDisplayedProgress += (preloadTargetProgress - preloadDisplayedProgress) * 0.08;
  if (Math.abs(preloadTargetProgress - preloadDisplayedProgress) < 0.002) {
    preloadDisplayedProgress = preloadTargetProgress;
  }
  preloadBar.style.width = `${Math.round(preloadDisplayedProgress * 1000) / 10}%`;
  if (preloadDisplayedProgress < 1 || preloadTargetProgress < 1) {
    preloadProgressRaf = requestAnimationFrame(animatePreloadProgress);
  }
}

function setPreloadProgress(progress: number, text: string): void {
  preloadMeta.textContent = text;
  preloadTargetProgress = Math.max(preloadTargetProgress, Math.max(0, Math.min(1, progress)));
  if (!preloadProgressRaf) preloadProgressRaf = requestAnimationFrame(animatePreloadProgress);
}

function hidePreload(): void {
  if (preloadProgressRaf) cancelAnimationFrame(preloadProgressRaf);
  window.clearInterval(preloadPoemTimer);
  preloadBar.style.width = "100%";
  preload.classList.add("hidden");
}

const scene = new Scene();
// 从当前 terrain style 读取初始 fog/background
const _initPalette = getTerrainPalette();
scene.background = _initPalette.fogColor;
scene.fog = new Fog(_initPalette.fogColor, _initPalette.fogNear, _initPalette.fogFar);

// 起始位置: 唐 755 长安。
const CHANGAN_START_GEO = { lat: 34.27, lon: 108.95 };
const DEMO_VIEW_RADIUS_UNITS = 360;
const GROUND_CAMERA_DISTANCE = 22;
const FLIGHT_CAMERA_DISTANCE = 34;
const CLOSE_CAMERA_DISTANCE = 3.2;       // F 键拉近：与人物等高水平视角的舒适距离
const CAMERA_OVERRIDE_MIN = 0.5;         // 滚轮在 override 模式下最近 0.5m（贴脸）
const CAMERA_OVERRIDE_MAX = 90;
const DEFAULT_CAMERA_PITCH = 0;          // 水平视角（不俯视），让 horizon 在角色头部高度
// pitch 范围放宽到 ≈ [-85°, +85°]——近乎全 sphere，可一直拖到天顶看天
const CAMERA_PITCH_MIN = -Math.PI / 2 + 0.1;
const CAMERA_PITCH_MAX = Math.PI / 2 - 0.1;
const MOUSE_YAW_SENSITIVITY = 0.005;
const MOUSE_PITCH_SENSITIVITY = 0.004;
const CAMERA_ZOOM_MIN = 0.55;
const CAMERA_ZOOM_MAX = 2.4;
const PLAYER_TURN_SPEED = 2.2;
const startWorld = projectGeoToWorld(
  CHANGAN_START_GEO,
  qinlingRegionBounds,
  qinlingRegionWorld
);
const camera = new PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  12000
);
camera.position.set(startWorld.x, 1.6, startWorld.z);
camera.lookAt(startWorld.x, 0, startWorld.z);

// 灯：盛唐金光（《长安三万里》参考）
const ambient = new AmbientLight(0xfff0d4, 0.45);
scene.add(ambient);
const sun = new DirectionalLight(0xffeab8, 1.05); // 偏暖金
sun.position.set(60, 110, 40);
scene.add(sun);
const moonLight = new DirectionalLight(0xb9cfff, 0.18);
moonLight.position.set(-60, 80, -40);
scene.add(moonLight);
const rimLight = new DirectionalLight(0x86b5c0, 0.18);
rimLight.position.set(-80, 45, 100);
scene.add(rimLight);

const environmentController = new EnvironmentController();
const query = new URLSearchParams(window.location.search);
const queryWeather = query.get("weather");
const querySeason = query.get("season");
const queryTime = Number(query.get("time"));
if (Number.isFinite(queryTime) && queryTime >= 0 && queryTime < 24) {
  environmentController.state.timeOfDay = queryTime;
}
if (querySeason && ["spring", "summer", "autumn", "winter"].includes(querySeason)) {
  environmentController.state.season = querySeason as Season;
}
if (queryWeather && ["clear", "windy", "cloudy", "rain", "storm", "snow", "mist"].includes(queryWeather)) {
  environmentController.setWeather(queryWeather as Weather, 0);
}
const windManager = new WindManager();
const skyDome = createSkyDome();
scene.add(skyDome.group);
const cloudLayer = createCloudLayer();
scene.add(cloudLayer.group);
let cloudDriftSeconds = 0;

// renderer
const renderer = new WebGLRenderer({ canvas, antialias: true });
const MAX_RENDER_PIXEL_RATIO = 1.5;
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_RENDER_PIXEL_RATIO));
let oceanWaterSurface:
  | {
      setTime(time: number): void;
      setSunDirection(direction: Vector3): void;
      setShimmerStrength?(strength: number): void;
      setBaseColor?(color: Color): void;
      setOpacity?(opacity: number): void;
    }
  | undefined;
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
function syncPyramidEnvironment(elapsedSeconds: number, deltaSeconds: number): void {
  applyPyramidEnvironmentRuntime({
    environment: environmentController,
    cameraPosition: camera.position,
    elapsedSeconds,
    deltaSeconds,
    fog: scene.fog as Fog,
    ambientLight: ambient,
    sunLight: sun,
    moonLight,
    rimLight,
    renderer,
    skyDome,
    oceanWaterSurface,
    cloud: {
      layer: cloudLayer,
      driftSeconds: cloudDriftSeconds,
      windDirection: windManager.uniforms.direction.value,
      updateDriftSeconds(nextDriftSeconds) {
        cloudDriftSeconds = nextDriftSeconds;
      }
    }
  });
}
syncPyramidEnvironment(performance.now() * 0.001, 0);
renderer.render(scene, camera);

// 输入：所有键位 SSOT 在 src/game/input/bindings.ts；改键改那里。
const inputManager = createInputManager({ pointerTarget: canvas });

// alt+digit 动画 clip 选择保留为 legacy 路径（直接喂给 characterInputFromKeySet）。
// 未来 DebugPanel 加一个 clip 下拉就可以彻底删掉。
const legacyAltDigitKeys = new Set<string>();
window.addEventListener("keydown", (e) => {
  if (e.altKey && /^Digit[1-9]$/.test(e.code)) {
    legacyAltDigitKeys.add(`alt+${e.code.slice(5)}`);
    e.preventDefault();
  }
});
window.addEventListener("keyup", (e) => {
  if (/^Digit[1-9]$/.test(e.code)) {
    legacyAltDigitKeys.delete(`alt+${e.code.slice(5)}`);
  }
});

// 2026-05-15 v2: 完全解耦镜头方位 + camera-relative 移动
//   - cameraAzimuth：镜头围绕角色的"世界绝对角度"（鼠标 X + Q/E 驱动）
//   - cameraPitch：镜头俯仰（鼠标 Y 驱动）
//   - characterHeading：角色当前朝向；由 WASD 决定（W = 沿镜头 forward 走）
//   - 三者互不影响。鼠标只动镜头、键盘只动人物。
//
// 历史对比：之前 cameraYaw 是"相对 heading 偏移"，camera 跟人物转一起转——会导致
// 转人物时画面跟着甩；现在拆成绝对角度，转人物时镜头位置不变。
let characterHeading = 0;
let cameraAzimuth = 0;
let cameraPitch = DEFAULT_CAMERA_PITCH;
let cameraDistanceScale = 1;
let cameraDistanceOverride: number | null = CLOSE_CAMERA_DISTANCE;
function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// LMB 或 RMB 拖拽 — X 反向（match BotW/WoW/Skyrim: 右拖 = 镜头绕人物 CW，世界往左飘）
inputManager.on("camera.rotate", (payload) => {
  if (payload.kind !== "drag") return;
  cameraAzimuth -= payload.deltaX * MOUSE_YAW_SENSITIVITY;
  cameraPitch = clampNumber(
    cameraPitch + payload.deltaY * MOUSE_PITCH_SENSITIVITY,
    CAMERA_PITCH_MIN,
    CAMERA_PITCH_MAX
  );
});

inputManager.on("camera.zoom", (payload) => {
  if (payload.kind !== "wheel") return;
  const zoomStep = payload.delta > 0 ? 1.1 : 0.9;
  if (cameraDistanceOverride !== null) {
    cameraDistanceOverride = clampNumber(
      cameraDistanceOverride * zoomStep,
      CAMERA_OVERRIDE_MIN,
      CAMERA_OVERRIDE_MAX
    );
  } else {
    // 滚轮缩到 scale*GROUND_DIST <= CLOSE_CAMERA_DISTANCE 时切到 override 模式继续往内推
    const nextScale = cameraDistanceScale * zoomStep;
    const minNonOverrideDistance = GROUND_CAMERA_DISTANCE * CAMERA_ZOOM_MIN;
    if (nextScale * GROUND_CAMERA_DISTANCE < minNonOverrideDistance && zoomStep < 1) {
      // 切到 override 继续往近推
      cameraDistanceOverride = minNonOverrideDistance * zoomStep;
    } else {
      cameraDistanceScale = clampNumber(nextScale, CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX);
    }
  }
});

inputManager.on("camera.followReset", () => {
  // F 键：完整复位 — 镜头到人物正后上方，人物屏幕居中
  cameraDistanceOverride = CLOSE_CAMERA_DISTANCE;
  cameraDistanceScale = 1;
  cameraAzimuth = characterHeading;     // 镜头位置与人物朝向一致 (正后方)
  cameraPitch = DEFAULT_CAMERA_PITCH;
  setStatus(`镜头复位: 正后方 ${CLOSE_CAMERA_DISTANCE}m 靠上`);
});

inputManager.on("camera.overview", () => {
  cameraDistanceOverride = null;
  cameraDistanceScale = CAMERA_ZOOM_MAX;
  setStatus("鸟瞰模式");
});

// V — 沉浸模式 (pointer lock)：原生 PointerLock API。Esc 自动释放。
let immersionLocked = false;
inputManager.on("camera.toggleImmersion", () => {
  if (immersionLocked) {
    document.exitPointerLock?.();
  } else {
    canvas.requestPointerLock?.();
  }
});
document.addEventListener("pointerlockchange", () => {
  immersionLocked = document.pointerLockElement === canvas;
  setStatus(immersionLocked ? "沉浸模式: 鼠标已锁定 (Esc 退出)" : "沉浸模式退出");
});
// 沉浸模式下 mousemove 直接更新 cameraAzimuth / cameraPitch（pointer lock 不会 fire drag）
window.addEventListener("mousemove", (e) => {
  if (!immersionLocked) return;
  cameraAzimuth -= e.movementX * 0.003;
  cameraPitch = clampNumber(
    cameraPitch + e.movementY * 0.0025,
    CAMERA_PITCH_MIN,
    CAMERA_PITCH_MAX
  );
});

// Natural Earth vector land mask feeds terrain hole-punching only. Rendering it
// as a flat underlay creates visible pale coastal slabs where DEM is missing.
setPreloadProgress(0.05, "读取海岸线...");
setStatus("加载 coastline mask...");
const landMaskData = await loadLandMaskData("/data/china");
const landMaskSampler = createLandMaskSamplerFromData(landMaskData);

// bootstrap pyramid
setPreloadProgress(0.12, "读取地形索引...");
setStatus("加载 pyramid manifest...");
const handle = await bootstrapPyramidTerrain(scene, {
  baseUrl: "/data/dem",
  viewRadiusUnits: DEMO_VIEW_RADIUS_UNITS,
  landMaskSampler
});
// Keep the nationwide L3 backdrop, but switch to coarser terrain sooner in the
// character demo. At Beijing start this cuts the active terrain set from about
// 155 chunks to about 94 without reintroducing missing-tile holes.
handle.setLodBands([60, 120, 180]);
// 初始 terrain style 的 flat shading
if (_initPalette.flatShading) handle.setFlatShading(true);

const terrainManifest = await handle.loader.loadManifest();

function currentL0Chunk(): { x: number; z: number } {
  const l0 = terrainManifest.tiers.L0;
  return {
    x: Math.floor((CHANGAN_START_GEO.lon - terrainManifest.bounds.west) / l0.chunkSizeDeg),
    z: Math.floor((terrainManifest.bounds.north - CHANGAN_START_GEO.lat) / l0.chunkSizeDeg)
  };
}

function l0WindowForStart(viewRadiusUnits: number): { xMin: number; xMax: number; zMin: number; zMax: number } {
  const l0 = terrainManifest.tiers.L0;
  const westGeo = unprojectWorldToGeo(
    { x: startWorld.x - viewRadiusUnits, z: startWorld.z },
    qinlingRegionBounds,
    qinlingRegionWorld
  );
  const eastGeo = unprojectWorldToGeo(
    { x: startWorld.x + viewRadiusUnits, z: startWorld.z },
    qinlingRegionBounds,
    qinlingRegionWorld
  );
  const northGeo = unprojectWorldToGeo(
    { x: startWorld.x, z: startWorld.z - viewRadiusUnits },
    qinlingRegionBounds,
    qinlingRegionWorld
  );
  const southGeo = unprojectWorldToGeo(
    { x: startWorld.x, z: startWorld.z + viewRadiusUnits },
    qinlingRegionBounds,
    qinlingRegionWorld
  );
  const west = Math.min(westGeo.lon, eastGeo.lon);
  const east = Math.max(westGeo.lon, eastGeo.lon);
  const north = Math.max(northGeo.lat, southGeo.lat);
  const south = Math.min(northGeo.lat, southGeo.lat);
  return {
    xMin: Math.max(l0.chunkRangeX[0], Math.floor((west - terrainManifest.bounds.west) / l0.chunkSizeDeg) - 1),
    xMax: Math.min(l0.chunkRangeX[1], Math.floor((east - terrainManifest.bounds.west) / l0.chunkSizeDeg) + 1),
    zMin: Math.max(l0.chunkRangeZ[0], Math.floor((terrainManifest.bounds.north - north) / l0.chunkSizeDeg) - 1),
    zMax: Math.min(l0.chunkRangeZ[1], Math.floor((terrainManifest.bounds.north - south) / l0.chunkSizeDeg) + 1)
  };
}

async function preloadTerrainChunks(chunks: { tier: TierName; x: number; z: number }[]): Promise<void> {
  await Promise.all(chunks.map(({ tier, x, z }) => handle.loader.requestChunk(tier, x, z)));
}

setPreloadProgress(0.22, "加载出生点附近 L0...");
const center = currentL0Chunk();
const coreL0: { tier: TierName; x: number; z: number }[] = [];
for (let x = center.x - 1; x <= center.x + 1; x += 1) {
  for (let z = center.z - 1; z <= center.z + 1; z += 1) {
    if (handle.loader.chunkExists("L0", x, z)) coreL0.push({ tier: "L0", x, z });
  }
}
await preloadTerrainChunks(coreL0);

setPreloadProgress(0.48, "加载远景 L3...");
const l3Keys = new Set<string>();
for (const chunk of terrainManifest.tiers.L3.chunks ?? []) {
  l3Keys.add(`${chunk.x}:${chunk.z}`);
}
const startWindow = l0WindowForStart(DEMO_VIEW_RADIUS_UNITS);
for (let x = startWindow.xMin; x <= startWindow.xMax; x += 1) {
  for (let z = startWindow.zMin; z <= startWindow.zMax; z += 1) {
    l3Keys.add(`${x >> 3}:${z >> 3}`);
  }
}
const fallbackL3 = Array.from(l3Keys)
  .map((key) => {
    const [x, z] = key.split(":").map(Number);
    return { tier: "L3" as TierName, x, z };
  })
  .filter(({ x, z }) => handle.loader.chunkExists("L3", x, z));
await preloadTerrainChunks(fallbackL3);

setPreloadProgress(0.58, "构建预览地形...");
await handle.updateVisibleAsync(camera, scene);
renderer.render(scene, camera);

// ocean plane —— 修 B7 海洋漫灌
// Y 压到 -3 — 陆地 fallback Y=0 牢牢遮住, 海洋区 chunks 不存在才露出
// 海岸的浅水/沙带视觉做在 terrain 顶点 (pyramidMesh.ts coast tint), 海面 shader
// 只负责 base + ripple + fresnel + (no sun glint, BotW 风).
const oceanPlane = createOceanPlane({ seaLevelY: -3 });
scene.add(oceanPlane);
oceanWaterSurface = oceanPlane.userData.waterSurface as typeof oceanWaterSurface;
oceanWaterSurface?.setSunDirection(sun.position.clone());
// 初始 water palette
oceanWaterSurface?.setBaseColor?.(_initPalette.water.oceanColor);
oceanWaterSurface?.setOpacity?.(_initPalette.water.oceanOpacity);

// lakes (Natural Earth 10m, 186 China lakes) — flat polygon meshes, Y 跟随 sampler
// 查 terrain 海拔 (青海湖 ~6.8u, 鄱阳湖 ~0.03u). Sampler 未加载的 chunk fallback 海平面.
setPreloadProgress(0.72, "加载湖泊与水面...");
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

setPreloadProgress(0.78, "加载角色与飞行器...");
const playerRuntime = await createCharacterPlayerRuntime({
  scene,
  sampler: {
    sampleSurfaceHeight(x: number, z: number): number {
      return handle.sampler.sampleHeightWorld(x, z);
    }
  },
  initialPosition: { x: startWorld.x, z: startWorld.z },
  search: window.location.search
});

function syncCameraToPlayer(): void {
  const playerPosition = playerRuntime.position();
  const baseDistance = playerRuntime.travelMode() === "ground"
    ? GROUND_CAMERA_DISTANCE
    : FLIGHT_CAMERA_DISTANCE;
  const cameraDistance = cameraDistanceOverride ?? baseDistance * cameraDistanceScale;
  // 解耦：pose function 的 azimuth = heading + cameraYaw；我们传 heading=0、
  // cameraYaw=cameraAzimuth 让镜头方位完全由 cameraAzimuth 决定（绝对世界角）
  const pose = cameraFollowPoseForCharacterPlayer({
    target: playerPosition,
    heading: 0,
    cameraYaw: cameraAzimuth,
    cameraPitch,
    distance: cameraDistance,
    height: playerRuntime.travelMode() === "ground" ? 3.2 : 6.5
  });
  applyCameraFollowPose(camera, pose);
}

syncCameraToPlayer();

// debug overlay 句柄；DebugPanel 通过下面的 toggle 回调控制可见性。
let debugOverlay: ReturnType<typeof createDebugOverlay> | null = null;
let lastFpsSample = 60;

const debugPanel = createDebugPanel({
  onFlatShadingToggle(active) {
    handle.setFlatShading(active);
  },
  onLodTintToggle(active) {
    handle.setDebugLodTint(active);
  },
  onOverlayToggle(active) {
    if (debugOverlay) debugOverlay.setVisible(active);
    else setStatus("调试层后台加载中...");
  },
  onBeachTintToggle(active) {
    handle.setBeachTint(active);
  },
  onTerrainStyleChange(style) {
    const p = setTerrainStyle(style);
    // 地形 vertex colors
    handle.refreshAllColors();
    // fog + background
    scene.background = p.fogColor;
    (scene.fog as Fog).color.copy(p.fogColor);
    (scene.fog as Fog).near = p.fogNear;
    (scene.fog as Fog).far = p.fogFar;
    // flat shading（lowpoly 自动开）
    handle.setFlatShading(p.flatShading);
    debugPanel.setFlatShading(p.flatShading);
    // 水体颜色
    const w = p.water;
    oceanWaterSurface?.setBaseColor?.(w.oceanColor);
    oceanWaterSurface?.setOpacity?.(w.oceanOpacity);
    // 湖泊
    const lakeWS = lakeHandle.group.userData.waterSurface as
      { setBaseColor?(c: Color): void; setOpacity?(o: number): void } | undefined;
    lakeWS?.setBaseColor?.(w.lakeColor);
    lakeWS?.setOpacity?.(w.lakeOpacity);
    // 河流（LineMaterial.color + userData.waterBaseColor）
    for (const rh of loadedRiverGroups.values()) {
      if (!rh?.group) continue;
      rh.group.traverse((obj: import("three").Object3D) => {
        const mat = (obj as any).material as import("three/examples/jsm/lines/LineMaterial.js").LineMaterial | undefined;
        if (!mat?.userData?.waterBaseColor) return;
        (mat.userData.waterBaseColor as Color).copy(w.riverColor);
        mat.userData.waterBaseOpacity = w.riverOpacity;
        mat.color.copy(w.riverColor);
        mat.opacity = w.riverOpacity;
        mat.needsUpdate = true;
      });
    }
  },
  onGroundOffsetChange(v) {
    characterMountOffsets.ground = v;
  },
  onSwordOffsetChange(v) {
    characterMountOffsets.sword = v;
  },
  onCloudOffsetChange(v) {
    characterMountOffsets.cloud = v;
  },
  initialMountOffsets: {
    ground: characterMountOffsets.ground,
    sword: characterMountOffsets.sword,
    cloud: characterMountOffsets.cloud
  },
  onCharacterEmissiveChange(v) {
    characterEmissive.intensity = v;
    applyCharacterEmissive();
  },
  initialCharacterEmissive: characterEmissive.intensity,
  onTimeChange(hour) {
    environmentController.state.timeOfDay = hour;
  },
  onWeatherChange(weather) {
    environmentController.setWeather(weather);
  },
  onSeasonChange(season) {
    environmentController.state.season = season;
  },
  getStats() {
    const playerState = playerRuntime.snapshot();
    return {
      fps: lastFpsSample,
      chunks: handle.loader.cacheSize(),
      timeOfDay: environmentController.state.timeOfDay,
      weather: environmentController.state.weather,
      season: environmentController.state.season,
      player: `${playerState.travelMode} · ${playerState.movementMode} · speed ${playerState.speed.toFixed(2)}`,
      playerWorld: `${playerState.position.x.toFixed(1)}, ${playerState.position.y.toFixed(1)}, ${playerState.position.z.toFixed(1)}`,
      cameraWorld: `${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)}`,
      nearbyPoi: latestNearbyPoiDebug,
      message: truncateDebugText(latestStatusMessage, 88)
    };
  }
});
// 同步初始状态
debugPanel.setBeachTint(true);

const poiLayer = createPoiArchetypeLayer({
  sampler: handle.sampler,
  maxPois: 180
});
scene.add(poiLayer.group);
const poiHud = createPyramidPoiHud(document.body);

function updatePoiPointerFromClient(clientX: number, clientY: number): boolean {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  poiPointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  poiPointerNdc.y = -(((clientY - rect.top) / rect.height) * 2 - 1);
  return true;
}

canvas.addEventListener("pointermove", (event) => {
  if (!updatePoiPointerFromClient(event.clientX, event.clientY)) return;
  lastPoiPointerClient = { clientX: event.clientX, clientY: event.clientY };
  poiPointerActive = true;
  const currentPoi = poiHud.currentPoi();
  if (currentPoi) {
    poiHud.setHoverTarget(currentPoi, lastPoiPointerClient);
  }
});
canvas.addEventListener("dblclick", (event) => {
  if (!updatePoiPointerFromClient(event.clientX, event.clientY)) return;
  lastPoiPointerClient = { clientX: event.clientX, clientY: event.clientY };
  const hoveredPoi = poiLayer.hoveredPoiAt(poiPointerNdc, camera);
  if (!hoveredPoi) return;
  lastHoveredPoiId = hoveredPoi.id;
  poiPointerActive = true;
  poiHud.showDetail(hoveredPoi);
  event.preventDefault();
});
canvas.addEventListener("pointerleave", () => {
  poiPointerActive = false;
  lastPoiPointerClient = null;
  lastHoveredPoiId = null;
  poiHud.setHoverTarget(null);
});

// ── 主键位 action 订阅 ────────────────────────────────────────────────
inputManager.on("world.cycleTime", () => {
  const timePreset = advancePyramidTimePreset(environmentController);
  setStatus(`时间切换: ${timePreset.label} · ${pyramidEnvironmentStatus(environmentController)}`);
});
inputManager.on("world.cycleSeason", () => {
  environmentController.advanceSeason();
  setStatus(`季节切换: ${pyramidEnvironmentStatus(environmentController)}`);
});
inputManager.on("world.cycleWeather", () => {
  environmentController.advanceWeather();
  setStatus(`天气切换中: ${pyramidEnvironmentStatus(environmentController)}`);
});

inputManager.on("debug.togglePanel", () => {
  const visible = debugPanel.toggle();
  if (visible) inputManager.pushContext("debugPanel");
  else inputManager.popContext("debugPanel");
});

inputManager.on("ui.dismiss", () => {
  if (poiHud.currentPoi()) {
    poiHud.hideDetail();
  }
  if (debugPanel.isVisible()) {
    debugPanel.setVisible(false);
    inputManager.popContext("debugPanel");
    return;
  }
  if (immersionLocked) {
    document.exitPointerLock?.();
  }
});

inputManager.on("ui.togglePoiDetail", () => {
  poiHud.toggleDetail();
});


// rivers
let riverLoader: RiverLoader | null = null;
const loadedRiverGroups = new Map<string, ReturnType<RiverLoader["getCachedChunk"]>>();
let activeRiverKeys = new Set<string>();

setPreloadProgress(0.86, "加载河流索引...");
const initialRiverLoader = new RiverLoader({
  baseUrl: "/data/rivers",
  sampler: handle.sampler,
  landMaskSampler,
  excludeWaterSampler: lakeHandle.waterMaskSampler
});
await initialRiverLoader.loadManifest();
riverLoader = initialRiverLoader;

setPreloadProgress(0.94, "构建当前视野地形...");
setStatus("构建当前视野地形...");
await handle.updateVisibleAsync(camera, scene);
renderer.render(scene, camera);
setPreloadProgress(1, "完成");
setStatus("预加载完成，开始流式 chunks...");
setTimeout(hidePreload, 180);

async function initDeferredOverlays(): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  const manifest = await handle.loader.loadManifest();
  debugOverlay = createDebugOverlay({
    manifest,
    geoGridStep: 5,
    chunkLabelStride: 2,
    showChunkGrid: true,
    showPois: true,
    showGeoGrid: true
  });
  debugOverlay.setVisible(false);
  scene.add(debugOverlay.group);
  setStatus("河流 manifest 已加载，开始流式 chunks...");
}

// frame loop
let lastFrame = performance.now();
let frameCounter = 0;
function animate(): void {
  const now = performance.now();
  const dt = (now - lastFrame) / 1000;
  lastFrame = now;
  frameCounter += 1;
  const waterTime = now * 0.001;
  environmentController.update(dt);
  windManager.update(dt, environmentController.getWindState());
  // 合并 InputManager 派生的 movement keys + legacy alt+digit
  const mergedKeys = new Set<string>([
    ...inputManager.characterKeys().asSet(),
    ...legacyAltDigitKeys
  ]);
  const playerInput = characterInputFromKeySet(mergedKeys);
  // Q/E 绕角色 orbit 镜头（改 cameraAzimuth）
  const cameraYawInput = (inputManager.isPressed("camera.yawLeft") ? 1 : 0)
                       - (inputManager.isPressed("camera.yawRight") ? 1 : 0);
  if (cameraYawInput !== 0) {
    cameraAzimuth -= cameraYawInput * PLAYER_TURN_SPEED * dt;
  }
  // WASD → 相对镜头方向走（不再是相对角色身体方向）
  //   - camera forward (xz) = (cos(az), -sin(az))
  //   - camera right (xz) = up × back = (0,1,0) × (-cos(az), 0, sin(az)) = (sin(az), 0, cos(az))
  //   - W=forward, S=back, A=strafe left, D=strafe right
  // 人物 heading 自动转到移动方向（BotW 风：往哪走就面向哪）
  const wasdF = (playerInput.forward ? 1 : 0) - (playerInput.backward ? 1 : 0);
  const wasdR = (playerInput.right ? 1 : 0) - (playerInput.left ? 1 : 0);
  if (wasdF !== 0 || wasdR !== 0) {
    const fwdX = Math.cos(cameraAzimuth);
    const fwdZ = -Math.sin(cameraAzimuth);
    const rightX = Math.sin(cameraAzimuth);
    const rightZ = Math.cos(cameraAzimuth);
    const moveX = wasdF * fwdX + wasdR * rightX;
    const moveZ = wasdF * fwdZ + wasdR * rightZ;
    // CharacterController 内部 forward = (cos H, -sin H)；要让人物走 (moveX, moveZ)
    // 需要解 cos H = moveX, -sin H = moveZ → H = atan2(-moveZ, moveX)
    characterHeading = Math.atan2(-moveZ, moveX);
    playerInput.forward = true;
    playerInput.backward = false;
  }
  playerInput.left = false;
  playerInput.right = false;
  const player = playerRuntime.update(dt, playerInput, characterHeading);
  if (playerInput.directClipDigit !== null) {
    legacyAltDigitKeys.delete(`alt+${playerInput.directClipDigit}`);
  }
  lastFpsSample = dt > 0 ? 1 / dt : lastFpsSample;
  syncCameraToPlayer();
  syncPyramidEnvironment(waterTime, dt);
  // Sprite 不响应光照——手动 tint 筋斗云 sprite 让它跟场景同步明暗
  tintCloudFlightVisual(playerRuntime.cloudVisual, ambient.intensity * 1.4, ambient.color);
  oceanWaterSurface?.setTime(waterTime);
  lakeHandle.setTime(waterTime);
  for (const rh of loadedRiverGroups.values()) {
    if (rh) updateRiverGroupShimmer(rh.group, waterTime);
  }

  // update pyramid (visible chunks)
  if (frameCounter % 10 === 0) {
    handle.updateVisible(camera, scene);

    // Rivers: 跟 camera 联动 — 把相机 world 位置反求到 L0 chunk grid.
    // radius 跟相机高度联动: 平视 radius=16, 高空俯视 radius=28 (~3000km, 覆盖 LOD L2 范围)
    if (riverLoader) {
      const camGeo = unprojectWorldToGeo(
        { x: player.position.x, z: player.position.z },
        qinlingRegionBounds,
        qinlingRegionWorld
      );
      const camChunkX = Math.floor((camGeo.lon - qinlingRegionBounds.west) / 1.0);
      const camChunkZ = Math.floor((qinlingRegionBounds.north - camGeo.lat) / 1.0);
      const riverRadius = camera.position.y > 100 ? 28 : camera.position.y > 40 ? 20 : 14;
      const candidates = riverLoader.findCandidateChunks(camChunkX, camChunkZ, riverRadius);
      activeRiverKeys = new Set(candidates.map(({ x, z }) => `${x}:${z}`));
      for (const { x, z } of candidates) {
        const key = `${x}:${z}`;
        if (loadedRiverGroups.has(key)) continue;
        void riverLoader.requestChunk(x, z).then((rh) => {
          if (!rh) return;
          if (!activeRiverKeys.has(key)) return;
          if (loadedRiverGroups.has(key)) return;
          scene.add(rh.group);
          loadedRiverGroups.set(key, rh);
        });
      }
      for (const [key, rh] of loadedRiverGroups) {
        if (!rh || activeRiverKeys.has(key)) continue;
        scene.remove(rh.group);
        loadedRiverGroups.delete(key);
      }
    }
  }

  // 内容 LOD: 按相机高度 4 级筛选 — 鸟瞰只看 gravity 地标, 低空才显细节
  // 河 (stream order): high=只 ord 7+, mid=6+, low=5+, ground=4+ (default)
  // 湖 (scalerank): high=≤2, mid=≤4, low=≤6, ground=全
  // 跟 BotW 三角法则一致 — 远只见标志性地理, 近见全细节.
  if (frameCounter % 12 === 0) {
    const alt = camera.position.y;
    poiLayer.update(
      alt,
      camera,
      renderer.domElement.clientHeight || window.innerHeight,
      environmentController.state.timeOfDay
    );
    if (poiPointerActive && !immersionLocked) {
      const hoveredPoi = poiLayer.hoveredPoiAt(poiPointerNdc, camera);
      const nextHoveredPoiId = hoveredPoi?.id ?? null;
      if (nextHoveredPoiId !== lastHoveredPoiId) {
        lastHoveredPoiId = nextHoveredPoiId;
        poiHud.setHoverTarget(hoveredPoi, lastPoiPointerClient);
      } else if (hoveredPoi && lastPoiPointerClient) {
        poiHud.setHoverTarget(hoveredPoi, lastPoiPointerClient);
      }
    } else if (lastHoveredPoiId !== null) {
      lastHoveredPoiId = null;
      poiHud.setHoverTarget(null);
    }
    const nearbyPoi = poiLayer.nearestPoi(player.position.x, player.position.z, 10);
    latestNearbyPoiDebug = nearbyPoi
      ? `${nearbyPoi.name} · ${truncateDebugText(nearbyPoi.summary, 42)}`
      : undefined;
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
    minimap.update(player.position.x, player.position.z, player.heading, environmentController.state.timeOfDay);
  }

  // debug panel stats 刷新（panel 显示时才更新）
  if (frameCounter % 10 === 0 && debugPanel.isVisible()) {
    debugPanel.refreshStats();
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
void initDeferredOverlays();
