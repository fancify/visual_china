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
  Scene,
  SphereGeometry,
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
  AmbientAudioController
} from "./game/ambientAudio";
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
import { movementVectorFromInput } from "./game/navigation.js";
import {
  avatarHeadingForMovement,
  woodHorseLegPose
} from "./game/playerAvatar.js";
import {
  createPlayerAvatar,
  rebuildPlayerAvatar
} from "./game/playerAvatarMesh";
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
import {
  qinlingRoutes,
  routeAffinityAt,
  type RouteInfluence
} from "./game/qinlingRoutes.js";
import {
  buildRouteRibbonVertices,
  qinlingRouteRibbonStyle
} from "./game/routeRibbon.js";
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
  TerrainSampler,
  loadDemAsset,
  resolveTerrainAssetRequest,
  type DemAsset
} from "./game/demSampler";
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
  sharedTreeMaterial
} from "./game/scenery";
import {
  createCityMarkers,
  disposeCityMarkers,
  type CityMarkersHandle
} from "./game/cityMarkers";
import { realQinlingCities } from "./data/realCities.js";
import type { RealCity } from "./data/realCities.js";
import { qinlingRegionWorld } from "./data/qinlingRegion.js";
import { projectGeoToWorld } from "./game/mapOrientation.js";
import {
  evaluateStoryGuide,
  formatStoryGuideLine,
  getQinlingStoryBeats,
  type StoryBeat
} from "./game/storyGuide";
import {
  createTerrainMesh,
  disposeTerrainMesh,
  setTerrainMeshSurfaceVisible,
  setTerrainMeshWorldPosition,
  updateTerrainMeshColors,
  type TerrainMeshHandle
} from "./game/terrainMesh";
import {
  modeColor,
  zoneNameAt
} from "./game/terrainModel";
import { textSpriteLayout } from "./game/textLabel.js";
import { createPerfStats, isDevModeEnabled } from "./game/perfStats";
import {
  applySkyVisuals,
  createCloudLayer,
  createPrecipitationLayer,
  createSkyDome
} from "./game/atmosphereLayer";
import { createCircleTexture } from "./game/proceduralTextures";
import {
  attachTerrainShaderEnhancements,
  updateTerrainShaderAtmosphericFar,
  updateTerrainShaderHeightFog,
  updateTerrainShaderHsl
} from "./game/terrainShaderEnhancer";
import { createWaterSurfaceMaterial } from "./game/waterSurfaceShader";

interface FragmentVisual {
  sprite: Sprite;
  halo: Sprite;
  baseY: number;
  phase: number;
  chunkId: string | null;
}

let terrainSampler: TerrainSampler | null = null;
const terrainAssetRequest = resolveTerrainAssetRequest(
  window.location.search,
  "/data/regions/qinling/manifest.json"
);
const environmentController = new EnvironmentController();
const ambientAudio = new AmbientAudioController();
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
// 每次 atlasFeatures / evidenceFeatures 更新时 ++，atlasStaticCacheKey 用它
// 让 cache 自动 invalidate。codex review d2eafde 抓到：异步 OSM 水系加载完
// 后 cache 不知道数据变了，可能一直贴老底图。
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
app.appendChild(renderer.domElement);

const perfStats = createPerfStats({ enabled: isDevModeEnabled() });
if (perfStats.element.hidden === false) {
  document.body.appendChild(perfStats.element);
}

// 旧版 DOM sky overlay（96 个 span 星星 + 3 个 div 云朵）已被 WebGL sky dome
// 完全替代，DOM 层删除以减少 compositor 负担。
const hud = createHud(app, terrainAssetRequest, knowledgeFragments.length);

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

const mistPlane = new Mesh(
  new PlaneGeometry(1, 1),
  new MeshBasicMaterial({
    color: 0xbfd9cf,
    transparent: true,
    opacity: 0.05,
    side: DoubleSide
  })
);
mistPlane.rotation.x = -Math.PI / 2;
mistPlane.position.y = 11;
scene.add(mistPlane);

let terrainGeometry = new PlaneGeometry(1, 1, 1, 1);
terrainGeometry.rotateX(-Math.PI / 2);
let positionAttribute = terrainGeometry.attributes.position;
let colorAttribute = new BufferAttribute(
  new Float32Array(positionAttribute.count * 3),
  3
);
terrainGeometry.setAttribute("color", colorAttribute);

const terrainMaterial = new MeshPhongMaterial({
  vertexColors: true,
  flatShading: true,
  shininess: 8
});
attachTerrainShaderEnhancements(terrainMaterial, {
  heightFogColor: new Color(0xb6c4be),
  // 远山初始色：千里江山图 石青调（#5f8ba6 偏冷）。runtime 每帧根据
  // environmentVisuals.skyZenithColor 改写它，让远山色随时间/天气一致。
  atmosphericFarColor: new Color(0x5f8ba6)
});
const terrain = new Mesh(terrainGeometry, terrainMaterial);
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
waterRibbon.visible = false;
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
// horseLegsByName 是个 reference，rebuild 时整体替换；包成 ref 让循环里始终读到最新。
let mountLegsByName = playerAvatarHandle.mountLegsByName;
let currentMountId: MountId = playerAvatarHandle.mountId;
let currentAvatarId: AvatarId = playerAvatarHandle.avatarId;
let customizationPanelOpen = false;
scene.add(player);

function applyCustomization(mountId: MountId, avatarId: AvatarId): void {
  if (mountId === currentMountId && avatarId === currentAvatarId) {
    return;
  }
  const { mountLegsByName: nextLegs } = rebuildPlayerAvatar(player, mountId, avatarId);
  mountLegsByName = nextLegs;
  currentMountId = mountId;
  currentAvatarId = avatarId;
  savePlayerCustomization({ mountId, avatarId });
  if (customizationPanelOpen) {
    hud.setCustomizationPanelOpen({ mountId, avatarId });
  }
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

const riverVegetationGroup = new Group();
scene.add(riverVegetationGroup);

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
  // 用渲染相机的实际位置算距离，而不是 target 的 cameraDistance——
  // cameraDistance 改变时（按 o/f 或滚轮）相机用 lerp 缓动跟过去，立即
  // 用 target 算 LOD 会让 city 在画面相机还没到位时就 fade 到 0，跳变
  // 仍然存在。codex eec2f37 P1 抓到。
  const distance = camera.position.distanceTo(lookTarget);
  // 树 fade 不依赖 cityMarkers——standalone DEM（没有 bounds、不建城市）
  // 也要享受 LOD（codex c039a4b P2 抓到）。所以放在 cityMarkersHandle
  // gate 之前。相机拉远（distance > 110）开始 fade，distance > 165 完全
  // 消失。复用共享 material，不动 instance 数。
  const treeAlpha = 1 - MathUtils.smoothstep(distance, 110, 165);
  sharedTreeMaterial.opacity = treeAlpha;
  sharedTreeMaterial.visible = treeAlpha > 0.01;
  // 关隘石碑跟 prefecture 同档 fade：170-240，默认相机 118 全亮，
  // overview 170 起点开始 fade。两个共享 material 一起调，sprite 单独循环。
  const passAlpha = 1 - MathUtils.smoothstep(distance, 170, 240);
  passSteleMaterial.opacity = passAlpha;
  passSteleMaterial.visible = passAlpha > 0.01;
  passSteleCapMaterial.opacity = passAlpha;
  passSteleCapMaterial.visible = passAlpha > 0.01;
  for (const sprite of passLandmarkLabelSprites) {
    sprite.material.opacity = passAlpha;
    sprite.visible = passAlpha > 0.01;
  }
  if (!cityMarkersHandle) return;
  const countyAlpha = 1 - MathUtils.smoothstep(distance, 70, 140);
  const prefectureAlpha = 1 - MathUtils.smoothstep(distance, 170, 240);
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
  // 不渲染，疑似 transparent pass 不读 opaque pass 写的深度）。每帧 ~30 个
  // sprite × 8 步 = 240 次 sampleHeight 调用，sampler 走 bilinear 查表，开销
  // 可忽略。
  if (terrainSampler) {
    const cameraWorld = camera.position;
    const occlude = (sprite: Sprite): void => {
      if (!sprite.visible) return; // 已经被距离 fade 隐去就不必再算
      const target = sprite.position;
      const dx = target.x - cameraWorld.x;
      const dy = target.y - cameraWorld.y;
      const dz = target.z - cameraWorld.z;
      // 8 步线性插值采样（不含端点 t=0 和 t=1，端点本身没意义：
      // 0 在相机内、1 是 label 自身位置）。
      for (let i = 1; i <= 8; i += 1) {
        const t = i / 9;
        const sx = cameraWorld.x + dx * t;
        const sy = cameraWorld.y + dy * t;
        const sz = cameraWorld.z + dz * t;
        const groundY = terrainSampler!.sampleHeight(sx, sz);
        // groundY > sy 表示这一段地形比视线高 → 山挡住了 label。
        // 给 0.6 单元容差，避免 label 自己脚下小起伏触发误判。
        if (groundY > sy + 0.6) {
          sprite.visible = false;
          return;
        }
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
// 几何共享。pass kind 改用 stele（石碑）—— 用户反馈"两个柱子+圆锥"
// 看不出含义，换成扁立的方碑更像关隘的纪念碑。
const landmarkGeometries = {
  city: new CylinderGeometry(0.18, 0.48, 2.8, 5),
  generic: new CylinderGeometry(0.14, 0.36, 2.4, 4),
  stele: new BoxGeometry(0.7, 2.1, 0.22),
  steleBase: new BoxGeometry(0.95, 0.32, 0.4),
  steleCap: new BoxGeometry(0.85, 0.18, 0.32)
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

// 名胜（scenic）共用几何 + 材质——7 个 POI 共 6 类 mesh 形态。
const scenicGeometries = {
  // 太白山：8m 高的 sharp cone（peak base radius 5.5）；雪冠是顶端小白锥。
  alpinePeakBody: new ConeGeometry(5.5, 8, 8),
  alpineSnowCap: new ConeGeometry(2.2, 2.8, 8),
  // 青城山：圆顶，3m 高 + 顶上一个迷你方亭暗示道观（青城天下幽）。
  forestPeakDome: new SphereGeometry(4.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
  forestPavilion: new BoxGeometry(1.2, 0.6, 1.2),
  forestPavilionRoof: new ConeGeometry(0.95, 0.6, 4),
  // 九寨沟：海子（cyan disk）+ 两个低锥代表周围森林。disk 半径 2.4。
  karstPool: new CylinderGeometry(2.4, 2.4, 0.18, 24),
  karstPoolSmall: new CylinderGeometry(1.4, 1.4, 0.16, 18),
  karstFringeTree: new ConeGeometry(0.55, 1.6, 5),
  // 法门寺：5 层方塔，每层缩进 0.18，最高 4.5m。基座 box，塔身 cylinder*5。
  pagodaBase: new BoxGeometry(2.4, 0.5, 2.4),
  pagodaTier1: new BoxGeometry(2.0, 0.85, 2.0),
  pagodaTier2: new BoxGeometry(1.7, 0.85, 1.7),
  pagodaTier3: new BoxGeometry(1.45, 0.85, 1.45),
  pagodaTier4: new BoxGeometry(1.2, 0.85, 1.2),
  pagodaSpire: new ConeGeometry(0.5, 1.4, 6),
  // 乾陵：黄土封土圆丘（hemisphere）+ 两通石碑（无字碑/述圣纪碑）立在前方。
  mausoleumMound: new SphereGeometry(4.6, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
  mausoleumStele: new BoxGeometry(0.45, 2.4, 0.18),
  // 黄龙：钙华梯田金水池——6 层降幅圆盘叠瀑（半径 0.9..2.6），水位略错开。
  travertineDisk1: new CylinderGeometry(2.6, 2.6, 0.22, 22),
  travertineDisk2: new CylinderGeometry(2.2, 2.2, 0.22, 20),
  travertineDisk3: new CylinderGeometry(1.85, 1.85, 0.22, 18),
  travertineDisk4: new CylinderGeometry(1.5, 1.5, 0.22, 16),
  travertineDisk5: new CylinderGeometry(1.15, 1.15, 0.22, 14),
  travertineDisk6: new CylinderGeometry(0.9, 0.9, 0.22, 12),
  // 汉中天坑：暗深井圆柱（向下 4m）+ 灰岩环形沿口（外径 3.4 内径 2.6）。
  // 三维里没法真正"挖洞"，所以用深色 cylinder 立在地面上，外加一圈石灰岩沿。
  tiankengWell: new CylinderGeometry(2.4, 2.6, 0.3, 24),
  tiankengRimOuter: new CylinderGeometry(3.4, 3.4, 0.5, 20),
  tiankengRimInner: new CylinderGeometry(2.5, 2.5, 0.55, 20)
};

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
  // 三星堆：方形夯土基座 (3.0 x 3.0 x 0.6) + 青铜立人柱（细圆柱顶端有横梁）。
  bronzePodium: new BoxGeometry(3.0, 0.6, 3.0),
  bronzePillar: new CylinderGeometry(0.18, 0.22, 2.6, 6),
  bronzeCrossbar: new BoxGeometry(0.95, 0.18, 0.18),
  // 金沙：方形低台 + 太阳神鸟金箔（薄金色圆盘，立在台上）。
  jinshaPodium: new BoxGeometry(2.6, 0.45, 2.6),
  sunBirdDisk: new CylinderGeometry(0.95, 0.95, 0.06, 24),
  // 大地湾 / 半坡 共用：F901 仰韶大房址——圆形夯土平台 + 4 根复原柱础。
  yangshaoPlatform: new CylinderGeometry(2.8, 3.0, 0.32, 18),
  yangshaoPost: new CylinderGeometry(0.16, 0.18, 1.4, 6),
  // 兵马俑：阵列 1 排 6 兵俑（5 cylinder + 头球）+ 2 块带边土坑边缘。
  terracottaSoldier: new CylinderGeometry(0.16, 0.20, 1.0, 6),
  terracottaHead: new SphereGeometry(0.16, 6, 6),
  terracottaPit: new BoxGeometry(4.6, 0.18, 1.4),
  // 秦始皇陵：高耸的封土山（76 m → 缩成 6 单元高）+ 顶端小石碑指向陵园。
  qinMausoleumMound: new ConeGeometry(4.4, 6.0, 12),
  qinMausoleumStele: new BoxGeometry(0.5, 1.4, 0.18)
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
  // 秦始皇陵封土：黄褐土壤。
  qinEarth: new MeshPhongMaterial({
    color: 0xa48560, emissive: 0x1c1408, flatShading: true, shininess: 3,
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
  landmarkChunkIds.clear();
  passLandmarkLabelSprites.length = 0;

  landmarks.forEach((landmark) => {
    if (isLegacyOverlappingCityLandmark(landmark)) {
      return;
    }
    const chunkId = regionChunkManifest
      ? findChunkForPosition(regionChunkManifest, landmark.position)?.id ?? null
      : null;
    landmarkChunkIds.set(landmark.name, chunkId);
    const ground = 0;
    if (landmark.kind === "pass") {
      // 关隘改成石碑：3 件套（台座 + 主碑 + 顶冠），各自有独立 Y 高度。
      // 用 userData.terrainYOffset 把各档的 Y 偏移记下来，让后续的
      // applyTerrainFromSampler re-center 循环不会把三件压成一层（codex
      // 9332266 P1 抓到）。
      const stelePieces: Array<[
        keyof typeof landmarkGeometries,
        MeshPhongMaterial,
        number
      ]> = [
        ["steleBase", passSteleCapMaterial, 0.16],
        ["stele", passSteleMaterial, 1.37],
        ["steleCap", passSteleCapMaterial, 2.41]
      ];
      stelePieces.forEach(([geomKey, mat, yOffset]) => {
        const piece = new Mesh(landmarkGeometries[geomKey], mat);
        piece.position.set(landmark.position.x, ground + yOffset, landmark.position.y);
        piece.userData.chunkId = chunkId;
        piece.userData.sharedResources = true;
        piece.userData.terrainYOffset = yOffset;
        landmarkGroup.add(piece);
      });

      const label = createTextSprite(landmark.name, "#efcf83");
      label.scale.multiplyScalar(1.18);
      label.position.set(landmark.position.x, ground + 4.6, landmark.position.y);
      label.userData.chunkId = chunkId;
      label.userData.terrainYOffset = 4.6;
      landmarkGroup.add(label);
      passLandmarkLabelSprites.push(label);
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
    }

    landmarkGroup.add(marker);
  });
}

// 名胜 POI 渲染：5 个独立组合体，每个都带 1 个 label + 多个 mesh。
// 调用时机跟 rebuildLandmarkVisuals 同步——rebuild 时 clear group + reset
// 标签数组（updateCityLodFade 闭包了 scenicLabelSprites 的引用）。
function rebuildScenicVisuals(): void {
  clearGroup(scenicGroup);
  scenicLabelSprites.length = 0;

  if (!terrainSampler?.asset.bounds) {
    return;
  }
  const bounds = terrainSampler.asset.bounds;
  const world = terrainSampler.asset.world;

  const recordChunkId = (
    object: { userData: { chunkId?: string | null } },
    position: Vector2
  ): void => {
    object.userData.chunkId = regionChunkManifest
      ? findChunkForPosition(regionChunkManifest, position)?.id ?? null
      : null;
  };

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
    const groundY = terrainSampler!.sampleHeight(wp.x, wp.z);
    const position = new Vector2(wp.x, wp.z);

    const addPiece = (mesh: Mesh, yOffset: number): void => {
      mesh.position.set(wp.x, groundY + yOffset, wp.z);
      mesh.userData.terrainYOffset = yOffset;
      mesh.userData.sharedResources = true;
      recordChunkId(mesh, position);
      scenicGroup.add(mesh);
    };

    let labelHeight = 6.4;

    if (spot.role === "alpine-peak") {
      // 太白山：8m 锥山身 + 2.8m 雪冠（顶在 ~10m）。label 抬到 13m 高。
      addPiece(new Mesh(scenicGeometries.alpinePeakBody, scenicMaterials.alpineRock), 4.0);
      addPiece(new Mesh(scenicGeometries.alpineSnowCap, scenicMaterials.alpineSnow), 8.4);
      labelHeight = 12.4;
    } else if (spot.role === "religious-mountain") {
      // 青城山：圆顶 + 顶上小道观（亭 + 锥顶）。
      addPiece(new Mesh(scenicGeometries.forestPeakDome, scenicMaterials.forestGreen), 0);
      addPiece(new Mesh(scenicGeometries.forestPavilion, scenicMaterials.pavilionWall), 4.55);
      addPiece(new Mesh(scenicGeometries.forestPavilionRoof, scenicMaterials.pavilionRoof), 5.15);
      labelHeight = 7.0;
    } else if (spot.role === "karst-lake-system") {
      // 九寨沟：3 个海子 + 4 株冷杉 cluster，沿东北 / 西南错位。
      const pools: Array<[number, number, number]> = [
        [0, 0.09, 0],
        [3.4, 0.08, 1.6],
        [-2.6, 0.08, -1.8]
      ];
      pools.forEach(([dx, dy, dz], index) => {
        const geom = index === 0 ? scenicGeometries.karstPool : scenicGeometries.karstPoolSmall;
        const mesh = new Mesh(geom, scenicMaterials.karstWater);
        mesh.position.set(wp.x + dx, groundY + dy, wp.z + dz);
        mesh.userData.terrainYOffset = dy;
        mesh.userData.sharedResources = true;
        recordChunkId(mesh, position);
        scenicGroup.add(mesh);
      });
      const trees: Array<[number, number]> = [
        [-1.6, 1.4], [1.8, 1.2], [-3.4, -0.4], [2.6, -2.6]
      ];
      trees.forEach(([dx, dz]) => {
        const tree = new Mesh(scenicGeometries.karstFringeTree, scenicMaterials.karstTree);
        tree.position.set(wp.x + dx, groundY + 0.8, wp.z + dz);
        tree.userData.terrainYOffset = 0.8;
        tree.userData.sharedResources = true;
        recordChunkId(tree, position);
        scenicGroup.add(tree);
      });
      labelHeight = 4.2;
    } else if (spot.role === "buddhist-relic") {
      // 法门寺：5 层方塔 + 顶尖 spire。基座 0.25m 起。
      addPiece(new Mesh(scenicGeometries.pagodaBase, scenicMaterials.pagodaBaseStone), 0.25);
      addPiece(new Mesh(scenicGeometries.pagodaTier1, scenicMaterials.pagodaWall), 0.92);
      addPiece(new Mesh(scenicGeometries.pagodaTier2, scenicMaterials.pagodaWall), 1.85);
      addPiece(new Mesh(scenicGeometries.pagodaTier3, scenicMaterials.pagodaWall), 2.78);
      addPiece(new Mesh(scenicGeometries.pagodaTier4, scenicMaterials.pagodaWall), 3.71);
      addPiece(new Mesh(scenicGeometries.pagodaSpire, scenicMaterials.pagodaWall), 4.84);
      labelHeight = 6.5;
    } else if (spot.role === "imperial-mausoleum") {
      // 乾陵：黄土圆丘 + 前方两通石碑（无字碑左、述圣纪碑右）。
      addPiece(new Mesh(scenicGeometries.mausoleumMound, scenicMaterials.mausoleumEarth), 0);
      const stele1 = new Mesh(scenicGeometries.mausoleumStele, scenicMaterials.mausoleumStele);
      stele1.position.set(wp.x - 1.6, groundY + 1.2, wp.z + 5.0);
      stele1.userData.terrainYOffset = 1.2;
      stele1.userData.sharedResources = true;
      recordChunkId(stele1, position);
      scenicGroup.add(stele1);
      const stele2 = new Mesh(scenicGeometries.mausoleumStele, scenicMaterials.mausoleumStele);
      stele2.position.set(wp.x + 1.6, groundY + 1.2, wp.z + 5.0);
      stele2.userData.terrainYOffset = 1.2;
      stele2.userData.sharedResources = true;
      recordChunkId(stele2, position);
      scenicGroup.add(stele2);
      labelHeight = 5.4;
    } else if (spot.role === "travertine-terraces") {
      // 黄龙：6 层钙华梯田金水池，半径递减、Y 错位 0.18 模拟叠瀑。
      const disks: Array<[keyof typeof scenicGeometries, number]> = [
        ["travertineDisk1", 0.11],
        ["travertineDisk2", 0.34],
        ["travertineDisk3", 0.57],
        ["travertineDisk4", 0.80],
        ["travertineDisk5", 1.03],
        ["travertineDisk6", 1.26]
      ];
      disks.forEach(([key, y]) => {
        addPiece(new Mesh(scenicGeometries[key], scenicMaterials.travertineGold), y);
      });
      labelHeight = 3.0;
    } else if (spot.role === "karst-sinkhole") {
      // 汉中天坑：暗深井 + 灰岩沿口（双圈造出环形沿）。
      // 井底用大半径低色 cylinder 地表下沉感（用 -0.15 让其顶面略低于地面）。
      addPiece(new Mesh(scenicGeometries.tiankengWell, scenicMaterials.tiankengWell), -0.15);
      // 外圈大、内圈小一点，叠出"中空"看感。
      addPiece(new Mesh(scenicGeometries.tiankengRimOuter, scenicMaterials.tiankengRim), 0.25);
      addPiece(new Mesh(scenicGeometries.tiankengRimInner, scenicMaterials.tiankengWell), 0.27);
      labelHeight = 2.6;
    }

    // 名胜 label 用青金色——区别于 pass 的 #efcf83，更靠近"名山古迹"
    // 调性。LOD fade 跟 prefecture 同档（updateCityLodFade 走遍数组）。
    const label = createTextSprite(spot.name, "#dde7c2");
    label.scale.multiplyScalar(1.05);
    label.position.set(wp.x, groundY + labelHeight, wp.z);
    label.userData.terrainYOffset = labelHeight;
    recordChunkId(label, position);
    scenicGroup.add(label);
    scenicLabelSprites.push(label);
  });
}

// 考古 POI 渲染：3 个遗址，独立 group 跟 ancient atlas 层对齐。
function rebuildAncientVisuals(): void {
  clearGroup(ancientGroup);
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
    const groundY = terrainSampler!.sampleHeight(wp.x, wp.z);
    const position = new Vector2(wp.x, wp.z);

    const addPiece = (mesh: Mesh, yOffset: number, dx = 0, dz = 0): void => {
      mesh.position.set(wp.x + dx, groundY + yOffset, wp.z + dz);
      mesh.userData.terrainYOffset = yOffset;
      mesh.userData.sharedResources = true;
      mesh.userData.chunkId = regionChunkManifest
        ? findChunkForPosition(regionChunkManifest, position)?.id ?? null
        : null;
      ancientGroup.add(mesh);
    };

    let labelHeight = 4.4;

    if (site.role === "shu-bronze-altar") {
      // 三星堆：方形夯土基座 + 青铜立人柱（圆柱 + 顶端横梁意象纵目面具）。
      addPiece(new Mesh(ancientGeometries.bronzePodium, ancientMaterials.earthFoundation), 0.30);
      addPiece(new Mesh(ancientGeometries.bronzePillar, ancientMaterials.bronzeRelic), 1.90);
      addPiece(new Mesh(ancientGeometries.bronzeCrossbar, ancientMaterials.bronzeRelic), 3.10);
      labelHeight = 4.5;
    } else if (site.role === "shu-sun-bird") {
      // 金沙：低台 + 太阳神鸟金箔（薄圆盘竖立摆放）。
      addPiece(new Mesh(ancientGeometries.jinshaPodium, ancientMaterials.earthFoundation), 0.225);
      const disk = new Mesh(ancientGeometries.sunBirdDisk, ancientMaterials.goldRelic);
      disk.rotation.x = Math.PI / 2; // 竖起来
      addPiece(disk, 1.45);
      labelHeight = 3.2;
    } else if (site.role === "yangshao-dwelling") {
      // 大地湾 / 半坡 共用：圆形夯土平台 + 4 根复原柱础呈方阵。
      addPiece(new Mesh(ancientGeometries.yangshaoPlatform, ancientMaterials.rammedEarth), 0.16);
      const postOffsets: Array<[number, number]> = [
        [-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]
      ];
      postOffsets.forEach(([dx, dz]) => {
        addPiece(new Mesh(ancientGeometries.yangshaoPost, ancientMaterials.woodPost), 1.02, dx, dz);
      });
      labelHeight = 2.6;
    } else if (site.role === "qin-terracotta-army") {
      // 兵马俑：长条土坑（4.6m 长，朝东西方向）+ 6 排兵阵列。
      addPiece(new Mesh(ancientGeometries.terracottaPit, ancientMaterials.earthFoundation), 0.09);
      // 6 个兵俑成一排，沿 x 方向间距 0.7。每个兵 = 圆柱身 + 球头。
      for (let i = 0; i < 6; i += 1) {
        const dx = -1.75 + i * 0.7;
        addPiece(
          new Mesh(ancientGeometries.terracottaSoldier, ancientMaterials.terracottaClay),
          0.65,
          dx,
          0
        );
        addPiece(
          new Mesh(ancientGeometries.terracottaHead, ancientMaterials.terracottaClay),
          1.30,
          dx,
          0
        );
      }
      labelHeight = 2.3;
    } else if (site.role === "qin-imperial-mausoleum") {
      // 秦始皇陵：4.4 半径 × 6m 高的封土山 + 顶端小石碑代表陵园朝向。
      addPiece(new Mesh(ancientGeometries.qinMausoleumMound, ancientMaterials.qinEarth), 3.0);
      addPiece(
        new Mesh(ancientGeometries.qinMausoleumStele, ancientMaterials.bronzeRelic),
        6.7,
        0,
        0
      );
      labelHeight = 8.4;
    }

    // 考古 label 用米白色，跟 scenic 的青金色稍区分；走 prefecture LOD。
    const label = createTextSprite(site.name, "#e7d8b3");
    label.scale.multiplyScalar(1.02);
    label.position.set(wp.x, groundY + labelHeight, wp.z);
    label.userData.terrainYOffset = labelHeight;
    label.userData.chunkId = regionChunkManifest
      ? findChunkForPosition(regionChunkManifest, position)?.id ?? null
      : null;
    ancientGroup.add(label);
    ancientLabelSprites.push(label);
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
const moonSkyDisc = skyDome.moonDisc;
const cloudGroup = cloudLayer.group;
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

// proximity 触发：玩家走到真实城市附近时记录最近的一座，按 I 弹出
// 详情。范围 12 单元（≈ 城墙外圈一圈步行距离）。
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
  let closestDistance = 12;
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
    if (distance < closestDistance) {
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
      showToast(`[I] 了解 ${closest.name}`);
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
        sampleHeight: (x, z) => terrainSampler!.sampleSurfaceHeight(x, z)
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

// 0x3d7d8c：把水的色相往真实河流的"深绿青"上推。原来的 0x6aa7b0 太接近
// 灰白，叠在地形上几乎看不出色。现在饱和度足够，远眺时能立刻识别出河道。
const ambientWaterBaseColor = new Color(0x3d7d8c);
function applyAmbientWaterSurfaceVisuals(visuals: EnvironmentVisuals): void {
  const environmentStyle = waterEnvironmentVisualStyle(ambientWaterStyle, visuals);
  const tintedBase = ambientWaterBaseColor
    .clone()
    .multiplyScalar(environmentStyle.colorMultiplier);
  waterSurface.setBaseColor(tintedBase);
  // opacity 倍率从 1.4 → 1.9：水面更不透明，叠在地形上不再"洗白"。
  waterSurface.setOpacity(Math.max(0.12, environmentStyle.ribbonOpacity * 1.9));
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
    // 2026-05 重构：河面渲染移到 terrain shader (modeColor 里 riverMask
    // > 0.6 → 蓝色)。这里不再单独建 ribbon mesh — 一层 mesh = 没有
    // z-buffer 冲突 / bilinear vs triangle Y 不匹配。只保留 label + 河边植被。

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
  clearGroup(routeGroup);
  routeLabelSprites.length = 0;

  if (!terrainSampler) {
    return;
  }

  qinlingRoutes
    .filter((route) =>
      route.source?.verification === "external-vector" ||
      route.source?.verification === "verified"
    )
    .forEach((route) => {
      if (route.labelPoint && route.label) {
        const routeLabel = createTextSprite(route.label, "#f6d783");
        routeLabel.scale.multiplyScalar(1.16);
        routeLabel.position.set(
          route.labelPoint.x,
          terrainSampler!.sampleHeight(route.labelPoint.x, route.labelPoint.y) + 6.2,
          route.labelPoint.y
        );
        routeLabel.renderOrder = 14;
        routeGroup.add(routeLabel);
        routeLabelSprites.push(routeLabel);
      }

      const ribbonGeometry = new BufferGeometry();
      ribbonGeometry.setAttribute(
        "position",
        new BufferAttribute(
          buildRouteRibbonVertices(route.points, {
            width: qinlingRouteRibbonStyle.width,
            yOffset: qinlingRouteRibbonStyle.yOffset,
            sampleHeight: (x, z) => terrainSampler!.sampleSurfaceHeight(x, z)
          }),
          3
        )
      );
      ribbonGeometry.computeVertexNormals();

      const ribbon = new Mesh(
        ribbonGeometry,
        new MeshBasicMaterial({
          color: 0xe8c66f,
          transparent: true,
          opacity: qinlingRouteRibbonStyle.opacity,
          side: DoubleSide,
          depthWrite: false
        })
      );
      ribbon.renderOrder = 11;
      routeGroup.add(ribbon);

      const positions: number[] = [];

      route.points.forEach((point) => {
        positions.push(
          point.x,
          terrainSampler!.sampleHeight(point.x, point.y) + 0.72,
          point.y
        );
      });

      const geometry = new BufferGeometry();
      geometry.setAttribute(
        "position",
        new BufferAttribute(new Float32Array(positions), 3)
      );

      const line = new Line(
        geometry,
        new LineBasicMaterial({
          color: 0xf0ca72,
          transparent: true,
          opacity: 0.82,
          linewidth: 2
        })
      );
      line.renderOrder = 12;
      routeGroup.add(line);

      route.points.forEach((point, index) => {
        if (index !== 0 && index !== route.points.length - 1 && index % 2 !== 0) {
          return;
        }

        const marker = new Mesh(
          new SphereGeometry(index === route.points.length - 1 ? 0.62 : 0.44, 10, 10),
          new MeshBasicMaterial({
            color: index === route.points.length - 1 ? 0xf7df8a : 0xd6a852,
            transparent: true,
            opacity: 0.9
          })
        );
        marker.position.set(
          point.x,
          terrainSampler!.sampleHeight(point.x, point.y) + 1.08,
          point.y
        );
        marker.renderOrder = 13;
        routeGroup.add(marker);
      });
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

function createAtlasBaseMapCanvas(asset: DemAsset): HTMLCanvasElement {
  const cached = atlasBaseMapCache.get(asset);

  if (cached) {
    return cached;
  }

  const canvas = document.createElement("canvas");
  canvas.width = asset.grid.columns;
  canvas.height = asset.grid.rows;
  const context = canvas.getContext("2d");

  if (!context) {
    atlasBaseMapCache.set(asset, canvas);
    return canvas;
  }

  const image = context.createImageData(canvas.width, canvas.height);

  for (let row = 0; row < asset.grid.rows; row += 1) {
    for (let column = 0; column < asset.grid.columns; column += 1) {
      const offset = (row * canvas.width + column) * 4;
      const color = demSampleColor(asset, {
        x: ((column / Math.max(1, asset.grid.columns - 1)) - 0.5) * asset.world.width,
        y: (0.5 - row / Math.max(1, asset.grid.rows - 1)) * asset.world.depth
      });

      // Hillshade：太阳从西北上方（azimuth=315°, altitude=45°）打过来。
      // shade ∈ [0, 1]——0 完全背光、1 完全正照。把它映射到 [0.45, 1.15] 的
      // 调色乘子，让平原保留底色（shade≈1），山阴侧明显变暗，山脊高光。
      const shade = computeHillshade(asset, column, row);
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

// Atlas 静态底图缓存——内容（地形 hillshade、河流、城市、地标、placemark）
// 在玩家移动期间完全不变。每帧都重画 ~12ms 是浪费；缓存到 OffscreenCanvas 后
// 每帧只 drawImage（GPU-accelerated，~0.1ms）+ 画 player dot。
//
// 缓存按 target canvas 区分（mini-map 跟全屏 atlas 各有自己的 cache）。失效条件
// 是 cacheKey 任一字段变：canvas 尺寸 / mapView / 可见图层集合 / 选中要素 /
// 模式。普通游戏视图下 mapView/可见图层 不变，cache 几乎永远命中。
interface AtlasStaticCache {
  surface: HTMLCanvasElement;
  key: string;
}
const atlasStaticCaches = new WeakMap<HTMLCanvasElement, AtlasStaticCache>();

function atlasStaticCacheKey(
  canvas: HTMLCanvasElement,
  mapView: { scale: number; offsetX: number; offsetY: number; fitMode?: string },
  useWorkbenchView: boolean,
  selectedFeatureId: string | null,
  layerIds: Set<string>,
  mode: string,
  featuresVersion: number
): string {
  // 把所有影响 base 渲染的状态打成一个 string——下次进 drawAtlasMapCanvas
  // 直接对比，相同就跳过 ~12ms canvas2d 重画。featuresVersion 让异步加载的
  // OSM 水系一旦换了 atlasFeatures 就强制重画（codex review d2eafde 抓到）。
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
    mode,
    featuresVersion
  ].join("|");
}

function renderAtlasStaticInto(
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

  drawAtlasBaseMap(context, asset, surface, mapView);
  context.fillStyle = "rgba(247, 230, 174, 0.12)";
  context.fillRect(0, 0, width, height);
  drawDemQualityOverlay(context, asset, surface, projection, useWorkbenchView);

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
  drawAtlasOverlay(context, surface, asset, mapView, useWorkbenchView);

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
    atlasWorkbench.selectedFeatureId ?? null,
    atlasWorkbench.visibleLayerIds,
    currentMode,
    atlasFeaturesVersion
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
      useWorkbenchView,
      atlasWorkbench.selectedFeatureId ?? null
    );
    cache.key = cacheKey;
  }
  // 把缓存 blit 到目标 canvas——浏览器 drawImage canvas→canvas 走 GPU
  // 路径，~0.1ms 即使全屏 1200×800。
  context.clearRect(0, 0, width, height);
  context.drawImage(cache.surface, 0, 0);

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
  if (useWorkbenchView) {
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
  // worldspace 单位 = qinlingGeographicFootprintKm.width / asset.world.width 公里。
  // 这里 hardcode 420km / 180 unit = 2.33 km/unit。后续多 region 可改成读 manifest。
  const kmPerUnit = 420 / asset.world.width;
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

  context.font = "500 12px 'Noto Sans SC', 'PingFang SC', sans-serif";
  context.textAlign = "center";
  context.textBaseline = "alphabetic";
  context.fillStyle = "rgba(247, 234, 188, 0.9)";
  context.fillText(`${scaleKm} km`, (barLeft + barRight) / 2, baseY - 8);

  // Zoom 等级 + evidence 阈值提示（比例尺上方）
  context.font = "600 13px 'Noto Sans SC', 'PingFang SC', sans-serif";
  context.textAlign = "left";
  context.fillStyle = "rgba(247, 234, 188, 0.78)";
  context.fillText(`缩放 ${mapView.scale.toFixed(2)}x`, barLeft, baseY - 30);
  context.font = "500 11px 'Noto Sans SC', 'PingFang SC', sans-serif";
  context.fillStyle = "rgba(247, 234, 188, 0.55)";
  context.fillText(
    mapView.scale >= 1.45
      ? "OSM 详细水系已加载"
      : "缩放 ≥ 1.45x 加载 OSM 详细水系",
    barLeft,
    baseY - 14
  );

  // 数据源标注（更下方，最低存在感）
  context.font = "500 10px 'Noto Sans SC', 'PingFang SC', sans-serif";
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
  { name: "成都平原",     lat: 30.65, lon: 104.65, fontSize: 24 }
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

  if (atlasWorkbench.isFullscreen) {
    resizeAtlasCanvasToDisplaySize(hud.atlasFullscreenCanvas);
    drawAtlasMapCanvas(hud.atlasFullscreenCanvas, asset, playerPosition, true);
  }
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
  const chunkSuffix = activeChunkId ? ` · 区块 ${activeChunkId}` : "";
  const routeInfluence = routeAffinityAt({
    x: player.position.x,
    y: player.position.z
  });
  const routeLine = routeStatusText(routeInfluence);

  const nearby = nearestUncollectedFragment();

  if (!nearby) {
    hud.updateStatus({
      zone: `地带：${zoneNameAt(player.position.x, player.position.z, terrainSampler)}${chunkSuffix}`,
      mode: `视图：${modeMeta[currentMode].title}`,
      environment: `时辰：${formatTimeOfDay(environmentController.state.timeOfDay)} · ${seasonLabel(environmentController.state.season)} · ${weatherLabel(environmentController.state.weather)}`,
      collection: `残简：${collectedIds.size} / ${knowledgeFragments.length}`,
      nearby: `附近：风声已经安静下来。 · ${routeLine}`,
      story: storyLine
    });
    return;
  }

  if (nearby.distance < 9) {
    hud.updateStatus({
      zone: `地带：${zoneNameAt(player.position.x, player.position.z, terrainSampler)}${chunkSuffix}`,
      mode: `视图：${modeMeta[currentMode].title}`,
      environment: `时辰：${formatTimeOfDay(environmentController.state.timeOfDay)} · ${seasonLabel(environmentController.state.season)} · ${weatherLabel(environmentController.state.weather)}`,
      collection: `残简：${collectedIds.size} / ${knowledgeFragments.length}`,
      nearby: `附近：微光残简「${nearby.fragment.title}」 · ${routeLine}`,
      story: storyLine
    });
    return;
  }

  hud.updateStatus({
    zone: `地带：${zoneNameAt(player.position.x, player.position.z, terrainSampler)}${chunkSuffix}`,
    mode: `视图：${modeMeta[currentMode].title}`,
    environment: `时辰：${formatTimeOfDay(environmentController.state.timeOfDay)} · ${seasonLabel(environmentController.state.season)} · ${weatherLabel(environmentController.state.weather)}`,
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
        const chunkSampler = new TerrainSampler(loadedChunk.asset);
        const terrainChunk = createTerrainMesh(chunkSampler);
        setTerrainMeshSurfaceVisible(terrainChunk, false);
        const scenery = createChunkScenery(
          chunkSampler,
          scaledSceneryBudget()
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
function updateChunkFadeIn(): void {
  const fadeDuration = 1.2;
  terrainChunkMeshes.forEach((terrainChunk) => {
    if (!terrainChunk.mesh.visible) return;
    const fadeStart = terrainChunk.mesh.userData.fadeStart as number | undefined;
    const material = terrainChunk.mesh.material as MeshPhongMaterial;
    if (fadeStart === undefined) {
      material.opacity = 1;
      if (terrainChunk.scenery) terrainChunk.scenery.visible = true;
      return;
    }
    const elapsed = clock.elapsedTime - fadeStart;
    if (elapsed >= fadeDuration) {
      material.opacity = 1;
      delete terrainChunk.mesh.userData.fadeStart;
      if (terrainChunk.scenery) terrainChunk.scenery.visible = true;
      return;
    }
    material.opacity = MathUtils.clamp(elapsed / fadeDuration, 0, 1);
    // scenery 在 fade 80% 之后再开始 visible，让树跟在 terrain 后面"长出来"。
    if (terrainChunk.scenery) {
      terrainChunk.scenery.visible = elapsed >= fadeDuration * 0.8;
    }
  });
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
      return;
    }

    terrainChunk.mesh.visible = nextVisibleChunkIds.has(chunkId);
  });
}

function disposeChunkTerrain(): void {
  terrainChunkMeshes.forEach((terrainChunk) => {
      terrainChunkGroup.remove(terrainChunk.mesh);
      if (terrainChunk.scenery) {
        disposeScenery(terrainChunk.scenery);
      }
      disposeTerrainMesh(terrainChunk);
  });
  terrainChunkMeshes.clear();
  chunkLoadPromises.clear();
}

function updateVisibleChunkState(nextChunkId: string | null): void {
  activeChunkId = nextChunkId;

  if (!regionChunkManifest) {
    visibleChunkIds = new Set();
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
    if (!silent) {
      showToast(`主线推进：${snapshot.completedBeat.completionLine}`);
    }
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
let cameraElevation = 0.52;
let cameraDistance = qinlingCameraRig.minDistance + 10;
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
}

document.addEventListener("keydown", (event) => {
  // 用 normalizeInputKey(event) 而不是 event.key.toLowerCase()——它走 event.code
  // 路径，不受中文输入法 IME 影响。否则 macOS 中文用户按 Q/E/W/A/S/D 全部失效。
  const normalized = normalizeInputKey(event);

  // ESC 优先级：customization panel > city detail panel > atlas fullscreen。
  // 都是用户主动开的覆盖层，越靠近"刚开"越先关（栈式直觉）。
  if (normalized === "escape" && customizationPanelOpen) {
    event.preventDefault();
    customizationPanelOpen = false;
    hud.setCustomizationPanelOpen(null);
    return;
  }
  if (normalized === "escape" && cityDetailPanelOpen) {
    event.preventDefault();
    cityDetailPanelOpen = false;
    cityDetailOpenCityId = null;
    hud.setCityDetailPanelOpen(null);
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
    return;
  }

  // I（info）: 走到城市跟前按 I 弹出详情面板（替换原 toast）。
  // atlas 全屏时不响应 I——panel 会被 atlas 罩住，按下去看似无效但状态
  // 已变（codex 084972c P2）。
  if (normalized === "i" && nearbyRealCity && !atlasWorkbench.isFullscreen) {
    event.preventDefault();
    const city = nearbyRealCity;
    if (cityDetailPanelOpen && cityDetailOpenCityId === city.id) {
      // 同一个城市的面板已开，不重复
      return;
    }
    cityDetailPanelOpen = true;
    cityDetailOpenCityId = city.id;
    hud.setCityDetailPanelOpen({
      id: city.id,
      name: city.name,
      tier: city.tier,
      lat: city.lat,
      lon: city.lon,
      hint: city.hint,
      description: city.description
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
    cameraViewMode = "follow";
    cameraDistance = qinlingCameraRig.minDistance + 10;
    cameraElevation = 0.52;
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

  if (isGameplayInputKey(event)) {
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
  keys.delete(normalizeInputKey(event));
});

window.addEventListener("blur", resetGameplayInput);
window.addEventListener("pagehide", resetGameplayInput);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    resetGameplayInput();
  }
});

function enableAudio(): void {
  ambientAudio.ensureStarted().catch((error: unknown) => {
    console.error(error);
  });
}

document.addEventListener("pointerdown", enableAudio, { once: true });
document.addEventListener("keydown", enableAudio, { once: true });

renderer.domElement.addEventListener("pointerdown", (event: PointerEvent) => {
  isDragging = true;
  dragOriginX = event.clientX;
  dragOriginY = event.clientY;
  renderer.domElement.setPointerCapture(event.pointerId);
});

renderer.domElement.addEventListener("pointermove", (event: PointerEvent) => {
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
});

hud.closeCityDetailButton.addEventListener("click", () => {
  cityDetailPanelOpen = false;
  cityDetailOpenCityId = null;
  hud.setCityDetailPanelOpen(null);
});

hud.closeCustomizationButton.addEventListener("click", () => {
  customizationPanelOpen = false;
  hud.setCustomizationPanelOpen(null);
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
});

hud.closeAtlasFullscreenButton.addEventListener("click", () => {
  atlasWorkbench = setAtlasFullscreen(atlasWorkbench, false);
  refreshAtlasWorkbench();
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

  positionAttribute = terrainGeometry.attributes.position;
  colorAttribute = new BufferAttribute(
    new Float32Array(positionAttribute.count * 3),
    3
  );
  terrainGeometry.setAttribute("color", colorAttribute);
  terrain.geometry = terrainGeometry;

  underpaint.scale.set(worldWidth * 1.5, worldDepth * 1.5, 1);
  mistPlane.scale.set(worldWidth * 1.3, worldDepth * 1.2, 1);
  waterRibbon.scale.set(worldWidth * 0.34, worldDepth * 0.52, 1);
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

  const environment = environmentController.update(deltaSeconds);
  const visuals = environmentController.computeVisuals();
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
  rim.color.copy(visuals.rimColor);
  rim.intensity = visuals.rimIntensity;
  renderer.setClearColor(visuals.skyColor);
  skyDomeGroup.position.copy(camera.position);
  applySkyVisuals(skyDome, {
    skyColor: visuals.skyColor,
    skyHorizonColor: visuals.skyHorizonColor,
    skyZenithColor: visuals.skyZenithColor,
    starOpacity: visuals.starOpacity
  });
  // 把当前 sky horizon 色更新到 terrain shader 的 height fog uniform，
  // 让山顶融到与天空一致的雾色。整区 + 所有 chunk 都要更新。
  updateTerrainShaderHeightFog(
    terrainMaterial,
    visuals.skyHorizonColor
  );
  // 远山逐青：用 skyZenithColor（深邃天色）跟一个石青基调 mix。zenithColor
  // 已经反映了 dawn/dusk/夜晚 的色温。codex review d30759b 抓到夜里 zenith
  // ≈ #000 跟 #5f8ba6 mix 0.55 = mid-teal，远山反而变亮。改成按 daylight
  // 加权：白天 0.55 mix（远山饱和石青），夜里 0.05 mix（基本跟天色齐黑）。
  const atmosphericMixT = 0.05 + visuals.daylight * 0.50;
  const atmosphericFarRuntimeColor = visuals.skyZenithColor
    .clone()
    .lerp(new Color(0x5f8ba6), atmosphericMixT);
  updateTerrainShaderAtmosphericFar(
    terrainMaterial,
    atmosphericFarRuntimeColor
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
      updateTerrainShaderHsl(
        chunk.mesh.material as MeshPhongMaterial,
        visuals.terrainHueShift,
        visuals.terrainSaturationMul,
        visuals.terrainLightnessMul
      );
    }
  });

  const sunDomeVector = celestialDomeVector({
    timeOfDay: environment.timeOfDay,
    body: "sun"
  });
  const moonDomeVector = celestialDomeVector({
    timeOfDay: environment.timeOfDay,
    body: "moon",
    radius: skyDomePolicy.radius * skyBodyStyle.moon.radiusMultiplier
  });
  // sun/moon 地平线 fade：fade 窗口必须覆盖"日轮的半径"才不会让太阳还有
  // 大半个露在天上时就消失。日轮在天穹上的视半角 ≈ atan(spriteRadius /
  // skyRadius)。skyRadius 360、sun scale 46-70、moon scale 走 minScale/
  // maxScale（约 36-58）。取保守 ±0.10 rad 窗口，覆盖 sun 半径并留余量。
  const skyBodyHorizonFadeWindow = 0.10;
  const sunScaleAtCurrent = 46 + Math.max(0, sunDomeVector.altitude) * 24;
  sunSkyDisc.position.set(sunDomeVector.x, sunDomeVector.y, sunDomeVector.z);
  sunSkyDisc.scale.setScalar(sunScaleAtCurrent);
  const sunHorizonFade = MathUtils.smoothstep(
    sunDomeVector.altitude,
    -skyBodyHorizonFadeWindow,
    skyBodyHorizonFadeWindow
  );
  sunSkyDisc.material.opacity = visuals.sunDiscOpacity * sunHorizonFade;
  moonSkyDisc.position.set(moonDomeVector.x, moonDomeVector.y, moonDomeVector.z);
  moonSkyDisc.scale.setScalar(
    MathUtils.lerp(
      skyBodyStyle.moon.minScale,
      skyBodyStyle.moon.maxScale,
      Math.max(0, moonDomeVector.altitude)
    )
  );
  const moonHorizonFade = MathUtils.smoothstep(
    moonDomeVector.altitude,
    -skyBodyHorizonFadeWindow,
    skyBodyHorizonFadeWindow
  );
  moonSkyDisc.material.opacity = visuals.moonOpacity * moonHorizonFade;
  mistPlane.material.opacity = visuals.mistOpacity;
  applyAmbientWaterSurfaceVisuals(visuals);
  applyWaterEnvironmentVisuals(visuals);
  waterSurface.setTime(clock.elapsedTime);
  updateCityLodFade();
  updateChunkFadeIn();
  updateNearbyRealCity();
  cloudDrift += deltaSeconds * visuals.cloudDriftSpeed * 60;
  cloudGroup.position.set(player.position.x * 0.18, player.position.y + 54, player.position.z * 0.18);
  cloudSprites.forEach((cloud, index) => {
    const phase = Number(cloud.userData.phase) || 0;
    cloud.position.set(
      Number(cloud.userData.baseX) + cloudDrift * (14 + index),
      12 + Math.sin(clock.elapsedTime * 0.18 + phase) * 2.5,
      Number(cloud.userData.baseZ) + Math.cos(clock.elapsedTime * 0.13 + phase) * 8
    );
    cloud.material.opacity = visuals.cloudOpacity * (0.58 + (index % 3) * 0.16);
    cloud.material.color.copy(visuals.cloudColor);
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
  const baseSpeed = (keys.has("shift") ? 20 : 13.5) * travelSpeedMultiplier();
  const speed = baseSpeed * (slopePenalty + routeBonus) * offRouteCost;
  const isMoving = forwardInput !== 0 || rightInput !== 0;

  if (isMoving) {
    cameraViewMode = "follow";
    const movement = movementVectorFromInput({
      heading: movementHeading,
      forward: forwardInput,
      right: rightInput
    });
    const worldX = movement.x;
    const worldZ = movement.z;

    player.position.x += worldX * speed * deltaSeconds;
    player.position.z += worldZ * speed * deltaSeconds;
    clampToWorld(player.position);
    player.rotation.y = avatarHeadingForMovement({ x: worldX, z: worldZ });
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

  const ground = terrainSampler.sampleHeight(player.position.x, player.position.z);
  player.position.y = MathUtils.lerp(player.position.y, ground + 0.35, 0.16);

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

  nextCameraPosition.y = clampAboveTerrain(
    nextCameraPosition.x,
    nextCameraPosition.z,
    nextCameraPosition.y
  );

  targetCameraPosition.set(
    nextCameraPosition.x,
    nextCameraPosition.y,
    nextCameraPosition.z
  );

  camera.position.lerp(targetCameraPosition, qinlingCameraRig.followLerp);
  camera.position.y = clampAboveTerrain(
    camera.position.x,
    camera.position.z,
    camera.position.y
  );
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
  mistPlane.position.x = player.position.x * 0.015;
  mistPlane.position.z = player.position.z * 0.02;

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

  ambientAudio.update(environment, terrainSampler.sampleRiver(player.position.x, player.position.z));
  syncStoryGuideState();
}

function frame(): void {
  perfStats.beginFrame();
  const deltaSeconds = Math.min(clock.getDelta(), 0.05);
  const elapsedTime = clock.elapsedTime;

  update(deltaSeconds);
  updateFragmentVisuals(elapsedTime);
  hudRefreshTimer += deltaSeconds;
  // 静态底图缓存（drawAtlasMapCanvas 内）让 mini-map / 全屏 atlas 重绘成本
  // 从 ~12ms 降到 ~0.2ms（GPU drawImage cache + 玩家 dot）。所以 timer 可以
  // 收紧到 0.1s 让玩家 dot 看上去丝滑。dirty 路径仍然即时刷。
  if (hudDirty || hudRefreshTimer >= 0.1) {
    refreshHud();
    hudRefreshTimer = 0;
    hudDirty = false;
  }
  // 走 EffectComposer：RenderPass + UnrealBloomPass + OutputPass 链。
  // 高亮像素（雪冠、太阳盘、水面）会有柔和辉光；midtone 被 threshold
  // 0.92 排除掉，色彩不动。
  bloomComposer.render();
  perfStats.endFrame(renderer);
  requestAnimationFrame(frame);
}

function applyTerrainFromSampler(sampler: TerrainSampler): void {
  disposeChunkTerrain();
  terrainSampler = sampler;
  resetStoryGuide();
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

  terrainGeometry.computeVertexNormals();
  rebuildWaterSystemVisuals();
  rebuildRouteVisuals();

  // 真实城市 instanced mesh：用 region asset 的 bounds + world 投影坐标，
  // 跟 atlas / hydrography 同一个 mapOrientation 投影。地图内的城市才落
  // mesh，落到 region bounds 之外的（暂无）会被 isInsideBounds 跳过。
  if (cityMarkersHandle) {
    disposeCityMarkers(cityMarkersHandle);
    disposeCityLabelSprites();
    cityMarkersGroup.clear();
    cityMarkersHandle = null;
  }
  if (sampler.asset.bounds) {
    const visibleCities = realQinlingCities.filter(
      (city) =>
        city.lat >= sampler.asset.bounds!.south &&
        city.lat <= sampler.asset.bounds!.north &&
        city.lon >= sampler.asset.bounds!.west &&
        city.lon <= sampler.asset.bounds!.east
    );
    cityMarkersHandle = createCityMarkers(
      visibleCities,
      sampler.asset.bounds,
      sampler.asset.world,
      sampler
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
        const groundY = sampler.sampleHeight(wp.x, wp.z);
        const label = createTextSprite(city.name, "#e8cb89");
        label.scale.multiplyScalar(0.78);
        label.position.set(wp.x, groundY + 2.6, wp.z);
        label.renderOrder = 13;
        label.visible = false;
        cityMarkersGroup.add(label);
        countyLabelSpriteByCityId.set(city.id, label);
      });

    visibleCities
      .filter((city) => city.tier !== "county")
      .forEach((city) => {
        const wp = projectGeoToWorld(
          { lat: city.lat, lon: city.lon },
          sampler.asset.bounds!,
          sampler.asset.world
        );
        const groundY = sampler.sampleHeight(wp.x, wp.z);
        // tierTop 抬到 sprite center 应该在的高度——createTextSprite
        // 默认 ~3.8 单元高，乘 scale 后 capital ~4.5、prefecture ~3.6，
        // sprite 用中心定位，所以 y 偏移要等于"墙顶 + sprite 半高"才
        // 不会撞到城墙。新口字型墙更矮（capital 1.4、prefecture 1.1），
        // label 偏移跟着降。
        const tierTop = city.tier === "capital" ? 4.0 : 3.2;
        const accent = city.tier === "capital" ? "#fbe0a8" : "#f3d692";
        const label = createTextSprite(city.name, accent);
        label.scale.multiplyScalar(city.tier === "capital" ? 1.18 : 0.96);
        label.position.set(wp.x, groundY + tierTop, wp.z);
        label.renderOrder = 13;
        cityMarkersGroup.add(label);
        if (city.tier === "capital" || city.tier === "prefecture") {
          cityLabelSpritesByTier[city.tier].push(label);
        }
      });
  }

  const waterLevel = sampler.asset.presentation?.waterLevel ?? sampler.asset.minHeight - 2.5;
  const underpaintLevel =
    sampler.asset.presentation?.underpaintLevel ?? sampler.asset.minHeight - 3.2;
  waterRibbon.position.y = waterLevel;
  underpaint.position.y = underpaintLevel;

  landmarkGroup.children.forEach((child) => {
    if (child instanceof Sprite || child instanceof Mesh) {
      const x = child.position.x;
      const z = child.position.z;
      // 优先用 mesh.userData.terrainYOffset；否则按类型用默认（Sprite=6.4 标签，
      // Mesh=1.8 marker）。Stele 三件套各自记了自己的 yOffset，避免被一刀切平。
      const fallback = child instanceof Sprite ? 6.4 : 1.8;
      const yOffset = (child.userData.terrainYOffset as number | undefined) ?? fallback;
      child.position.y = sampler.sampleHeight(x, z) + yOffset;
    }
  });
  // 名胜 group 跟 landmark 同样把每件子物体重新贴到当前 sampler 的高度。
  scenicGroup.children.forEach((child) => {
    if (child instanceof Sprite || child instanceof Mesh) {
      const yOffset = (child.userData.terrainYOffset as number | undefined) ?? 1.8;
      child.position.y = sampler.sampleHeight(child.position.x, child.position.z) + yOffset;
    }
  });
  // 考古 group 同上。
  ancientGroup.children.forEach((child) => {
    if (child instanceof Sprite || child instanceof Mesh) {
      const yOffset = (child.userData.terrainYOffset as number | undefined) ?? 1.8;
      child.position.y = sampler.sampleHeight(child.position.x, child.position.z) + yOffset;
    }
  });

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
  cameraDistance = qinlingCameraRig.initialDistance * cameraScaleMultiplier();

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
    rebuildScenicVisuals();
    rebuildAncientVisuals();
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
