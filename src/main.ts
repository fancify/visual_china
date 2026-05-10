import "./style.css";

import {
  AmbientLight,
  BackSide,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Clock,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  FogExp2,
  Group,
  InstancedMesh,
  Line,
  LineBasicMaterial,
  Matrix4,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshPhongMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Raycaster,
  Scene,
  SphereGeometry,
  Shape,
  ShapeGeometry,
  Sprite,
  SpriteMaterial,
  Vector2,
  Vector3,
  WebGLRenderer
} from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ColorGradeShader } from "./game/colorGradeShader";
import {
  knowledgeFragments as defaultKnowledgeFragments,
  type KnowledgeFragment
} from "./data/fragments";
import {
  landmarks as defaultLandmarks,
  modeMeta,
  routeStart as defaultRouteStart,
  type Landmark,
  type LandmarkKind,
  type ViewMode
} from "./data/qinlingSlice";
import {
  createAmbientMixer,
  type AmbientContext,
  type AmbientMixer
} from "./game/audio/ambientMixer";
import {
  createAudioRuntime,
  setMasterMuted,
  unlockOnUserGesture
} from "./game/audio/audioContext";
import { loadAllBuffers } from "./game/audio/audioManifest";
import {
  createSparseScheduler,
  DEFAULT_SPARSE_RULES
} from "./game/audio/sparseScheduler";
import { createTriggerSystem } from "./game/audio/triggerSystem";
import { createAudioDebugHud } from "./game/audioDebugHud";
import {
  cameraLookTargetForMode,
  cameraPositionForMode,
  effectiveCameraHeadingForMode,
  type CameraViewMode
} from "./game/cameraView.js";
import { qinlingCameraRig } from "./game/cameraRig.js";
import {
  EnvironmentController,
  seasonLabel,
  weatherLabel,
  formatTimeOfDay,
  formatAncientTimeOfDay,
  skyBodyHorizonFade,
  sharedAtmosphericFarColor,
  sunDiscScaleForAltitude,
  type EnvironmentVisuals
} from "./game/environment";
import { northNeedleAngleRadians } from "./game/compass.js";
import {
  clearGameplayInput,
  isGameplayInputKey,
  movementAxesFromKeys,
  normalizeInputKey
} from "./game/inputState.js";
import {
  celestialDomeVector,
  skyBodyStyle,
  skyDomePolicy
} from "./game/skyDome.js";
import {
  atlasMinimumDisplayPriority,
  atlasVisibleFeatures,
  featureWorldPoints,
  missingDemTileWorldRects
} from "./game/atlasRender.js";
import {
  atlasMapCanvasToWorldPoint,
  atlasMapWorldToCanvasPoint,
  createAtlasWorkbenchState,
  findAtlasFeatureAtCanvasPoint,
  panAtlasMap,
  resetAtlasMapView,
  selectAtlasFeature,
  setAtlasFullscreen,
  selectedAtlasFeature,
  toggleAtlasLayer,
  zoomAtlasMapAtPoint,
  type AtlasWorkbenchState
} from "./game/atlasWorkbench.js";
import {
  computeLabelVisibility,
  labelMaxRenderDistance
} from "./game/labelVisibility.js";
import { movementVectorFromInput } from "./game/navigation.js";
import {
  avatarHeadingForMovement,
  woodHorseLegPose
} from "./game/playerAvatar.js";
import { computeAvatarTilt } from "./game/avatarTilt";
import {
  createPlayerAvatar,
  rebuildPlayerAvatar
} from "./game/playerAvatarMesh";
import {
  advanceMountVelocityScale,
  mountSpeedMultiplier
} from "./game/mountRuntime.js";
import {
  cycleAvatar,
  cycleMount,
  savePlayerCustomization,
  type AvatarId,
  type MountId
} from "./game/playerCustomization.js";
import {
  qinlingAtlasFeatures,
  qinlingAtlasLayers,
  qinlingScenicLandmarks,
  qinlingAncientSites,
  type QinlingAtlasFeature,
  type QinlingAtlasLayerId
} from "./game/qinlingAtlas.js";
import {
  importedHydrographyAssetToAtlasFeatures,
  type ImportedHydrographyAsset
} from "./game/osmHydrographyAtlas.js";
import { hydrographyFeatureToAtlasFeature } from "./game/hydrographyAtlas.js";
import type { HydrographyFeature } from "./game/hydrographyModel.js";
import { qinlingModernHydrography } from "./game/qinlingHydrography.js";
import {
  qinlingRoutes,
  routeAffinityAt,
  type RouteInfluence
} from "./game/qinlingRoutes.js";
import {
  buildPlankRoadNetwork,
  disposePlankRoad,
  type PlankRoadHandle
} from "./game/plankRoadRenderer";
import {
  buildPassLandmarkMeshes,
  passLandmarkGeometries
} from "./game/passLandmarks.js";
import {
  buildScenicPoiMeshes,
  scenicPoiLabelHeights
} from "./game/scenicPoiVisuals";
import { buildImperialTombMound } from "./game/ancientPoiVisuals";
import {
  buildWaterRibbonVertices,
  buildWaterRibbonAlphas,
  buildRiverVegetationSamples,
  riverCorridorInfluenceAtPoint,
  selectRenderableWaterFeatures,
  waterLabelPoint,
  waterEnvironmentVisualStyle,
  waterVisualStyle
} from "./game/waterSystemVisuals.js";
import {
  TERRAIN_VERTICAL_EXAGGERATION,
  TerrainSampler,
  CompositeTerrainSampler,
  downsampleChunkAsset,
  loadDemAsset,
  resolveTerrainAssetRequest,
  type DemAsset
} from "./game/demSampler";
import { GroundAnchorRegistry } from "./game/groundAnchors";
import { createHud } from "./game/hud";
import { renderJournalView } from "./game/journal";
import { qinlingRuntimeBudget } from "./game/performanceBudget";
import { loadRegionBundle } from "./game/regionBundle";
import type { ExperienceProfile } from "./game/demSampler";
import {
  buildRetainedChunkIds,
  buildVisibleChunkIds,
  findChunkForPosition,
  limitChunkIdsByGridDistance,
  type RegionChunkManifest
} from "./game/regionChunks";
import {
  createChunkScenery,
  disposeScenery,
  sharedTreeMaterial,
  updateSceneryColors
} from "./game/scenery";
import {
  createWildlifeHandle,
  computeWildlifePose,
  disposeWildlife,
  sharedWildlifeMaterials,
  updateWildlifeFrame,
  type WildlifeHandle
} from "./game/wildlife";
import {
  createCityHoverHud,
  findNearestProximityPoi,
  resolveHudTargetSource,
  type PoiInfo
} from "./game/cityHoverHud";
import {
  attachHoverPoiMetadata,
  findHoveredPoiFromIntersections
} from "./game/poiHoverRuntime";
import { gameHeightToRealMeters } from "./game/realElevation";
import { biomeWeightsAt } from "./game/biomeZones.js";
import {
  cityFromMarkerIntersection,
  CITY_TIER_SPECS,
  createCityMarkers,
  disposeCityMarkers,
  type CityMarkersHandle
} from "./game/cityMarkers";
import { flattenedY, setCityFlattenZones } from "./game/cityFlattenZones.js";
import { realQinlingCities } from "./data/realCities.js";
import type { RealCity } from "./data/realCities.js";
import { qinlingRegionWorld } from "./data/qinlingRegion.js";
import { CHINA_LAKES, type ChinaLake } from "./game/data/chinaLakes";
import { projectGeoToWorld, unprojectWorldToGeo } from "./game/mapOrientation.js";
import {
  evaluateStoryGuide,
  formatStoryGuideLine,
  getQinlingStoryBeats,
  type StoryBeat
} from "./game/storyGuide";
import {
  applyTerrainLodMorphAttributes,
  createTerrainMesh,
  disposeTerrainMesh,
  setTerrainMeshWorldPosition,
  updateTerrainMeshColors,
  type TerrainMeshHandle
} from "./game/terrainMesh";
import {
  modeColor,
  zoneNameAt
} from "./game/terrainModel";
import { isSpriteOccludedByTerrain } from "./game/labelOcclusion";
import { textSpriteLayout } from "./game/textLabel.js";
import {
  computeLodMorph,
  formatTerrainLodBreakdown,
  resolveLodMorphOverride,
  summarizeChunkLodMorphs
} from "./game/terrainLodMorph.js";
import { createPerfStats, isDevModeEnabled } from "./game/perfStats";
import { createPerfMonitor } from "./game/perfMonitor";
import {
  applySkyVisuals,
  createCloudLayer,
  createPrecipitationLayer,
  createSkyDome
} from "./game/atmosphereLayer";
import {
  createCircleTexture,
  createCloudCookieTexture
} from "./game/proceduralTextures";
import {
  attachTerrainShaderEnhancements,
  updateTerrainShaderAtmosphericFar,
  updateTerrainShaderCloudCookie,
  updateTerrainShaderHeightFog,
  updateTerrainShaderHsl,
  updateTerrainShaderLodMorph
} from "./game/terrainShaderEnhancer";
import { createWaterSurfaceMaterial } from "./game/waterSurfaceShader";
import { WindManager } from "./game/windManager";

interface FragmentVisual {
  sprite: Sprite;
  halo: Sprite;
  baseY: number;
  phase: number;
  chunkId: string | null;
}

declare global {
  interface Window {
    LOD_MORPH_DEMO?: number;
  }
}

// CompositeTerrainSampler 替代 TerrainSampler：所有 sample 调用经过它，
// 命中已装载的 chunk 用 chunk sampler，否则 fallback 到 base（L1）。
// 解决"建筑/水/POI 用 L1 高度，跟 chunks 实际渲染脱钩"的问题。
let terrainSampler: CompositeTerrainSampler | null = null;
const groundAnchorRegistry = new GroundAnchorRegistry();
const terrainAssetRequest = resolveTerrainAssetRequest(
  window.location.search,
  "/data/regions/qinling/manifest.json"
);
const environmentController = new EnvironmentController();
const windManager = new WindManager();
const audioRuntime = createAudioRuntime();
unlockOnUserGesture(audioRuntime);
const ambientMixer = createAmbientMixer(audioRuntime);
const triggerSystem = createTriggerSystem(audioRuntime);
const sparseScheduler = createSparseScheduler(triggerSystem, DEFAULT_SPARSE_RULES);
let landmarks: Landmark[] = defaultLandmarks.map((landmark) => ({
  ...landmark,
  position: landmark.position.clone()
}));
let knowledgeFragments: KnowledgeFragment[] = defaultKnowledgeFragments.map(
  (fragment) => ({
    ...fragment,
    position: fragment.position.clone(),
    details: { ...fragment.details }
  })
);
let routeStart = defaultRouteStart.clone();
let regionChunkManifest: RegionChunkManifest | null = null;
let regionChunkManifestUrl: string | null = null;
let activeChunkId: string | null = null;
let visibleChunkIds = new Set<string>();
const landmarkChunkIds = new Map<string, string | null>();
const terrainChunkMeshes = new Map<string, TerrainMeshHandle>();
const chunkLoadPromises = new Map<string, Promise<void>>();
const runtimeBudget = qinlingRuntimeBudget;
const CHUNK_FADE_DURATION = 1.2;
// 区域 experience profile（从 manifest 读取）。决定 baseSpeed / cameraDistance /
// scenery 密度的缩放系数。null 时按 1 处理。
let experienceProfile: ExperienceProfile | null = null;

function travelSpeedMultiplier(): number {
  return experienceProfile?.travelSpeedMultiplier ?? 1;
}
function cameraScaleMultiplier(): number {
  return experienceProfile?.cameraScaleMultiplier ?? 1;
}
function detailDensityMultiplier(): number {
  return experienceProfile?.detailDensityMultiplier ?? 1;
}
function eventDensityMultiplier(): number {
  return experienceProfile?.eventDensityMultiplier ?? 1;
}

function scaledSceneryBudget(): typeof runtimeBudget.scenery {
  const m = detailDensityMultiplier();
  return {
    maxTreesPerChunk: Math.max(1, Math.floor(runtimeBudget.scenery.maxTreesPerChunk * m))
  };
}
let storyBeats: StoryBeat[] = getQinlingStoryBeats();
const completedStoryBeatIds = new Set<string>();
let storyLine = "主线：从关中出发，去看山河如何一步步把道路收紧。";
let storyGuideInitialized = false;
let atlasWorkbench: AtlasWorkbenchState =
  createAtlasWorkbenchState(qinlingAtlasLayers);
let atlasFeatures: QinlingAtlasFeature[] = [...qinlingAtlasFeatures];
// 每次 atlasFeatures / evidenceFeatures 更新时 ++，atlasFeatureCacheKey 用它
// 让 features cache 自动 invalidate。codex review d2eafde 抓到：异步 OSM 水系
// 加载完后 cache 不知道数据变了，可能一直贴老要素层。
let atlasFeaturesVersion = 0;
let visibleWaterFeatures: QinlingAtlasFeature[] = [];
// Evidence layer：OSM 命名水系（4639 条），按 rank 是 raw evidence，不是
// curated 主干。默认不进 atlasFeatures，避免每帧 filter/sort 4639 项。
// Atlas workbench 在 fullscreen + zoom>=1.45 时才把它合入可见集合。
let evidenceFeatures: QinlingAtlasFeature[] = [];
const EVIDENCE_ZOOM_THRESHOLD = 1.45;

interface PrimaryHydrographyAsset {
  features: HydrographyFeature[];
}

/**
 * 当前帧应该在 atlas 上呈现的 feature 集合。
 * - curated + primary：常驻
 * - OSM evidence：仅 fullscreen + 缩放过阈值时合入
 *
 * 调用方（drawOverviewMap / findAtlasFeatureAtCanvasPoint / atlasVisibleFeatures
 * 等）必须从这里取，不能直接读 atlasFeatures。
 */
function activeAtlasFeatures(): QinlingAtlasFeature[] {
  const includeEvidence =
    atlasWorkbench.isFullscreen &&
    (atlasWorkbench.mapView?.scale ?? 1) >= EVIDENCE_ZOOM_THRESHOLD;
  return includeEvidence
    ? atlasFeatures.concat(evidenceFeatures)
    : atlasFeatures;
}

async function loadHydrographyAtlas(): Promise<void> {
  // Yield to the next microtask so module-level initializers
  // (waterSystemGroup, terrainChunkGroup, etc.) finish first. Old
  // version had `await fetch(...)` which deferred implicitly; after
  // we removed the OSM/primary fetches the function became sync and
  // ran before module init → "Cannot access 'waterSystemGroup' before
  // initialization".
  await Promise.resolve();
  // 2026-05 用户："只要 prototype 里有的"——
  // primary-modern.json 把 OSM + curated 合并；
  // osm-modern.json 又是 4639 个 OSM water features 当 evidence overlay。
  // 这两都包含 prototype 里没有的支流，全部跳过。
  // qinlingAtlasFeatures 里的 water layer 直接来自 qinlingHydrography
  // (= qinlingNeRivers = major-rivers.json 在 slice 内的 5 条 NE 河)。
  atlasFeatures = [...qinlingAtlasFeatures];
  evidenceFeatures = [];
  atlasFeaturesVersion += 1;
  rebuildWaterSystemVisuals();
  if (lastVisuals) {
    applyWaterEnvironmentVisuals(lastVisuals);
    updateTerrainColors(lastVisuals);
  }
  refreshAtlasWorkbench();
}

void loadHydrographyAtlas();

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing app root");
}
const appRoot = app;

const renderer = new WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance"
});
// pixelRatio 上限再从 1.5 降到 1.25：用户反馈"风扇响得很厉害"。
// 1.5 → 1.25 在 Retina 屏额外砍 ~31% pixel fill（1.5²/1.25² ≈ 1.44，
// 即从 144% 降到 100% baseline），加上之前从 2.0 降到 1.5 的 44%，
// 累计相对原生 devicePixelRatio 约砍 60% 像素填充。视觉上更软，但风扇
// 静下来更重要——这是个浏览器原型不是 AAA 游戏。
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x081213);
appRoot.appendChild(renderer.domElement);

const perfStats = createPerfStats({ enabled: isDevModeEnabled() });
const perfMonitor = createPerfMonitor({
  getActiveChunkCount: () => visibleChunkIds.size
});
if (perfStats.element.hidden === false) {
  document.body.appendChild(perfStats.element);
}

// 旧版 DOM sky overlay（96 个 span 星星 + 3 个 div 云朵）已被 WebGL sky dome
// 完全替代，DOM 层删除以减少 compositor 负担。
const hud = createHud(appRoot, terrainAssetRequest, knowledgeFragments.length);
// 用户："去掉静音按钮" — 改 keyboard M 切换。
let audioMuted = safeReadAudioMuted();
setMasterMuted(audioRuntime, audioMuted);
const audioDebugHud = createAudioDebugHud(appRoot);
void loadAllBuffers(audioRuntime).then(({ loaded, failed }) => {
  console.info(`[audio] ${loaded} loaded, ${failed} missing`);
});
const hoverRaycaster = new Raycaster();
const hoverPointer = new Vector2();
let hoverPointerActive = false;
const CITY_LOD_OCCLUSION_INTERVAL = 4;
const POI_HOVER_SYNC_INTERVAL = 4;
let lodOcclusionFrameCounter = CITY_LOD_OCCLUSION_INTERVAL - 1;
let hoverFrameCounter = POI_HOVER_SYNC_INTERVAL - 1;
let hoverPointerDirty = false;
let lastHoveredPoi: RuntimePoiInfo | null = null;
let poiHoverTargetsDirty = true;
const poiHoverTargetSources: Object3D[] = [];
const poiHoverTargetScratch: Object3D[] = [];

declare global {
  interface Window {
    HUD_DEBUG?: boolean;
  }
}

if (typeof window.HUD_DEBUG !== "boolean") {
  try {
    window.HUD_DEBUG = window.localStorage.getItem("HUD_DEBUG") === "1";
  } catch {
    window.HUD_DEBUG = false;
  }
}

function hudDebugWarn(message: string, details?: unknown): void {
  if (!window.HUD_DEBUG) {
    return;
  }
  if (details === undefined) {
    console.warn("[HUD-DEBUG]", message);
    return;
  }
  console.warn("[HUD-DEBUG]", message, details);
}

// proximity 半径：原 3-5u 太宽——玩家出生位置就压在西安半径内，HUD 一直挂着
// 不会消失，用户报告"不会触发"。半径砍半，强制"必须走进城/景"才显示。
const PROXIMITY_RADIUS_DEFAULT = 1.6;
const PROXIMITY_RADIUS_CITY_COUNTY = 1.4;
const PROXIMITY_RADIUS_CITY_PREF = 1.8;
const PROXIMITY_RADIUS_CITY_CAP = 2.2;

interface RuntimePoiInfo extends PoiInfo {
  cityTier?: RealCity["tier"];
}

const FOOTSTEP_INTERVAL_MS = 450;
const OX_MOO_INTERVAL_MS = 30000;
const WATER_FOOTSTEP_THRESHOLD = 0.72;
const CRANE_AUDIO_RADIUS = 8;
const TEMPLE_POI_PATTERN = /(寺|塔|观|庙|佛阁|经幢)/;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function lodMorphDemoValue(): number | null {
  return resolveLodMorphOverride(window.LOD_MORPH_DEMO);
}

function ambientWeatherForState(weather: EnvironmentController["state"]["weather"]): AmbientContext["weather"] {
  if (weather === "storm") {
    return "storm";
  }
  if (weather === "rain") {
    return "rain";
  }
  return "clear";
}

function deriveAmbientBiome(
  x: number,
  z: number,
  sampler: TerrainSampler
): AmbientContext["biome"] {
  const height = sampler.sampleHeight(x, z);
  const slope = sampler.sampleSlope(x, z);
  const river = sampler.sampleRiver(x, z);
  const zone = zoneNameAt(x, z, sampler);

  if (height > 12 || slope > 0.42) {
    return "highland";
  }

  if (zone.includes("盆地")) {
    return "basin";
  }

  if (sampler.asset.bounds) {
    const biome = biomeWeightsAt(
      unprojectWorldToGeo({ x, z }, sampler.asset.bounds, sampler.asset.world)
    ).biomeId;
    if (biome === "subtropical-humid" || biome === "tropical-humid") {
      return "subtropical";
    }
    if (biome === "warm-temperate-semiarid" || biome === "temperate-grassland") {
      return "plain";
    }
  }

  if (river < 0.12 && slope < 0.18 && height < 8) {
    return "plain";
  }

  return "forest";
}

function sampleRiverProximity(
  sampler: TerrainSampler,
  position: Pick<Vector3, "x" | "z">
): number {
  return clamp01(sampler.sampleRiver(position.x, position.z));
}

function distanceToSegment2D(
  pointX: number,
  pointZ: number,
  start: { x: number; y: number },
  end: { x: number; y: number }
): number {
  const dx = end.x - start.x;
  const dz = end.y - start.y;
  if (dx === 0 && dz === 0) {
    return Math.hypot(pointX - start.x, pointZ - start.y);
  }
  const t = clamp01(
    ((pointX - start.x) * dx + (pointZ - start.y) * dz) / (dx * dx + dz * dz)
  );
  const nearestX = start.x + dx * t;
  const nearestZ = start.y + dz * t;
  return Math.hypot(pointX - nearestX, pointZ - nearestZ);
}

function sampleLargeRiverProximity(position: Pick<Vector3, "x" | "z">): number {
  let bestDistance = Infinity;

  for (const feature of visibleWaterFeatures) {
    if (feature.terrainRole !== "main-river") {
      continue;
    }
    const points =
      feature.world && "points" in feature.world ? feature.world.points : null;
    if (!points || points.length < 2) {
      continue;
    }
    for (let index = 0; index < points.length - 1; index += 1) {
      bestDistance = Math.min(
        bestDistance,
        distanceToSegment2D(position.x, position.z, points[index]!, points[index + 1]!)
      );
    }
  }

  if (!Number.isFinite(bestDistance)) {
    return 0;
  }

  return 1 - MathUtils.smoothstep(bestDistance, 3, 16);
}

function safeReadAudioMuted(): boolean {
  try {
    const stored = window.localStorage.getItem("audio_muted");
    // 当前 freesound 抓的样本质量参差，默认静音；用户偏好"似有似无"+
    // 高质量音源未到位之前，先以无声为底，等精修完再让用户主动 unmute。
    if (stored === null) {
      return true;
    }
    return stored === "1";
  } catch {
    return true;
  }
}

function safeWriteAudioMuted(muted: boolean): void {
  try {
    window.localStorage.setItem("audio_muted", muted ? "1" : "0");
  } catch {
    /* localStorage 不可写时只丢失偏好，不阻断游戏 */
  }
}

const scene = new Scene();
const sceneFog = new FogExp2(0x091416, 0.0065);
scene.fog = sceneFog;

const camera = new PerspectiveCamera(
  58,
  window.innerWidth / window.innerHeight,
  0.1,
  800
);

// Bloom 第二次（refactor #64）：第一次（commit 8563f63→d2eafde）失败是因为
// 把 OutputPass 误放在 bloom 后又跳到 canvas 时多走了一次 sRGB 编码，midtone
// 被推灰。这次走 Three.js r178 的标准链：renderer 默认 SRGBColorSpace +
// NoToneMapping，EffectComposer 内部 RT 默认 LinearSRGB，OutputPass 在末尾
// 把 linear → sRGB 一次性写到 canvas。Bloom 在 linear 空间做 threshold。
//
// 保守参数：strength 0.22 / threshold 0.92 / radius 0.4——只让真正高亮的
// 像素（雪冠、太阳盘、水面反光）发光，midtone 完全不动。
const bloomComposer = new EffectComposer(renderer);
bloomComposer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
bloomComposer.setSize(window.innerWidth, window.innerHeight);
bloomComposer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new Vector2(window.innerWidth, window.innerHeight),
  0.22,
  0.40,
  0.92
);
bloomComposer.addPass(bloomPass);
// 千里江山图 split-toning：阴影偏冷青、高光偏暖金，对应青绿山水审美。
// 在 OutputPass 之前做，操作 linear 色。
const colorGradePass = new ShaderPass(ColorGradeShader);
bloomComposer.addPass(colorGradePass);
bloomComposer.addPass(new OutputPass());

const ambientLight = new AmbientLight(0xf2dfba, 1.65);
scene.add(ambientLight);

const sun = new DirectionalLight(0xfff0ca, 2.8);
sun.position.set(110, 160, 24);
scene.add(sun);

const rim = new DirectionalLight(0x80adbe, 0.72);
rim.position.set(-100, 48, -120);
scene.add(rim);

const moonLight = new DirectionalLight(0xb9cfff, 0.55);
moonLight.position.set(-80, 90, -40);
scene.add(moonLight);

const underpaint = new Mesh(
  new PlaneGeometry(1, 1),
  new MeshPhongMaterial({
    color: 0x242318,
    transparent: true,
    opacity: 0.86,
    shininess: 50,
    side: DoubleSide
  })
);
underpaint.rotation.x = -Math.PI / 2;
underpaint.position.y = -8.5;
scene.add(underpaint);

let terrainGeometry = new PlaneGeometry(1, 1, 1, 1);
terrainGeometry.rotateX(-Math.PI / 2);
let positionAttribute = terrainGeometry.attributes.position as BufferAttribute;
let colorAttribute = new BufferAttribute(
  new Float32Array(positionAttribute.count * 3),
  3
);
terrainGeometry.setAttribute("color", colorAttribute);

const cloudCookieTexture = createCloudCookieTexture(256);
const terrainMaterial = new MeshPhongMaterial({
  vertexColors: true,
  flatShading: true,
  shininess: 8,
  // 方案 A z-fight 解：base mesh（L1 14.4 km/cell）和 chunks (0.9 km/cell)
  // 同位置时让 chunks 必赢 depth-test。polygonOffset 把 base 的 depth 值
  // 整体推远，GPU 在像素 z-test 阶段就让 chunks 覆盖。chunks yOffset 已经
  // 抬了 0.12（line 4228），加上这条 polygonOffset 双保险。
  polygonOffset: true,
  polygonOffsetFactor: 4,
  polygonOffsetUnits: 4
});
attachTerrainShaderEnhancements(terrainMaterial, {
  heightFogColor: new Color(0xb6c4be),
  // R5 远景初始色：runtime 每帧用 sky horizon 共享色覆盖，初值只服务首帧。
  atmosphericFarColor: new Color(0xb6c4be),
  cloudCookieTexture
});
const terrain = new Mesh(terrainGeometry, terrainMaterial);
// renderOrder 0（默认）：base 先画。chunks 后面 createTerrainMesh 时显式
// 设 mesh.renderOrder = 1，让 chunks 后画 → 同位置覆盖 base。
terrain.renderOrder = 0;
// 之前临时下沉 -1.5 防 z-fight，但 exag 降到 1.07 后高度范围本来就压扁，
// 下沉让低地（华北/江汉）跌到 waterLevel 以下被淹。回退到 0；polygonOffset
// + chunks 的 0.12 yOffset + renderOrder=1 三重已经够防 z-fight。
scene.add(terrain);

const terrainChunkGroup = new Group();
scene.add(terrainChunkGroup);

const waterSurface = createWaterSurfaceMaterial();
// 旧的 ambient water plane（一块 60x125 单元的平面，固定 Y）会被用户看到
// "浮在地形上空的一条带子"——尤其当 terrain 边缘外露时它会作为水色矩形露出。
// 真正的河流由 waterSystemVisuals 单独渲染并 sample 地形高度，所以这层
// ambient plane 弊大于利，先 visible=false。waterSurface shader 仍被河流
// ribbon 复用（共用 material），所以保留 mesh 和 material 实例不删。
const waterRibbon = new Mesh(new PlaneGeometry(1, 1), waterSurface.material);
waterRibbon.rotation.x = -Math.PI / 2;
waterRibbon.position.y = -8;
// 水面必须默认 visible：旧 slice 是 hidden 因为 Qinling 本来无海，全国画幅
// 必须显示东海/南海/渤海。位置由 applyTerrainFromSampler 设到 waterLevel ×
// TERRAIN_VERTICAL_EXAGGERATION，scale 铺满世界（rescaleTerrainGeometry）。
waterRibbon.visible = true;
scene.add(waterRibbon);
const ambientWaterStyle: ReturnType<typeof waterVisualStyle> = {
  bankWidth: 0,
  bankYOffset: 0,
  bankOpacity: 0,
  ribbonWidth: 0,
  ribbonYOffset: 0,
  ribbonOpacity: 0.13,
  depthTest: true
};

const playerAvatarHandle = createPlayerAvatar();
const player = playerAvatarHandle.player;
const poiHoverHud = createCityHoverHud(appRoot, {
  getPlayerWorldPosition: () => ({ x: player.position.x, z: player.position.z })
});
// horseLegsByName 是个 reference，rebuild 时整体替换；包成 ref 让循环里始终读到最新。
let mountLegsByName = playerAvatarHandle.mountLegsByName;
let avatarWalkLegsByName = playerAvatarHandle.avatarWalkLegsByName;
let avatarWalkArmsByName = playerAvatarHandle.avatarWalkArmsByName;
let currentMountId: MountId = playerAvatarHandle.mountId;
let currentAvatarId: AvatarId = playerAvatarHandle.avatarId;
let customizationPanelOpen = false;
let avatarWalkPhase = 0;
let currentVelocityScale = 0;
let lastMovementHeading: { x: number; z: number } | null = null;
// 全国画幅下普通云高（50）显得低；用户要求 ×3 让筋斗云真能看到全景。
const CLOUD_FLIGHT_ASCEND_STEP = 1.2; // 0.4 × 3
const CLOUD_FLIGHT_MAX_ALTITUDE = 150; // 50 × 3
// 筋斗云改全局绝对高度：飞行不跟地面坡度走，过山过河都是同一高度。
// maxHeight 13.5 × 1.6 exag = 21.6（青藏/Everest），MIN 25 确保安全过所有
// 中国地形而不会撞山（用户："不用照顾地面坡度"）。
const CLOUD_FLIGHT_MIN_ABSOLUTE = 25;
const CLOUD_FLIGHT_DEFAULT_GROUND_OFFSET = 24; // 8 × 3 — 全国画幅起飞高度
scene.add(player);

export function resetCloudFlightAltitudeForGround(ground: number): number {
  return ground + CLOUD_FLIGHT_DEFAULT_GROUND_OFFSET;
}

// 飞行型 mount：cloud (筋斗云) + sword (御剑)。共享相同的 absolute-altitude
// 控制（space 上 / x 下，clamp [MIN_ABSOLUTE, MAX_ALTITUDE]）和 scenery hide 行为。
export function isFlyingMount(id: MountId): boolean {
  return id === "cloud" || id === "sword";
}

export function resolvePlayerTargetY({
  currentMountId,
  ground,
  cloudFlightAltitude
}: {
  currentMountId: MountId;
  ground: number;
  cloudFlightAltitude: number;
}): number {
  if (isFlyingMount(currentMountId)) {
    return cloudFlightAltitude;
  }

  return ground + 0.35;
}

export function nextCloudFlightAltitude({
  currentMountId,
  keys,
  ground,
  cloudFlightAltitude
}: {
  currentMountId: MountId;
  keys: Set<string>;
  ground: number;
  cloudFlightAltitude: number;
}): number {
  if (!isFlyingMount(currentMountId)) {
    return cloudFlightAltitude;
  }

  let nextAltitude = cloudFlightAltitude;

  if (keys.has(" ")) {
    nextAltitude += CLOUD_FLIGHT_ASCEND_STEP;
  }
  if (keys.has("x")) {
    nextAltitude -= CLOUD_FLIGHT_ASCEND_STEP;
  }

  // 筋斗云全局绝对高度：clamp 用 absolute MIN，跟地面无关。过山时 player.y
  // 由 resolvePlayerTargetY 直接 = cloudFlightAltitude（不加 ground offset）。
  void ground;
  return MathUtils.clamp(
    nextAltitude,
    CLOUD_FLIGHT_MIN_ABSOLUTE,
    CLOUD_FLIGHT_MAX_ALTITUDE
  );
}

function normalizeRuntimeInputKey(event: KeyboardEvent): string {
  if (event.code === "KeyX") {
    return "x";
  }

  return normalizeInputKey(event);
}

function wrapCloudDriftX(value: number, limit = 250): number {
  const span = limit * 2;
  return ((((value + limit) % span) + span) % span) - limit;
}

function applyCustomization(mountId: MountId, avatarId: AvatarId): void {
  if (mountId === currentMountId && avatarId === currentAvatarId) {
    return;
  }
  const {
    mountLegsByName: nextLegs,
    avatarWalkLegsByName: nextAvatarWalkLegs,
    avatarWalkArmsByName: nextAvatarWalkArms
  } = rebuildPlayerAvatar(player, mountId, avatarId);
  mountLegsByName = nextLegs;
  avatarWalkLegsByName = nextAvatarWalkLegs;
  avatarWalkArmsByName = nextAvatarWalkArms;
  currentMountId = mountId;
  currentAvatarId = avatarId;
  savePlayerCustomization({ mountId, avatarId });
  if (customizationPanelOpen) {
    hud.setCustomizationPanelOpen({ mountId, avatarId });
  }
  applyCloudModeVisibility();
}

// 筋斗云模式：远景俯瞰画风，地面 scenery（树/草）+ 动物会让画面糊成噪点。
// 全部隐藏；保留 cities/landmarks/scenic POIs/ancient sites/rivers。
// 切回非云骑乘时全部恢复（chunk fade 路径会按需重新点亮）。
function applyCloudModeVisibility(): void {
  // 用户："暂时把所有的树木都隐藏掉吧"。强制 hide 所有 scenery + 河边植物，
  // 不再受 mount mode 影响（之前是仅 cloud 模式才藏）。
  const HIDE_ALL_VEGETATION = true;
  const flying = isFlyingMount(currentMountId);
  // wildlife group 整组开关（飞行时藏；动物不属于"树木"，保留）
  wildlifeGroup.visible = !flying;
  // 河边植物全程藏。
  riverVegetationGroup.visible = !HIDE_ALL_VEGETATION;
  // 每个 chunk 的 scenery group（树/灌丛）— 全程 hide。
  terrainChunkMeshes.forEach((terrainChunk) => {
    if (terrainChunk.scenery) {
      terrainChunk.scenery.visible =
        !HIDE_ALL_VEGETATION && !flying && terrainChunk.mesh.visible;
    }
  });
}

// 4 个 procedural texture helper（圆形光晕、月亮、星空点云、云朵）已迁到
// src/game/proceduralTextures.ts —— main.ts 仅 import 需要的函数。

function createTextSprite(text: string, accent: string): Sprite {
  const layout = textSpriteLayout(text);
  const canvas = document.createElement("canvas");
  canvas.width = layout.canvasWidth;
  canvas.height = layout.canvasHeight;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Failed to create label context");
  }

  // 紧凑 pill：背板透明度更低（rgba 0.36），细金边，让山河地形透出来不抢戏。
  context.fillStyle = "rgba(7, 13, 14, 0.42)";
  context.strokeStyle = "rgba(235, 214, 155, 0.32)";
  context.lineWidth = 1.4;
  context.beginPath();
  context.roundRect(
    layout.rect.x,
    layout.rect.y,
    layout.rect.width,
    layout.rect.height,
    layout.rect.radius
  );
  context.fill();
  context.stroke();

  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `600 ${layout.fontSize}px 'Noto Sans SC', 'PingFang SC', sans-serif`;
  // 文本先描一圈深色 stroke，再叠 accent 实色——保证亮地貌（沙土黄）上
  // 也读得清，不依赖背板厚度。
  context.lineWidth = 4;
  context.strokeStyle = "rgba(7, 13, 14, 0.85)";
  context.strokeText(text, layout.text.x, layout.text.y);
  context.fillStyle = accent;
  context.fillText(text, layout.text.x, layout.text.y);

  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;

  const material = new SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    // depthTest: false 是 Sprite + transparent 通常要的组合（开 depthTest 后
    // 画面里 sprite 整体看不到——Three.js Sprite 在 transparent pass 的深度处理
    // 跟普通 Mesh 不一致，会被 opaque pass 留下的深度全部刷掉）。
    // 山体遮挡改用 software raycast 在主循环里 hide—— updateLabelOcclusion()
    // 沿 camera→label 线段采样 terrainSampler，比 GPU 深度测试可靠。
    depthTest: false
  });

  const sprite = new Sprite(material);
  sprite.scale.set(layout.scale.x, layout.scale.y, 1);
  sprite.renderOrder = 90;
  return sprite;
}

const fragmentGlowTexture = createCircleTexture(
  "rgba(249, 233, 170, 0.95)",
  "rgba(249, 233, 170, 0)"
);
const fragmentHaloTexture = createCircleTexture(
  "rgba(109, 206, 188, 0.35)",
  "rgba(109, 206, 188, 0)"
);

const landmarkGroup = new Group();
scene.add(landmarkGroup);

const fragmentGroup = new Group();
scene.add(fragmentGroup);

const waterSystemGroup = new Group();
scene.add(waterSystemGroup);

const hydrographyRibbonsGroup = new Group();
hydrographyRibbonsGroup.name = "hydrography-ribbons";
scene.add(hydrographyRibbonsGroup);

const riverVegetationGroup = new Group();
scene.add(riverVegetationGroup);

const wildlifeGroup = new Group();
scene.add(wildlifeGroup);
let wildlifeHandle: WildlifeHandle | null = null;
let wildlifeVisibleChunkKey = "";

const routeGroup = new Group();
scene.add(routeGroup);

const cityMarkersGroup = new Group();
scene.add(cityMarkersGroup);
let cityMarkersHandle: CityMarkersHandle | null = null;

// 名胜（scenic）单独一个 group——POI 的 mesh 跟 landmarks/cities 不一致
// （每个 POI 都是组合体），独立路径方便管理 dispose 和 LOD。
const scenicGroup = new Group();
scene.add(scenicGroup);
const scenicLabelSprites: Sprite[] = [];

// 考古（ancient）跟 scenic 同思路独立一个 group：3D mesh 跟其它景点风格
// 不一样（夯土台 + 文物缩影），分组也方便 atlas 层切换 toggle 整层。
const ancientGroup = new Group();
scene.add(ancientGroup);
const ancientLabelSprites: Sprite[] = [];
// 城市名签 sprites 按档分组 track，方便：
// 1) 重建 region 时显式 dispose 它们的 SpriteMaterial + CanvasTexture
//    （cityMarkersGroup.clear() 只 detach 不 dispose——codex b50e5c6 抓到）
// 2) LOD fade 时按档分别调整 opacity（capital 始终亮、prefecture 中距
//    fade out、county 近距才显）
const cityLabelSpritesByTier: { capital: Sprite[]; prefecture: Sprite[] } = {
  capital: [],
  prefecture: []
};
// county 名签按 proximity reveal：每个县城预创建一个 hidden sprite，
// nearbyRealCity 是 county 时显示对应的那个，否则全部隐藏。
const countyLabelSpriteByCityId = new Map<string, Sprite>();
// 关隘石碑名签 sprites，跟 prefecture tier 同档 fade（170-240）。
const passLandmarkLabelSprites: Sprite[] = [];
const allDistanceLimitedLabelSprites: Sprite[] = [];
// 河流 / 古道 名签——之前没接 LOD，远距离仍漂浮；用户反馈"标签离得太远
// 就不要显示了"，按 priority 分两档：
//   river major (priority>=9, e.g. 渭河/汉水/嘉陵江)：跟 prefecture 同档 170-240
//   river tributary (priority<9，褒水/斜水等支流)：跟 county 同档 70-140
//   route：跟 prefecture 同档 170-240
const riverLabelSpritesByTier: { major: Sprite[]; tributary: Sprite[] } = {
  major: [],
  tributary: []
};
const routeLabelSprites: Sprite[] = [];
let routePlankRoadHandle: PlankRoadHandle | null = null;
let allHudPois: RuntimePoiInfo[] = [];
const hudPoiBySourceKey = new Map<string, RuntimePoiInfo>();
const discoveredPoiIds = new Set<string>();
let lastProximityPoiId: string | null = null;
let footstepPulseTimerMs = 0;
let oxMooTimerMs = 0;
let audioHudTimerMs = 0;

function handlePoiEntryAudio(poi: RuntimePoiInfo): void {
  // 用户反馈"新发现 chime 难听"——已从 manifest + 触发器移除。
  if (!discoveredPoiIds.has(poi.id)) {
    discoveredPoiIds.add(poi.id);
  }

  if (poi.category === "scenic") {
    if (Math.random() < 0.1) {
      triggerSystem.fire("cultural_guqin_pluck", {
        volume: 0.42,
        reason: `scenic cue: ${poi.name} guqin`
      });
    }
    if (Math.random() < 0.05) {
      triggerSystem.fire("cultural_dizi_flute", {
        volume: 0.34,
        reason: `scenic cue: ${poi.name} dizi`
      });
    }
  }

  if (TEMPLE_POI_PATTERN.test(poi.name)) {
    if (Math.random() < 0.3) {
      triggerSystem.fire("cultural_temple_bell", {
        volume: 0.5,
        reason: `temple cue: ${poi.name} bell`
      });
    }
    if (Math.random() < 0.1) {
      triggerSystem.fire("cultural_wooden_fish", {
        volume: 0.42,
        reason: `temple cue: ${poi.name} wooden fish`
      });
    }
  }
}

function triggerNearbyCraneAudio(elapsedTime: number): void {
  if (!wildlifeHandle) {
    return;
  }

  const craneInstances = wildlifeHandle.instancesByKind.crane;
  for (const crane of craneInstances) {
    const pose = computeWildlifePose(crane, elapsedTime, crane.sampler);
    const distance = Math.hypot(
      pose.position.x - player.position.x,
      pose.position.z - player.position.z
    );
    if (distance < CRANE_AUDIO_RADIUS) {
      triggerSystem.fire("cultural_crane_call", {
        volume: 0.5,
        reason: "wildlife: crane nearby"
      });
      return;
    }
  }
}

function refreshAudioDebugHud(): void {
  audioDebugHud.refresh({
    activeLayers: ambientMixer.getActiveLayers(),
    recentFires: triggerSystem.getRecentFires(5),
    nowSec: audioRuntime.context.currentTime,
    masterGainValue: audioRuntime.masterGain.gain.value
  });
}

function hideHoverCard(): void {
  hoverPointerActive = false;
  hoverPointerDirty = false;
  lastHoveredPoi = null;
  poiHoverHud.hide();
}

function trackDistanceLimitedLabelSprite(label: Sprite): void {
  label.userData.maxLabelDistance = labelMaxRenderDistance(label.scale.y);
  allDistanceLimitedLabelSprites.push(label);
}

function buildHudPoiId(prefix: string, name: string, worldX: number, worldZ: number): string {
  return `${prefix}:${name}:${Math.round(worldX * 100)}:${Math.round(worldZ * 100)}`;
}

function poiSourceKey(category: RuntimePoiInfo["category"], sourceId: string): string {
  return `${category}:${sourceId}`;
}

function isPoiHudSuppressed(): boolean {
  return (
    atlasWorkbench.isFullscreen ||
    cityDetailPanelOpen ||
    journalOpen ||
    customizationPanelOpen
  );
}

function poiProximityRadius(poi: RuntimePoiInfo): number {
  if (poi.category !== "city") {
    return PROXIMITY_RADIUS_DEFAULT;
  }

  if (poi.cityTier === "capital") {
    return PROXIMITY_RADIUS_CITY_CAP;
  }
  if (poi.cityTier === "prefecture") {
    return PROXIMITY_RADIUS_CITY_PREF;
  }
  return PROXIMITY_RADIUS_CITY_COUNTY;
}

function findHoveredPoi(): RuntimePoiInfo | null {
  if (!terrainSampler || !hoverPointerActive || isDragging || isPoiHudSuppressed()) {
    return null;
  }

  hoverRaycaster.setFromCamera(hoverPointer, camera);

  const hoverTargets = getPoiHoverTargets();
  const intersections = hoverRaycaster.intersectObjects(hoverTargets, false);
  const hoveredPoi = findHoveredPoiFromIntersections(intersections, (object, instanceId) => {
    const nextCity = cityMarkersHandle
      ? cityFromMarkerIntersection(cityMarkersHandle, object, instanceId)
      : null;
    if (!nextCity) {
      return null;
    }
    return hudPoiBySourceKey.get(poiSourceKey("city", nextCity.id)) ?? null;
  }) as RuntimePoiInfo | null;

  if (window.HUD_DEBUG) {
    hudDebugWarn("findHoveredPoi", {
      hoverTargets: hoverTargets.length,
      intersections: intersections.length,
      targetId: hoveredPoi?.id ?? null
    });
  }

  return hoveredPoi;
}

function syncPoiHoverHud(): void {
  if (!terrainSampler || isPoiHudSuppressed()) {
    hoverPointerDirty = false;
    lastHoveredPoi = null;
    poiHoverHud.hide();
    return;
  }

  let hoverTarget: RuntimePoiInfo | null = null;
  if (hoverPointerActive && !isDragging) {
    hoverFrameCounter += 1;
    const shouldRefreshHover =
      hoverPointerDirty || hoverFrameCounter % POI_HOVER_SYNC_INTERVAL === 0;
    if (shouldRefreshHover) {
      lastHoveredPoi = findHoveredPoi();
      hoverPointerDirty = false;
    }
    hoverTarget = lastHoveredPoi;
  } else {
    hoverPointerDirty = false;
    lastHoveredPoi = null;
  }

  const proximityTarget = findNearestProximityPoi(
    player.position.x,
    player.position.z,
    allHudPois,
    poiProximityRadius
  ) as RuntimePoiInfo | null;
  const update = resolveHudTargetSource(hoverTarget, proximityTarget);
  if (window.HUD_DEBUG) {
    hudDebugWarn("syncPoiHoverHud", {
      hoverTargetId: hoverTarget?.id ?? null,
      proximityTargetId: proximityTarget?.id ?? null,
      resolvedTargetId: update.target?.id ?? null,
      source: update.source
    });
  }

  if (proximityTarget?.id !== lastProximityPoiId) {
    if (proximityTarget) {
      handlePoiEntryAudio(proximityTarget);
    }
    lastProximityPoiId = proximityTarget?.id ?? null;
  }

  poiHoverHud.setTarget(update.target, update.source);
}

function rebuildHudPoiCatalog(): void {
  if (!terrainSampler?.asset.bounds) {
    allHudPois = [];
    hudPoiBySourceKey.clear();
    return;
  }

  const sampler = terrainSampler;
  const bounds = sampler.asset.bounds!;
  const world = sampler.asset.world;
  const nextPois: RuntimePoiInfo[] = [];
  hudPoiBySourceKey.clear();

  realQinlingCities
    .filter(
      (city) =>
        city.lat >= bounds.south &&
        city.lat <= bounds.north &&
        city.lon >= bounds.west &&
        city.lon <= bounds.east
    )
    .forEach((city) => {
      const worldPoint = projectGeoToWorld({ lat: city.lat, lon: city.lon }, bounds, world);
      const elevation = gameHeightToRealMeters(
        sampler.sampleSurfaceHeight(worldPoint.x, worldPoint.z) / TERRAIN_VERTICAL_EXAGGERATION,
        sampler.asset
      );
      const poi: RuntimePoiInfo = {
        id: buildHudPoiId("city", city.name, worldPoint.x, worldPoint.z),
        name: city.name,
        category: "city",
        worldX: worldPoint.x,
        worldZ: worldPoint.z,
        elevation,
        realLat: city.lat,
        realLon: city.lon,
        description: city.description ?? city.hint,
        cityTier: city.tier
      };
      nextPois.push(poi);
      hudPoiBySourceKey.set(poiSourceKey("city", city.id), poi);
    });

  qinlingScenicLandmarks
    .filter(
      (spot) =>
        spot.lat >= bounds.south &&
        spot.lat <= bounds.north &&
        spot.lon >= bounds.west &&
        spot.lon <= bounds.east
    )
    .forEach((spot) => {
      const worldPoint = projectGeoToWorld({ lat: spot.lat, lon: spot.lon }, bounds, world);
      const elevation = gameHeightToRealMeters(
        sampler.sampleSurfaceHeight(worldPoint.x, worldPoint.z) / TERRAIN_VERTICAL_EXAGGERATION,
        sampler.asset
      );
      const poi: RuntimePoiInfo = {
        id: buildHudPoiId("scenic", spot.name, worldPoint.x, worldPoint.z),
        name: spot.name,
        category: "scenic",
        worldX: worldPoint.x,
        worldZ: worldPoint.z,
        elevation,
        realLat: spot.lat,
        realLon: spot.lon,
        description: spot.summary
      };
      nextPois.push(poi);
      hudPoiBySourceKey.set(poiSourceKey("scenic", spot.id), poi);
    });

  qinlingAncientSites
    .filter(
      (site) =>
        site.lat >= bounds.south &&
        site.lat <= bounds.north &&
        site.lon >= bounds.west &&
        site.lon <= bounds.east
    )
    .forEach((site) => {
      const worldPoint = projectGeoToWorld({ lat: site.lat, lon: site.lon }, bounds, world);
      const elevation = gameHeightToRealMeters(
        sampler.sampleSurfaceHeight(worldPoint.x, worldPoint.z) / TERRAIN_VERTICAL_EXAGGERATION,
        sampler.asset
      );
      const poi: RuntimePoiInfo = {
        id: buildHudPoiId("ancient", site.name, worldPoint.x, worldPoint.z),
        name: site.name,
        category: "ancient",
        worldX: worldPoint.x,
        worldZ: worldPoint.z,
        elevation,
        realLat: site.lat,
        realLon: site.lon,
        description: site.summary
      };
      nextPois.push(poi);
      hudPoiBySourceKey.set(poiSourceKey("ancient", site.id), poi);
    });

  landmarks
    .filter((landmark) => landmark.kind === "pass")
    .forEach((landmark) => {
      const geo = unprojectWorldToGeo(
        { x: landmark.position.x, z: landmark.position.y },
        bounds,
        world
      );
      const elevation = gameHeightToRealMeters(
        sampler.sampleSurfaceHeight(landmark.position.x, landmark.position.y) /
          TERRAIN_VERTICAL_EXAGGERATION,
        sampler.asset
      );
      const poi: RuntimePoiInfo = {
        id: buildHudPoiId("pass", landmark.name, landmark.position.x, landmark.position.y),
        name: landmark.name,
        category: "pass",
        worldX: landmark.position.x,
        worldZ: landmark.position.y,
        elevation,
        realLat: geo.lat,
        realLon: geo.lon,
        description: landmark.description
      };
      nextPois.push(poi);
      hudPoiBySourceKey.set(poiSourceKey("pass", landmark.name), poi);
    });

  allHudPois = nextPois;
}

/**
 * 距离视角分档 fade：camera 远了 county 先消失、再 prefecture 消失，
 * capital 始终保持。让相机拉远时画面信息密度自动降级，符合用户"分层
 * 加载、远的不展示"的诉求。淡入淡出用 smoothstep，避免 snap 跳变。
 *
 * cameraDistance 在 26 (近) 到 170 (远) 之间。新阈值（提高保留范围）：
 *   county        : 0..70 全亮，70..140 fade 到 0
 *   prefecture    : 0..170 全亮，170..240 fade 到 0（默认相机 118 全亮，
 *                   按 O 切到 overview 170 仍接近全亮）
 *   capital       : 始终 1
 * 用户反馈"城市在摄像头变化时容易消失"——之前 prefecture fade 100-160
 * 让默认 118 距离已经在 fade 中段（69% opacity），按 O 直接消失。
 */
function updateCityLodFade(): void {
  lodOcclusionFrameCounter += 1;
  // 用渲染相机的实际位置算距离，而不是 target 的 cameraDistance——
  // cameraDistance 改变时（按 o/f 或滚轮）相机用 lerp 缓动跟过去，立即
  // 用 target 算 LOD 会让 city 在画面相机还没到位时就 fade 到 0，跳变
  // 仍然存在。codex eec2f37 P1 抓到。
  const distance = camera.position.distanceTo(lookTarget);
  // 树 fade 不依赖 cityMarkers——standalone DEM（没有 bounds、不建城市）
  // 也要享受 LOD（codex c039a4b P2 抓到）。所以放在 cityMarkersHandle
  // gate 之前。相机拉远（distance > 110）开始 fade，distance > 165 完全
  // 消失。复用共享 material，不动 instance 数。
  // 2026-05 codex 调查：之前 fade 窗口 110-165 / 70-140 / 170-240 设得
  // 太紧——qinlingCameraRig.maxDistance = 170 (按 O 键 overview)，camera
  // 实测距离 172，正好踩到 treeAlpha=0 / countyAlpha=0 的死亡区。结果
  // "按一下 O 键 → 树和小城瞬间消失，按 F 又出现"。fade 窗口必须把
  // 170 安全地放在 "全亮" 半区里。
  const treeAlpha = 1 - MathUtils.smoothstep(distance, 200, 280);
  sharedTreeMaterial.opacity = treeAlpha;
  sharedTreeMaterial.visible = treeAlpha > 0.01;
  sharedWildlifeMaterials.forEach((material) => {
    material.opacity = treeAlpha;
    material.visible = treeAlpha > 0.01;
  });
  // 关隘石碑跟 prefecture 同档 fade。
  const passAlpha = 1 - MathUtils.smoothstep(distance, 240, 320);
  passSteleMaterial.opacity = passAlpha;
  passSteleMaterial.visible = passAlpha > 0.01;
  passSteleCapMaterial.opacity = passAlpha;
  passSteleCapMaterial.visible = passAlpha > 0.01;
  for (const sprite of passLandmarkLabelSprites) {
    sprite.material.opacity = passAlpha;
    sprite.visible = passAlpha > 0.01;
  }
  if (!cityMarkersHandle) return;
  const countyAlpha = 1 - MathUtils.smoothstep(distance, 190, 260);
  const prefectureAlpha = 1 - MathUtils.smoothstep(distance, 240, 320);
  const capitalAlpha = 1.0;
  cityMarkersHandle.tierMaterials.county.opacity = countyAlpha;
  cityMarkersHandle.tierMaterials.county.visible = countyAlpha > 0.01;
  // 跟着 county wall 一起 fade：proximity reveal 出来的 county 名签
  // 在镜头拉远时也得隐藏；zoom 回来又要恢复（如果还在 nearby）。所以
  // visible 由 alpha 阈值 + 是否就是 nearbyRealCity 共同决定（codex
  // 8171d2e P2 抓到 zoom out + zoom in 不动 player 时标签卡死隐藏）。
  countyLabelSpriteByCityId.forEach((sprite, cityId) => {
    sprite.material.opacity = countyAlpha;
    const isNearby =
      nearbyRealCity?.tier === "county" && nearbyRealCity.id === cityId;
    sprite.visible = isNearby && countyAlpha > 0.01;
  });
  cityMarkersHandle.tierMaterials.prefecture.opacity = prefectureAlpha;
  cityMarkersHandle.tierMaterials.prefecture.visible = prefectureAlpha > 0.01;
  cityMarkersHandle.tierMaterials.capital.opacity = capitalAlpha;
  for (const sprite of cityLabelSpritesByTier.prefecture) {
    sprite.material.opacity = prefectureAlpha;
    sprite.visible = prefectureAlpha > 0.01;
  }
  // capital 名签（西安/成都）：本来 opacity 恒 1，但用户要求"标签离得太远
  // 就不要显示了"——给一档软 fade 250..330，覆盖飞镜头到 region 边缘的
  // 极端情况。默认相机 26..170 全程 1.0 不变。
  const capitalLabelAlpha = 1 - MathUtils.smoothstep(distance, 250, 330);
  for (const sprite of cityLabelSpritesByTier.capital) {
    sprite.material.opacity = capitalLabelAlpha;
    sprite.visible = capitalLabelAlpha > 0.01;
  }
  // 河流名签：major（渭河/汉水/嘉陵江）跟 prefecture 同档；tributary
  // （褒水/斜水等）跟 county 同档，远了就先隐去支流标签减少视觉噪声。
  for (const sprite of riverLabelSpritesByTier.major) {
    sprite.material.opacity = prefectureAlpha;
    sprite.visible = prefectureAlpha > 0.01;
  }
  for (const sprite of riverLabelSpritesByTier.tributary) {
    sprite.material.opacity = countyAlpha;
    sprite.visible = countyAlpha > 0.01;
  }
  // 古道名签跟 prefecture 同档（陈仓道/剑门蜀道这种主轴线索）。
  for (const sprite of routeLabelSprites) {
    sprite.material.opacity = prefectureAlpha;
    sprite.visible = prefectureAlpha > 0.01;
  }
  // 名胜（太白山/青城山/法门寺...）也走 prefecture LOD：日常视距全亮，
  // overview 拉远才淡出。比 county 优先级高（地标性强），但不至于挂到
  // capital 那么硬。
  for (const sprite of scenicLabelSprites) {
    sprite.material.opacity = prefectureAlpha;
    sprite.visible = prefectureAlpha > 0.01;
  }
  // 考古（三星堆/金沙/大地湾）跟 scenic 同档 LOD。
  for (const sprite of ancientLabelSprites) {
    sprite.material.opacity = prefectureAlpha;
    sprite.visible = prefectureAlpha > 0.01;
  }
  // ── 远距 mesh 一并隐去（用户："离得太远的话，这些东西都不要显示"）──
  // 用 farMeshAlpha = 1 - smoothstep(distance, 250, 330)：默认 26..170 全亮，
  // overview 170 接近 1，250+ 才开始淡出。3D 主网格（树/河/山）这套距离
  // 上根本看不见，这 fade 是给 fly mode 或未来 zoom-out 提前做的防御。
  const farMeshAlpha = 1 - MathUtils.smoothstep(distance, 250, 330);
  const farMeshVisible = farMeshAlpha > 0.01;
  // 名胜 / 考古 group 整组 visibility 用 alpha 硬切（材料已在 scenicMaterials
  // 上 transparent: true，可读 opacity）。Three.js Material 上设 opacity 一次
  // 就改所有共享 material 实例。
  Object.values(scenicMaterials).forEach((mat) => {
    mat.opacity = farMeshAlpha * (mat === scenicMaterials.karstWater ? 0.92 : 1);
    mat.visible = farMeshVisible;
  });
  Object.values(ancientMaterials).forEach((mat) => {
    mat.opacity = farMeshAlpha;
    mat.visible = farMeshVisible;
  });
  // capital 城墙 mesh：之前 capitalAlpha=1 永亮；现在远距也跟着隐。
  if (cityMarkersHandle) {
    cityMarkersHandle.tierMaterials.capital.opacity = farMeshAlpha;
    cityMarkersHandle.tierMaterials.capital.visible = farMeshVisible;
  }
  // 山体遮挡（occlusion）：用 terrainSampler 沿 camera→label 线段做软光线
  // 步进，碰到任何采样点高度 > 当前线段高度，就把 sprite.visible 设为 false。
  // 比 GPU depthTest 可靠（Three.js Sprite + transparent + depthTest 实测整体
  // 不渲染，疑似 transparent pass 不读 opaque pass 写的深度）。这里改成
  // 24 步 + sampleSurfaceHeight：远视野每步约 10u，能命中秦岭窄山脊，且跟
  // GPU 三角化表面一致，不会在陡坡上低估地表高度。
  if (terrainSampler) {
    const sampler = terrainSampler;
    const cameraWorld = camera.position;
    const shouldRunOcclusion =
      lodOcclusionFrameCounter % CITY_LOD_OCCLUSION_INTERVAL === 0;
    const occlude = (sprite: Sprite): void => {
      const chunkId =
        typeof sprite.userData.chunkId === "string" ? sprite.userData.chunkId : null;
      if (chunkId && visibleChunkIds.size > 0 && !visibleChunkIds.has(chunkId)) {
        sprite.visible = false;
        return;
      }
      if (!sprite.visible) return; // 已经被距离 fade 隐去就不必再算
      if (shouldRunOcclusion) {
        sprite.userData.cachedTerrainOccluded = isSpriteOccludedByTerrain({
          camera: cameraWorld,
          target: sprite.position,
          sampler
        });
      }
      if (sprite.userData.cachedTerrainOccluded === true) {
        sprite.visible = false;
      }
    };
    cityLabelSpritesByTier.capital.forEach(occlude);
    cityLabelSpritesByTier.prefecture.forEach(occlude);
    countyLabelSpriteByCityId.forEach(occlude);
    passLandmarkLabelSprites.forEach(occlude);
    riverLabelSpritesByTier.major.forEach(occlude);
    riverLabelSpritesByTier.tributary.forEach(occlude);
    routeLabelSprites.forEach(occlude);
    scenicLabelSprites.forEach(occlude);
    ancientLabelSprites.forEach(occlude);
  }
}

function updateLabelVisibility(): void {
  const visibility = computeLabelVisibility(
    allDistanceLimitedLabelSprites,
    {
      cameraPosition: camera.position,
      cameraFovDeg: camera.fov,
      canvasHeightPx: renderer.domElement.clientHeight,
      maxScreenHeightPx: 110
    }
  );

  visibility.forEach((isWithinDistance, index) => {
    const label = allDistanceLimitedLabelSprites[index];

    if (!label?.parent || !label.visible) {
      return;
    }
    label.visible = isWithinDistance;
  });
}

function disposeCityLabelSprites(): void {
  (["capital", "prefecture"] as const).forEach((tier) => {
    for (const sprite of cityLabelSpritesByTier[tier]) {
      const material = sprite.material;
      if (material instanceof SpriteMaterial) {
        material.map?.dispose();
        material.dispose();
      }
    }
    cityLabelSpritesByTier[tier].length = 0;
  });
  countyLabelSpriteByCityId.forEach((sprite) => {
    const material = sprite.material;
    if (material instanceof SpriteMaterial) {
      material.map?.dispose();
      material.dispose();
    }
  });
  countyLabelSpriteByCityId.clear();
}

const fragmentVisuals = new Map<string, FragmentVisual>();
type WaterEnvironmentMaterialRole = "ribbon" | "highlight" | "line";
type WaterEnvironmentMaterial = {
  material: MeshBasicMaterial | LineBasicMaterial;
  baseColor: Color;
  baseOpacity: number;
  style: ReturnType<typeof waterVisualStyle>;
  role: WaterEnvironmentMaterialRole;
};
const waterEnvironmentMaterials: WaterEnvironmentMaterial[] = [];

function clearGroup(group: Group): void {
  while (group.children.length > 0) {
    const child = group.children[0];

    if (!child) {
      continue;
    }

    group.remove(child);

    // 标记为共享资源的对象的 geometry / material 由 owning 模块维护，
    // 这里只移除 scene graph 节点，不 dispose。
    const isShared = child.userData?.sharedResources === true;

    if (!isShared && (child instanceof Mesh || child instanceof Line)) {
      child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach((material) => material.dispose());
      } else {
        child.material.dispose();
      }
    } else if (!isShared && child instanceof Sprite) {
      child.material.dispose();
    }
  }
}

// 全局共享 material：避免每个 landmark / gate post 都 new，减少 GPU
// 状态切换和材质实例数。clearGroup 不会 dispose 这些（共享，下一次 rebuild 复用）。
const landmarkMaterials = {
  pass: new MeshPhongMaterial({
    color: 0xd7a354,
    emissive: 0x4d2d10,
    flatShading: true
  }),
  river: new MeshPhongMaterial({
    color: 0x5fb8d0,
    emissive: 0x111111,
    flatShading: true
  }),
  mountain: new MeshPhongMaterial({
    color: 0xded5c3,
    emissive: 0x111111,
    flatShading: true
  }),
  city: new MeshPhongMaterial({
    color: 0x91b67c,
    emissive: 0x252111,
    flatShading: true
  }),
  plain: new MeshPhongMaterial({
    color: 0x91b67c,
    emissive: 0x111111,
    flatShading: true
  })
};
// 几何共享。pass 现在按 subKind 走 helper 里的多档造型；这里保留 stele
// 三件套引用，给 memorial-stele fallback 继续复用。
const landmarkGeometries = {
  city: new CylinderGeometry(0.18, 0.48, 2.8, 5),
  generic: new CylinderGeometry(0.14, 0.36, 2.4, 4),
  stele: passLandmarkGeometries.stele,
  steleBase: passLandmarkGeometries.steleBase,
  steleCap: passLandmarkGeometries.steleCap
};

// stele 自己的灰岩石材质，与原 pass 黄棕色（landmarkMaterials.pass）区分。
const passSteleMaterial = new MeshPhongMaterial({
  color: 0xa8a294,
  emissive: 0x2c2820,
  flatShading: true,
  shininess: 4,
  transparent: true,
  opacity: 1
});
const passSteleCapMaterial = new MeshPhongMaterial({
  color: 0x6e655a,
  emissive: 0x1c1812,
  flatShading: true,
  shininess: 6,
  transparent: true,
  opacity: 1
});

const scenicMaterials = {
  alpineRock: new MeshPhongMaterial({
    color: 0x9a8e7c, emissive: 0x16100a, flatShading: true, shininess: 6,
    transparent: true, opacity: 1
  }),
  alpineSnow: new MeshPhongMaterial({
    color: 0xeef2f5, emissive: 0x1a1d20, flatShading: true, shininess: 28,
    transparent: true, opacity: 1
  }),
  forestGreen: new MeshPhongMaterial({
    color: 0x416b3c, emissive: 0x0e1a0c, flatShading: true, shininess: 3,
    transparent: true, opacity: 1
  }),
  pavilionWall: new MeshPhongMaterial({
    color: 0xc89866, emissive: 0x1f120a, flatShading: true, shininess: 8,
    transparent: true, opacity: 1
  }),
  pavilionRoof: new MeshPhongMaterial({
    color: 0x6c2f1f, emissive: 0x180a06, flatShading: true, shininess: 12,
    transparent: true, opacity: 1
  }),
  karstWater: new MeshPhongMaterial({
    color: 0x4cb6c4, emissive: 0x1c4a52, flatShading: true, shininess: 60,
    transparent: true, opacity: 0.92
  }),
  karstTree: new MeshPhongMaterial({
    color: 0x2e5a3c, emissive: 0x0a1808, flatShading: true, shininess: 2,
    transparent: true, opacity: 1
  }),
  pagodaWall: new MeshPhongMaterial({
    color: 0xc25b3b, emissive: 0x32140c, flatShading: true, shininess: 14,
    transparent: true, opacity: 1
  }),
  pagodaBaseStone: new MeshPhongMaterial({
    color: 0x8c7b65, emissive: 0x18120c, flatShading: true, shininess: 4,
    transparent: true, opacity: 1
  }),
  mausoleumEarth: new MeshPhongMaterial({
    color: 0x8c7444, emissive: 0x1c1408, flatShading: true, shininess: 3,
    transparent: true, opacity: 1
  }),
  mausoleumStele: new MeshPhongMaterial({
    color: 0xb0a896, emissive: 0x201c14, flatShading: true, shininess: 8,
    transparent: true, opacity: 1
  }),
  // 黄龙：金黄色钙华水池（高反光仿水面 + 鎏金色调）。
  travertineGold: new MeshPhongMaterial({
    color: 0xe5b86b, emissive: 0x4a3110, flatShading: true, shininess: 65,
    transparent: true, opacity: 0.94
  }),
  // 汉中天坑：井底色（极暗）和井沿色（青灰）。
  tiankengWell: new MeshPhongMaterial({
    color: 0x1c1f24, emissive: 0x06070a, flatShading: true, shininess: 1,
    transparent: true, opacity: 1
  }),
  tiankengRim: new MeshPhongMaterial({
    color: 0x8a8a82, emissive: 0x121212, flatShading: true, shininess: 6,
    transparent: true, opacity: 1
  })
};

// 考古（ancient）层独立 geometry / material 集合。
const ancientGeometries = {
  // 三星堆：方形夯土基座 (0.8 x 0.8 x 0.16) + 青铜立人柱（细圆柱顶端有横梁）。
  bronzePodium: new BoxGeometry(0.8, 0.16, 0.8),
  bronzePillar: new CylinderGeometry(0.05, 0.06, 0.7, 6),
  bronzeCrossbar: new BoxGeometry(0.30, 0.06, 0.06),
  // 金沙：方形低台 + 太阳神鸟金箔（薄金色圆盘，立在台上）。
  jinshaPodium: new BoxGeometry(0.7, 0.12, 0.7),
  sunBirdDisk: new CylinderGeometry(0.25, 0.25, 0.02, 24),
  // 大地湾 / 半坡 共用：F901 仰韶大房址——圆形夯土平台 + 4 根复原柱础。
  yangshaoPlatform: new CylinderGeometry(0.75, 0.80, 0.10, 18),
  yangshaoPost: new CylinderGeometry(0.05, 0.06, 0.4, 6),
  // 兵马俑：阵列 1 排 6 兵俑（5 cylinder + 头球）+ 2 块带边土坑边缘。
  terracottaSoldier: new CylinderGeometry(0.05, 0.06, 0.3, 6),
  terracottaHead: new SphereGeometry(0.05, 6, 6),
  terracottaPit: new BoxGeometry(1.25, 0.06, 0.40),
  // 帝陵：三层阶梯方台 + 顶部四棱锥，统一表现关中大型封土。
  imperialTombMound: buildImperialTombMound(0.6)
};

const ancientMaterials = {
  earthFoundation: new MeshPhongMaterial({
    color: 0x8e6f4a, emissive: 0x1a120a, flatShading: true, shininess: 4,
    transparent: true, opacity: 1
  }),
  bronzeRelic: new MeshPhongMaterial({
    color: 0x6d6034, emissive: 0x141008, flatShading: true, shininess: 38,
    transparent: true, opacity: 1
  }),
  goldRelic: new MeshPhongMaterial({
    color: 0xdcb45a, emissive: 0x3a2a08, flatShading: true, shininess: 88,
    transparent: true, opacity: 1
  }),
  rammedEarth: new MeshPhongMaterial({
    color: 0xb59872, emissive: 0x1a120a, flatShading: true, shininess: 3,
    transparent: true, opacity: 1
  }),
  woodPost: new MeshPhongMaterial({
    color: 0x6f4f30, emissive: 0x140a06, flatShading: true, shininess: 4,
    transparent: true, opacity: 1
  }),
  // 兵马俑：陶土灰褐色（真品颜色）。
  terracottaClay: new MeshPhongMaterial({
    color: 0x8c6e54, emissive: 0x18120a, flatShading: true, shininess: 4,
    transparent: true, opacity: 1
  }),
  // 帝陵封土：更偏黄土色，跟城市夯土和一般遗址台基拉开层次。
  imperialTombEarth: new MeshPhongMaterial({
    color: 0xa7895a, emissive: 0x1c1408, flatShading: true, shininess: 3,
    transparent: true, opacity: 1
  })
};

// 真实 instanced city marker 已经覆盖的"意象"地标位置——这些 legacy
// kind=city POI 留着会和真实城市 mesh 重叠，需要从渲染 + HUD 一起过滤。
// 注意：成都平原 的坐标 (-44,104) 跟真实 成都 (~-71,107) 不重合，是
// 盆地标签不是城市，保留。
const LEGACY_OVERLAPPING_CITY_NAMES = new Set(["长安意象", "汉中盆地"]);

function isLegacyOverlappingCityLandmark(landmark: Landmark): boolean {
  return landmark.kind === "city" && LEGACY_OVERLAPPING_CITY_NAMES.has(landmark.name);
}

// 把真实城市投影到当前 region 的世界坐标，用作 HUD nearest 候选（不进
// landmarkGroup 渲染——visual marker 是 cityMarkers 那条独立路径）。
function realCityLandmarksForHud(): Landmark[] {
  const bounds = terrainSampler?.asset.bounds;
  const world = terrainSampler?.asset.world;
  if (!bounds || !world) return [];
  return realQinlingCities
    .filter(
      (city) =>
        city.lat >= bounds.south &&
        city.lat <= bounds.north &&
        city.lon >= bounds.west &&
        city.lon <= bounds.east
    )
    .map((city) => {
      const wp = projectGeoToWorld({ lat: city.lat, lon: city.lon }, bounds, world);
      const tierLabel =
        city.tier === "capital" ? "京城" : city.tier === "prefecture" ? "州府" : "县城";
      return {
        name: city.name,
        kind: "city" as LandmarkKind,
        position: new Vector2(wp.x, wp.z),
        description: city.hint ?? `${tierLabel}`
      };
    });
}

function rebuildLandmarkVisuals(): void {
  clearGroup(landmarkGroup);
  invalidatePoiHoverTargets();
  landmarkChunkIds.clear();
  passLandmarkLabelSprites.length = 0;

  if (window.HUD_DEBUG) {
    hudDebugWarn("rebuildLandmarkVisuals", {
      landmarkCount: landmarks.length,
      hudPoiCatalogSize: hudPoiBySourceKey.size
    });
  }

  landmarks.forEach((landmark) => {
    if (isLegacyOverlappingCityLandmark(landmark)) {
      return;
    }
    const hudPoi =
      landmark.kind === "pass"
        ? hudPoiBySourceKey.get(poiSourceKey("pass", landmark.name)) ?? null
        : null;
    const chunkId = regionChunkManifest
      ? findChunkForPosition(regionChunkManifest, landmark.position)?.id ?? null
      : null;
    landmarkChunkIds.set(landmark.name, chunkId);
    const ground = 0;
    if (landmark.kind === "pass") {
      // pass 按 subKind 分三档：major-pass 双层关楼、gorge-pass 谷道关楼、
      // memorial-stele 旧碑亭 fallback。所有 piece 继续记录 terrainYOffset，
      // 避免 sampler re-center 时被压回同一层。
      buildPassLandmarkMeshes({
        position: landmark.position,
        ground,
        chunkId,
        subKind: landmark.subKind,
        materials: {
          body: passSteleMaterial,
          accent: passSteleCapMaterial
        }
      }).forEach((piece) => {
        if (hudPoi) {
          attachHoverPoiMetadata(piece, hudPoi);
        } else if (window.HUD_DEBUG) {
          hudDebugWarn("pass landmark missing HUD metadata", {
            name: landmark.name,
            sourceKey: poiSourceKey("pass", landmark.name)
          });
        }
        landmarkGroup.add(piece);
        groundAnchorRegistry.register(`pass:${landmark.name}:${piece.name}`, {
          object: piece,
          worldX: piece.position.x,
          worldZ: piece.position.z,
          baseOffset: (piece.userData.terrainYOffset as number | undefined) ?? 0,
          category: "scenic"
        });
      });

      const label = createTextSprite(landmark.name, "#efcf83");
      label.scale.multiplyScalar(1.18);
      label.position.set(landmark.position.x, ground + 1.38, landmark.position.y);
      label.userData.chunkId = chunkId;
      label.userData.terrainYOffset = 1.38;
      if (hudPoi) {
        attachHoverPoiMetadata(label, hudPoi);
      } else if (window.HUD_DEBUG) {
        hudDebugWarn("pass landmark label missing HUD metadata", {
          name: landmark.name,
          sourceKey: poiSourceKey("pass", landmark.name)
        });
      }
      landmarkGroup.add(label);
      groundAnchorRegistry.register(`pass:${landmark.name}:label`, {
        object: label,
        worldX: landmark.position.x,
        worldZ: landmark.position.y,
        baseOffset: 1.38,
        category: "label"
      });
      passLandmarkLabelSprites.push(label);
      trackDistanceLimitedLabelSprite(label);
      return;
    }

    const geometry =
      landmark.kind === "city"
        ? landmarkGeometries.city
        : landmarkGeometries.generic;
    const material = landmarkMaterials[landmark.kind] ?? landmarkMaterials.plain;
    const marker = new Mesh(geometry, material);
    marker.position.set(landmark.position.x, ground + 1.8, landmark.position.y);
    marker.userData.chunkId = chunkId;
    marker.userData.sharedResources = true;
    marker.userData.terrainYOffset = 1.8;

    if (landmark.kind !== "plain") {
      const label = createTextSprite(landmark.name, "#f3ebd4");
      label.position.set(landmark.position.x, ground + 6.4, landmark.position.y);
      label.userData.chunkId = chunkId;
      label.userData.terrainYOffset = 6.4;
      landmarkGroup.add(label);
      groundAnchorRegistry.register(`landmark:${landmark.name}:label`, {
        object: label,
        worldX: landmark.position.x,
        worldZ: landmark.position.y,
        baseOffset: 6.4,
        category: "label"
      });
    }

    landmarkGroup.add(marker);
    groundAnchorRegistry.register(`landmark:${landmark.name}:marker`, {
      object: marker,
      worldX: landmark.position.x,
      worldZ: landmark.position.y,
      baseOffset: 1.8,
      category: "scenic"
    });
  });
}

// 名胜 POI 渲染：5 个独立组合体，每个都带 1 个 label + 多个 mesh。
// 调用时机跟 rebuildLandmarkVisuals 同步——rebuild 时 clear group + reset
// 标签数组（updateCityLodFade 闭包了 scenicLabelSprites 的引用）。
function rebuildScenicVisuals(): void {
  clearGroup(scenicGroup);
  invalidatePoiHoverTargets();
  scenicLabelSprites.length = 0;

  if (!terrainSampler?.asset.bounds) {
    return;
  }
  const bounds = terrainSampler.asset.bounds;
  const world = terrainSampler.asset.world;

  qinlingScenicLandmarks.forEach((spot) => {
    if (
      spot.lat < bounds.south ||
      spot.lat > bounds.north ||
      spot.lon < bounds.west ||
      spot.lon > bounds.east
    ) {
      return;
    }
    const wp = projectGeoToWorld(
      { lat: spot.lat, lon: spot.lon },
      bounds,
      world
    );
    const position = new Vector2(wp.x, wp.z);
    const chunkId = regionChunkManifest
      ? findChunkForPosition(regionChunkManifest, position)?.id ?? null
      : null;
    const hudPoi = hudPoiBySourceKey.get(poiSourceKey("scenic", spot.id));

    buildScenicPoiMeshes({
      chunkId,
      ground: 0,
      materials: scenicMaterials,
      position,
      role: spot.role
    }).forEach((mesh) => {
      if (hudPoi) {
        attachHoverPoiMetadata(mesh, hudPoi);
      }
      scenicGroup.add(mesh);
      groundAnchorRegistry.register(`scenic:${spot.id}:${mesh.name}`, {
        object: mesh,
        worldX: mesh.position.x,
        worldZ: mesh.position.z,
        baseOffset: (mesh.userData.terrainYOffset as number | undefined) ?? 0,
        category: "scenic"
      });
    });

    // 名胜 label 用青金色——区别于 pass 的 #efcf83，更靠近"名山古迹"
    // 调性。LOD fade 跟 prefecture 同档（updateCityLodFade 走遍数组）。
    const label = createTextSprite(spot.name, "#dde7c2");
    label.scale.multiplyScalar(1.05);
    const labelHeight = scenicPoiLabelHeights[spot.role] ?? scenicPoiLabelHeights["alpine-peak"];
    label.position.set(wp.x, labelHeight, wp.z);
    label.userData.terrainYOffset = labelHeight;
    label.userData.chunkId = chunkId;
    if (hudPoi) {
      attachHoverPoiMetadata(label, hudPoi);
    }
    scenicGroup.add(label);
    groundAnchorRegistry.register(`scenic:${spot.id}:label`, {
      object: label,
      worldX: wp.x,
      worldZ: wp.z,
      baseOffset: labelHeight,
      category: "label"
    });
    scenicLabelSprites.push(label);
    trackDistanceLimitedLabelSprite(label);
  });
}

// 考古 POI 渲染：3 个遗址，独立 group 跟 ancient atlas 层对齐。
function rebuildAncientVisuals(): void {
  clearGroup(ancientGroup);
  invalidatePoiHoverTargets();
  ancientLabelSprites.length = 0;

  if (!terrainSampler?.asset.bounds) {
    return;
  }
  const bounds = terrainSampler.asset.bounds;
  const world = terrainSampler.asset.world;

  qinlingAncientSites.forEach((site) => {
    if (
      site.lat < bounds.south ||
      site.lat > bounds.north ||
      site.lon < bounds.west ||
      site.lon > bounds.east
    ) {
      return;
    }
    const wp = projectGeoToWorld(
      { lat: site.lat, lon: site.lon },
      bounds,
      world
    );
    const position = new Vector2(wp.x, wp.z);
    const hudPoi = hudPoiBySourceKey.get(poiSourceKey("ancient", site.id));
    let pieceIndex = 0;

    const addPiece = (mesh: Mesh, yOffset: number, dx = 0, dz = 0): void => {
      const anchorId = `ancient:${site.id}:piece:${pieceIndex}`;
      pieceIndex += 1;
      mesh.position.set(wp.x + dx, yOffset, wp.z + dz);
      mesh.userData.terrainYOffset = yOffset;
      mesh.userData.sharedResources = true;
      mesh.userData.chunkId = regionChunkManifest
        ? findChunkForPosition(regionChunkManifest, position)?.id ?? null
        : null;
      if (hudPoi) {
        attachHoverPoiMetadata(mesh, hudPoi);
      }
      ancientGroup.add(mesh);
      groundAnchorRegistry.register(anchorId, {
        object: mesh,
        worldX: wp.x + dx,
        worldZ: wp.z + dz,
        baseOffset: yOffset,
        category: "ancient"
      });
    };

    let labelHeight = 4.4;

    if (site.role === "shu-bronze-altar") {
      // 三星堆：方形夯土基座 + 青铜立人柱（圆柱 + 顶端横梁意象纵目面具）。
      addPiece(new Mesh(ancientGeometries.bronzePodium, ancientMaterials.earthFoundation), 0.08);
      addPiece(new Mesh(ancientGeometries.bronzePillar, ancientMaterials.bronzeRelic), 0.52);
      addPiece(new Mesh(ancientGeometries.bronzeCrossbar, ancientMaterials.bronzeRelic), 0.85);
      labelHeight = 1.2;
    } else if (site.role === "shu-sun-bird") {
      // 金沙：低台 + 太阳神鸟金箔（薄圆盘竖立摆放）。
      addPiece(new Mesh(ancientGeometries.jinshaPodium, ancientMaterials.earthFoundation), 0.06);
      const disk = new Mesh(ancientGeometries.sunBirdDisk, ancientMaterials.goldRelic);
      disk.rotation.x = Math.PI / 2; // 竖起来
      addPiece(disk, 0.39);
      labelHeight = 0.9;
    } else if (site.role === "yangshao-dwelling") {
      // 大地湾 / 半坡 共用：圆形夯土平台 + 4 根复原柱础呈方阵。
      addPiece(new Mesh(ancientGeometries.yangshaoPlatform, ancientMaterials.rammedEarth), 0.05);
      const postOffsets: Array<[number, number]> = [
        [-0.36, -0.36], [0.36, -0.36], [-0.36, 0.36], [0.36, 0.36]
      ];
      postOffsets.forEach(([dx, dz]) => {
        addPiece(new Mesh(ancientGeometries.yangshaoPost, ancientMaterials.woodPost), 0.30, dx, dz);
      });
      labelHeight = 0.75;
    } else if (site.role === "qin-terracotta-army") {
      // 兵马俑：紧凑长条土坑（朝东西方向）+ 6 个兵俑的一排阵列。
      addPiece(new Mesh(ancientGeometries.terracottaPit, ancientMaterials.earthFoundation), 0.03);
      // 6 个兵俑成一排，沿 x 方向紧凑排布。每个兵 = 圆柱身 + 球头。
      for (let i = 0; i < 6; i += 1) {
        const dx = -0.525 + i * 0.21;
        addPiece(
          new Mesh(ancientGeometries.terracottaSoldier, ancientMaterials.terracottaClay),
          0.18,
          dx,
          0
        );
        addPiece(
          new Mesh(ancientGeometries.terracottaHead, ancientMaterials.terracottaClay),
          0.38,
          dx,
          0
        );
      }
      labelHeight = 0.7;
    } else if (site.role === "imperial-tomb") {
      // 帝陵：统一用阶梯式封土 mound，秦/汉/唐几座主陵都走同一视觉语汇。
      addPiece(
        new Mesh(ancientGeometries.imperialTombMound, ancientMaterials.imperialTombEarth),
        0
      );
      labelHeight = 1.5;
    }

    // 考古 label 用米白色，跟 scenic 的青金色稍区分；走 prefecture LOD。
    const label = createTextSprite(site.name, "#e7d8b3");
    label.scale.multiplyScalar(1.02);
    label.position.set(wp.x, labelHeight, wp.z);
    label.userData.terrainYOffset = labelHeight;
    label.userData.chunkId = regionChunkManifest
      ? findChunkForPosition(regionChunkManifest, position)?.id ?? null
      : null;
    if (hudPoi) {
      attachHoverPoiMetadata(label, hudPoi);
    }
    ancientGroup.add(label);
    groundAnchorRegistry.register(`ancient:${site.id}:label`, {
      object: label,
      worldX: wp.x,
      worldZ: wp.z,
      baseOffset: labelHeight,
      category: "label"
    });
    ancientLabelSprites.push(label);
    trackDistanceLimitedLabelSprite(label);
  });
}

// 共享 sprite material：所有 knowledge fragment 用同色 glow + halo。
const fragmentGlowMaterial = new SpriteMaterial({
  map: fragmentGlowTexture,
  color: 0xfff0a5,
  transparent: true,
  depthWrite: false
});
const fragmentHaloMaterial = new SpriteMaterial({
  map: fragmentHaloTexture,
  transparent: true,
  depthWrite: false
});

function rebuildFragmentVisuals(): void {
  clearGroup(fragmentGroup);
  fragmentVisuals.clear();

  knowledgeFragments.forEach((fragment, index) => {
    const chunkId = regionChunkManifest
      ? findChunkForPosition(regionChunkManifest, fragment.position)?.id ?? null
      : null;
    const ground = 0;

    const sprite = new Sprite(fragmentGlowMaterial);
    sprite.scale.set(2.5, 2.5, 1);
    sprite.position.set(fragment.position.x, ground + 3.5, fragment.position.y);
    sprite.userData.sharedResources = true;

    const halo = new Sprite(fragmentHaloMaterial);
    halo.scale.set(5.8, 5.8, 1);
    halo.position.set(fragment.position.x, ground + 2.2, fragment.position.y);
    halo.userData.sharedResources = true;

    fragmentGroup.add(halo, sprite);

    fragmentVisuals.set(fragment.id, {
      sprite,
      halo,
      baseY: ground + 3.5,
      phase: index * 0.8,
      chunkId
    });
  });
}

allDistanceLimitedLabelSprites.length = 0;
rebuildLandmarkVisuals();
rebuildScenicVisuals();
rebuildAncientVisuals();
rebuildFragmentVisuals();

// Atmosphere（sky dome + 云层 + 雨雪粒子）从 main.ts 抽出，便于独立演进 shader。
const skyDome = createSkyDome();
scene.add(skyDome.group);

const cloudLayer = createCloudLayer();
scene.add(cloudLayer.group);

const precipitationLayer = createPrecipitationLayer(240);
scene.add(precipitationLayer.points);

// 兼容旧引用（main 循环使用）
const skyDomeGroup = skyDome.group;
const skyShell = skyDome.shell;
const starDomeMaterial = skyDome.starDomeMaterial;
const sunSkyDisc = skyDome.sunDisc;
const sunSkyDiscMaterial = skyDome.sunDiscMaterial;
const moonSkyDisc = skyDome.moonDisc;
const moonSkyDiscMaterial = skyDome.moonDiscMaterial;
const cloudGroup = cloudLayer.group;
const cloudMaterial = cloudLayer.material;
const cloudSprites = cloudLayer.sprites;
const precipitation = precipitationLayer.points;
const precipitationMaterial = precipitationLayer.material;
const precipitationGeometry = precipitationLayer.geometry;
const precipitationPositions = precipitationLayer.positions;
const precipitationOffsets = precipitationLayer.offsets;
const precipitationCount = precipitationLayer.count;

let currentMode: ViewMode = "terrain";
const collectedIds = new Set<string>();
let selectedFragmentId: string | null = null;
let toastTimeout: number | null = null;
let journalOpen = false;
let cityDetailPanelOpen = false;
let cityDetailOpenCityId: string | null = null;
let lastTerrainColorSignature = "";
let lastScenerySeasonSignature = "";
let lastVisuals: EnvironmentVisuals | null = null;
let hudRefreshTimer = 0;
let hudDirty = true;
let horseMovementIntensity = 0;

function updateTerrainColors(visuals: EnvironmentVisuals): void {
  if (!terrainSampler) {
    return;
  }

  const color = new Color();
  const waterTint = new Color(0x4f8a8f);
  const wetBankTint = new Color(0x687f54);
  const vegetationTint = new Color(0x486b3f);

  for (let index = 0; index < positionAttribute.count; index += 1) {
    const x = positionAttribute.getX(index);
    const y = positionAttribute.getY(index);
    const z = positionAttribute.getZ(index);
    color.copy(
      modeColor(
        currentMode,
        x,
        z,
        y,
        terrainSampler,
        environmentController.state,
        visuals
      )
    );

    if (currentMode === "terrain" && visibleWaterFeatures.length > 0) {
      const influence = riverCorridorInfluenceAtPoint(x, z, visibleWaterFeatures);
      color.lerp(wetBankTint, influence.bank * 0.24);
      color.lerp(vegetationTint, influence.vegetation * 0.34);
      color.lerp(waterTint, influence.water * 0.38);
    }

    colorAttribute.setXYZ(index, color.r, color.g, color.b);
  }

  colorAttribute.needsUpdate = true;

  terrainChunkMeshes.forEach((terrainChunk) => {
    updateTerrainMeshColors(
      terrainChunk,
      currentMode,
      environmentController.state,
      visuals
    );
  });
}

function updateChunkScenerySeason(): void {
  terrainChunkMeshes.forEach((terrainChunk) => {
    if (!terrainChunk.scenery) {
      return;
    }
    updateSceneryColors(terrainChunk.scenery, environmentController.state.season);
  });
}

function disposeWildlifeVisuals(): void {
  if (!wildlifeHandle) {
    wildlifeVisibleChunkKey = "";
    return;
  }

  wildlifeGroup.remove(wildlifeHandle.group);
  disposeWildlife(wildlifeHandle);
  wildlifeHandle = null;
  wildlifeVisibleChunkKey = "";
}

function rebuildWildlifeVisuals(force = false): void {
  const eligibleChunks = Array.from(terrainChunkMeshes.entries())
    .filter(([, terrainChunk]) => {
      if (!terrainChunk.mesh.visible) {
        return false;
      }

      const fadeStart = terrainChunk.mesh.userData.fadeStart as number | undefined;
      if (fadeStart === undefined) {
        return true;
      }

      return clock.elapsedTime - fadeStart >= CHUNK_FADE_DURATION * 0.8;
    })
    .sort(([chunkIdA], [chunkIdB]) => chunkIdA.localeCompare(chunkIdB));
  const chunkKey = eligibleChunks.map(([chunkId]) => chunkId).join(",");

  if (!force && chunkKey === wildlifeVisibleChunkKey) {
    return;
  }

  disposeWildlifeVisuals();
  wildlifeVisibleChunkKey = chunkKey;

  if (eligibleChunks.length === 0) {
    return;
  }

  wildlifeHandle = createWildlifeHandle(
    eligibleChunks.map(([, terrainChunk]) => terrainChunk.sampler)
  );
  wildlifeGroup.add(wildlifeHandle.group);
}

function invalidatePoiHoverTargets(): void {
  poiHoverTargetsDirty = true;
}

function getPoiHoverTargets(): Object3D[] {
  if (poiHoverTargetsDirty) {
    poiHoverTargetSources.length = 0;
    if (cityMarkersHandle) {
      poiHoverTargetSources.push(...cityMarkersHandle.group.children);
    }
    poiHoverTargetSources.push(...landmarkGroup.children);
    poiHoverTargetSources.push(...scenicGroup.children);
    poiHoverTargetSources.push(...ancientGroup.children);
    // 河流 ribbon + 湖泊 polygon 都在 hydrographyRibbonsGroup 里。
    // 用户："hover 显示河名湖名"。
    poiHoverTargetSources.push(...hydrographyRibbonsGroup.children);
    poiHoverTargetsDirty = false;
  }

  poiHoverTargetScratch.length = 0;
  poiHoverTargetSources.forEach((object) => {
    if (object.visible) {
      poiHoverTargetScratch.push(object);
    }
  });

  return poiHoverTargetScratch;
}

function resetStoryGuide(): void {
  completedStoryBeatIds.clear();
  storyGuideInitialized = false;
  storyLine = formatStoryGuideLine(
    evaluateStoryGuide(
      storyBeats,
      routeStart.clone(),
      collectedIds,
      completedStoryBeatIds
    )
  );
}

function showToast(text: string): void {
  hud.showToast(text);

  if (toastTimeout !== null) {
    window.clearTimeout(toastTimeout);
  }

  toastTimeout = window.setTimeout(() => {
    hud.hideToast();
  }, 3400);
}

// county 标签仍沿用"靠近城市时显名"这条逻辑，但现在阈值跟 HUD proximity
// 半径统一，避免玩家还没看到 FUD 就先看到 [I] / 标签提示。
// 节流：每帧 30 个城市的距离计算 + 投影是真实开销，玩家走路速度也不
// 需要 60Hz 检测。每 8 帧（~7-8Hz）跑一次足够，肉眼无延迟感。
let nearbyRealCity: RealCity | null = null;
let nearbyRealCityCheckTick = 0;

function updateNearbyRealCity(): void {
  nearbyRealCityCheckTick = (nearbyRealCityCheckTick + 1) % 8;
  if (nearbyRealCityCheckTick !== 0) return;
  updateNearbyRealCityCore();
}

function updateNearbyRealCityCore(): void {
  if (!terrainSampler?.asset.bounds) {
    nearbyRealCity = null;
    return;
  }
  const bounds = terrainSampler.asset.bounds;
  const world = terrainSampler.asset.world;
  const px = player.position.x;
  const pz = player.position.z;
  let closest: RealCity | null = null;
  let closestDistance = Infinity;
  for (const city of realQinlingCities) {
    if (
      city.lat < bounds.south ||
      city.lat > bounds.north ||
      city.lon < bounds.west ||
      city.lon > bounds.east
    ) {
      continue;
    }
    const wp = projectGeoToWorld({ lat: city.lat, lon: city.lon }, bounds, world);
    const distance = Math.hypot(wp.x - px, wp.z - pz);
    const radius =
      city.tier === "capital"
        ? PROXIMITY_RADIUS_CITY_CAP
        : city.tier === "prefecture"
          ? PROXIMITY_RADIUS_CITY_PREF
          : PROXIMITY_RADIUS_CITY_COUNTY;
    if (distance <= radius && distance < closestDistance) {
      closestDistance = distance;
      closest = city;
    }
  }
  if (closest?.id !== nearbyRealCity?.id) {
    // hide previous county label (if was a county)
    if (nearbyRealCity?.tier === "county") {
      const prev = countyLabelSpriteByCityId.get(nearbyRealCity.id);
      if (prev) prev.visible = false;
    }
    nearbyRealCity = closest;
    if (closest) {
      // reveal county label as the player approaches
      if (closest.tier === "county") {
        const sprite = countyLabelSpriteByCityId.get(closest.id);
        if (sprite) sprite.visible = true;
      }
    }
  }
}

function renderJournal(): void {
  const collected = knowledgeFragments.filter((fragment) =>
    collectedIds.has(fragment.id)
  );

  selectedFragmentId = renderJournalView({
    refs: {
      journal: hud.journal,
      journalEmpty: hud.journalEmpty,
      journalList: hud.journalList,
      journalDetail: hud.journalDetail
    },
    open: journalOpen,
    collected,
    selectedFragmentId,
    onSelect(fragmentId) {
      selectedFragmentId = fragmentId;
      renderJournal();
    }
  });
}

function createWaterSurfaceRibbon(
  points: Array<{ x: number; y: number }>,
  options: {
    width: number;
    yOffset: number;
    color: number;
    opacity: number;
    renderOrder: number;
    depthTest?: boolean;
    maxSegmentLength?: number;
    fadeStartAlpha?: number;
    fadeEndAlpha?: number;
    fadeFraction?: number;
  }
): Mesh<BufferGeometry, MeshBasicMaterial> {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(
      buildWaterRibbonVertices(points, {
        width: options.width,
        yOffset: options.yOffset,
        maxSegmentLength: options.maxSegmentLength,
        // ribbon 高度 = max(mesh, waterLevel)：河流到达海岸时，mesh 下沉到
        // ocean (-3.5×1.6=-5.6) 但 ribbon 应该停在 waterLevel (-3.0×1.6=-4.8)
        // 之上而不是跟着 mesh 沉到水下，否则河消失在海里 / 跟海底 Z-fight。
        sampleHeight: (x, z) => {
          const mesh = terrainSampler!.sampleSurfaceHeight(x, z);
          const water = (terrainSampler!.asset.presentation?.waterLevel ?? -3.0) *
            TERRAIN_VERTICAL_EXAGGERATION;
          return Math.max(mesh, water);
        }
      }),
      3
    )
  );
  // 河末端如果是在内陆 (不到 slice 边界)，就 fade 到透明 — 用户请求。
  // alpha 数组按 buildWaterRibbonVertices 同样的 6-vert/quad 顺序铺。
  const needsAlphaAttr =
    (options.fadeStartAlpha ?? 1) < 1 || (options.fadeEndAlpha ?? 1) < 1;
  if (needsAlphaAttr) {
    geometry.setAttribute(
      "aAlpha",
      new BufferAttribute(
        buildWaterRibbonAlphas(points, {
          maxSegmentLength: options.maxSegmentLength,
          fadeStartAlpha: options.fadeStartAlpha,
          fadeEndAlpha: options.fadeEndAlpha,
          fadeFraction: options.fadeFraction,
          baseOpacity: 1.0
        }),
        1
      )
    );
  }

  const material = new MeshBasicMaterial({
    color: options.color,
    transparent: true,
    opacity: options.opacity,
    side: DoubleSide,
    depthWrite: false,
    depthTest: options.depthTest ?? true,
    // 不让 FogExp2 把远处水带雾化——之前用户反馈"水离得很近才出现"
    // 就是因为水带在远处被场景 fog 吞了。
    fog: false
  });
  if (needsAlphaAttr) {
    // 用 onBeforeCompile 注入 per-vertex alpha (MeshBasicMaterial 自带
    // 不支持 vertex alpha)。透明 + alpha attribute 让河末端 fade 到 0。
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nattribute float aAlpha;\nvarying float vAlpha;"
        )
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvAlpha = aAlpha;"
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying float vAlpha;"
        )
        .replace(
          "gl_FragColor = vec4( outgoingLight, diffuseColor.a );",
          "gl_FragColor = vec4( outgoingLight, diffuseColor.a * vAlpha );"
        );
    };
  }

  const ribbon = new Mesh(geometry, material);
  ribbon.renderOrder = options.renderOrder;

  return ribbon;
}

function createLakePolygon(
  lake: ChinaLake,
  bounds: NonNullable<DemAsset["bounds"]>,
  world: DemAsset["world"]
): Mesh<ShapeGeometry, MeshBasicMaterial> {
  const shape = new Shape();

  // ShapeGeometry 的 2D 平面（XY）通过 rotateX(-π/2) 转到世界 XZ 平面；
  // 那一步会把 shape Y 翻成 -Z（世界），所以 shape 里要预先存 -worldZ
  // 才能投到正确位置。之前没翻 Z 让 太湖/巢湖 跑到对称北方。
  // 顺便用 quadraticCurveTo 把硬六边形折角改成圆角，让湖形状不再像砍出来的。
  const projectedRaw = lake.polygon.map((point) =>
    projectGeoToWorld({ lat: point.lat, lon: point.lon }, bounds, world)
  );
  if (projectedRaw.length === 0) {
    return new Mesh(new ShapeGeometry(shape), new MeshBasicMaterial());
  }

  // 用户："形状太圆了，自然湖应该弯弯曲曲"。在原始 polygon 顶点之间插值
  // 中间点，再叠确定性噪声扰动，让闭合曲线有自然 fingers + 凹陷，而不是
  // 标准 N 边形 quadratic blob。
  // 噪声基于 lake.id hash + 顶点 index，稳定可重现。
  let hashSeed = 0;
  for (const ch of lake.id) hashSeed = (hashSeed * 31 + ch.charCodeAt(0)) | 0;
  const pseudoNoise = (i: number): number => {
    const s = Math.sin((hashSeed + i * 9301) * 0.001);
    return s - Math.floor(s); // 0-1
  };

  const projected: { x: number; z: number }[] = [];
  for (let i = 0; i < projectedRaw.length; i += 1) {
    const a = projectedRaw[i];
    const b = projectedRaw[(i + 1) % projectedRaw.length];
    projected.push({ x: a.x, z: a.z });
    // 在 a-b 之间插 2 个中间点
    for (let k = 1; k <= 2; k += 1) {
      const t = k / 3;
      const mx = a.x + (b.x - a.x) * t;
      const mz = a.z + (b.z - a.z) * t;
      // 垂直 a-b 方向的法线 nx,nz
      const dx = b.x - a.x, dz = b.z - a.z;
      const len = Math.hypot(dx, dz) || 1;
      const nx = -dz / len, nz = dx / len;
      // 噪声幅度 = 该段长度的 ±15%
      const offset = (pseudoNoise(i * 7 + k) - 0.5) * len * 0.3;
      projected.push({ x: mx + nx * offset, z: mz + nz * offset });
    }
  }

  const last = projected[projected.length - 1];
  const first = projected[0];
  const startX = (last.x + first.x) / 2;
  const startZ = (last.z + first.z) / 2;
  shape.moveTo(startX, -startZ);
  for (let i = 0; i < projected.length; i += 1) {
    const ctrl = projected[i];
    const nextI = (i + 1) % projected.length;
    const next = projected[nextI];
    const endX = (ctrl.x + next.x) / 2;
    const endZ = (ctrl.z + next.z) / 2;
    shape.quadraticCurveTo(ctrl.x, -ctrl.z, endX, -endZ);
  }
  shape.closePath();

  const geometry = new ShapeGeometry(shape, 12);
  geometry.rotateX(-Math.PI / 2);
  const material = new MeshBasicMaterial({
    color: 0x3b6ea8,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    side: DoubleSide
  });
  const mesh = new Mesh(geometry, material);
  mesh.renderOrder = 5;
  mesh.userData.lakeId = lake.id;
  return mesh;
}

function rebuildHydrographyRibbons(): void {
  clearGroup(hydrographyRibbonsGroup);

  const sampler = terrainSampler;
  if (!sampler) {
    return;
  }

  // 主干更宽，支流逐级收细；全国画幅里 1.2 / 0.7 / 0.4 刚好能在远景读出
  // 河级差，但又不会把岷江、汉水画成不真实的巨型蓝带。
  const widthByRank: Record<number, number> = {
    1: 1.2,
    2: 0.7,
    3: 0.4
  };
  const colorByRank: Record<number, number> = {
    1: 0x3b6ea8,
    2: 0x4a7eb8,
    3: 0x5a8ec5
  };

  qinlingModernHydrography.features.forEach((feature) => {
    const atlasFeature = hydrographyFeatureToAtlasFeature(feature);

    // 只给 polyline 水系画 ribbon；point / area feature 以及缺失 points 的
    // 数据都跳过，避免把单点 POI 误当成河面。
    if (atlasFeature.geometry !== "polyline" || !("points" in atlasFeature.world)) {
      return;
    }

    const points = featureWorldPoints(atlasFeature);
    if (points.length < 2) {
      return;
    }

    // 用户："这些江都没有入海"。NE polyline 末端往往落在内陆，跟海岸 mesh
    // 之间留 5-50 km 空白。如果最后一点附近 mesh 已经接近 waterLevel（陆海
    // 过渡带），沿最后一段方向延伸 ~30 km，让 ribbon 真正插进海面。
    // 注意 featureWorldPoints 返回的是 feature.world.points 引用，不能 mutate；
    // 这里 spread 出新数组再 push。
    const waterLevelExag = (sampler.asset.presentation?.waterLevel ?? -3.0) *
      TERRAIN_VERTICAL_EXAGGERATION;
    let renderPoints: { x: number; y: number }[] = points.slice();
    const tail = renderPoints[renderPoints.length - 1];
    const tailMesh = sampler.sampleSurfaceHeight(tail.x, tail.y);
    if (renderPoints.length >= 2 && tailMesh < waterLevelExag + 1.5) {
      const prev = renderPoints[renderPoints.length - 2];
      const dx = tail.x - prev.x, dy = tail.y - prev.y;
      const len = Math.hypot(dx, dy) || 1;
      const stepX = (dx / len) * 9; // 1 world unit ≈ 3.27 km
      const stepY = (dy / len) * 9;
      for (let k = 1; k <= 3; k += 1) {
        renderPoints.push({ x: tail.x + stepX * k, y: tail.y + stepY * k });
      }
    }

    const rank = feature.rank ?? 2;
    const ribbon = createWaterSurfaceRibbon(renderPoints, {
      width: widthByRank[rank] ?? 0.6,
      yOffset: 0.05,
      color: colorByRank[rank] ?? 0x4a7eb8,
      opacity: 0.85,
      renderOrder: 5,
      depthTest: true,
      // 河流 polyline 数据点稀疏（海河 12 pt / 淮河 57 pt 等），每段 8 unit
      // ≈ 26 km 让 ribbon 看着像点不像河。压到 1.5（~5 km），
      // 让 buildWaterRibbonVertices 自己 densify 中间点。
      maxSegmentLength: 1.5
    });
    ribbon.userData.featureId = feature.id;
    // hover 显示河名：用 polyline 中点作 worldX/Z 锚点。
    const midPoint = renderPoints[Math.floor(renderPoints.length / 2)];
    const midGeo = sampler.asset.bounds
      ? unprojectWorldToGeo(
          { x: midPoint.x, z: midPoint.y },
          sampler.asset.bounds,
          sampler.asset.world
        )
      : { lat: 0, lon: 0 };
    attachHoverPoiMetadata(ribbon, {
      id: `river-${feature.id}`,
      name: feature.displayName ?? feature.name,
      category: "scenic",
      worldX: midPoint.x,
      worldZ: midPoint.y,
      elevation: 0,
      realLat: midGeo.lat,
      realLon: midGeo.lon,
      description: `${feature.basin ?? ""}${feature.basin ? "·" : ""}rank ${rank} 河流`
    });
    hydrographyRibbonsGroup.add(ribbon);
  });

  const bounds = sampler.asset.bounds;
  if (!bounds) {
    return;
  }

  CHINA_LAKES.forEach((lake) => {
    if (
      lake.centerLat < bounds.south ||
      lake.centerLat > bounds.north ||
      lake.centerLon < bounds.west ||
      lake.centerLon > bounds.east
    ) {
      return;
    }

    const lakeMesh = createLakePolygon(lake, bounds, sampler.asset.world);
    const centerWorldPoint = projectGeoToWorld(
      { lat: lake.centerLat, lon: lake.centerLon },
      bounds,
      sampler.asset.world
    );
    // 湖面需要压在 terrain 之上而不是海平面高度，否则全国高程下内陆湖会被地形吞掉。
    const lakeY = sampler.sampleHeight(centerWorldPoint.x, centerWorldPoint.z) + 0.08;
    lakeMesh.position.y = lakeY;
    // hover 显示湖名
    attachHoverPoiMetadata(lakeMesh, {
      id: `lake-${lake.id}`,
      name: lake.name,
      category: "scenic",
      worldX: centerWorldPoint.x,
      worldZ: centerWorldPoint.z,
      elevation: 0,
      realLat: lake.centerLat,
      realLon: lake.centerLon,
      description: "全国画幅五大湖"
    });
    hydrographyRibbonsGroup.add(lakeMesh);

    // 用户："每个湖上面加个名字"。湖 polygon 跨度大，label scale ×3 让远处也读得到。
    const lakeLabel = createTextSprite(lake.name, "rgba(160, 220, 255, 0.95)");
    lakeLabel.scale.multiplyScalar(3.0);
    lakeLabel.position.set(centerWorldPoint.x, lakeY + 8, centerWorldPoint.z);
    lakeLabel.userData.role = "lake-label";
    lakeLabel.userData.lakeId = lake.id;
    hydrographyRibbonsGroup.add(lakeLabel);
  });

  // Hover targets 缓存了 group children 引用，重建后必须 invalidate 否则
  // 旧的 dispose 过的 mesh 还出现在 raycaster 列表里。
  invalidatePoiHoverTargets();
}

function registerWaterEnvironmentMaterial(
  material: MeshBasicMaterial | LineBasicMaterial,
  baseColor: number,
  style: ReturnType<typeof waterVisualStyle>,
  role: WaterEnvironmentMaterialRole
): void {
  waterEnvironmentMaterials.push({
    material,
    baseColor: new Color(baseColor),
    baseOpacity: material.opacity,
    style,
    role
  });
}

function applyWaterEnvironmentVisuals(visuals: EnvironmentVisuals): void {
  // 简化后只剩 "ribbon" role（删了 line / highlight 反光层）。
  waterEnvironmentMaterials.forEach((entry) => {
    const environmentStyle = waterEnvironmentVisualStyle(entry.style, visuals);
    entry.material.opacity = Math.min(entry.baseOpacity, environmentStyle.ribbonOpacity);
    entry.material.color
      .copy(entry.baseColor)
      .multiplyScalar(environmentStyle.colorMultiplier);
  });
}

// 用户："海要非常明显的是蓝色的海水，而且要跟土地区分开"。
// 0x1e6ec5（饱和蓝色）+ 高 opacity，使海洋远远就能识别出来，跟土黄/绿地清晰
// 分隔。原 0x3d7d8c 偏青灰，全国画幅下被周边地形吃掉。
const ambientWaterBaseColor = new Color(0x1e6ec5);
function applyAmbientWaterSurfaceVisuals(visuals: EnvironmentVisuals): void {
  const environmentStyle = waterEnvironmentVisualStyle(ambientWaterStyle, visuals);
  const tintedBase = ambientWaterBaseColor
    .clone()
    .multiplyScalar(environmentStyle.colorMultiplier);
  waterSurface.setBaseColor(tintedBase);
  // opacity 强制 0.92：水面几乎不透明，海面不会被底下 mesh 颜色洗淡。
  waterSurface.setOpacity(Math.max(0.85, environmentStyle.ribbonOpacity * 1.9));
  waterSurface.setSunDirection(visuals.sunDirection);
}

function rebuildRiverVegetationVisuals(rivers: QinlingAtlasFeature[]): void {
  clearGroup(riverVegetationGroup);

  if (!terrainSampler || rivers.length === 0) {
    return;
  }

  const samples = buildRiverVegetationSamples(rivers, {
    maxSamples: 520,
    spacing: 3.25,
    bankOffset: 2.6,
    // 跟 selectRenderableWaterFeatures 在 main 里 selectRenderableWaterFeatures
    // 调的 minDisplayPriority 对齐——主流 + 支流都要有岸边植被。
    minDisplayPriority: 8
  });
  const treeMatrices: Matrix4[] = [];
  const shrubMatrices: Matrix4[] = [];
  const dummy = new Object3D();

  samples.forEach((sample) => {
    const height = terrainSampler!.sampleHeight(sample.x, sample.z);
    const scale = sample.scale;

    if (sample.variant === "tree") {
      dummy.position.set(sample.x, height + 0.82 * scale, sample.z);
      dummy.rotation.set(0, sample.rotation, 0);
      dummy.scale.set(0.72 * scale, 1.08 * scale, 0.72 * scale);
      dummy.updateMatrix();
      treeMatrices.push(dummy.matrix.clone());
      return;
    }

    dummy.position.set(sample.x, height + 0.28 * scale, sample.z);
    dummy.rotation.set(0, sample.rotation, 0);
    dummy.scale.set(0.84 * scale, 0.58 * scale, 0.84 * scale);
    dummy.updateMatrix();
    shrubMatrices.push(dummy.matrix.clone());
  });

  if (treeMatrices.length > 0) {
    const trees = new InstancedMesh(
      new ConeGeometry(0.34, 1.62, 5),
      new MeshPhongMaterial({
        color: 0x2f6246,
        flatShading: true,
        shininess: 4
      }),
      treeMatrices.length
    );
    trees.renderOrder = 8;
    treeMatrices.forEach((matrix, index) => trees.setMatrixAt(index, matrix));
    trees.instanceMatrix.needsUpdate = true;
    // 跟 cityMarkers 一样：必须 computeBoundingSphere 把所有 instance 位置
    // 算进 culling sphere，否则镜头转到河流另一侧会整批 trees 被裁掉。
    trees.computeBoundingSphere();
    riverVegetationGroup.add(trees);
  }

  if (shrubMatrices.length > 0) {
    const shrubs = new InstancedMesh(
      new CylinderGeometry(0.28, 0.46, 0.58, 5),
      new MeshPhongMaterial({
        color: 0x58764b,
        flatShading: true,
        shininess: 3
      }),
      shrubMatrices.length
    );
    shrubs.renderOrder = 8;
    shrubMatrices.forEach((matrix, index) => shrubs.setMatrixAt(index, matrix));
    shrubs.instanceMatrix.needsUpdate = true;
    shrubs.computeBoundingSphere();
    riverVegetationGroup.add(shrubs);
  }
}

function rebuildWaterSystemVisuals(): void {
  clearGroup(waterSystemGroup);
  clearGroup(riverVegetationGroup);
  waterEnvironmentMaterials.length = 0;
  visibleWaterFeatures = [];
  // 复用同一个 sprites 数组对象（updateCityLodFade 闭包了它的引用），所以
  // 用 length=0 清空，而不是重新赋值。
  riverLabelSpritesByTier.major.length = 0;
  riverLabelSpritesByTier.tributary.length = 0;

  if (!terrainSampler) {
    return;
  }

  // 3D 游戏里保留一级支流（rank=2，priority 8），用户反馈"游戏里还是
  // 要有支流信息"。tributary 用 1.5 单元密化（major 是 0.9）省 ~40%
  // 顶点；其它 perf 节流（pixelRatio 1.25 / 白天隐星 / 节流 proximity）
  // 已分摊掉部分开销。
  const rivers = selectRenderableWaterFeatures(atlasFeatures, {
    minDisplayPriority: 8
  });
  visibleWaterFeatures = rivers;

  rebuildRiverVegetationVisuals(rivers);

  // 判断 polyline 端点是不是"内陆" — 离 slice 边界 > 4 单元 (~9 km) 算内陆。
  // 内陆端点需要 fade 到透明，让河看起来"渐渐消失"而不是被地图边硬切。
  const SLICE_HALF_W = qinlingRegionWorld.width * 0.5;
  const SLICE_HALF_D = qinlingRegionWorld.depth * 0.5;
  const INLAND_BORDER_MARGIN = 4;
  const isInlandPoint = (p: { x: number; y: number }) =>
    Math.abs(p.x) < SLICE_HALF_W - INLAND_BORDER_MARGIN &&
    Math.abs(p.y) < SLICE_HALF_D - INLAND_BORDER_MARGIN;

  rivers.forEach((river) => {
    // 地表 shader 仍保留 riverMask 着色做远景融合；真正的蓝色水面 ribbon
    // 由 rebuildHydrographyRibbons() 单独重建。这个分支只负责 label 和河边植被。

    const labelPoint = waterLabelPoint(river);

    if (labelPoint) {
      const isMajor = river.displayPriority >= 9;
      const label = createTextSprite(river.name, "#bdeff0");
      label.scale.multiplyScalar(isMajor ? 1.08 : 0.82);
      label.position.set(
        labelPoint.x,
        terrainSampler!.sampleHeight(labelPoint.x, labelPoint.y) + 4.8,
        labelPoint.y
      );
      label.renderOrder = 13;
      waterSystemGroup.add(label);
      (isMajor
        ? riverLabelSpritesByTier.major
        : riverLabelSpritesByTier.tributary
      ).push(label);
    }
  });

  if (lastVisuals) {
    applyWaterEnvironmentVisuals(lastVisuals);
  }
}

function rebuildRouteVisuals(): void {
  if (routePlankRoadHandle) {
    disposePlankRoad(routePlankRoadHandle);
    routePlankRoadHandle = null;
  }

  clearGroup(routeGroup);
  routeLabelSprites.length = 0;

  if (!terrainSampler) {
    return;
  }

  const visibleRoutes = qinlingRoutes.filter(
    (route) =>
      route.source?.verification === "external-vector" ||
      route.source?.verification === "verified" ||
      route.source?.verification === "historical-references"
  );

  visibleRoutes.forEach((route) => {
    if (route.labelPoint && route.label) {
      const routeLabel = createTextSprite(route.label, "#f6d783");
      routeLabel.scale.multiplyScalar(1.16);
      routeLabel.position.set(route.labelPoint.x, 6.2, route.labelPoint.y);
      routeLabel.renderOrder = 14;
      routeGroup.add(routeLabel);
      groundAnchorRegistry.register(`route:${route.id}:label`, {
        object: routeLabel,
        worldX: route.labelPoint.x,
        worldZ: route.labelPoint.y,
        baseOffset: 6.2,
        category: "label"
      });
      routeLabelSprites.push(routeLabel);
    }
  });

  routePlankRoadHandle = buildPlankRoadNetwork(
    visibleRoutes.map((route) => ({
      routeId: route.id,
      points: route.points,
      sampler: terrainSampler!
    }))
  );

  routeGroup.add(routePlankRoadHandle.group);
  groundAnchorRegistry.register("path:plank-road", {
    object: routePlankRoadHandle.group,
    worldX: 0,
    worldZ: 0,
    baseOffset: 0,
    category: "path",
    customReanchor: routePlankRoadHandle.reanchor
  });
}

function resizeAtlasCanvasToDisplaySize(canvas: HTMLCanvasElement): void {
  const rect = canvas.getBoundingClientRect();

  if (rect.width <= 0 || rect.height <= 0) {
    return;
  }

  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  const nextWidth = Math.max(1, Math.floor(rect.width * pixelRatio));
  const nextHeight = Math.max(1, Math.floor(rect.height * pixelRatio));

  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth;
    canvas.height = nextHeight;
  }
}

const atlasBaseMapCache = new WeakMap<DemAsset, HTMLCanvasElement>();

interface AtlasCanvasProjection {
  worldToCanvas(point: { x: number; y: number }): { x: number; y: number };
  canvasToWorld(point: { x: number; y: number }): { x: number; y: number };
}

function strictAtlasProjection(
  asset: DemAsset,
  canvas: HTMLCanvasElement,
  mapView: { scale: number; offsetX: number; offsetY: number; fitMode?: "stretch" | "cover" }
): AtlasCanvasProjection {
  return {
    worldToCanvas: (point) =>
      atlasMapWorldToCanvasPoint(point, asset.world, canvas, mapView),
    canvasToWorld: (point) =>
      atlasMapCanvasToWorldPoint(point, asset.world, canvas, mapView)
  };
}

function demSampleColor(
  asset: DemAsset,
  worldPoint: { x: number; y: number }
): [number, number, number] {
  const heightRange = asset.maxHeight - asset.minHeight || 1;
  const column = Math.min(
    asset.grid.columns - 1,
    Math.max(
      0,
      Math.floor(((worldPoint.x / asset.world.width) + 0.5) * asset.grid.columns)
    )
  );
  const row = Math.min(
    asset.grid.rows - 1,
    Math.max(
      0,
      Math.floor((0.5 - worldPoint.y / asset.world.depth) * asset.grid.rows)
    )
  );
  const sample = asset.heights[row * asset.grid.columns + column] ?? asset.minHeight;
  const h = MathUtils.clamp((sample - asset.minHeight) / heightRange, 0, 1);

  // 跟 3D 主游戏的色板对齐（用户："视觉风格跟主游戏很不一样"）：
  //   h < 0.30 平原盆地 → 草绿（≈ #6f8a4d）
  //   0.30..0.55 中山植被 → 黄绿过渡 → 黄褐（≈ #aa9a5e）
  //   0.55..0.80 山脊裸岩 → 暖灰褐（≈ #b59874）
  //   h > 0.80 雪线 → 灰白（≈ #d6d6cf）
  // 不再是 desert / parchment 配色——盆地直接给绿色，跟玩家在 3D 里看到的
  // 关中盆地 / 四川盆地一致。
  let r: number;
  let g: number;
  let b: number;
  if (h < 0.30) {
    const t = h / 0.30;
    r = 90 + t * 30;
    g = 120 + t * 18;
    b = 76 + t * 22;
  } else if (h < 0.55) {
    const t = (h - 0.30) / 0.25;
    r = 120 + t * 50;
    g = 138 + t * 16;
    b = 98 - t * 4;
  } else if (h < 0.80) {
    const t = (h - 0.55) / 0.25;
    r = 170 + t * 26;
    g = 154 - t * 4;
    b = 94 + t * 26;
  } else {
    const t = MathUtils.clamp((h - 0.80) / 0.20, 0, 1);
    r = 196 + t * 18;
    g = 150 + t * 60;
    b = 120 + t * 90;
  }
  return [r, g, b];
}

function computeHillshade(
  asset: DemAsset,
  column: number,
  row: number,
  azimuthDeg = 315,
  altitudeDeg = 45,
  zFactor = 6
): number {
  const cols = asset.grid.columns;
  const rows = asset.grid.rows;
  const cl = Math.max(0, column - 1);
  const cr = Math.min(cols - 1, column + 1);
  const ru = Math.max(0, row - 1);
  const rd = Math.min(rows - 1, row + 1);
  const h = (c: number, r: number) => asset.heights[r * cols + c] ?? 0;

  // Sobel 梯度（标准 hillshade kernel）
  const dzdx =
    ((h(cr, ru) + 2 * h(cr, row) + h(cr, rd)) -
      (h(cl, ru) + 2 * h(cl, row) + h(cl, rd))) /
    8;
  const dzdy =
    ((h(cl, rd) + 2 * h(column, rd) + h(cr, rd)) -
      (h(cl, ru) + 2 * h(column, ru) + h(cr, ru))) /
    8;

  const slope = Math.atan(zFactor * Math.sqrt(dzdx * dzdx + dzdy * dzdy));
  const aspect = Math.atan2(dzdy, -dzdx);
  const azimuth = (azimuthDeg * Math.PI) / 180;
  const altitude = (altitudeDeg * Math.PI) / 180;
  const azimuthMath = Math.PI / 2 - azimuth;

  const shade =
    Math.cos(altitude) * Math.cos(slope) +
    Math.sin(altitude) * Math.sin(slope) * Math.cos(azimuthMath - aspect);

  return Math.max(0, shade);
}

// Atlas base map 渲染分辨率上限。grid 直接当 canvas 在小尺度（416×666）够用，
// 但全国 grid 可能去到 3000+ × 2000+ = 27MB ImageData + 6.7M 次 hillshade 采样，
// 卡顿明显。1500 已经够 retina 显示器看清，再大是浪费。
const ATLAS_BASE_MAP_MAX_DIM = 1500;

function createAtlasBaseMapCanvas(asset: DemAsset): HTMLCanvasElement {
  const cached = atlasBaseMapCache.get(asset);

  if (cached) {
    return cached;
  }

  const canvas = document.createElement("canvas");
  // 按 DEM 长宽比缩放到 ≤ ATLAS_BASE_MAP_MAX_DIM
  const scale = Math.min(
    1,
    ATLAS_BASE_MAP_MAX_DIM / Math.max(asset.grid.columns, asset.grid.rows)
  );
  canvas.width = Math.max(1, Math.round(asset.grid.columns * scale));
  canvas.height = Math.max(1, Math.round(asset.grid.rows * scale));
  const context = canvas.getContext("2d");

  if (!context) {
    atlasBaseMapCache.set(asset, canvas);
    return canvas;
  }

  const image = context.createImageData(canvas.width, canvas.height);

  for (let row = 0; row < canvas.height; row += 1) {
    for (let column = 0; column < canvas.width; column += 1) {
      const offset = (row * canvas.width + column) * 4;
      const color = demSampleColor(asset, {
        x: ((column / Math.max(1, canvas.width - 1)) - 0.5) * asset.world.width,
        y: (0.5 - row / Math.max(1, canvas.height - 1)) * asset.world.depth
      });

      // Hillshade：太阳从西北上方（azimuth=315°, altitude=45°）打过来。
      // shade ∈ [0, 1]——0 完全背光、1 完全正照。把它映射到 [0.45, 1.15] 的
      // 调色乘子，让平原保留底色（shade≈1），山阴侧明显变暗，山脊高光。
      // 把 atlas canvas 坐标映射回 DEM grid 坐标算 hillshade
      const demColumn = Math.round(
        (column / Math.max(1, canvas.width - 1)) * (asset.grid.columns - 1)
      );
      const demRow = Math.round(
        (row / Math.max(1, canvas.height - 1)) * (asset.grid.rows - 1)
      );
      const shade = computeHillshade(asset, demColumn, demRow);
      const factor = 0.45 + shade * 0.7;

      image.data[offset] = Math.min(255, color[0] * factor);
      image.data[offset + 1] = Math.min(255, color[1] * factor);
      image.data[offset + 2] = Math.min(255, color[2] * factor);
      image.data[offset + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);
  atlasBaseMapCache.set(asset, canvas);

  return canvas;
}

function drawAtlasBaseMap(
  context: CanvasRenderingContext2D,
  asset: DemAsset,
  canvas: HTMLCanvasElement,
  mapView: { scale: number; offsetX: number; offsetY: number; fitMode?: "stretch" | "cover" }
): void {
  const baseMap = createAtlasBaseMapCanvas(asset);
  const topLeft = atlasMapWorldToCanvasPoint(
    { x: -asset.world.width / 2, y: asset.world.depth / 2 },
    asset.world,
    canvas,
    mapView
  );
  const bottomRight = atlasMapWorldToCanvasPoint(
    { x: asset.world.width / 2, y: -asset.world.depth / 2 },
    asset.world,
    canvas,
    mapView
  );
  const x = Math.min(topLeft.x, bottomRight.x);
  const y = Math.min(topLeft.y, bottomRight.y);
  const width = Math.abs(bottomRight.x - topLeft.x);
  const height = Math.abs(bottomRight.y - topLeft.y);

  context.fillStyle = "rgb(9, 17, 17)";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.drawImage(baseMap, x, y, width, height);
}

function drawCameraAlignedAtlasBaseMap(
  context: CanvasRenderingContext2D,
  asset: DemAsset,
  canvas: HTMLCanvasElement,
  projection: AtlasCanvasProjection
): void {
  const image = context.createImageData(canvas.width, canvas.height);

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const worldPoint = projection.canvasToWorld({ x, y });
      const offset = (y * canvas.width + x) * 4;
      const inBounds =
        worldPoint.x >= -asset.world.width / 2 &&
        worldPoint.x <= asset.world.width / 2 &&
        worldPoint.y >= -asset.world.depth / 2 &&
        worldPoint.y <= asset.world.depth / 2;

      if (!inBounds) {
        image.data[offset] = 9;
        image.data[offset + 1] = 17;
        image.data[offset + 2] = 17;
        image.data[offset + 3] = 255;
        continue;
      }

      const color = demSampleColor(asset, worldPoint);
      image.data[offset] = color[0];
      image.data[offset + 1] = color[1];
      image.data[offset + 2] = color[2];
      image.data[offset + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);
}

// Atlas 底图与 features 分层缓存。base map 的 hillshade 已经按 DemAsset 缓存；
// 这里再把 canvas 尺寸 / mapView 相关的底图 blit 与 features 绘制分开缓存。
// 玩家点和 fullscreen 比例尺属于便宜的高频 overlay，每次 redraw 现场画。
interface AtlasStaticCache {
  surface: HTMLCanvasElement;
  key: string;
}
const atlasStaticCaches = new WeakMap<HTMLCanvasElement, AtlasStaticCache>();
const atlasFeatureCaches = new WeakMap<HTMLCanvasElement, AtlasStaticCache>();

function atlasStaticCacheKey(
  canvas: HTMLCanvasElement,
  mapView: { scale: number; offsetX: number; offsetY: number; fitMode?: string },
  useWorkbenchView: boolean,
  mode: string
): string {
  return [
    canvas.width,
    canvas.height,
    useWorkbenchView ? 1 : 0,
    mapView.scale.toFixed(3),
    mapView.offsetX.toFixed(2),
    mapView.offsetY.toFixed(2),
    mapView.fitMode ?? "default",
    mode
  ].join("|");
}

function atlasFeatureCacheKey(
  canvas: HTMLCanvasElement,
  mapView: { scale: number; offsetX: number; offsetY: number; fitMode?: string },
  useWorkbenchView: boolean,
  selectedFeatureId: string | null,
  layerIds: Set<string>,
  featuresVersion: number,
  playerChunkId: string | null,
  mode: string
): string {
  const layers = [...layerIds].sort().join("/");
  return [
    canvas.width,
    canvas.height,
    useWorkbenchView ? 1 : 0,
    mapView.scale.toFixed(3),
    mapView.offsetX.toFixed(2),
    mapView.offsetY.toFixed(2),
    mapView.fitMode ?? "default",
    selectedFeatureId ?? "-",
    layers,
    featuresVersion,
    playerChunkId ?? "-",
    mode
  ].join("|");
}

function renderAtlasStaticInto(
  surface: HTMLCanvasElement,
  asset: DemAsset,
  mapView: { scale: number; offsetX: number; offsetY: number; fitMode?: "stretch" | "cover" },
  useWorkbenchView: boolean
): void {
  const context = surface.getContext("2d");
  if (!context) return;

  const { width, height } = surface;
  context.clearRect(0, 0, width, height);
  const projection = strictAtlasProjection(asset, surface, mapView);

  drawAtlasBaseMap(context, asset, surface, mapView);
  context.fillStyle = "rgba(247, 230, 174, 0.12)";
  context.fillRect(0, 0, width, height);
  drawDemQualityOverlay(context, asset, surface, projection, useWorkbenchView);
}

function renderAtlasFeaturesInto(
  surface: HTMLCanvasElement,
  asset: DemAsset,
  mapView: { scale: number; offsetX: number; offsetY: number; fitMode?: "stretch" | "cover" },
  useWorkbenchView: boolean,
  selectedFeatureId: string | null
): void {
  const context = surface.getContext("2d");
  if (!context) return;

  const { width, height } = surface;
  context.clearRect(0, 0, width, height);
  const projection = strictAtlasProjection(asset, surface, mapView);

  const atlasLayers = qinlingAtlasLayers.map((layer) => ({
    ...layer,
    defaultVisible: atlasWorkbench.visibleLayerIds.has(layer.id)
  }));
  const featuresForView = activeAtlasFeatures();
  const minDisplayPriority = atlasMinimumDisplayPriority({
    fullscreen: useWorkbenchView,
    scale: mapView.scale
  });

  atlasVisibleFeatures(featuresForView, atlasLayers, {
    minDisplayPriority,
    includeUnverifiedFeatures: true
  }).forEach((feature) => {
    drawAtlasFeature(context, feature, projection, useWorkbenchView);
  });

  drawRegionPlacemarks(context, projection, useWorkbenchView);

  if (selectedFeatureId) {
    const selected = featuresForView.find((f) => f.id === selectedFeatureId) ?? null;
    if (selected) {
      drawAtlasFeatureSelection(context, selected, projection);
    }
  }
}

function drawAtlasMapCanvas(
  canvas: HTMLCanvasElement,
  asset: DemAsset,
  playerPosition: Vector3,
  useWorkbenchView = false
): void {
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  const { width, height } = canvas;
  const mapView = useWorkbenchView
    ? atlasWorkbench.mapView
    : { scale: 1, offsetX: 0, offsetY: 0 };
  const projection = strictAtlasProjection(asset, canvas, mapView);

  // 找到/建底图缓存。mini-map 的 mapView 是固定 1/0/0，layer 不切，
  // selected 不变 → cacheKey 几乎永远不变 → 全程命中。
  let cache = atlasStaticCaches.get(canvas);
  const cacheKey = atlasStaticCacheKey(
    canvas,
    mapView,
    useWorkbenchView,
    currentMode
  );
  if (!cache) {
    const surface = document.createElement("canvas");
    surface.width = width;
    surface.height = height;
    cache = { surface, key: "" };
    atlasStaticCaches.set(canvas, cache);
  } else if (cache.surface.width !== width || cache.surface.height !== height) {
    cache.surface.width = width;
    cache.surface.height = height;
    cache.key = ""; // 尺寸变就强制重画
  }
  if (cache.key !== cacheKey) {
    renderAtlasStaticInto(
      cache.surface,
      asset,
      mapView,
      useWorkbenchView
    );
    cache.key = cacheKey;
  }

  let featureCache = atlasFeatureCaches.get(canvas);
  const featureCacheKey = atlasFeatureCacheKey(
    canvas,
    mapView,
    useWorkbenchView,
    atlasWorkbench.selectedFeatureId ?? null,
    atlasWorkbench.visibleLayerIds,
    atlasFeaturesVersion,
    activeChunkId,
    currentMode
  );
  if (!featureCache) {
    const surface = document.createElement("canvas");
    surface.width = width;
    surface.height = height;
    featureCache = { surface, key: "" };
    atlasFeatureCaches.set(canvas, featureCache);
  } else if (
    featureCache.surface.width !== width ||
    featureCache.surface.height !== height
  ) {
    featureCache.surface.width = width;
    featureCache.surface.height = height;
    featureCache.key = "";
  }
  if (featureCache.key !== featureCacheKey) {
    renderAtlasFeaturesInto(
      featureCache.surface,
      asset,
      mapView,
      useWorkbenchView,
      atlasWorkbench.selectedFeatureId ?? null
    );
    featureCache.key = featureCacheKey;
  }

  // 把缓存 blit 到目标 canvas。玩家位置和 fullscreen overlay 变化频繁但成本低，
  // 所以不进 features cache。
  context.clearRect(0, 0, width, height);
  context.drawImage(cache.surface, 0, 0);
  context.drawImage(featureCache.surface, 0, 0);
  drawAtlasOverlay(context, canvas, asset, mapView, useWorkbenchView);

  const playerPoint = projection.worldToCanvas({
    x: playerPosition.x,
    y: playerPosition.z
  });
  const playerX = MathUtils.clamp(playerPoint.x, 0, width);
  const playerY = MathUtils.clamp(playerPoint.y, 0, height);

  // 全屏 atlas 上玩家标记需要更显眼：光晕 + 大圆点 + 朝向小三角。
  // 小窗 minimap 仍保持原来的 5.5px 紧凑圆点。
  const fullscreenScale = useWorkbenchView ? 1.7 : 1;
  const dotRadius = 5.5 * fullscreenScale;

  if (useWorkbenchView) {
    // 半透明光晕，让玩家位置远看也能扫到
    const haloGradient = context.createRadialGradient(
      playerX, playerY, dotRadius * 0.4,
      playerX, playerY, dotRadius * 4
    );
    haloGradient.addColorStop(0, "rgba(245, 231, 164, 0.42)");
    haloGradient.addColorStop(1, "rgba(245, 231, 164, 0)");
    context.fillStyle = haloGradient;
    context.beginPath();
    context.arc(playerX, playerY, dotRadius * 4, 0, Math.PI * 2);
    context.fill();
  }

  // 朝向小三角：按 cameraHeading 决定指向哪个世界方向。
  // 玩家朝 -Z（南）时 heading=0，要让箭头指向 atlas 上的"南"=画布 +y 方向。
  // forward (world) = (-sin h, -cos h)；atlas 上 +world.z → -canvas.y，
  // 所以 atlas 屏幕方向 = (-sin h, +cos h)。
  // 用户："代表人物的圆点加一个方向" → minimap 也画三角，跟全屏一起显示。
  {
    const arrowAngle = Math.atan2(-Math.sin(cameraHeading), Math.cos(cameraHeading));
    const tipDistance = dotRadius * 2.2;
    const baseHalf = dotRadius * 0.95;
    context.save();
    context.translate(playerX, playerY);
    context.rotate(arrowAngle);
    context.beginPath();
    context.moveTo(0, -tipDistance);
    context.lineTo(baseHalf, dotRadius * 0.4);
    context.lineTo(-baseHalf, dotRadius * 0.4);
    context.closePath();
    context.fillStyle = "rgba(245, 231, 164, 0.92)";
    context.fill();
    context.strokeStyle = "rgba(44, 24, 14, 0.7)";
    context.lineWidth = 1.6;
    context.stroke();
    context.restore();
  }

  context.beginPath();
  context.arc(playerX, playerY, dotRadius, 0, Math.PI * 2);
  context.fillStyle = "#f5e7a4";
  context.fill();
  context.lineWidth = 2;
  context.strokeStyle = "rgba(44, 24, 14, 0.8)";
  context.stroke();
}

function drawAtlasOverlay(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  asset: DemAsset,
  mapView: { scale: number },
  fullscreen: boolean
): void {
  if (!fullscreen) {
    return;
  }

  // 比例尺：50km 在 worldspace 是多少世界单位？
  // worldspace 单位 = asset.geographicFootprintKm.width / asset.world.width 公里。
  // 旧 slice (420km/180unit) → 全国 (5602km/1711unit ≈ 3.27 km/unit)，差 ~20×。
  // 必须从 asset 读，不能 hardcode。
  const footprintKmWidth =
    (asset as DemAsset & { geographicFootprintKm?: { width: number } }).geographicFootprintKm
      ?.width ?? asset.world.width;
  const kmPerUnit = footprintKmWidth / asset.world.width;
  const scaleKm = 50;
  const scaleUnits = scaleKm / kmPerUnit;
  const scaleBarPx =
    (scaleUnits / asset.world.width) * canvas.width * mapView.scale;

  // 把所有 overlay 放在 canvas 左下角——右上方被 atlas-side-panel 遮住。
  const margin = 28;
  const baseY = canvas.height - margin;
  const barLeft = margin;
  const barRight = barLeft + scaleBarPx;

  context.save();

  // 比例尺横线 + 50km 文字
  context.strokeStyle = "rgba(247, 234, 188, 0.88)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(barLeft, baseY);
  context.lineTo(barRight, baseY);
  context.stroke();
  // 端点小竖线
  context.beginPath();
  context.moveTo(barLeft, baseY - 5);
  context.lineTo(barLeft, baseY + 5);
  context.moveTo(barRight, baseY - 5);
  context.lineTo(barRight, baseY + 5);
  context.stroke();

  // 用户：把最小的字给我放大。所有 < 14px 的 atlas 文字提到 14-16 px。
  context.font = "500 16px 'Noto Sans SC', 'PingFang SC', sans-serif";
  context.textAlign = "center";
  context.textBaseline = "alphabetic";
  context.fillStyle = "rgba(247, 234, 188, 0.9)";
  context.fillText(`${scaleKm} km`, (barLeft + barRight) / 2, baseY - 8);

  // Zoom 等级 + evidence 阈值提示（比例尺上方）
  context.font = "600 17px 'Noto Sans SC', 'PingFang SC', sans-serif";
  context.textAlign = "left";
  context.fillStyle = "rgba(247, 234, 188, 0.78)";
  context.fillText(`缩放 ${mapView.scale.toFixed(2)}x`, barLeft, baseY - 30);
  context.font = "500 14px 'Noto Sans SC', 'PingFang SC', sans-serif";
  context.fillStyle = "rgba(247, 234, 188, 0.55)";
  context.fillText(
    mapView.scale >= 1.45
      ? "OSM 详细水系已加载"
      : "缩放 ≥ 1.45x 加载 OSM 详细水系",
    barLeft,
    baseY - 14
  );

  // 数据源标注（更下方，最低存在感）
  context.font = "500 14px 'Noto Sans SC', 'PingFang SC', sans-serif";
  context.textAlign = "left";
  context.fillStyle = "rgba(247, 234, 188, 0.4)";
  context.fillText(
    "DEM · FABDEM V1-2     水系 · OSM Overpass",
    barLeft,
    baseY + 18
  );

  context.restore();
}

interface RegionPlacemark {
  name: string;
  lat: number;
  lon: number;
  fontSize: number;
}

// 宏观地带标签：跟 feature 系统并行，atlas 打开时作为"地理骨架"。
// 用 lat/lon 而不是 world.x/z，bounds 改了自动跟着重投影（refactor #63）。
// 真实经纬度按对应地理中心估算：关中平原≈西安附近(34.5°N, 108.5°E)，
// 秦岭主脊≈太白山(33.95°N, 107.78°E)，等等。
const qinlingRegionPlacemarks: RegionPlacemark[] = [
  { name: "关中平原",     lat: 34.50, lon: 108.30, fontSize: 26 },
  { name: "渭河谷地",     lat: 34.60, lon: 106.20, fontSize: 22 },
  { name: "秦岭主脊",     lat: 33.85, lon: 106.45, fontSize: 25 },
  { name: "汉中盆地",     lat: 33.20, lon: 107.05, fontSize: 24 },
  { name: "蜀道走廊",     lat: 32.55, lon: 106.05, fontSize: 22 },
  { name: "四川盆地北缘", lat: 31.55, lon: 105.30, fontSize: 22 },
  { name: "成都平原",     lat: 30.65, lon: 104.65, fontSize: 24 },
  // 五大湖：mini-map 上加湖名 placemark，让用户能识别 polygon 是哪个湖。
  { name: "青海湖",       lat: 36.85, lon: 100.18, fontSize: 22 },
  { name: "鄱阳湖",       lat: 29.10, lon: 116.20, fontSize: 22 },
  { name: "洞庭湖",       lat: 29.20, lon: 112.85, fontSize: 22 },
  { name: "太湖",         lat: 31.20, lon: 120.20, fontSize: 22 },
  { name: "巢湖",         lat: 31.55, lon: 117.45, fontSize: 22 }
];

function drawRegionPlacemarks(
  context: CanvasRenderingContext2D,
  projection: AtlasCanvasProjection,
  fullscreen: boolean
): void {
  if (!fullscreen) {
    return;
  }
  context.save();
  context.textAlign = "center";
  context.textBaseline = "middle";
  // 用 terrainSampler 提供的 bounds + world 算每个 placemark 当前的世界 (x,z)，
  // 然后投到 atlas 像素。bounds 改了，placemark 自动跟着移到正确地理位置。
  const bounds = terrainSampler?.asset.bounds;
  const world = terrainSampler?.asset.world;
  qinlingRegionPlacemarks.forEach((mark) => {
    const wp = bounds && world
      ? projectGeoToWorld({ lat: mark.lat, lon: mark.lon }, bounds, world)
      : { x: 0, z: 0 };
    const point = projection.worldToCanvas({ x: wp.x, y: wp.z });
    context.font = `700 ${mark.fontSize}px 'Noto Sans SC', 'PingFang SC', sans-serif`;
    const metrics = context.measureText(mark.name);
    const padX = 10;
    const padY = mark.fontSize * 0.36;
    const rectW = metrics.width + padX * 2;
    const rectH = mark.fontSize + padY * 2;
    context.fillStyle = "rgba(9, 18, 19, 0.55)";
    context.beginPath();
    if (typeof context.roundRect === "function") {
      context.roundRect(point.x - rectW / 2, point.y - rectH / 2, rectW, rectH, 6);
    } else {
      context.rect(point.x - rectW / 2, point.y - rectH / 2, rectW, rectH);
    }
    context.fill();
    context.strokeStyle = "rgba(245, 231, 164, 0.32)";
    context.lineWidth = 1;
    context.stroke();
    context.fillStyle = "rgba(247, 234, 188, 0.94)";
    context.fillText(mark.name, point.x, point.y + 1);
  });
  context.restore();
}

function drawDemQualityOverlay(
  context: CanvasRenderingContext2D,
  asset: DemAsset,
  canvas: HTMLCanvasElement,
  projection: AtlasCanvasProjection,
  showLabel: boolean
): void {
  const rects = missingDemTileWorldRects(asset);

  if (rects.length === 0) {
    return;
  }

  context.save();
  context.setLineDash([8, 5]);
  context.lineWidth = 1.5;
  context.strokeStyle = "rgba(125, 51, 33, 0.78)";
  context.fillStyle = "rgba(181, 75, 45, 0.2)";
  let labelBounds: { x: number; y: number; maxX: number; maxY: number } | null = null;

  for (const rect of rects) {
    const topLeft = projection.worldToCanvas({ x: rect.minX, y: rect.maxY });
    const bottomRight = projection.worldToCanvas({ x: rect.maxX, y: rect.minY });
    const x = Math.min(topLeft.x, bottomRight.x);
    const y = Math.min(topLeft.y, bottomRight.y);
    const w = Math.abs(bottomRight.x - topLeft.x);
    const h = Math.abs(bottomRight.y - topLeft.y);

    if (w < 2 || h < 2) {
      continue;
    }

    labelBounds = labelBounds
      ? {
          x: Math.min(labelBounds.x, x),
          y: Math.min(labelBounds.y, y),
          maxX: Math.max(labelBounds.maxX, x + w),
          maxY: Math.max(labelBounds.maxY, y + h)
        }
      : { x, y, maxX: x + w, maxY: y + h };

    context.fillRect(x, y, w, h);
    context.strokeRect(x, y, w, h);

    context.save();
    context.beginPath();
    context.rect(x, y, w, h);
    context.clip();
    context.setLineDash([]);
    context.strokeStyle = "rgba(125, 51, 33, 0.24)";
    for (let hatch = x - h; hatch < x + w + h; hatch += 12) {
      context.beginPath();
      context.moveTo(hatch, y + h);
      context.lineTo(hatch + h, y);
      context.stroke();
    }
    context.restore();
  }

  if (
    showLabel &&
    labelBounds &&
    labelBounds.maxX - labelBounds.x > 70 &&
    labelBounds.maxY - labelBounds.y > 28
  ) {
    context.setLineDash([]);
    context.fillStyle = "rgba(55, 30, 22, 0.84)";
    context.fillRect(labelBounds.x + 8, labelBounds.y + 8, 104, 22);
    context.fillStyle = "#f6d7a2";
    context.font = "12px serif";
    context.fillText("DEM缺瓦片/插值", labelBounds.x + 14, labelBounds.y + 23);
  }

  context.restore();
}

function drawOverviewMap(asset: DemAsset, playerPosition: Vector3): void {
  drawAtlasMapCanvas(hud.overviewCanvas, asset, playerPosition);
  recordHudRedrawForDev();

  if (atlasWorkbench.isFullscreen) {
    resizeAtlasCanvasToDisplaySize(hud.atlasFullscreenCanvas);
    drawAtlasMapCanvas(hud.atlasFullscreenCanvas, asset, playerPosition, true);
  }
}

let hudRedrawCountForDev = 0;
let hudRedrawLastLogMs = 0;

function recordHudRedrawForDev(): void {
  if (!isDevModeEnabled()) {
    return;
  }
  hudRedrawCountForDev += 1;
  const now = performance.now();
  if (now - hudRedrawLastLogMs < 5000) {
    return;
  }
  const elapsedSeconds = Math.max((now - hudRedrawLastLogMs) / 1000, 0.001);
  console.info(
    `[hud] atlas redraw frequency: ${(hudRedrawCountForDev / elapsedSeconds).toFixed(2)} Hz`
  );
  hudRedrawCountForDev = 0;
  hudRedrawLastLogMs = now;
}

function nearestLandmarkText(): string {
  if (!terrainSampler) {
    return "山河正在显现。";
  }

  const currentPosition = new Vector2(player.position.x, player.position.z);
  // 跟 rebuildLandmarkVisuals 保持一致：legacy 重叠的"意象"城市地标不
  // 进 HUD nearest（否则站在 西安 旁还是被告知"附近：长安意象"）。
  // 同时把 P4 真实城市 instanced markers 也变成 nearest 候选，否则 HUD
  // 会指向更远的 渭河平原 / 褒斜谷意象 之类，而玩家其实就站在西安/汉中
  // 旁边——codex d99d587 review 抓到。
  const renderableLandmarks = landmarks.filter(
    (landmark) => !isLegacyOverlappingCityLandmark(landmark)
  );
  const visibleLandmarks =
    regionChunkManifest && visibleChunkIds.size > 0
      ? renderableLandmarks.filter((landmark) => {
          const chunkId = landmarkChunkIds.get(landmark.name) ?? null;
          return !chunkId || visibleChunkIds.has(chunkId);
        })
      : renderableLandmarks;

  const baseLandmarks = visibleLandmarks.length > 0 ? visibleLandmarks : renderableLandmarks;
  const landmarksToUse = [...baseLandmarks, ...realCityLandmarksForHud()];

  const nearest = landmarksToUse.reduce((best, landmark) => {
    const bestDistance = best.position.distanceTo(currentPosition);
    const candidateDistance = landmark.position.distanceTo(currentPosition);
    return candidateDistance < bestDistance ? landmark : best;
  }, landmarksToUse[0]!);

  return `${nearest.name} · ${nearest.description}`;
}

function routeStatusText(influence: RouteInfluence): string {
  if (!influence.nearestRoute) {
    return "古道：未识别路线";
  }

  if (influence.affinity > 0.72) {
    return `古道：贴近${influence.nearestRoute.name}，坡地消耗降低`;
  }

  if (influence.affinity > 0.28) {
    return `古道：${influence.nearestRoute.name}在附近，继续贴线更省力`;
  }

  return `古道：偏离${influence.nearestRoute.name}，山地消耗上升`;
}

function atlasFeatureCenterInView(
  feature: QinlingAtlasFeature,
  projection: AtlasCanvasProjection
): { x: number; y: number } {
  const points = featureWorldPoints(feature).map((point) =>
    projection.worldToCanvas(point)
  );
  const sum = points.reduce(
    (total, point) => ({
      x: total.x + point.x,
      y: total.y + point.y
    }),
    { x: 0, y: 0 }
  );

  return {
    x: sum.x / points.length,
    y: sum.y / points.length
  };
}

function drawAtlasPath(
  context: CanvasRenderingContext2D,
  feature: QinlingAtlasFeature,
  projection: AtlasCanvasProjection
): void {
  const points = featureWorldPoints(feature).map((point) =>
    projection.worldToCanvas(point)
  );

  if (points.length === 0) {
    return;
  }

  context.beginPath();
  points.forEach((point, index) => {
    if (index === 0) {
      context.moveTo(point.x, point.y);
      return;
    }

    context.lineTo(point.x, point.y);
  });
}

function drawAtlasFeature(
  context: CanvasRenderingContext2D,
  feature: QinlingAtlasFeature,
  projection: AtlasCanvasProjection,
  fullscreen = false
): void {
  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";

  // 判断这条 feature 是不是手画意象（manual-atlas-draft / unverified）。
  // 古道、城市、关隘、地貌区域当前全部是手工绘制的"叙事意象"，不是真实
  // GIS 数据。视觉上必须能区分，避免用户误读为事实。
  const sourceName = feature.source?.name ?? "";
  const isOsmEvidence = sourceName === "openstreetmap-overpass";
  const isDraftImagery =
    !isOsmEvidence &&
    !(
      feature.source?.verification === "external-vector" ||
      feature.source?.verification === "verified"
    );

  if (feature.layer === "landform") {
    drawAtlasPath(context, feature, projection);
    if (feature.geometry === "area") {
      const isBasin = feature.terrainRole.includes("basin");
      const isGorge = feature.terrainRole.includes("gorge");
      context.fillStyle = isGorge
        ? "rgba(130, 73, 39, 0.22)"
        : isBasin
          ? "rgba(76, 122, 89, 0.24)"
          : "rgba(116, 100, 54, 0.18)";
      context.strokeStyle = isGorge
        ? "rgba(107, 52, 28, 0.34)"
        : "rgba(55, 70, 43, 0.24)";
      context.lineWidth = isGorge ? 2.1 : 1.2;
      // draft 意象 area 用虚线边界
      if (isDraftImagery) {
        context.setLineDash([6, 4]);
      }
      context.closePath();
      context.fill();
      context.stroke();
      context.setLineDash([]);
    } else if (feature.geometry === "polyline") {
      context.strokeStyle = "rgba(87, 65, 35, 0.58)";
      context.lineWidth = 2.4;
      if (isDraftImagery) {
        context.setLineDash([6, 4]);
      }
      context.stroke();
      context.setLineDash([]);
    }
  }

  if (feature.layer === "water") {
    // 按 source / displayPriority 做四级视觉权重：
    //   - 干流（rank=1，curated/primary，priority>=10）：粗深蓝 + 白光晕，最强
    //   - 一级支流（priority 8-9）：中等粗
    //   - 地方支流 / 渠道：细
    //   - OSM evidence：极细浅灰（仅在 zoom 阈值后加载）
    // hillshade 让地形对比度高，所以水线必须够粗够亮才不会被淹没。
    const sourceName = feature.source?.name ?? "";
    const isEvidence = sourceName === "openstreetmap-overpass";
    const isMajor = feature.displayPriority >= 10;
    const isMid = feature.displayPriority >= 8 && !isMajor;

    if (isEvidence) {
      drawAtlasPath(context, feature, projection);
      context.strokeStyle = "rgba(150, 180, 190, 0.55)";
      context.lineWidth = 0.9;
      context.stroke();
    } else {
      const outerHaloWidth = isMajor ? 11 : isMid ? 7 : 5;
      const haloWidth = isMajor ? 7 : isMid ? 4.6 : 3.4;
      const coreWidth = isMajor ? 3.4 : isMid ? 2.2 : 1.5;
      const coreColor = isMajor
        ? "rgba(96, 198, 230, 1)"
        : isMid
          ? "rgba(126, 212, 230, 0.95)"
          : "rgba(160, 220, 230, 0.85)";

      // 外层柔光：白色低 alpha，让水线在 hillshade 上"发亮"
      drawAtlasPath(context, feature, projection);
      context.strokeStyle = isMajor
        ? "rgba(220, 245, 252, 0.32)"
        : "rgba(220, 245, 252, 0.2)";
      context.lineWidth = outerHaloWidth;
      context.stroke();
      // 中层深蓝边
      drawAtlasPath(context, feature, projection);
      context.strokeStyle = "rgba(20, 70, 88, 0.7)";
      context.lineWidth = haloWidth;
      context.stroke();
      // 核心鲜蓝
      drawAtlasPath(context, feature, projection);
      context.strokeStyle = coreColor;
      context.lineWidth = coreWidth;
      context.stroke();
    }
  }

  if (feature.layer === "road") {
    drawAtlasPath(context, feature, projection);
    context.setLineDash([5, 4]);
    context.strokeStyle = "rgba(93, 52, 18, 0.44)";
    context.lineWidth = 2.4;
    context.stroke();
    drawAtlasPath(context, feature, projection);
    context.strokeStyle = "rgba(229, 168, 82, 0.76)";
    context.lineWidth = 1.25;
    context.stroke();
    context.setLineDash([]);
  }

  if (feature.geometry === "point") {
    const center = atlasFeatureCenterInView(feature, projection);
    const isPass = feature.layer === "pass";
    const radius = isPass ? 4.2 : 3.4;

    context.beginPath();
    if (isPass) {
      context.rect(center.x - radius, center.y - radius, radius * 2, radius * 2);
    } else {
      context.arc(center.x, center.y, radius, 0, Math.PI * 2);
    }
    context.fillStyle = isPass ? "rgba(130, 54, 24, 0.9)" : "rgba(231, 194, 106, 0.9)";
    context.strokeStyle = "rgba(36, 24, 14, 0.64)";
    context.lineWidth = 1.4;
    context.fill();
    context.stroke();
  }

  if (feature.displayPriority >= 9) {
    const center = atlasFeatureCenterInView(feature, projection);
    // 全屏字号大幅放大——之前 12/10 在 1144x720 的全屏地图上太小看不清。
    // 小窗 minimap 仍用紧凑字号。
    const baseLandformPx = fullscreen ? 17 : 12;
    const baseOtherPx = fullscreen ? 15 : 10;
    context.font =
      feature.layer === "landform"
        ? `600 ${baseLandformPx}px 'Noto Sans SC', 'PingFang SC', sans-serif`
        : `600 ${baseOtherPx}px 'Noto Sans SC', 'PingFang SC', sans-serif`;
    context.fillStyle = feature.layer === "water"
      ? "rgba(24, 82, 92, 0.86)"
      : feature.layer === "road" || feature.layer === "pass"
        ? "rgba(92, 45, 18, 0.84)"
        : "rgba(45, 35, 20, 0.8)";
    // 手画意象在名字后追加" · 意象"提示，防止用户误读为事实数据。
    const labelText = isDraftImagery ? `${feature.name} · 意象` : feature.name;
    context.fillText(labelText, center.x + 5, center.y - 4);
  }

  context.restore();
}

function drawAtlasFeatureSelection(
  context: CanvasRenderingContext2D,
  feature: QinlingAtlasFeature,
  projection: AtlasCanvasProjection
): void {
  const center = atlasFeatureCenterInView(feature, projection);

  context.save();
  context.beginPath();
  context.arc(center.x, center.y, 7.2, 0, Math.PI * 2);
  context.strokeStyle = "rgba(255, 246, 190, 0.95)";
  context.lineWidth = 2.4;
  context.stroke();
  context.beginPath();
  context.arc(center.x, center.y, 10.5, 0, Math.PI * 2);
  context.strokeStyle = "rgba(112, 52, 22, 0.55)";
  context.lineWidth = 1.4;
  context.stroke();
  context.restore();
}

function refreshAtlasWorkbench(): void {
  hud.renderAtlasLayers(qinlingAtlasLayers, atlasWorkbench.visibleLayerIds);
  // 先把 summary 喂给 hud（它在没选 feature 时显示），再喂选中 feature。
  // 这样未选时显示统计，选中时显示具体 feature 信息。
  const visibleFeatures = activeAtlasFeatures().filter((feature) =>
    atlasWorkbench.visibleLayerIds.has(feature.layer)
  );
  const layerCounts = qinlingAtlasLayers
    .filter((layer) => atlasWorkbench.visibleLayerIds.has(layer.id))
    .map((layer) => ({
      layerId: layer.id,
      layerName: layer.name,
      count: visibleFeatures.filter((feature) => feature.layer === layer.id).length
    }));
  hud.renderAtlasSummary({
    layerCounts,
    totalFeatures: visibleFeatures.length,
    evidenceLoaded:
      atlasWorkbench.isFullscreen &&
      (atlasWorkbench.mapView?.scale ?? 1) >= EVIDENCE_ZOOM_THRESHOLD
  });
  hud.renderAtlasFeature(
    selectedAtlasFeature(atlasWorkbench, activeAtlasFeatures())
  );
  hud.setAtlasFullscreenOpen(atlasWorkbench.isFullscreen);
  hudDirty = true;
}

// 拖动 / 缩放只需要重绘地图 canvas，不需要重生成 layer chips DOM 或 feature card。
// 把 pointermove / wheel 路径与 layer toggle / feature select 路径分开，
// 并合并到下一个 rAF，避免一次拖动产生几十次 innerHTML 重建。
let atlasMapRedrawScheduled = false;
function scheduleAtlasMapRedraw(): void {
  hudDirty = true;
  if (atlasMapRedrawScheduled) {
    return;
  }
  atlasMapRedrawScheduled = true;
  requestAnimationFrame(() => {
    atlasMapRedrawScheduled = false;
  });
}

function nearestUncollectedFragment():
  | { fragment: KnowledgeFragment; distance: number }
  | null {
  const currentPosition = new Vector2(player.position.x, player.position.z);
  let best: { fragment: KnowledgeFragment; distance: number } | null = null;

  knowledgeFragments.forEach((fragment) => {
    if (collectedIds.has(fragment.id)) {
      return;
    }

    if (regionChunkManifest && visibleChunkIds.size > 0) {
      const chunkId = fragmentVisuals.get(fragment.id)?.chunkId ?? null;

      if (chunkId && !visibleChunkIds.has(chunkId)) {
        return;
      }
    }

    const distance = fragment.position.distanceTo(currentPosition);

    if (!best || distance < best.distance) {
      best = { fragment, distance };
    }
  });

  return best;
}

// 上次画 mini-map 时的玩家位置，用来判断"够远才重画"——unmoved 的镜头/玩家
// 不应该每秒触发 ~12ms 的 canvas2d 重绘（用户："fps 动不动就跌很低"）。
let lastDrawnPlayerX = Number.POSITIVE_INFINITY;
let lastDrawnPlayerZ = Number.POSITIVE_INFINITY;

function refreshHud(): void {
  if (!terrainSampler) {
    return;
  }
  // 玩家位置阈值：mini-map 上 1 像素约对应 0.8 世界单位（180/220）。0.6
  // 单元的位移就重绘，确保 dot 看上去贴着玩家。atlas 全屏期间走 0.15s
  // 强制刷新（hudRefreshInterval 那条路径），不走这里——所以这个阈值只
  // 影响游戏视图下的 mini-map 节流。
  const playerDx = Math.abs(player.position.x - lastDrawnPlayerX);
  const playerDz = Math.abs(player.position.z - lastDrawnPlayerZ);
  const playerMoved = playerDx > 0.6 || playerDz > 0.6;
  // hudDirty 路径（用户操作 toggle layer / 切季节等）一律重绘——保证内容
  // 状态实时反映。timer 路径下只有玩家位移够大才重绘；atlas 全屏时玩家
  // 还想看 dot 慢慢移动，所以全屏时 timer 也照画（已被外层 0.5s throttle）。
  if (hudDirty || playerMoved || atlasWorkbench.isFullscreen) {
    drawOverviewMap(terrainSampler.asset, player.position);
    lastDrawnPlayerX = player.position.x;
    lastDrawnPlayerZ = player.position.z;
  }
  hud.setActiveMode(currentMode);
  // 用户："标题应该直接说现在在什么位置"——zone 字段已经简化为纯地名（无前缀
  // 无 chunk 后缀），写到 title-block h1。chunkSuffix 不再用。
  void activeChunkId;
  const routeInfluence = routeAffinityAt({
    x: player.position.x,
    y: player.position.z
  });
  const routeLine = routeStatusText(routeInfluence);

  const nearby = nearestUncollectedFragment();

  if (!nearby) {
    hud.updateStatus({
      zone: zoneNameAt(player.position.x, player.position.z, terrainSampler),
      mode: `视图：${modeMeta[currentMode].title}`,
      environment: `时辰：${formatAncientTimeOfDay(environmentController.state.timeOfDay)} · ${seasonLabel(environmentController.state.season)} · ${weatherLabel(environmentController.state.weather)}`,
      collection: `残简：${collectedIds.size} / ${knowledgeFragments.length}`,
      nearby: `附近：风声已经安静下来。 · ${routeLine}`,
      story: storyLine
    });
    return;
  }

  if (nearby.distance < 9) {
    hud.updateStatus({
      zone: zoneNameAt(player.position.x, player.position.z, terrainSampler),
      mode: `视图：${modeMeta[currentMode].title}`,
      environment: `时辰：${formatAncientTimeOfDay(environmentController.state.timeOfDay)} · ${seasonLabel(environmentController.state.season)} · ${weatherLabel(environmentController.state.weather)}`,
      collection: `残简：${collectedIds.size} / ${knowledgeFragments.length}`,
      nearby: `附近：微光残简「${nearby.fragment.title}」 · ${routeLine}`,
      story: storyLine
    });
    return;
  }

  hud.updateStatus({
    zone: zoneNameAt(player.position.x, player.position.z, terrainSampler),
    mode: `视图：${modeMeta[currentMode].title}`,
    environment: `时辰：${formatAncientTimeOfDay(environmentController.state.timeOfDay)} · ${seasonLabel(environmentController.state.season)} · ${weatherLabel(environmentController.state.weather)}`,
    collection: `残简：${collectedIds.size} / ${knowledgeFragments.length}`,
    nearby: `附近：${nearestLandmarkText()} · ${routeLine}`,
    story: storyLine
  });
}

function collectFragment(fragment: KnowledgeFragment): void {
  if (collectedIds.has(fragment.id)) {
    return;
  }

  collectedIds.add(fragment.id);
  selectedFragmentId = fragment.id;
  renderJournal();
  refreshHud();

  const visual = fragmentVisuals.get(fragment.id);

  if (visual) {
    visual.sprite.visible = false;
    visual.halo.visible = false;
  }

  hudDirty = true;
  showToast(fragment.pickupLine);
}

function updateFragmentVisuals(elapsedTime: number): void {
  if (!terrainSampler) {
    return;
  }

  const currentPosition = new Vector2(player.position.x, player.position.z);

  knowledgeFragments.forEach((fragment) => {
    const visual = fragmentVisuals.get(fragment.id);

    if (!visual) {
      return;
    }

    if (visual.chunkId && visibleChunkIds.size > 0 && !visibleChunkIds.has(visual.chunkId)) {
      visual.sprite.visible = false;
      visual.halo.visible = false;
      return;
    }

    if (collectedIds.has(fragment.id)) {
      visual.sprite.visible = false;
      visual.halo.visible = false;
      return;
    }

    const distance = fragment.position.distanceTo(currentPosition);
    const pulse = 0.6 + Math.sin(elapsedTime * 2 + visual.phase) * 0.15;

    visual.sprite.visible = true;
    visual.halo.visible = true;
    visual.sprite.position.y = visual.baseY + Math.sin(elapsedTime * 2.2 + visual.phase) * 0.4;
    visual.halo.position.y = visual.baseY - 1.2;
    visual.halo.scale.setScalar(5.2 + pulse);
    visual.sprite.material.opacity = MathUtils.clamp(1.2 - distance / 18, 0.35, 1);
    visual.halo.material.opacity = MathUtils.clamp(1 - distance / 22, 0.1, 0.4);

    if (distance < 3.2) {
      collectFragment(fragment);
    }
  });
}

function chunkCenterFromBounds(worldBounds: {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}): Vector2 {
  return new Vector2(
    (worldBounds.minX + worldBounds.maxX) * 0.5,
    (worldBounds.minZ + worldBounds.maxZ) * 0.5
  );
}

async function ensureVisibleChunkTerrain(chunkIds: Set<string>): Promise<void> {
  if (!regionChunkManifest || !regionChunkManifestUrl) {
    return;
  }

  const chunkManifestBaseUrl = regionChunkManifestUrl;
  const neededChunks = regionChunkManifest.chunks.filter((chunk) =>
    chunkIds.has(chunk.id)
  );

  await Promise.all(
    neededChunks.map(async (chunk) => {
      if (terrainChunkMeshes.has(chunk.id)) {
        const existing = terrainChunkMeshes.get(chunk.id);

        if (existing) {
          if (!existing.mesh.visible) {
            existing.mesh.userData.fadeStart = clock.elapsedTime;
            // 立刻把 opacity 清零，避免 cached chunk 第一帧用旧的 1 渲
            // 染（codex fb57c87 P1 抓到 updateChunkFadeIn 跑在 visibility
            // 翻转之前导致一帧 pop）。
            (existing.mesh.material as MeshPhongMaterial).opacity = 0;
            if (existing.scenery) existing.scenery.visible = false;
          }
          existing.mesh.visible = true;
        }

        return;
      }

      const pending = chunkLoadPromises.get(chunk.id);

      if (pending) {
        await pending;
        const existing = terrainChunkMeshes.get(chunk.id);

        if (existing) {
          if (!existing.mesh.visible) {
            existing.mesh.userData.fadeStart = clock.elapsedTime;
            // 立刻把 opacity 清零，避免 cached chunk 第一帧用旧的 1 渲
            // 染（codex fb57c87 P1 抓到 updateChunkFadeIn 跑在 visibility
            // 翻转之前导致一帧 pop）。
            (existing.mesh.material as MeshPhongMaterial).opacity = 0;
            if (existing.scenery) existing.scenery.visible = false;
          }
          existing.mesh.visible = true;
        }

        return;
      }

      const loadPromise = (async () => {
        const chunkAssetUrl = new URL(chunk.file, chunkManifestBaseUrl).toString();
        const loadedChunk = await loadDemAsset(chunkAssetUrl);
        // 用户："Chunks 分辨率再调低一倍。0.9 km → 1.8 km"。运行时下采样
        // 2× → 51×51 cell 变 26×26，三角数 5000 → 1300/chunk，仍密于 base
        // 14.4 km/cell 一档。源文件不变。
        const downsampledAsset = downsampleChunkAsset(loadedChunk.asset, 2);
        const chunkSampler = new TerrainSampler(downsampledAsset);
        const terrainChunk = createTerrainMesh(chunkSampler);
        // 之前这里 setTerrainMeshSurfaceVisible(chunk, false) 把 material.visible
        // 设成 false，但代码里再也没人把它设回 true → chunk 永远不渲染，全屏
        // 只剩 L1 base 的大三角。createTerrainMesh 已经 transparent + opacity 0，
        // fade-in 路径会把 opacity 渐进到 1，不需要再压 material.visible。
        const scenery = createChunkScenery(
          chunkSampler,
          scaledSceneryBudget(),
          lastVisuals?.seasonalBlend ?? environmentController.computeVisuals().seasonalBlend,
          environmentController.state.season
        );
        const center = chunkCenterFromBounds(chunk.worldBounds);
        setTerrainMeshWorldPosition(terrainChunk, center.x, center.y, 0.12);
        terrainChunk.scenery = scenery;
        terrainChunk.mesh.add(scenery);

        if (lastVisuals) {
          updateTerrainMeshColors(
            terrainChunk,
            currentMode,
            environmentController.state,
            lastVisuals
          );
        }

        terrainChunk.mesh.userData.chunkId = chunk.id;
        terrainChunk.mesh.userData.fadeStart = clock.elapsedTime;
        terrainChunkGroup.add(terrainChunk.mesh);
        terrainChunkMeshes.set(chunk.id, terrainChunk);
        // 把 chunk sampler 注册进 composite。之后所有 terrainSampler.sample*
        // (建筑/水/POI 都在用) 在该 chunk 区域内的查询会优先走这个 sampler，
        // 高度跟 chunk mesh 一致。
        if (terrainSampler) {
          terrainSampler.registerChunk(chunk.id, chunkSampler, chunk.worldBounds);
          groundAnchorRegistry.reanchor(terrainSampler, chunk.worldBounds);
        }
      })()
        .catch((error) => {
          console.warn(`Failed to load terrain chunk ${chunk.id}.`, error);
        })
        .finally(() => {
          chunkLoadPromises.delete(chunk.id);
        });

      chunkLoadPromises.set(chunk.id, loadPromise);
      await loadPromise;
    })
  );

  terrainChunkMeshes.forEach((terrainChunk, chunkId) => {
    const wasVisible = terrainChunk.mesh.visible;
    const willBeVisible = chunkIds.has(chunkId);
    if (willBeVisible && !wasVisible) {
      terrainChunk.mesh.userData.fadeStart = clock.elapsedTime;
      (terrainChunk.mesh.material as MeshPhongMaterial).opacity = 0;
      if (terrainChunk.scenery) terrainChunk.scenery.visible = false;
    }
    terrainChunk.mesh.visible = willBeVisible;
  });
}

// Chunk fade-in：每帧把刚切到 visible 的 chunk 从 opacity 0 涨到 1，
// 1.2 秒走完。scenery（树）等 chunk fade 结束后再亮起来，避免地形还在
// 半透明时树已经满 opacity 漂在空气里（codex fb57c87 P2）。
// 筋斗云模式：scenery 全局关掉——高空俯瞰画风，地面树会让画面糊成一片。
function updateChunkFadeIn(): void {
  // 跟 applyCloudModeVisibility 同一 flag。用户："暂时把所有树木都隐藏掉"。
  const HIDE_ALL_VEGETATION = true;
  const sceneryEnabled =
    !HIDE_ALL_VEGETATION && !isFlyingMount(currentMountId);
  terrainChunkMeshes.forEach((terrainChunk) => {
    if (!terrainChunk.mesh.visible) return;
    const fadeStart = terrainChunk.mesh.userData.fadeStart as number | undefined;
    const material = terrainChunk.mesh.material as MeshPhongMaterial;
    if (fadeStart === undefined) {
      material.opacity = 1;
      if (terrainChunk.scenery) terrainChunk.scenery.visible = sceneryEnabled;
      return;
    }
    const elapsed = clock.elapsedTime - fadeStart;
    if (elapsed >= CHUNK_FADE_DURATION) {
      material.opacity = 1;
      delete terrainChunk.mesh.userData.fadeStart;
      if (terrainChunk.scenery) terrainChunk.scenery.visible = sceneryEnabled;
      return;
    }
    material.opacity = MathUtils.clamp(elapsed / CHUNK_FADE_DURATION, 0, 1);
    // scenery 在 fade 80% 之后再开始 visible，让树跟在 terrain 后面"长出来"。
    if (terrainChunk.scenery) {
      terrainChunk.scenery.visible =
        sceneryEnabled && elapsed >= CHUNK_FADE_DURATION * 0.8;
    }
  });
}

function updateTerrainLodMorphs(): void {
  const demoMorph = lodMorphDemoValue();
  const visibleCenterMorphs: number[] = [];
  let hiddenChunks = 0;

  updateTerrainShaderLodMorph(terrainMaterial, demoMorph);

  terrainChunkMeshes.forEach((terrainChunk) => {
    if (Array.isArray(terrainChunk.mesh.material)) {
      return;
    }

    // R6：实际 morph 在 vertex shader 按顶点 world distance 算，这里只保留
    // LOD_MORPH_DEMO 的全局 override。HUD 用 chunk 中心点估算可见区分布，
    // 不再把每个 chunk 当作单一 LOD 档位。
    updateTerrainShaderLodMorph(
      terrainChunk.mesh.material as MeshPhongMaterial,
      demoMorph
    );
    const centerMorph = computeLodMorph(
      Math.hypot(
        terrainChunk.mesh.position.x - camera.position.x,
        terrainChunk.mesh.position.z - camera.position.z
      )
    );
    terrainChunk.mesh.userData.lodMorph = demoMorph ?? centerMorph;

    if (terrainChunk.mesh.visible) {
      visibleCenterMorphs.push(demoMorph ?? centerMorph);
    } else {
      hiddenChunks += 1;
    }
  });

  perfStats.setLodBreakdown(
    formatTerrainLodBreakdown(
      summarizeChunkLodMorphs(visibleCenterMorphs, hiddenChunks)
    )
  );
}

async function syncChunkTerrainWindow(nextVisibleChunkIds: Set<string>): Promise<void> {
  if (!regionChunkManifest) {
    return;
  }

  const retainedChunkIds = limitChunkIdsByGridDistance(
    regionChunkManifest,
    buildRetainedChunkIds(
      regionChunkManifest,
      activeChunkId,
      runtimeBudget.streaming.retainedChunkRadius
    ),
    activeChunkId,
    runtimeBudget.streaming.maxLoadedTerrainChunks
  );
  await ensureVisibleChunkTerrain(retainedChunkIds);

  terrainChunkMeshes.forEach((terrainChunk, chunkId) => {
    if (!retainedChunkIds.has(chunkId)) {
      terrainChunkGroup.remove(terrainChunk.mesh);
      if (terrainChunk.scenery) {
        disposeScenery(terrainChunk.scenery);
      }
      disposeTerrainMesh(terrainChunk);
      terrainChunkMeshes.delete(chunkId);
      // 卸载时把 chunk 从 composite sampler 摘掉，回落 base。
      if (terrainSampler) {
        terrainSampler.unregisterChunk(chunkId);
      }
      return;
    }

    terrainChunk.mesh.visible = nextVisibleChunkIds.has(chunkId);
  });
  rebuildWildlifeVisuals(true);
}

function disposeChunkTerrain(): void {
  terrainChunkMeshes.forEach((terrainChunk, chunkId) => {
      terrainChunkGroup.remove(terrainChunk.mesh);
      if (terrainChunk.scenery) {
        disposeScenery(terrainChunk.scenery);
      }
      disposeTerrainMesh(terrainChunk);
      if (terrainSampler) {
        terrainSampler.unregisterChunk(chunkId);
      }
  });
  terrainChunkMeshes.clear();
  chunkLoadPromises.clear();
  disposeWildlifeVisuals();
}

function updateVisibleChunkState(nextChunkId: string | null): void {
  activeChunkId = nextChunkId;

  if (!regionChunkManifest) {
    visibleChunkIds = new Set();
    invalidatePoiHoverTargets();
    hudDirty = true;
    return;
  }

  visibleChunkIds = buildVisibleChunkIds(
    regionChunkManifest,
    activeChunkId,
    runtimeBudget.streaming.visibleChunkRadius
  );
  landmarkGroup.children.forEach((child) => {
    const chunkId =
      typeof child.userData?.chunkId === "string" ? child.userData.chunkId : null;
    child.visible = !chunkId || visibleChunkIds.has(chunkId);
  });
  scenicGroup.children.forEach((child) => {
    const chunkId =
      typeof child.userData?.chunkId === "string" ? child.userData.chunkId : null;
    child.visible = !chunkId || visibleChunkIds.has(chunkId);
  });
  ancientGroup.children.forEach((child) => {
    const chunkId =
      typeof child.userData?.chunkId === "string" ? child.userData.chunkId : null;
    child.visible = !chunkId || visibleChunkIds.has(chunkId);
  });
  invalidatePoiHoverTargets();
  void syncChunkTerrainWindow(visibleChunkIds);
  hudDirty = true;
}

function syncStoryGuideState(silent = false): void {
  const snapshot = evaluateStoryGuide(
    storyBeats,
    new Vector2(player.position.x, player.position.z),
    collectedIds,
    completedStoryBeatIds
  );

  if (snapshot.completedBeat && !completedStoryBeatIds.has(snapshot.completedBeat.id)) {
    completedStoryBeatIds.add(snapshot.completedBeat.id);
    // 用户："把主线推进什么这些显示全都给我去掉"——保留 storyBeat 完成的状态记录
    // （成就 / 进度仍在跑），但屏幕上不再 toast 主线推进文本。
  }

  const latestSnapshot = evaluateStoryGuide(
    storyBeats,
    new Vector2(player.position.x, player.position.z),
    collectedIds,
    completedStoryBeatIds
  );
  const nextStoryLine = formatStoryGuideLine(latestSnapshot);

  if (!storyGuideInitialized) {
    storyGuideInitialized = true;
    storyLine = nextStoryLine;
    hudDirty = true;
    return;
  }

  if (nextStoryLine !== storyLine) {
    storyLine = nextStoryLine;
    hudDirty = true;
  }
}

const keys = new Set<string>();
// 反方向键映射：按下任一方向键时，如果反向键还在 keys 里，先把反向移除。
// 让"刚按下"成为唯一意图，避免 w+s 同时按 → forward=0 cancel → 松开 s 又
// 开始 walking 的体验问题。
const OPPOSITE_DIRECTION_KEY: Record<string, string> = {
  w: "s",
  s: "w",
  a: "d",
  d: "a",
  arrowup: "arrowdown",
  arrowdown: "arrowup",
  arrowleft: "arrowright",
  arrowright: "arrowleft"
};
let cameraHeading = qinlingCameraRig.initialHeading;
// 用户："网页一进来就是进入到 F 的那个状态，直接对准小人"。
// F 键把视角拉到 minDistance+2 距离 + elevation 0.34（接近肩后跟随）。
let cameraElevation = 0.34;
let cameraDistance = qinlingCameraRig.minDistance + 2;
// 默认 follow（之前 overview）——overview 视角离地形太远 + FogExp2 衰减
// 让首屏看不到地形细节，用户反馈"看不到地形"。follow 是常用游戏视角，
// 玩家想看大地图按 O 切 overview。
let cameraViewMode: CameraViewMode = "follow";
// 首屏 cameraDistance / Elevation 也按 F 键（follow 重置）的值放——
// initialDistance 118 / Elevation 1.02 仍像半 overview，加 fog 看不见
// 地形细节。给 F 同款近镜头让玩家一进来就看到草、树、河、城。
let isDragging = false;
let dragOriginX = 0;
let dragOriginY = 0;
let isAtlasMapDragging = false;
let atlasMapDragOriginX = 0;
let atlasMapDragOriginY = 0;

function resetGameplayInput(): void {
  clearGameplayInput(keys);
  isDragging = false;
  isAtlasMapDragging = false;
  hideHoverCard();
}

function isTextInputFocused(): boolean {
  const activeElement = document.activeElement;
  if (!activeElement) {
    return false;
  }

  return (
    activeElement instanceof HTMLInputElement ||
    activeElement instanceof HTMLTextAreaElement ||
    activeElement instanceof HTMLSelectElement ||
    (activeElement instanceof HTMLElement && activeElement.isContentEditable)
  );
}

document.addEventListener("keydown", (event) => {
  // 用 normalizeInputKey(event) 而不是 event.key.toLowerCase()——它走 event.code
  // 路径，不受中文输入法 IME 影响。否则 macOS 中文用户按 Q/E/W/A/S/D 全部失效。
  const normalized = normalizeRuntimeInputKey(event);

  // 用户：M 重新变回"全屏地图"（之前临时挂了 mute，现在收回）。
  // 真正的 M handler 在下面 atlas 区段（line ~4508）；不需要在这里 short-circuit。

  // ESC 优先级：customization panel > city detail panel > atlas fullscreen。
  // 都是用户主动开的覆盖层，越靠近"刚开"越先关（栈式直觉）。
  if (normalized === "escape" && customizationPanelOpen) {
    event.preventDefault();
    customizationPanelOpen = false;
    hud.setCustomizationPanelOpen(null);
    hideHoverCard();
    return;
  }
  if (normalized === "escape" && cityDetailPanelOpen) {
    event.preventDefault();
    cityDetailPanelOpen = false;
    cityDetailOpenCityId = null;
    hud.setCityDetailPanelOpen(null);
    hideHoverCard();
    return;
  }
  if (normalized === "escape" && atlasWorkbench.isFullscreen) {
    event.preventDefault();
    resetGameplayInput();
    atlasWorkbench = setAtlasFullscreen(atlasWorkbench, false);
    refreshAtlasWorkbench();
    return;
  }

  if (normalized === "m") {
    event.preventDefault();
    resetGameplayInput();
    atlasWorkbench = setAtlasFullscreen(atlasWorkbench, !atlasWorkbench.isFullscreen);
    refreshAtlasWorkbench();
    triggerSystem.fire("ui_page_turn", {
      volume: 0.48,
      reason: "atlas toggle"
    });
    return;
  }

  if (normalized === "a" && !event.repeat && !isTextInputFocused()) {
    audioDebugHud.toggle();
    if (audioDebugHud.isVisible()) {
      refreshAudioDebugHud();
    }
  }

  if (
    normalized === "i" &&
    !isTextInputFocused() &&
    !atlasWorkbench.isFullscreen &&
    poiHoverHud.getCurrentState() !== "hidden"
  ) {
    event.preventDefault();
    poiHoverHud.toggleDetail();
    triggerSystem.fire("ui_click", {
      volume: 0.52,
      reason: "POI detail toggle"
    });
    return;
  }
  // P：开关坐骑/造型面板（power-user 走 [ ] - = 直接切，不必开面板）。
  if (normalized === "p") {
    event.preventDefault();
    customizationPanelOpen = !customizationPanelOpen;
    if (customizationPanelOpen) {
      resetGameplayInput();
      hud.setCustomizationPanelOpen({
        mountId: currentMountId,
        avatarId: currentAvatarId
      });
    } else {
      hud.setCustomizationPanelOpen(null);
    }
    hideHoverCard();
    return;
  }

  // 切坐骑：[ 上一个，] 下一个
  if (normalized === "[" || normalized === "]") {
    event.preventDefault();
    const next = cycleMount(currentMountId, normalized === "[" ? -1 : 1);
    applyCustomization(next, currentAvatarId);
    return;
  }

  // 切造型：- 上一个，= 下一个
  if (normalized === "-" || normalized === "=") {
    event.preventDefault();
    const next = cycleAvatar(currentAvatarId, normalized === "-" ? -1 : 1);
    applyCustomization(currentMountId, next);
    return;
  }

  // 纯相机 / 环境快捷键在 atlas 全屏时也允许使用：
  // 玩家可以一边看地图一边转身、切天气、切季节，不需要先关 atlas。
  if (normalized === "k") {
    environmentController.advanceWeather();
    hudDirty = true;
    return;
  }

  if (normalized === "l") {
    environmentController.advanceSeason();
    hudDirty = true;
    return;
  }

  if (normalized === "t") {
    environmentController.state.timeOfDay =
      (environmentController.state.timeOfDay + 3) % 24;
    hudDirty = true;
    return;
  }

  if (normalized === "o") {
    cameraViewMode = "overview";
    cameraDistance = qinlingCameraRig.maxDistance;
    cameraElevation = qinlingCameraRig.maxElevation;
    return;
  }

  if (normalized === "f") {
    // F = follow reset，"主人公肩后视角"——再次压近，落到 minDistance+2 = 9，
    // 接近第三人称跟随的 chest cam。
    cameraViewMode = "follow";
    cameraDistance = qinlingCameraRig.minDistance + 2;
    cameraElevation = 0.34;
    return;
  }

  // Q / E 是相机转向，atlas 全屏时也保留。
  // WASD / Arrow / Space / Shift 是玩家移动 input，atlas 全屏时屏蔽——
  // 否则地图模式下玩家会偷偷走出当前视野。
  const isCameraTurnKey = normalized === "q" || normalized === "e";

  if (atlasWorkbench.isFullscreen && !isCameraTurnKey) {
    return;
  }

  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(normalized)) {
    event.preventDefault();
  }

  const isCloudFlightKey = normalized === " " || normalized === "x";

  if (isGameplayInputKey(event) || (isFlyingMount(currentMountId) && isCloudFlightKey)) {
    // 反方向键互相取消（codex 0a8e1b9 和用户反馈的"按反方向只能暂停，松手
    // 后还继续走"）。原本按 w + s 同时 forward = 0 cancel，松开 s 后只剩 w，
    // 玩家又开始往前走——感受像"我让它停它没听"。改成：按 s 时如果 w 还在，
    // 把 w 移除，让"刚按下的方向"成为唯一意图，s 松手后玩家完全停住。
    const opposite = OPPOSITE_DIRECTION_KEY[normalized];
    if (opposite && keys.has(opposite)) {
      keys.delete(opposite);
    }
    keys.add(normalized);
  }
});

document.addEventListener("keyup", (event) => {
  keys.delete(normalizeRuntimeInputKey(event));
});

window.addEventListener("blur", resetGameplayInput);
window.addEventListener("pagehide", resetGameplayInput);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    resetGameplayInput();
  }
});

renderer.domElement.addEventListener("pointerdown", (event: PointerEvent) => {
  const hoveredPoi = findHoveredPoi();
  if (hoveredPoi) {
    triggerSystem.fire("ui_hover", {
      volume: 0.4,
      reason: `hover POI: ${hoveredPoi.name}`
    });
  }
  isDragging = true;
  dragOriginX = event.clientX;
  dragOriginY = event.clientY;
  hideHoverCard();
  renderer.domElement.setPointerCapture(event.pointerId);
});

renderer.domElement.addEventListener("pointermove", (event: PointerEvent) => {
  const canvasRect = renderer.domElement.getBoundingClientRect();
  if (canvasRect.width > 0 && canvasRect.height > 0) {
    hoverPointer.x = ((event.clientX - canvasRect.left) / canvasRect.width) * 2 - 1;
    hoverPointer.y = -(((event.clientY - canvasRect.top) / canvasRect.height) * 2 - 1);
    hoverPointerActive = true;
    hoverPointerDirty = true;
    if (window.HUD_DEBUG) {
      hudDebugWarn("pointermove hoverPointer", {
        x: Number(hoverPointer.x.toFixed(3)),
        y: Number(hoverPointer.y.toFixed(3))
      });
    }
  }

  if (!isDragging) {
    return;
  }

  const deltaX = event.clientX - dragOriginX;
  const deltaY = event.clientY - dragOriginY;
  dragOriginX = event.clientX;
  dragOriginY = event.clientY;

  cameraHeading -= deltaX * 0.008;
  cameraElevation = MathUtils.clamp(
    cameraElevation + deltaY * 0.005,
    qinlingCameraRig.minElevation,
    qinlingCameraRig.maxElevation
  );
});

renderer.domElement.addEventListener("pointerup", (event: PointerEvent) => {
  isDragging = false;
  renderer.domElement.releasePointerCapture(event.pointerId);
});

renderer.domElement.addEventListener("pointerleave", () => {
  isDragging = false;
  hoverPointerActive = false;
  hoverPointerDirty = false;
  lastHoveredPoi = null;
});

renderer.domElement.addEventListener("wheel", (event: WheelEvent) => {
  event.preventDefault();
  cameraDistance = MathUtils.clamp(
    cameraDistance + event.deltaY * 0.02,
    qinlingCameraRig.minDistance,
    qinlingCameraRig.maxDistance
  );
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
  renderer.setSize(window.innerWidth, window.innerHeight);
  // composer 必须跟 renderer 同步 size + bloom resolution，否则 RT 内
  // framebuffer 还是旧尺寸，画面会拉伸或切片。
  bloomComposer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
  bloomComposer.setSize(window.innerWidth, window.innerHeight);
  bloomPass.resolution.set(window.innerWidth, window.innerHeight);
});

hud.closeJournalButton.addEventListener("click", () => {
  journalOpen = false;
  renderJournal();
  hideHoverCard();
});

hud.closeCityDetailButton.addEventListener("click", () => {
  cityDetailPanelOpen = false;
  cityDetailOpenCityId = null;
  hud.setCityDetailPanelOpen(null);
  hideHoverCard();
});

hud.closeCustomizationButton.addEventListener("click", () => {
  customizationPanelOpen = false;
  hud.setCustomizationPanelOpen(null);
  hideHoverCard();
});

hud.onSelectMount((id) => {
  applyCustomization(id, currentAvatarId);
});

hud.onSelectAvatar((id) => {
  applyCustomization(currentMountId, id);
});

function handleAtlasLayerClick(event: MouseEvent): void {
  const target = event.target;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  const button = target.closest<HTMLButtonElement>("[data-atlas-layer]");

  if (!button) {
    return;
  }

  const layerId = button.dataset.atlasLayer as QinlingAtlasLayerId | undefined;

  if (!layerId) {
    return;
  }

  atlasWorkbench = toggleAtlasLayer(atlasWorkbench, layerId);
  const selectedFeature = selectedAtlasFeature(atlasWorkbench, activeAtlasFeatures());

  if (selectedFeature && !atlasWorkbench.visibleLayerIds.has(selectedFeature.layer)) {
    atlasWorkbench = selectAtlasFeature(atlasWorkbench, null);
  }

  refreshAtlasWorkbench();
}

function selectAtlasFeatureFromCanvas(
  canvas: HTMLCanvasElement,
  event: MouseEvent
): void {
  if (!terrainSampler) {
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const pointer = {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height
  };
  const hitState =
    canvas === hud.atlasFullscreenCanvas
      ? atlasWorkbench
      : {
          ...atlasWorkbench,
          mapView: { scale: 1, offsetX: 0, offsetY: 0 }
        };
  const feature = findAtlasFeatureAtCanvasPoint(
    activeAtlasFeatures(),
    hitState,
    pointer,
    terrainSampler.asset.world,
    canvas,
    14,
    {
      minDisplayPriority: atlasMinimumDisplayPriority({
        fullscreen: canvas === hud.atlasFullscreenCanvas,
        scale: hitState.mapView.scale
      })
    }
  );

  atlasWorkbench = selectAtlasFeature(atlasWorkbench, feature?.id ?? null);
  refreshAtlasWorkbench();
}

hud.openAtlasFullscreenButton.addEventListener("click", () => {
  atlasWorkbench = setAtlasFullscreen(atlasWorkbench, true);
  refreshAtlasWorkbench();
  hideHoverCard();
  triggerSystem.fire("ui_page_turn", {
    volume: 0.48,
    reason: "atlas open"
  });
});

hud.closeAtlasFullscreenButton.addEventListener("click", () => {
  atlasWorkbench = setAtlasFullscreen(atlasWorkbench, false);
  refreshAtlasWorkbench();
  hideHoverCard();
  triggerSystem.fire("ui_page_turn", {
    volume: 0.48,
    reason: "atlas close"
  });
});

hud.atlasLayerList.addEventListener("click", handleAtlasLayerClick);
hud.atlasFullscreenLayerList.addEventListener("click", handleAtlasLayerClick);

hud.overviewCanvas.addEventListener("click", (event: MouseEvent) => {
  selectAtlasFeatureFromCanvas(hud.overviewCanvas, event);
});

hud.atlasFullscreenCanvas.addEventListener("click", (event: MouseEvent) => {
  if (isAtlasMapDragging) {
    return;
  }

  selectAtlasFeatureFromCanvas(hud.atlasFullscreenCanvas, event);
});

hud.atlasFullscreenCanvas.addEventListener("wheel", (event: WheelEvent) => {
  if (!terrainSampler) {
    return;
  }

  event.preventDefault();
  const rect = hud.atlasFullscreenCanvas.getBoundingClientRect();
  const pointer = {
    x: ((event.clientX - rect.left) / rect.width) * hud.atlasFullscreenCanvas.width,
    y: ((event.clientY - rect.top) / rect.height) * hud.atlasFullscreenCanvas.height
  };
  atlasWorkbench = zoomAtlasMapAtPoint(
    atlasWorkbench,
    event.deltaY < 0 ? 1.18 : 1 / 1.18,
    pointer,
    terrainSampler.asset.world,
    hud.atlasFullscreenCanvas
  );
  scheduleAtlasMapRedraw();
});

hud.atlasFullscreenCanvas.addEventListener("pointerdown", (event: PointerEvent) => {
  isAtlasMapDragging = false;
  atlasMapDragOriginX = event.clientX;
  atlasMapDragOriginY = event.clientY;
  hud.atlasFullscreenCanvas.setPointerCapture(event.pointerId);
});

hud.atlasFullscreenCanvas.addEventListener("pointermove", (event: PointerEvent) => {
  if (!terrainSampler) {
    return;
  }

  if (!hud.atlasFullscreenCanvas.hasPointerCapture(event.pointerId)) {
    return;
  }

  const rect = hud.atlasFullscreenCanvas.getBoundingClientRect();
  const delta = {
    x: ((event.clientX - atlasMapDragOriginX) / rect.width) *
      hud.atlasFullscreenCanvas.width,
    y: ((event.clientY - atlasMapDragOriginY) / rect.height) *
      hud.atlasFullscreenCanvas.height
  };

  if (Math.abs(delta.x) + Math.abs(delta.y) < 0.5) {
    return;
  }

  isAtlasMapDragging = true;
  atlasMapDragOriginX = event.clientX;
  atlasMapDragOriginY = event.clientY;
  atlasWorkbench = panAtlasMap(
    atlasWorkbench,
    delta,
    terrainSampler.asset.world,
    hud.atlasFullscreenCanvas
  );
  scheduleAtlasMapRedraw();
});

hud.atlasFullscreenCanvas.addEventListener("pointerup", (event: PointerEvent) => {
  if (hud.atlasFullscreenCanvas.hasPointerCapture(event.pointerId)) {
    hud.atlasFullscreenCanvas.releasePointerCapture(event.pointerId);
  }
});

hud.atlasFullscreenCanvas.addEventListener("pointerleave", () => {
  isAtlasMapDragging = false;
});

hud.atlasFullscreenCanvas.addEventListener("dblclick", () => {
  atlasWorkbench = resetAtlasMapView(atlasWorkbench);
  scheduleAtlasMapRedraw();
});

renderJournal();
refreshAtlasWorkbench();

const targetCameraPosition = new Vector3();
const lookTarget = new Vector3();
const clock = new Clock();
let cloudDrift = 0;
let cloudFlightAltitude = 12;

function rebuildTerrainGeometry(
  worldWidth: number,
  worldDepth: number,
  gridColumns: number,
  gridRows: number
): void {
  terrain.geometry.dispose();

  terrainGeometry = new PlaneGeometry(
    worldWidth,
    worldDepth,
    Math.max(1, gridColumns - 1),
    Math.max(1, gridRows - 1)
  );
  terrainGeometry.rotateX(-Math.PI / 2);

  positionAttribute = terrainGeometry.attributes.position as BufferAttribute;
  colorAttribute = new BufferAttribute(
    new Float32Array(positionAttribute.count * 3),
    3
  );
  terrainGeometry.setAttribute("color", colorAttribute);
  terrain.geometry = terrainGeometry;

  underpaint.scale.set(worldWidth * 1.5, worldDepth * 1.5, 1);
  // Phase 3 全国扩张：旧 slice 把 waterRibbon 缩到 0.34×0.52 cover 局部水域，
  // 全国画幅下海洋分布在四周，必须铺满整个世界（再加 10% 延伸防 camera 边缘
  // 飞穿露出底色）。
  waterRibbon.scale.set(worldWidth * 1.1, worldDepth * 1.1, 1);
}

function clampToWorld(position: Vector3): void {
  if (!terrainSampler) {
    return;
  }

  const { width, depth } = terrainSampler.asset.world;

  position.x = MathUtils.clamp(
    position.x,
    -width * 0.5 + 4,
    width * 0.5 - 4
  );
  position.z = MathUtils.clamp(
    position.z,
    -depth * 0.5 + 4,
    depth * 0.5 - 4
  );
}

function update(deltaSeconds: number): void {
  if (!terrainSampler) {
    return;
  }

  // 防御性：每帧强制把 scenery / wildlife 可见性同步到当前 mount 状态。
  // applyCustomization 时已调用一次，但 chunk 后续异步加载 / wildlife rebuild
  // 可能让新的 group 默认 visible=true，绕过那次同步。
  applyCloudModeVisibility();

  const environment = environmentController.update(deltaSeconds);
  const visuals = environmentController.computeVisuals();
  windManager.update(deltaSeconds, environmentController.getWindState());
  lastVisuals = visuals;
  sceneFog.color.copy(visuals.fogColor);
  // 用户反馈"看不到地形"——overview 镜头下 FogExp2 把远地形染成 fog 色
  // ≈ 天空色，整图融成一片。把 density 再砍 60%（之前砍 50% 还不够），
  // 让 200 单元远的地形仍保留 ~85% 原色，hillshade / 河谷 都看得到。
  sceneFog.density = visuals.fogDensity * 0.4;
  ambientLight.color.copy(visuals.ambientColor);
  ambientLight.intensity = visuals.ambientIntensity;
  sun.color.copy(visuals.sunColor);
  sun.intensity = visuals.sunIntensity;
  sun.position.copy(visuals.sunDirection);
  moonLight.color.copy(visuals.moonColor);
  moonLight.intensity = visuals.moonOpacity * 0.92;
  moonLight.position.copy(visuals.moonDirection);
  sunSkyDiscMaterial.color.copy(visuals.sunColor);
  moonSkyDiscMaterial.color.copy(visuals.moonColor);
  rim.color.copy(visuals.rimColor);
  rim.intensity = visuals.rimIntensity;
  renderer.setClearColor(visuals.skyColor);
  skyDomeGroup.position.copy(camera.position);
  applySkyVisuals(skyDome, {
    skyColor: visuals.skyColor,
    skyHorizonColor: visuals.skyHorizonColor,
    horizonCoolColor: visuals.skyHorizonCoolColor,
    skyZenithColor: visuals.skyZenithColor,
    groundColor: visuals.skyGroundColor,
    starOpacity: visuals.starOpacity,
    sunDirection: visuals.sunDirection,
    sunWarmColor: visuals.skySunWarmColor,
    sunInfluence: visuals.skySunInfluence,
    moonPhase: visuals.moonPhase
  });
  const starTwinkleUniforms = starDomeMaterial.userData.twinkleUniforms as
    | { twinkleTime: { value: number } }
    | undefined;
  if (starTwinkleUniforms) {
    starTwinkleUniforms.twinkleTime.value = clock.elapsedTime;
  }
  // 把当前 sky horizon 色更新到 terrain shader 的 height fog uniform，
  // 让山顶融到与天空一致的雾色。整区 + 所有 chunk 都要更新。
  updateTerrainShaderHeightFog(
    terrainMaterial,
    visuals.skyHorizonColor
  );
  // R5 共享远景色：terrain/cloud/远景 silhouette 都从 sky horizon 派生，
  // 避免 zenith/石青混色在远 chunk 边缘形成另一条色带。
  const atmosphericFarRuntimeColor = sharedAtmosphericFarColor(visuals);
  updateTerrainShaderAtmosphericFar(
    terrainMaterial,
    atmosphericFarRuntimeColor
  );
  updateTerrainShaderCloudCookie(
    terrainMaterial,
    cloudCookieTexture,
    windManager.uniforms
  );
  // 时间/季节/天气 HSL 调色：之前每 1.85s 触发全顶点 JS recolor (~440ms hitch)，
  // 现在直接推 shader uniform，零 CPU 工作。
  updateTerrainShaderHsl(
    terrainMaterial,
    visuals.terrainHueShift,
    visuals.terrainSaturationMul,
    visuals.terrainLightnessMul
  );
  terrainChunkMeshes.forEach((chunk) => {
    if (!Array.isArray(chunk.mesh.material)) {
      updateTerrainShaderHeightFog(
        chunk.mesh.material as MeshPhongMaterial,
        visuals.skyHorizonColor
      );
      updateTerrainShaderAtmosphericFar(
        chunk.mesh.material as MeshPhongMaterial,
        atmosphericFarRuntimeColor
      );
      updateTerrainShaderCloudCookie(
        chunk.mesh.material as MeshPhongMaterial,
        cloudCookieTexture,
        windManager.uniforms
      );
      updateTerrainShaderHsl(
        chunk.mesh.material as MeshPhongMaterial,
        visuals.terrainHueShift,
        visuals.terrainSaturationMul,
        visuals.terrainLightnessMul
      );
    }
  });
  updateTerrainLodMorphs();

  const sunDomeVector = celestialDomeVector({
    timeOfDay: environment.timeOfDay,
    body: "sun"
  });
  const moonDomeVector = celestialDomeVector({
    timeOfDay: environment.timeOfDay,
    body: "moon",
    radius: skyDomePolicy.radius * skyBodyStyle.moon.radiusMultiplier
  });
  const sunScaleAtCurrent = sunDiscScaleForAltitude(sunDomeVector.altitude);
  sunSkyDisc.position.set(sunDomeVector.x, sunDomeVector.y, sunDomeVector.z);
  sunSkyDisc.scale.setScalar(sunScaleAtCurrent);
  const sunHorizonFade = skyBodyHorizonFade(sunDomeVector.altitude);
  sunSkyDiscMaterial.opacity = visuals.sunDiscOpacity * sunHorizonFade;
  moonSkyDisc.position.set(moonDomeVector.x, moonDomeVector.y, moonDomeVector.z);
  moonSkyDisc.scale.setScalar(
    MathUtils.lerp(
      skyBodyStyle.moon.minScale,
      skyBodyStyle.moon.maxScale,
      Math.max(0, moonDomeVector.altitude)
    )
  );
  const moonHorizonFade = skyBodyHorizonFade(moonDomeVector.altitude);
  moonSkyDiscMaterial.opacity = visuals.moonOpacity * moonHorizonFade;
  applyAmbientWaterSurfaceVisuals(visuals);
  applyWaterEnvironmentVisuals(visuals);
  waterSurface.setTime(clock.elapsedTime);
  updateCityLodFade();
  updateChunkFadeIn();
  updateNearbyRealCity();
  // 用户："天空云的速度降到 20%"。原 *60 → *12。
  cloudDrift += deltaSeconds * visuals.cloudDriftSpeed * 12;
  cloudGroup.position.set(player.position.x * 0.18, player.position.y + 54, player.position.z * 0.18);
  cloudMaterial.opacity = visuals.cloudOpacity * 0.74;
  cloudMaterial.color.copy(atmosphericFarRuntimeColor);
  // R5：远景云体也吃同一个 horizon farColor，terrain 远色 → 云 → sky
  // 连成一套色温；亮度体积仍交给 Lambert lighting 和 opacity 负责。
  cloudLayer.bodyMaterial.color.copy(atmosphericFarRuntimeColor);
  cloudLayer.bodyMaterial.opacity = MathUtils.clamp(visuals.cloudOpacity * 1.05, 0.4, 0.95);
  cloudSprites.forEach((cloud, index) => {
    const phase = Number(cloud.userData.phase) || 0;
    const speedFactor = Number(cloud.userData.driftSpeed) || 1;
    const driftedX = wrapCloudDriftX(
      Number(cloud.userData.baseX) + cloudDrift * (10 + index) * speedFactor
    );
    cloud.position.set(
      driftedX,
      12 + Math.sin(clock.elapsedTime * 0.18 + phase) * 2.5,
      Number(cloud.userData.baseZ) + Math.cos(clock.elapsedTime * 0.13 + phase) * 8
    );
  });

  // 把 effective weather 的连续值离散化（步长 0.1）丢进 signature，让
  // weather 平滑过渡时 terrain 颜色每 1.2 秒重涂一次，跟上雨量/雪量/雾
  // 浓度的渐变（codex df32918 review 抓到 signature 只在 discrete 切换时
  // 变，整个 12 秒过渡里 terrain 只会重画一两次）。
  const terrainColorSignature = [
    currentMode,
    environmentController.state.season,
    environmentController.state.weather
    // time-of-day / saturation / lightness 全部移到 shader uniform 了，
    // 这里完全不再触发 recolor。signature 只在 模式/季节/天气 切换时
    // 才变——这三件事都是用户主动操作（K/L 键）或自动很慢（>30s/次），
    // recolor hitch 完全消失。
  ].join(":");

  if (terrainColorSignature !== lastTerrainColorSignature) {
    lastTerrainColorSignature = terrainColorSignature;
    updateTerrainColors(visuals);
  }

  if (environmentController.state.season !== lastScenerySeasonSignature) {
    lastScenerySeasonSignature = environmentController.state.season;
    updateChunkScenerySeason();
  }

  const { forward: forwardInput, right: rightInput } = movementAxesFromKeys(keys);

  if (keys.has("q")) {
    cameraHeading += deltaSeconds * 1.2;
  }
  if (keys.has("e")) {
    cameraHeading -= deltaSeconds * 1.2;
  }
  const movementHeading = effectiveCameraHeadingForMode({
    mode: cameraViewMode,
    heading: cameraHeading
  });

  const currentSlope = terrainSampler.sampleSlope(player.position.x, player.position.z);
  const routeInfluence = routeAffinityAt({
    x: player.position.x,
    y: player.position.z
  });
  const routeBonus =
    terrainSampler.sampleSettlement(player.position.x, player.position.z) * 0.14 +
    terrainSampler.samplePass(player.position.x, player.position.z) * 0.08 +
    routeInfluence.affinity * 0.28;
  const slopePenalty = MathUtils.lerp(1, 0.42, currentSlope);
  const offRouteCost = MathUtils.lerp(0.68, 1.08, routeInfluence.affinity);
  const baseSpeed =
    (keys.has("shift") ? 20 : 13.5) *
    travelSpeedMultiplier() *
    mountSpeedMultiplier(currentMountId);
  const speed = baseSpeed * (slopePenalty + routeBonus) * offRouteCost;
  const isMoving = forwardInput !== 0 || rightInput !== 0;
  const targetVelocityScale = isMoving ? 1 : 0;
  currentVelocityScale = advanceMountVelocityScale({
    currentScale: currentVelocityScale,
    targetScale: targetVelocityScale,
    mountId: currentMountId
  });
  const effectiveSpeed = speed * currentVelocityScale;
  const movementSpeed = effectiveSpeed;
  const stillMoving = effectiveSpeed > 0.5;

  if (isMoving) {
    cameraViewMode = "follow";
    const movement = movementVectorFromInput({
      heading: movementHeading,
      forward: forwardInput,
      right: rightInput
    });
    const worldX = movement.x;
    const worldZ = movement.z;

    lastMovementHeading = { x: worldX, z: worldZ };
  }

  // 仍只在真实输入帧刷新朝向；松键后沿最后一次输入方向滑行减速。
  const heading = lastMovementHeading;

  if (stillMoving && heading) {
    player.position.x += heading.x * effectiveSpeed * deltaSeconds;
    player.position.z += heading.z * effectiveSpeed * deltaSeconds;
    clampToWorld(player.position);
    player.rotation.y = avatarHeadingForMovement(heading);
  }

  horseMovementIntensity = MathUtils.lerp(
    horseMovementIntensity,
    isMoving ? 1 : 0,
    isMoving ? 0.34 : 0.18
  );
  const legPose = woodHorseLegPose({
    timeSeconds: clock.elapsedTime,
    movementIntensity: horseMovementIntensity
  });
  mountLegsByName.forEach((leg, name) => {
    const rotation = legPose[name as keyof typeof legPose];

    if (rotation !== undefined) {
      leg.rotation.z = rotation;
    }
  });
  // walk phase 频率：原 0.9 × 3.2 = 2.88 cycles/(unit movement)，用户反馈"脚倒得太快"
  // 减一档到 0.6 × 2.0 = 1.2，更自然走路节奏。
  avatarWalkPhase += movementSpeed * deltaSeconds * 0.6;
  const avatarLimbPhase = avatarWalkPhase * 2.0;
  const avatarLegSwing = Math.sin(avatarLimbPhase) * 0.4 * horseMovementIntensity;
  avatarWalkLegsByName.forEach((leg, name) => {
    leg.rotation.z =
      name === "avatar-walk-left-leg"
        ? 0.08 + avatarLegSwing
        : -0.08 - avatarLegSwing;
  });
  const avatarArmSwing = Math.sin(avatarLimbPhase) * 0.6 * horseMovementIntensity;
  avatarWalkArmsByName.forEach((arm, name) => {
    const baseRotation = name === "avatar-walk-left-arm" ? -0.15 : 0.15;
    const targetRotation =
      movementSpeed < 0.5
        ? baseRotation
        : name === "avatar-walk-left-arm"
          ? baseRotation - avatarArmSwing
          : baseRotation + avatarArmSwing;
    arm.rotation.z = MathUtils.lerp(
      arm.rotation.z,
      targetRotation,
      movementSpeed < 0.5 ? 0.18 : 0.32
    );
  });

  // 飞行模式（筋斗云 / 御剑）下跳过地形倾斜——飞行不跟地形坡度。否则
  // player 在云/剑上还会随山势歪头歪身，看着像被风吹倒。
  if (isFlyingMount(currentMountId)) {
    player.rotation.x = MathUtils.lerp(player.rotation.x, 0, 0.18);
    player.rotation.z = MathUtils.lerp(player.rotation.z, 0, 0.18);
  } else {
    const avatarTilt = computeAvatarTilt({
      heading: player.rotation.y,
      position: player.position,
      sampler: terrainSampler
    });
    player.rotation.x = MathUtils.lerp(player.rotation.x, avatarTilt.pitch, 0.18);
    player.rotation.z = MathUtils.lerp(player.rotation.z, avatarTilt.roll, 0.18);
  }

  const ground = terrainSampler.sampleHeight(player.position.x, player.position.z);
  cloudFlightAltitude = nextCloudFlightAltitude({
    currentMountId,
    keys,
    ground,
    cloudFlightAltitude
  });
  const targetY = resolvePlayerTargetY({
    currentMountId,
    ground,
    cloudFlightAltitude
  });
  if (!isFlyingMount(currentMountId)) {
    cloudFlightAltitude = resetCloudFlightAltitudeForGround(ground);
  }
  // 飞行 mount：player.y 直接锁到 cloudFlightAltitude，避免 lerp 渐进过程
  // 跟 chunk 装载/CSS lerp/camera follow 复合产生"颠簸"感。
  // 非飞行：保留 lerp 让 player 跟 ground 平滑跟随。
  if (isFlyingMount(currentMountId)) {
    player.position.y = targetY;
  } else {
    player.position.y = MathUtils.lerp(player.position.y, targetY, 0.16);
  }

  // 用户反馈"没在走路也有脚步声"——把门槛从 movementSpeed > 0.5 提到 1.5，
  // 而且要求 isMoving=true（防止 lerp 余速触发）。停下立刻 reset timer，
  // 任何"按一下就放"的伪 trigger 都消失。
  if (isMoving && movementSpeed > 1.5) {
    footstepPulseTimerMs += deltaSeconds * 1000;
    if (footstepPulseTimerMs >= FOOTSTEP_INTERVAL_MS) {
      footstepPulseTimerMs = 0;
      triggerSystem.footstepPulse({
        inWater: terrainSampler.sampleRiver(player.position.x, player.position.z) > WATER_FOOTSTEP_THRESHOLD,
        mounted:
          currentMountId === "horse"
            ? "horse"
            : currentMountId === "ox"
              ? "ox"
              : null
      });
    }
  } else {
    footstepPulseTimerMs = 0;
  }

  if (currentMountId === "ox") {
    oxMooTimerMs += deltaSeconds * 1000;
    if (oxMooTimerMs >= OX_MOO_INTERVAL_MS) {
      oxMooTimerMs = 0;
      if (Math.random() < 0.4) {
        triggerSystem.fire("mount_ox_moo", {
          volume: 0.58,
          reason: "mount: ox moo"
        });
      }
    }
  } else {
    oxMooTimerMs = 0;
  }

  if (regionChunkManifest) {
    const nextChunkId =
      findChunkForPosition(
        regionChunkManifest,
        new Vector2(player.position.x, player.position.z)
      )?.id ?? null;

    if (nextChunkId !== activeChunkId) {
      updateVisibleChunkState(nextChunkId);
    }
  }

  const nextLookTarget = cameraLookTargetForMode({
    mode: cameraViewMode,
    player: {
      x: player.position.x,
      y: player.position.y,
      z: player.position.z
    },
    lookAtHeight: qinlingCameraRig.lookAtHeight
  });
  const nextCameraPosition = cameraPositionForMode({
    mode: cameraViewMode,
    lookTarget: nextLookTarget,
    heading: effectiveCameraHeadingForMode({
      mode: cameraViewMode,
      heading: cameraHeading
    }),
    elevation: cameraElevation,
    distance: cameraDistance
  });

  // 地形碰撞 clamp：minElevation 现在允许相机降到与玩家齐平（看天空），
  // 但代价是后方上坡时相机会嵌进山里、屏幕被山体填满。
  // 实现要点（codex aa67c5c review 之后修正）：
  //   - 边界处理：把采样坐标 clamp 到 DEM 范围内再 sampleHeight，而不是
  //     "出界就跳过"。理由是相机往外飘到边界外时，相机和玩家之间的边界山
  //     还实实在在挡视线；跳过会让低 pitch 相机继续穿进边界山脊。clamp
  //     到 nearest border cell 偶尔会在"远远飘出地图、空中无物"时把相机
  //     稍微抬高一点，cosmetic 而非 bug。
  //   - 既 clamp target 也 clamp post-lerp position：lerp 0.12 每帧只补 12%，
  //     如果上一帧 camera 已经在山里，光改 target 还要好几帧才出来；所以
  //     lerp 之后立即再 clamp 一次实际相机位置。
  const cameraTerrainClearance = 4.0;
  function clampAboveTerrain(x: number, z: number, y: number): number {
    if (!terrainSampler) return y;
    const halfWidth = terrainSampler.asset.world.width * 0.5;
    const halfDepth = terrainSampler.asset.world.depth * 0.5;

    let sampleX = x;
    let sampleZ = z;
    // 出界时用"player→camera 射线和 DEM 矩形的交点"作为采样点，
    // 而不是把 (x,z) 各自 clamp 到边界——后者等价于"正交投影到矩形",
    // 当相机斜着出界时拿到的不是真正挡视线的那块边界山脊（codex
    // a177a9c review 给出过 18m 高度差的反例）。射线交点正是 player 看
    // 出去的那个方向上、地图最后一格地形所在。
    if (Math.abs(x) > halfWidth || Math.abs(z) > halfDepth) {
      const px = player.position.x;
      const pz = player.position.z;
      const dx = x - px;
      const dz = z - pz;
      const tCandidates: number[] = [];
      if (dx > 0) tCandidates.push((halfWidth - px) / dx);
      else if (dx < 0) tCandidates.push((-halfWidth - px) / dx);
      if (dz > 0) tCandidates.push((halfDepth - pz) / dz);
      else if (dz < 0) tCandidates.push((-halfDepth - pz) / dz);
      const tExit = tCandidates.length
        ? Math.max(0, Math.min(1, Math.min(...tCandidates)))
        : 1;
      sampleX = px + dx * tExit;
      sampleZ = pz + dz * tExit;
    }

    const terrainAt = terrainSampler.sampleHeight(sampleX, sampleZ);
    return Math.max(y, terrainAt + cameraTerrainClearance);
  }

  // 飞行 mount（筋斗云 / 御剑）跳过 clampAboveTerrain：玩家是 absolute
  // 高度（cloudFlightAltitude），相机本来就该跟玩家齐高甚至更高。不跳过的话
  // camera.y 飞过山峰时被 pop 抬升，过峰后又落回 → 用户感知"颠簸"。
  if (!isFlyingMount(currentMountId)) {
    nextCameraPosition.y = clampAboveTerrain(
      nextCameraPosition.x,
      nextCameraPosition.z,
      nextCameraPosition.y
    );
  }

  targetCameraPosition.set(
    nextCameraPosition.x,
    nextCameraPosition.y,
    nextCameraPosition.z
  );

  if (isFlyingMount(currentMountId)) {
    // 飞行 mount：相机刚性跟随，不走 lerp。
    // 之前 followLerp(0.12) 在 60fps 下的 smoothing time constant ~130ms 配合
    // 浏览器 frame 时间抖动（16ms vs 17ms），每帧 lerp 系数变了，camera 收敛
    // 速度跟着抖 → 用户感知"相机颠"。飞行态 player.y/x/z 都是确定值，
    // 直接拷给 camera.position 即可，零滞后零抖动。
    camera.position.copy(targetCameraPosition);
  } else {
    camera.position.lerp(targetCameraPosition, qinlingCameraRig.followLerp);
    camera.position.y = clampAboveTerrain(
      camera.position.x,
      camera.position.z,
      camera.position.y
    );
  }
  // 始终用 +Y 作为 up：overview 模式现在改成"从南方斜俯视北"而不是纯顶视，
  // 不需要再用 -Z 翻转 up。
  camera.up.set(0, 1, 0);
  lookTarget.set(
    nextLookTarget.x,
    nextLookTarget.y,
    nextLookTarget.z
  );
  camera.lookAt(lookTarget);
  const compassHeading = effectiveCameraHeadingForMode({
    mode: cameraViewMode,
    heading: cameraHeading
  });
  hud.updateCompass({
    northAngleRadians: northNeedleAngleRadians(compassHeading)
  });

  underpaint.position.x = player.position.x * 0.04;
  underpaint.position.z = player.position.z * 0.03;

  precipitation.position.x = player.position.x;
  precipitation.position.z = player.position.z;
  precipitation.position.y = player.position.y;
  // 用平滑过渡后的 precipitationOpacity 决定可见性，而不是 discrete state。
  // 否则切到 clear 时立刻 visible=false，effectiveWeather 还没把粒子 fade
  // 完就一帧消失（codex df32918 review）。0.001 阈值留点 cushion 让收尾
  // 也走 fade，不会肉眼看到突然没。
  precipitation.visible = visuals.precipitationOpacity > 0.001;
  precipitationMaterial.opacity = visuals.precipitationOpacity;
  precipitationMaterial.color.copy(visuals.precipitationColor);
  precipitationMaterial.size = visuals.precipitationSize;

  if (precipitation.visible) {
    // 雪 vs 雨 fall speed：用 precipitationSize 做代理（雪粒子大，落得慢）。
    const snowiness = MathUtils.clamp((visuals.precipitationSize - 0.18) / 0.24, 0, 1);
    const fallSpeed = MathUtils.lerp(18, 4.5, snowiness);

    for (let index = 0; index < precipitationCount; index += 1) {
      const i3 = index * 3;
      precipitationPositions[i3 + 1] -= fallSpeed * deltaSeconds;

      // 雪的横向飘动按 snowiness 连续叠加，避开 0.5 阈值跳变（codex
      // adb9879 抓到的 P3：横向运动从 0.51 → 0.49 时直接断掉）。
      if (snowiness > 0) {
        precipitationPositions[i3] += Math.sin(clock.elapsedTime + precipitationOffsets[index]!) * 0.15 * snowiness;
        precipitationPositions[i3 + 2] += Math.cos(clock.elapsedTime * 0.8 + precipitationOffsets[index]!) * 0.08 * snowiness;
      }

      if (precipitationPositions[i3 + 1] < 0) {
        precipitationPositions[i3] = (Math.random() - 0.5) * 50;
        precipitationPositions[i3 + 1] = Math.random() * 26 + 12;
        precipitationPositions[i3 + 2] = (Math.random() - 0.5) * 50;
      }
    }

    precipitationGeometry.attributes.position.needsUpdate = true;
  }

  const riverProximity = sampleRiverProximity(terrainSampler, player.position);
  const largeRiverProximity = sampleLargeRiverProximity(player.position);
  const ambientContext: AmbientContext = {
    biome: deriveAmbientBiome(player.position.x, player.position.z, terrainSampler),
    isNight: environment.timeOfDay < 6 || environment.timeOfDay > 19,
    weather: ambientWeatherForState(environment.weather),
    altitudeBand:
      player.position.y > 12 ? "high" : player.position.y > 4 ? "mid" : "low",
    riverProximity,
    largeRiverProximity
  };
  ambientMixer.setContext(ambientContext);
  ambientMixer.tick(deltaSeconds * 1000);
  sparseScheduler.setContext(ambientContext);
  sparseScheduler.tick(deltaSeconds * 1000);
  triggerSystem.setThunderActive(environment.weather === "storm");
  triggerNearbyCraneAudio(clock.elapsedTime);
  syncPoiHoverHud();
  syncStoryGuideState();
}

function frame(): void {
  perfStats.beginFrame();
  const frameStartMs = performance.now();
  const deltaSeconds = Math.min(clock.getDelta(), 0.05);
  const elapsedTime = clock.elapsedTime;

  update(deltaSeconds);
  if (wildlifeHandle) {
    updateWildlifeFrame(wildlifeHandle, elapsedTime);
  }
  updateFragmentVisuals(elapsedTime);
  hudRefreshTimer += deltaSeconds;
  // mini-map 只需要 0.5s 级别刷新；fullscreen atlas 保持更高频，避免 M 键
  // 打开后玩家位置和缩放反馈发粘。dirty 路径仍然即时刷。
  const hudRefreshInterval = atlasWorkbench.isFullscreen ? 0.1 : 0.5;
  if (hudDirty || hudRefreshTimer >= hudRefreshInterval) {
    refreshHud();
    hudRefreshTimer = 0;
    hudDirty = false;
  }
  audioHudTimerMs += deltaSeconds * 1000;
  if (audioHudTimerMs >= 200) {
    audioHudTimerMs = 0;
    if (audioDebugHud.isVisible()) {
      refreshAudioDebugHud();
    }
  }
  updateLabelVisibility();
  // 走 EffectComposer：RenderPass + UnrealBloomPass + OutputPass 链。
  // 高亮像素（雪冠、太阳盘、水面）会有柔和辉光；midtone 被 threshold
  // 0.92 排除掉，色彩不动。
  bloomComposer.render();
  perfStats.endFrame(renderer);
  perfMonitor.observe(renderer, performance.now() - frameStartMs);
  requestAnimationFrame(frame);
}

function applyTerrainFromSampler(sampler: TerrainSampler): void {
  disposeChunkTerrain();
  // 包成 composite，让 chunks 注册后所有 sampleHeight 等自动用 chunk 数据。
  terrainSampler = new CompositeTerrainSampler(sampler);
  const visibleCities = sampler.asset.bounds
    ? realQinlingCities.filter(
        (city) =>
          city.lat >= sampler.asset.bounds!.south &&
          city.lat <= sampler.asset.bounds!.north &&
          city.lon >= sampler.asset.bounds!.west &&
          city.lon <= sampler.asset.bounds!.east
      )
    : [];
  setCityFlattenZones(
    sampler.asset.bounds
      ? visibleCities.map((city) => {
          const worldPoint = projectGeoToWorld(
            { lat: city.lat, lon: city.lon },
            sampler.asset.bounds!,
            sampler.asset.world
          );
          return {
            cityId: city.id,
            centerX: worldPoint.x,
            centerZ: worldPoint.z,
            radius: CITY_TIER_SPECS[city.tier].outerSide * 0.65,
            // sampleSurfaceHeight 已经把 raw × 1.6 返回；之后 setHeightOverride
            // 会让 sampleHeight 把 zone.groundY 再 × 1.6 → 双倍夸张让城市陷进
            // 抬高的 mesh。zone.groundY 必须存"未夸张"的 raw，让 sampleHeight
            // 走 override 路径只夸张一次（统一与 zone 外 mesh 一致）。
            groundY:
              sampler.sampleSurfaceHeight(worldPoint.x, worldPoint.z) /
              TERRAIN_VERTICAL_EXAGGERATION
          };
        })
      : []
  );
  sampler.setHeightOverride((rawY, x, z) => flattenedY(rawY, x, z));
  allDistanceLimitedLabelSprites.length = 0;
  resetStoryGuide();
  rebuildHudPoiCatalog();
  if (window.HUD_DEBUG) {
    hudDebugWarn("applyTerrainFromSampler catalog rebuilt", {
      poiCount: allHudPois.length,
      cityMarkersBeforeRebuild: cityMarkersHandle?.group.children.length ?? 0
    });
  }
  rebuildLandmarkVisuals();
  // scenic / ancient POI 需要 sampler.bounds + sampleHeight 才能落地；init
  // 里如果先 rebuild 再设 terrainSampler，会直接 early return 变成空组。
  // 把这两组重建收口到 terrain apply 之后，避免 atlas 有点位但 3D 首帧没有。
  rebuildScenicVisuals();
  rebuildAncientVisuals();
  rebuildTerrainGeometry(
    sampler.asset.world.width,
    sampler.asset.world.depth,
    sampler.asset.grid.columns,
    sampler.asset.grid.rows
  );

  for (let index = 0; index < positionAttribute.count; index += 1) {
    const x = positionAttribute.getX(index);
    const z = positionAttribute.getZ(index);
    positionAttribute.setY(index, sampler.sampleHeight(x, z));
  }
  applyTerrainLodMorphAttributes(terrainGeometry, sampler, positionAttribute);

  terrainGeometry.computeVertexNormals();
  rebuildWaterSystemVisuals();
  rebuildRouteVisuals();
  rebuildHydrographyRibbons();

  // 真实城市 instanced mesh：用 region asset 的 bounds + world 投影坐标，
  // 跟 atlas / hydrography 同一个 mapOrientation 投影。地图内的城市才落
  // mesh，落到 region bounds 之外的（暂无）会被 isInsideBounds 跳过。
  if (cityMarkersHandle) {
    disposeCityMarkers(cityMarkersHandle);
    disposeCityLabelSprites();
    cityMarkersGroup.clear();
    cityMarkersHandle = null;
    hideHoverCard();
    invalidatePoiHoverTargets();
  }
  if (sampler.asset.bounds) {
    cityMarkersHandle = createCityMarkers(
      visibleCities,
      sampler.asset.bounds,
      sampler.asset.world,
      sampler,
      groundAnchorRegistry
    );
    cityMarkersGroup.add(cityMarkersHandle.group);

    // 城市名签：只给京城 + 州府（9 个）渲染 text sprite。
    // 28 个全做 sprite 实测把 fps 从 120 砸到 24（每个 sprite 一张
    // CanvasTexture + 透明 sort，量上来扛不住）。县城建筑物 mesh 已经
    // 在 cityMarkersHandle 渲染，玩家走近能看到形状档级，名字可以等之
    // 后做 hover/proximity 弹出标签的交互再补，先把性能保住。
    // 县城名签：每座 pre-create 一个 hidden sprite，updateNearbyRealCity
    // 时只显示 nearbyRealCity 那一个。这样 19 个 sprite 同时驻留 GPU 但
    // 只有 0..1 个 visible，draw call 增量近 0、避免之前 28 sprite 全开
    // 的 fps 24 灾难。
    visibleCities
      .filter((city) => city.tier === "county")
      .forEach((city) => {
        const wp = projectGeoToWorld(
          { lat: city.lat, lon: city.lon },
          sampler.asset.bounds!,
          sampler.asset.world
        );
        const chunkId = regionChunkManifest
          ? findChunkForPosition(regionChunkManifest, new Vector2(wp.x, wp.z))?.id ?? null
          : null;
        const label = createTextSprite(city.name, "#e8cb89");
        label.scale.multiplyScalar(0.78);
        label.position.set(wp.x, 2.6, wp.z);
        label.renderOrder = 13;
        label.visible = false;
        label.userData.chunkId = chunkId;
        cityMarkersGroup.add(label);
        groundAnchorRegistry.register(`city:${city.id}:county-label`, {
          object: label,
          worldX: wp.x,
          worldZ: wp.z,
          baseOffset: 2.6,
          category: "label"
        });
        countyLabelSpriteByCityId.set(city.id, label);
        trackDistanceLimitedLabelSprite(label);
      });

    visibleCities
      .filter((city) => city.tier !== "county")
      .forEach((city) => {
        const wp = projectGeoToWorld(
          { lat: city.lat, lon: city.lon },
          sampler.asset.bounds!,
          sampler.asset.world
        );
        const chunkId = regionChunkManifest
          ? findChunkForPosition(regionChunkManifest, new Vector2(wp.x, wp.z))?.id ?? null
          : null;
        // tierTop 抬到 sprite center 应该在的高度——createTextSprite
        // 默认 ~3.8 单元高，乘 scale 后 capital ~4.5、prefecture ~3.6，
        // sprite 用中心定位，所以 y 偏移要等于"墙顶 + sprite 半高"才
        // 不会撞到城墙。新口字型墙更矮（capital 1.4、prefecture 1.1），
        // label 偏移跟着降。
        const tierTop = city.tier === "capital" ? 4.0 : 3.2;
        const accent = city.tier === "capital" ? "#fbe0a8" : "#f3d692";
        const label = createTextSprite(city.name, accent);
        label.scale.multiplyScalar(city.tier === "capital" ? 1.18 : 0.96);
        label.position.set(wp.x, tierTop, wp.z);
        label.renderOrder = 13;
        label.userData.chunkId = chunkId;
        cityMarkersGroup.add(label);
        groundAnchorRegistry.register(`city:${city.id}:label`, {
          object: label,
          worldX: wp.x,
          worldZ: wp.z,
          baseOffset: tierTop,
          category: "label"
        });
        trackDistanceLimitedLabelSprite(label);
        if (city.tier === "capital" || city.tier === "prefecture") {
          cityLabelSpritesByTier[city.tier].push(label);
        }
      });
    invalidatePoiHoverTargets();
  }

  const waterLevel = sampler.asset.presentation?.waterLevel ?? sampler.asset.minHeight - 2.5;
  const underpaintLevel =
    sampler.asset.presentation?.underpaintLevel ?? sampler.asset.minHeight - 3.2;
  // mesh 顶点 Y 由 sampleHeight × 1.6 决定。waterLevel/underpaintLevel 是
  // pre-exaggeration 的 normalized 值，必须同比 ×1.6 才跟 mesh 在同一空间。
  // 不乘的话水面会沉到 mesh 之下永远看不见——之前全国扩张 + 1.6× 后用户看
  // 到"该是大海的地方变成土地"的根因之一。
  waterRibbon.position.y = waterLevel * TERRAIN_VERTICAL_EXAGGERATION;
  underpaint.position.y = underpaintLevel * TERRAIN_VERTICAL_EXAGGERATION;

  groundAnchorRegistry.reanchorAll(terrainSampler);

  knowledgeFragments.forEach((fragment) => {
    const visual = fragmentVisuals.get(fragment.id);

    if (!visual) {
      return;
    }

    const baseY = sampler.sampleHeight(fragment.position.x, fragment.position.y) + 3.5;
    visual.baseY = baseY;
    visual.sprite.position.set(fragment.position.x, baseY, fragment.position.y);
    visual.halo.position.set(fragment.position.x, baseY - 1.2, fragment.position.y);
  });

  player.position.set(
    routeStart.x,
    sampler.sampleHeight(routeStart.x, routeStart.y) + 0.35,
    routeStart.y
  );
  // 用户："默认进入游戏时镜头应该在人物的正背后，而不是侧面"。
  // 默认 cameraHeading = 0（相机在 +Z 侧）+ player.rotation.y = 0（avatar 面朝 +X）
  // 二者互不一致，相机就在角色侧面。把 player 转到 π/2，让 avatar 面朝 -Z，
  // 跟相机正对面（相机在 +Z，看 -Z）→ 相机正背后看玩家背影。π/2 也正是按 W
  // 移动时 avatarHeadingForMovement 给的角度，启动姿势=随时往前走的姿势。
  player.rotation.y = Math.PI / 2;

  const visuals = environmentController.computeVisuals();
  lastVisuals = visuals;
  lastTerrainColorSignature = "";
  updateTerrainColors(visuals);
  applyAmbientWaterSurfaceVisuals(visuals);
  applyWaterEnvironmentVisuals(visuals);
  syncStoryGuideState(true);
  if (regionChunkManifest) {
    const initialChunkId =
      findChunkForPosition(
        regionChunkManifest,
        new Vector2(player.position.x, player.position.z)
      )?.id ?? null;
    updateVisibleChunkState(initialChunkId);
  } else {
    refreshHud();
  }
}

async function init(): Promise<void> {
  const regionBundle = await loadRegionBundle(terrainAssetRequest);
  const loaded = regionBundle.terrain;

  // 把 manifest 里的 experienceProfile 接入运行时——决定后续 baseSpeed /
  // cameraDistance / scenery 密度的缩放系数。如果 manifest 没声明，所有
  // multiplier 默认 1（high-focus 行为不变）。
  experienceProfile = regionBundle.experienceProfile ?? null;
  // 用户："一进来就是 F 状态"。F = minDistance + 2，elevation 0.34。
  // 不再用 initialDistance × multiplier（会被 cameraScaleMultiplier 拉大）。
  cameraDistance = qinlingCameraRig.minDistance + 2;
  cameraElevation = 0.34;

  regionChunkManifest = regionBundle.chunkManifest;
  regionChunkManifestUrl = regionBundle.chunkManifestUrl;

  if (regionChunkManifest) {
    visibleChunkIds = buildVisibleChunkIds(
      regionChunkManifest,
      null,
      runtimeBudget.streaming.visibleChunkRadius
    );
  }

  regionBundle.warnings.forEach((warning) => {
    console.warn(warning.message, warning.cause);
  });

  if (regionBundle.content) {
    landmarks = regionBundle.content.landmarks;
    knowledgeFragments = regionBundle.content.knowledgeFragments;
    routeStart = regionBundle.content.routeStart;
    storyBeats = regionBundle.content.storyBeats ?? getQinlingStoryBeats();
    resetStoryGuide();
    rebuildLandmarkVisuals();
    rebuildFragmentVisuals();
    renderJournal();
    hudDirty = true;
  }

  applyTerrainFromSampler(new TerrainSampler(loaded.asset));
  hud.setLoadingState(`已载入母版：${loaded.label}`, "success");

  // 把相机直接放到玩家身后正确位置，避免 init 后玩家偏离屏幕中央被 lerp 慢慢追。
  // 之前 hardcode 看 (0,0,0)，玩家在 (84,69) → 玩家显示在地形 "西北角" 而非中央。
  const initLookTarget = cameraLookTargetForMode({
    mode: cameraViewMode,
    player: {
      x: player.position.x,
      y: player.position.y,
      z: player.position.z
    },
    lookAtHeight: qinlingCameraRig.lookAtHeight
  });
  const initCameraPos = cameraPositionForMode({
    mode: cameraViewMode,
    lookTarget: initLookTarget,
    heading: effectiveCameraHeadingForMode({
      mode: cameraViewMode,
      heading: cameraHeading
    }),
    elevation: cameraElevation,
    distance: cameraDistance
  });
  camera.position.set(initCameraPos.x, initCameraPos.y, initCameraPos.z);
  camera.lookAt(new Vector3(initLookTarget.x, initLookTarget.y, initLookTarget.z));

  // 开发模式调试钩子：暴露关键运行时状态供 Playwright/控制台使用。
  if (isDevModeEnabled()) {
    (window as unknown as { __qinling: unknown }).__qinling = {
      scene,
      camera,
      player,
      get cameraHeading() { return cameraHeading; },
      get cameraDistance() { return cameraDistance; },
      get cameraElevation() { return cameraElevation; },
      get terrainSampler() { return terrainSampler; }
    };
  }

  frame();
}

init().catch((error: unknown) => {
  const message =
    error instanceof Error
      ? `山河母版加载失败：${error.message}`
      : "山河母版加载失败";
  hud.setLoadingState(message, "error");
  console.error(error);
});
