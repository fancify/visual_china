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

import {
  knowledgeFragments as defaultKnowledgeFragments,
  type KnowledgeFragment
} from "./data/fragments";
import {
  landmarks as defaultLandmarks,
  modeMeta,
  routeStart as defaultRouteStart,
  type Landmark,
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
import {
  northNeedleAngleRadians,
  screenRightDirectionLabel
} from "./game/compass.js";
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
import { createPlayerAvatar } from "./game/playerAvatarMesh";
import {
  qinlingAtlasFeatures,
  qinlingAtlasLayers,
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
import { createChunkScenery, disposeScenery } from "./game/scenery";
import {
  createCityMarkers,
  disposeCityMarkers,
  type CityMarkersHandle
} from "./game/cityMarkers";
import { realQinlingCities } from "./data/realCities";
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
  updateTerrainShaderHeightFog
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
  let nextAtlasFeatures = [...qinlingAtlasFeatures];

  try {
    const response = await fetch("/data/regions/qinling/hydrography/primary-modern.json");

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    const asset = (await response.json()) as PrimaryHydrographyAsset;
    const primaryFeatures = asset.features.map(hydrographyFeatureToAtlasFeature);
    nextAtlasFeatures = [
      ...qinlingAtlasFeatures.filter((feature) => feature.layer !== "water"),
      ...primaryFeatures
    ];
  } catch (error) {
    console.warn("Failed to load primary Qinling hydrography atlas layer", error);
  }

  try {
    const response = await fetch("/data/regions/qinling/hydrography/osm-modern.json");

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    const asset = (await response.json()) as ImportedHydrographyAsset;
    evidenceFeatures = importedHydrographyAssetToAtlasFeatures(asset);
  } catch (error) {
    console.warn("Failed to load imported OSM hydrography atlas layer", error);
    evidenceFeatures = [];
  }

  atlasFeatures = nextAtlasFeatures;
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
// pixelRatio 上限从 2 降到 1.5：在 Retina 屏 GPU 像素填充砍 ~44%，
// 风扇噪音明显降一档。视觉上软一点，但与多自定义 shader（terrain noise +
// height fog + water Fresnel + sky）的负担相比，这个交换很划算。
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
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
  heightFogColor: new Color(0xb6c4be)
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

const { player, horseLegsByName } = createPlayerAvatar();
scene.add(player);

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

  context.fillStyle = "rgba(9, 18, 19, 0.52)";
  context.strokeStyle = "rgba(235, 214, 155, 0.28)";
  context.lineWidth = 3;
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
  context.fillStyle = accent;
  context.fillText(text, layout.text.x, layout.text.y);

  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;

  const material = new SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
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
const gatePostMaterial = new MeshPhongMaterial({
  color: 0x8a4d22,
  emissive: 0x2d1608,
  flatShading: true
});
// 几何也共享：所有 city marker 用同一个 cylinder，所有 non-city marker 用另一个。
const landmarkGeometries = {
  city: new CylinderGeometry(0.18, 0.48, 2.8, 5),
  generic: new CylinderGeometry(0.14, 0.36, 2.4, 4),
  gatePost: new CylinderGeometry(0.14, 0.24, 4.1, 5)
};

function rebuildLandmarkVisuals(): void {
  clearGroup(landmarkGroup);
  landmarkChunkIds.clear();

  landmarks.forEach((landmark) => {
    const chunkId = regionChunkManifest
      ? findChunkForPosition(regionChunkManifest, landmark.position)?.id ?? null
      : null;
    landmarkChunkIds.set(landmark.name, chunkId);
    const ground = 0;
    const geometry =
      landmark.kind === "city"
        ? landmarkGeometries.city
        : landmarkGeometries.generic;
    const material = landmarkMaterials[landmark.kind] ?? landmarkMaterials.plain;
    const marker = new Mesh(geometry, material);
    marker.position.set(landmark.position.x, ground + 1.8, landmark.position.y);
    marker.userData.chunkId = chunkId;
    // 共享 geometry / material，clearGroup 时不要 dispose
    marker.userData.sharedResources = true;

    if (landmark.kind !== "plain") {
      const label = createTextSprite(
        landmark.name,
        landmark.kind === "pass" ? "#efcf83" : "#f3ebd4"
      );
      if (landmark.kind === "pass") {
        label.scale.multiplyScalar(1.18);
      }
      label.position.set(landmark.position.x, ground + 6.4, landmark.position.y);
      label.userData.chunkId = chunkId;
      landmarkGroup.add(label);
    }

    landmarkGroup.add(marker);

    if (landmark.kind === "pass") {
      [-0.72, 0.72].forEach((offset) => {
        const gatePost = new Mesh(landmarkGeometries.gatePost, gatePostMaterial);
        gatePost.position.set(
          landmark.position.x + offset,
          ground + 2.65,
          landmark.position.y
        );
        gatePost.userData.chunkId = chunkId;
        gatePost.userData.sharedResources = true;
        landmarkGroup.add(gatePost);
      });
    }
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
  }
): Mesh<BufferGeometry, MeshBasicMaterial> {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(
      buildWaterRibbonVertices(points, {
        width: options.width,
        yOffset: options.yOffset,
        sampleHeight: (x, z) => terrainSampler!.sampleHeight(x, z)
      }),
      3
    )
  );

  const ribbon = new Mesh(
    geometry,
    new MeshBasicMaterial({
      color: options.color,
      transparent: true,
      opacity: options.opacity,
      side: DoubleSide,
      depthWrite: false,
      depthTest: options.depthTest ?? true,
      // 不让 FogExp2 把远处水带雾化——之前用户反馈"水离得很近才出现"
      // 就是因为水带在远处被场景 fog 吞了。
      fog: false
    })
  );
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
    bankOffset: 2.6
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
    riverVegetationGroup.add(shrubs);
  }
}

function rebuildWaterSystemVisuals(): void {
  clearGroup(waterSystemGroup);
  clearGroup(riverVegetationGroup);
  waterEnvironmentMaterials.length = 0;
  visibleWaterFeatures = [];

  if (!terrainSampler) {
    return;
  }

  const rivers = selectRenderableWaterFeatures(atlasFeatures);
  visibleWaterFeatures = rivers;

  rebuildRiverVegetationVisuals(rivers);

  rivers.forEach((river) => {
    const points = featureWorldPoints(river);
    const waterStyle = waterVisualStyle(river);
    const ribbonColor = river.displayPriority >= 9 ? 0x5cabc6 : 0x6fb6c5;

    // 单层简单 ribbon：MeshBasic（不再 ShaderMaterial / 无 Fresnel /
    // 无涟漪 / 无中间反光白条）。polygonOffset 配合低 yOffset 让 ribbon
    // 看起来贴在地形上而不是飘在空中——polygonOffset 推 depth、yOffset
    // 控视觉层级。
    const ribbon = createWaterSurfaceRibbon(points, {
      width: waterStyle.ribbonWidth,
      yOffset: waterStyle.ribbonYOffset,
      color: ribbonColor,
      opacity: waterStyle.ribbonOpacity,
      renderOrder: 4
    });
    // 加强 polygonOffset：用户反馈"俯视时河流看不见"是因为低 yOffset
    // 时 ribbon 和地形深度挤在一起，弱 polygonOffset (-1, -2) 没把
    // ribbon 推到地形之前，渲染时被地形赢了 depth test。-2/-4 更稳。
    ribbon.material.polygonOffset = true;
    ribbon.material.polygonOffsetFactor = -2;
    ribbon.material.polygonOffsetUnits = -4;
    registerWaterEnvironmentMaterial(ribbon.material, ribbonColor, waterStyle, "ribbon");
    waterSystemGroup.add(ribbon);

    const labelPoint = waterLabelPoint(river);

    if (labelPoint) {
      const label = createTextSprite(river.name, "#bdeff0");
      label.scale.multiplyScalar(river.displayPriority >= 9 ? 1.08 : 0.82);
      label.position.set(
        labelPoint.x,
        terrainSampler!.sampleHeight(labelPoint.x, labelPoint.y) + 4.8,
        labelPoint.y
      );
      label.renderOrder = 13;
      waterSystemGroup.add(label);
    }
  });

  if (lastVisuals) {
    applyWaterEnvironmentVisuals(lastVisuals);
  }
}

function rebuildRouteVisuals(): void {
  clearGroup(routeGroup);

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
      }

      const ribbonGeometry = new BufferGeometry();
      ribbonGeometry.setAttribute(
        "position",
        new BufferAttribute(
          buildRouteRibbonVertices(route.points, {
            width: qinlingRouteRibbonStyle.width,
            yOffset: qinlingRouteRibbonStyle.yOffset,
            sampleHeight: (x, z) => terrainSampler!.sampleHeight(x, z)
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
  const lowland = h < 0.28;
  const ridge = h > 0.58;

  return [
    lowland ? 178 : ridge ? 224 : 190 + h * 34,
    lowland ? 178 : ridge ? 211 : 170 + h * 40,
    lowland ? 126 : ridge ? 160 : 108 + h * 36
  ];
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

  drawAtlasBaseMap(context, asset, canvas, mapView);
  context.fillStyle = "rgba(247, 230, 174, 0.12)";
  context.fillRect(0, 0, width, height);
  drawDemQualityOverlay(context, asset, canvas, projection, useWorkbenchView);

  const atlasLayers = qinlingAtlasLayers.map((layer) => ({
    ...layer,
    defaultVisible: atlasWorkbench.visibleLayerIds.has(layer.id)
  }));
  const featuresForView = activeAtlasFeatures();
  const selectedFeature = selectedAtlasFeature(atlasWorkbench, featuresForView);
  const minDisplayPriority = atlasMinimumDisplayPriority({
    fullscreen: useWorkbenchView,
    scale: mapView.scale
  });

  // atlas 视觉路径放行未验证 feature——长安、剑门关、陈仓道这种 manual-atlas-draft
  // 数据是产品级叙事的一部分，verification 政策只用于事实层（hydrography 3D 渲染）。
  atlasVisibleFeatures(featuresForView, atlasLayers, {
    minDisplayPriority,
    includeUnverifiedFeatures: true
  }).forEach((feature) => {
    drawAtlasFeature(context, feature, projection, useWorkbenchView);
  });

  drawRegionPlacemarks(context, projection, useWorkbenchView);
  drawAtlasOverlay(context, canvas, asset, mapView, useWorkbenchView);

  if (selectedFeature) {
    drawAtlasFeatureSelection(context, selectedFeature, projection);
  }

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
  world: { x: number; z: number };
  fontSize: number;
}

// 宏观地带标签：与 feature 系统并行，作为打开 atlas 时的"地理骨架"。
// feature 标签是细节（渭河、长安），这些是脊柱（关中平原、秦岭主脊、蜀道走廊）。
const qinlingRegionPlacemarks: RegionPlacemark[] = [
  // mapOrientation 北 = -Z；当时 worldAxis 重构跑 flip-z-axis-source.mjs 时
  // 这组 landform label 用 `world: { x, z }`，没匹配脚本的 `{ x, y }` /
  // `point(x,y)` / `Vector2(x,y)` pattern，被漏了。手工把 z 全部翻号。
  { name: "关中平原", world: { x: 26, z: -80 }, fontSize: 18 },
  { name: "渭河谷地", world: { x: -22, z: -76 }, fontSize: 14 },
  { name: "秦岭主脊", world: { x: 6, z: -28 }, fontSize: 17 },
  { name: "汉中盆地", world: { x: 26, z: -8 }, fontSize: 16 },
  { name: "蜀道走廊", world: { x: -10, z: 28 }, fontSize: 14 },
  { name: "四川盆地北缘", world: { x: -30, z: 64 }, fontSize: 14 },
  { name: "成都平原", world: { x: -44, z: 104 }, fontSize: 16 }
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
  qinlingRegionPlacemarks.forEach((mark) => {
    const point = projection.worldToCanvas({ x: mark.world.x, y: mark.world.z });
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
  const visibleLandmarks =
    regionChunkManifest && visibleChunkIds.size > 0
      ? landmarks.filter((landmark) => {
          const chunkId = landmarkChunkIds.get(landmark.name) ?? null;
          return !chunkId || visibleChunkIds.has(chunkId);
        })
      : landmarks;

  const landmarksToUse = visibleLandmarks.length > 0 ? visibleLandmarks : landmarks;

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

function refreshHud(): void {
  if (!terrainSampler) {
    return;
  }
  drawOverviewMap(terrainSampler.asset, player.position);
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
          existing.mesh.visible = true;
        }

        return;
      }

      const pending = chunkLoadPromises.get(chunk.id);

      if (pending) {
        await pending;
        const existing = terrainChunkMeshes.get(chunk.id);

        if (existing) {
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
    terrainChunk.mesh.visible = chunkIds.has(chunkId);
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
let cameraHeading = qinlingCameraRig.initialHeading;
let cameraElevation = qinlingCameraRig.initialElevation;
let cameraDistance = qinlingCameraRig.initialDistance;
let cameraViewMode: CameraViewMode = "overview";
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
});

hud.closeJournalButton.addEventListener("click", () => {
  journalOpen = false;
  renderJournal();
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
    canvas
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
  sceneFog.density = visuals.fogDensity;
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
    starOpacity: visuals.starOpacity
  });
  // 把当前 sky horizon 色更新到 terrain shader 的 height fog uniform，
  // 让山顶融到与天空一致的雾色。整区 + 所有 chunk 都要更新。
  updateTerrainShaderHeightFog(
    terrainMaterial,
    visuals.skyColor
  );
  terrainChunkMeshes.forEach((chunk) => {
    if (!Array.isArray(chunk.mesh.material)) {
      updateTerrainShaderHeightFog(
        chunk.mesh.material as MeshPhongMaterial,
        visuals.skyColor
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

  const terrainColorSignature = [
    currentMode,
    environmentController.state.season,
    environmentController.state.weather,
    Math.floor(environmentController.state.timeOfDay * 3)
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
  horseLegsByName.forEach((leg, name) => {
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
    northAngleRadians: northNeedleAngleRadians(compassHeading),
    screenRightDirection: screenRightDirectionLabel(compassHeading)
  });

  underpaint.position.x = player.position.x * 0.04;
  underpaint.position.z = player.position.z * 0.03;
  mistPlane.position.x = player.position.x * 0.015;
  mistPlane.position.z = player.position.z * 0.02;

  const weather = environment.weather;
  precipitation.position.x = player.position.x;
  precipitation.position.z = player.position.z;
  precipitation.position.y = player.position.y;
  precipitation.visible = weather === "rain" || weather === "snow";
  precipitationMaterial.opacity = visuals.precipitationOpacity;
  precipitationMaterial.color.copy(visuals.precipitationColor);
  precipitationMaterial.size = visuals.precipitationSize;

  if (precipitation.visible) {
    const fallSpeed = weather === "snow" ? 4.5 : 18;

    for (let index = 0; index < precipitationCount; index += 1) {
      const i3 = index * 3;
      precipitationPositions[i3 + 1] -= fallSpeed * deltaSeconds;

      if (weather === "snow") {
        precipitationPositions[i3] += Math.sin(clock.elapsedTime + precipitationOffsets[index]!) * 0.15;
        precipitationPositions[i3 + 2] += Math.cos(clock.elapsedTime * 0.8 + precipitationOffsets[index]!) * 0.08;
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
  if (hudDirty || hudRefreshTimer >= 0.15) {
    refreshHud();
    hudRefreshTimer = 0;
    hudDirty = false;
  }
  renderer.render(scene, camera);
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
  }

  const waterLevel = sampler.asset.presentation?.waterLevel ?? sampler.asset.minHeight - 2.5;
  const underpaintLevel =
    sampler.asset.presentation?.underpaintLevel ?? sampler.asset.minHeight - 3.2;
  waterRibbon.position.y = waterLevel;
  underpaint.position.y = underpaintLevel;

  landmarkGroup.children.forEach((child) => {
    if (child instanceof Sprite) {
      const x = child.position.x;
      const z = child.position.z;
      child.position.y = sampler.sampleHeight(x, z) + 6.4;
      return;
    }

    if (child instanceof Mesh) {
      const x = child.position.x;
      const z = child.position.z;
      child.position.y = sampler.sampleHeight(x, z) + 1.8;
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
