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
  Line,
  LineBasicMaterial,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshPhongMaterial,
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
  viewModes,
  type Landmark,
  type ViewMode
} from "./data/qinlingSlice";
import {
  AmbientAudioController
} from "./game/ambientAudio";
import { cameraLookTargetForMode, type CameraViewMode } from "./game/cameraView.js";
import { qinlingCameraRig } from "./game/cameraRig";
import {
  EnvironmentController,
  seasonLabel,
  weatherLabel,
  formatTimeOfDay,
  type EnvironmentVisuals
} from "./game/environment";
import {
  celestialDomeVector,
  skyBodyStyle,
  skyDomePolicy
} from "./game/skyDome.js";
import {
  atlasCanvasPoint,
  atlasFeatureCenter,
  atlasVisibleFeatures,
  featureWorldPoints
} from "./game/atlasRender.js";
import {
  createAtlasWorkbenchState,
  findAtlasFeatureAtCanvasPoint,
  selectAtlasFeature,
  setAtlasFullscreen,
  selectedAtlasFeature,
  toggleAtlasLayer,
  type AtlasWorkbenchState
} from "./game/atlasWorkbench.js";
import { movementVectorFromInput } from "./game/navigation.js";
import {
  avatarHeadingForMovement,
  woodHorseLegPose,
  woodHorseAvatarParts
} from "./game/playerAvatar.js";
import {
  qinlingAtlasFeatures,
  qinlingAtlasLayers,
  qinlingWaterSystem,
  type QinlingAtlasFeature,
  type QinlingAtlasLayerId
} from "./game/qinlingAtlas.js";
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
  TerrainSampler,
  loadDemAsset,
  resolveTerrainAssetRequest,
  type DemAsset
} from "./game/demSampler";
import { createHud } from "./game/hud";
import { renderJournalView } from "./game/journal";
import { qinlingRuntimeBudget } from "./game/performanceBudget";
import { loadRegionBundle } from "./game/regionBundle";
import {
  buildRetainedChunkIds,
  buildVisibleChunkIds,
  findChunkForPosition,
  limitChunkIdsByGridDistance,
  type RegionChunkManifest
} from "./game/regionChunks";
import { createChunkScenery, disposeScenery } from "./game/scenery";
import {
  evaluateStoryGuide,
  formatStoryGuideLine,
  getQinlingStoryBeats,
  type StoryBeat
} from "./game/storyGuide";
import {
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
let storyBeats: StoryBeat[] = getQinlingStoryBeats();
const completedStoryBeatIds = new Set<string>();
let storyLine = "主线：从关中出发，去看山河如何一步步把道路收紧。";
let storyGuideInitialized = false;
let atlasWorkbench: AtlasWorkbenchState =
  createAtlasWorkbenchState(qinlingAtlasLayers);

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing app root");
}

const renderer = new WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance"
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x081213);
app.appendChild(renderer.domElement);

const skyOverlay = document.createElement("div");
skyOverlay.className = "sky-overlay";
skyOverlay.innerHTML = `
  <div class="sky-dome">
    <div class="sky-sun"></div>
    <div class="sky-moon"></div>
    <div class="sky-stars">
      ${Array.from({ length: 96 }, (_, index) => {
        const left = (index * 47 + Math.floor(index / 7) * 11) % 100;
        const top = 5 + ((index * 29 + Math.floor(index / 5) * 7) % 70);
        const size = 1 + (index % 4 === 0 ? 1.4 : index % 3);
        const opacity = 0.46 + ((index * 17) % 45) / 100;
        return `<span style="left:${left}%;top:${top}%;width:${size}px;height:${size}px;opacity:${opacity}"></span>`;
      }).join("")}
    </div>
  </div>
  <div class="sky-cloud cloud-a"></div>
  <div class="sky-cloud cloud-b"></div>
  <div class="sky-cloud cloud-c"></div>
`;
app.appendChild(skyOverlay);
skyOverlay.hidden = true;
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

const terrain = new Mesh(
  terrainGeometry,
  new MeshPhongMaterial({
    vertexColors: true,
    flatShading: true,
    shininess: 8
  })
);
scene.add(terrain);

const terrainChunkGroup = new Group();
scene.add(terrainChunkGroup);

const waterRibbon = new Mesh(
  new PlaneGeometry(1, 1),
  new MeshBasicMaterial({
    color: 0x6aa7b0,
    transparent: true,
    opacity: 0.025,
    side: DoubleSide
  })
);
waterRibbon.rotation.x = -Math.PI / 2;
waterRibbon.position.y = -8;
scene.add(waterRibbon);

const player = new Group();

const avatarPartNames = new Set(woodHorseAvatarParts.map((part) => part.name));
const woodMaterial = new MeshPhongMaterial({
  color: 0x8b633d,
  flatShading: true,
  shininess: 6
});
const darkWoodMaterial = new MeshPhongMaterial({
  color: 0x5b3d28,
  flatShading: true,
  shininess: 5
});
const cloakMaterial = new MeshPhongMaterial({
  color: 0xb85b3d,
  flatShading: true,
  shininess: 8
});
const riderMaterial = new MeshPhongMaterial({
  color: 0xe2ceb0,
  flatShading: true
});

const horseBody = new Mesh(
  new BoxGeometry(2.7, 0.86, 1.12),
  woodMaterial
);
horseBody.name = "wooden-horse-body";
horseBody.position.y = 1.35;

const horseNeck = new Mesh(
  new BoxGeometry(0.4, 1.02, 0.48),
  woodMaterial
);
horseNeck.name = "wooden-horse-neck";
horseNeck.position.set(1.12, 1.82, 0);
horseNeck.rotation.z = -0.35;

const horseHead = new Mesh(
  new BoxGeometry(0.92, 0.58, 0.56),
  darkWoodMaterial
);
horseHead.name = "wooden-horse-head";
horseHead.position.set(1.62, 2.16, 0);
horseHead.rotation.z = -0.12;

const horseMane = new Mesh(
  new ConeGeometry(0.24, 0.72, 4),
  new MeshPhongMaterial({ color: 0xd5a35f, flatShading: true, shininess: 5 })
);
horseMane.position.set(1.22, 2.28, 0);
horseMane.rotation.z = Math.PI;

const horseTail = new Mesh(
  new ConeGeometry(0.18, 0.95, 5),
  darkWoodMaterial
);
horseTail.name = "wooden-horse-tail";
horseTail.position.set(-1.55, 1.42, 0);
horseTail.rotation.z = Math.PI / 2;

const horseLegs = [
  ["front-left-leg", 0.88, 0.38],
  ["front-right-leg", 0.88, -0.38],
  ["back-left-leg", -0.88, 0.38],
  ["back-right-leg", -0.88, -0.38]
].map(([name, x, z]) => {
  const leg = new Mesh(
    new CylinderGeometry(0.11, 0.15, 1.08, 5),
    darkWoodMaterial
  );
  leg.name = String(name);
  leg.position.set(Number(x), 0.68, Number(z));
  leg.rotation.z = name === "front-left-leg" || name === "back-right-leg" ? 0.1 : -0.1;
  return leg;
});
const horseLegsByName = new Map(
  horseLegs.map((leg) => [leg.name, leg])
);

const saddle = new Mesh(
  new BoxGeometry(0.82, 0.18, 0.88),
  new MeshPhongMaterial({ color: 0x3d2a20, flatShading: true })
);
saddle.position.set(0.05, 1.9, 0);

const rider = new Mesh(
  new SphereGeometry(0.36, 12, 12),
  riderMaterial
);
rider.name = "traveler-head";
rider.position.set(0.05, 2.78, 0);

const cloak = new Mesh(
  new ConeGeometry(0.62, 1.18, 5),
  cloakMaterial
);
cloak.name = "traveler-cloak";
cloak.position.set(0, 2.2, 0);
cloak.rotation.y = Math.PI / 5;

const bannerPole = new Mesh(
  new CylinderGeometry(0.05, 0.05, 2.8, 6),
  new MeshPhongMaterial({ color: 0xd7b56b, flatShading: true })
);
bannerPole.position.set(-0.4, 3.2, 0);

const banner = new Mesh(
  new PlaneGeometry(1.1, 0.74),
  new MeshPhongMaterial({
    color: 0x9d4234,
    flatShading: true,
    side: DoubleSide
  })
);
banner.name = "route-banner";
banner.position.set(0.1, 3.45, 0);
banner.rotation.y = Math.PI / 2;

if (avatarPartNames.size === 0) {
  throw new Error("Missing wood horse avatar blueprint.");
}

player.add(
  horseBody,
  horseNeck,
  horseHead,
  horseMane,
  horseTail,
  ...horseLegs,
  saddle,
  cloak,
  rider,
  bannerPole,
  banner
);
scene.add(player);

function createCircleTexture(
  innerColor: string,
  outerColor: string,
  size = 256
): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Failed to create texture context");
  }

  const gradient = context.createRadialGradient(
    size * 0.5,
    size * 0.5,
    size * 0.06,
    size * 0.5,
    size * 0.5,
    size * 0.45
  );
  gradient.addColorStop(0, innerColor);
  gradient.addColorStop(1, outerColor);

  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function createMoonTexture(size = 256): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Failed to create moon texture context");
  }

  const center = size * 0.5;
  const radius = size * 0.32;
  context.clearRect(0, 0, size, size);
  context.beginPath();
  context.arc(center, center, radius, 0, Math.PI * 2);
  context.fillStyle = "rgba(232, 236, 224, 0.86)";
  context.fill();

  const markings = [
    [0.42, 0.42, 0.055, 0.13],
    [0.57, 0.48, 0.08, 0.1],
    [0.47, 0.61, 0.065, 0.11],
    [0.61, 0.62, 0.035, 0.09]
  ];
  markings.forEach(([x, y, r, opacity]) => {
    context.beginPath();
    context.arc(size * x, size * y, size * r, 0, Math.PI * 2);
    context.fillStyle = `rgba(120, 132, 128, ${opacity})`;
    context.fill();
  });

  context.beginPath();
  context.arc(center, center, radius, 0, Math.PI * 2);
  context.strokeStyle = "rgba(255, 255, 246, 0.22)";
  context.lineWidth = 2;
  context.stroke();

  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function createStarDomePositions(count: number, radius: number): Float32Array {
  const positions = new Float32Array(count * 3);

  for (let index = 0; index < count; index += 1) {
    const azimuth = ((index * 137.508) % 360) * MathUtils.DEG2RAD;
    const elevation = MathUtils.lerp(0.08, 0.96, ((index * 61) % 100) / 100);
    const horizontalRadius = Math.cos(elevation) * radius;

    positions[index * 3] = Math.cos(azimuth) * horizontalRadius;
    positions[index * 3 + 1] = Math.sin(elevation) * radius;
    positions[index * 3 + 2] = Math.sin(azimuth) * horizontalRadius;
  }

  return positions;
}

function createCloudTexture(size = 512): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Failed to create cloud texture context");
  }

  const gradient = context.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, "rgba(255, 246, 214, 0)");
  gradient.addColorStop(0.45, "rgba(255, 246, 214, 0.38)");
  gradient.addColorStop(1, "rgba(255, 246, 214, 0)");
  context.fillStyle = gradient;

  for (let index = 0; index < 14; index += 1) {
    const x = size * (0.12 + Math.random() * 0.76);
    const y = size * (0.24 + Math.random() * 0.5);
    const radiusX = size * (0.12 + Math.random() * 0.18);
    const radiusY = size * (0.055 + Math.random() * 0.08);
    context.beginPath();
    context.ellipse(x, y, radiusX, radiusY, Math.random() * 0.4 - 0.2, 0, Math.PI * 2);
    context.fill();
  }

  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function createTextSprite(text: string, accent: string): Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 420;
  canvas.height = 120;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Failed to create label context");
  }

  context.fillStyle = "rgba(9, 18, 19, 0.52)";
  context.strokeStyle = "rgba(235, 214, 155, 0.28)";
  context.lineWidth = 3;
  context.beginPath();
  context.roundRect(8, 12, 404, 96, 24);
  context.fill();
  context.stroke();

  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "600 32px 'Noto Sans SC', 'PingFang SC', sans-serif";
  context.fillStyle = accent;
  context.fillText(text, 210, 60);

  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;

  const material = new SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false
  });

  const sprite = new Sprite(material);
  sprite.scale.set(10.5, 3, 1);
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

const routeGroup = new Group();
scene.add(routeGroup);

const fragmentVisuals = new Map<string, FragmentVisual>();

function clearGroup(group: Group): void {
  while (group.children.length > 0) {
    const child = group.children[0];

    if (!child) {
      continue;
    }

    group.remove(child);

    if (child instanceof Mesh || child instanceof Line) {
      child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach((material) => material.dispose());
      } else {
        child.material.dispose();
      }
    } else if (child instanceof Sprite) {
      child.material.dispose();
    }
  }
}

function rebuildLandmarkVisuals(): void {
  clearGroup(landmarkGroup);
  landmarkChunkIds.clear();

  landmarks.forEach((landmark) => {
    const chunkId = regionChunkManifest
      ? findChunkForPosition(regionChunkManifest, landmark.position)?.id ?? null
      : null;
    landmarkChunkIds.set(landmark.name, chunkId);
    const ground = 0;
    const marker = new Mesh(
      landmark.kind === "city"
        ? new CylinderGeometry(0.18, 0.48, 2.8, 5)
        : new CylinderGeometry(0.14, 0.36, 2.4, 4),
      new MeshPhongMaterial({
        color:
          landmark.kind === "pass"
            ? 0xd7a354
            : landmark.kind === "river"
              ? 0x5fb8d0
              : landmark.kind === "mountain"
                ? 0xded5c3
                : 0x91b67c,
        emissive:
          landmark.kind === "city"
            ? 0x252111
            : landmark.kind === "pass"
              ? 0x4d2d10
              : 0x111111,
        flatShading: true
      })
    );
    marker.position.set(landmark.position.x, ground + 1.8, landmark.position.y);
    marker.userData.chunkId = chunkId;

    if (landmark.kind !== "plain") {
      const label = createTextSprite(
        landmark.name,
        landmark.kind === "pass" ? "#efcf83" : "#f3ebd4"
      );
      if (landmark.kind === "pass") {
        label.scale.set(15, 4.3, 1);
      }
      label.position.set(landmark.position.x, ground + 6.4, landmark.position.y);
      label.userData.chunkId = chunkId;
      landmarkGroup.add(label);
    }

    landmarkGroup.add(marker);

    if (landmark.kind === "pass") {
      [-0.72, 0.72].forEach((offset) => {
        const gatePost = new Mesh(
          new CylinderGeometry(0.14, 0.24, 4.1, 5),
          new MeshPhongMaterial({
            color: 0x8a4d22,
            emissive: 0x2d1608,
            flatShading: true
          })
        );
        gatePost.position.set(
          landmark.position.x + offset,
          ground + 2.65,
          landmark.position.y
        );
        gatePost.userData.chunkId = chunkId;
        landmarkGroup.add(gatePost);
      });
    }
  });
}

function rebuildFragmentVisuals(): void {
  clearGroup(fragmentGroup);
  fragmentVisuals.clear();

  knowledgeFragments.forEach((fragment, index) => {
    const chunkId = regionChunkManifest
      ? findChunkForPosition(regionChunkManifest, fragment.position)?.id ?? null
      : null;
    const ground = 0;

    const sprite = new Sprite(
      new SpriteMaterial({
        map: fragmentGlowTexture,
        color: 0xfff0a5,
        transparent: true,
        depthWrite: false
      })
    );
    sprite.scale.set(2.5, 2.5, 1);
    sprite.position.set(fragment.position.x, ground + 3.5, fragment.position.y);

    const halo = new Sprite(
      new SpriteMaterial({
        map: fragmentHaloTexture,
        transparent: true,
        depthWrite: false
      })
    );
    halo.scale.set(5.8, 5.8, 1);
    halo.position.set(fragment.position.x, ground + 2.2, fragment.position.y);

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

const precipitationCount = 480;
const precipitationGeometry = new BufferGeometry();
const precipitationPositions = new Float32Array(precipitationCount * 3);
const precipitationOffsets: number[] = [];

for (let index = 0; index < precipitationCount; index += 1) {
  precipitationPositions[index * 3] = (Math.random() - 0.5) * 50;
  precipitationPositions[index * 3 + 1] = Math.random() * 26 + 4;
  precipitationPositions[index * 3 + 2] = (Math.random() - 0.5) * 50;
  precipitationOffsets.push(Math.random() * Math.PI * 2);
}

precipitationGeometry.setAttribute(
  "position",
  new BufferAttribute(precipitationPositions, 3)
);

const precipitationMaterial = new PointsMaterial({
  color: 0xd6eef8,
  size: 0.18,
  transparent: true,
  opacity: 0,
  depthWrite: false
});
const precipitation = new Points(precipitationGeometry, precipitationMaterial);
scene.add(precipitation);

const skyDomeGroup = new Group();
skyDomeGroup.renderOrder = -1000;
scene.add(skyDomeGroup);

const skyShell = new Mesh(
  new SphereGeometry(skyDomePolicy.radius, 48, 24),
  new MeshBasicMaterial({
    color: 0x8eb6ac,
    side: BackSide,
    depthTest: false,
    depthWrite: false,
    fog: false
  })
);
skyShell.renderOrder = -1000;
skyDomeGroup.add(skyShell);

const starDomeGeometry = new BufferGeometry();
starDomeGeometry.setAttribute(
  "position",
  new BufferAttribute(createStarDomePositions(360, skyDomePolicy.radius * 0.92), 3)
);
const starDomeMaterial = new PointsMaterial({
  color: 0xf1f5ff,
  size: 1.1,
  transparent: true,
  opacity: 0,
  depthTest: false,
  depthWrite: false,
  fog: false
});
const starDome = new Points(starDomeGeometry, starDomeMaterial);
starDome.renderOrder = -999;
skyDomeGroup.add(starDome);

const sunSkyDisc = new Sprite(
  new SpriteMaterial({
    map: createCircleTexture("rgba(255, 244, 203, 0.9)", "rgba(255, 194, 91, 0)", 256),
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
    fog: false
  })
);
sunSkyDisc.renderOrder = -998;
skyDomeGroup.add(sunSkyDisc);

const moonSkyDisc = new Sprite(
  new SpriteMaterial({
    map: createMoonTexture(256),
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
    fog: false
  })
);
moonSkyDisc.renderOrder = -998;
skyDomeGroup.add(moonSkyDisc);

const cloudGroup = new Group();
const cloudTexture = createCloudTexture();
const cloudSprites: Sprite[] = [];

for (let index = 0; index < 7; index += 1) {
  const cloud = new Sprite(
    new SpriteMaterial({
      map: cloudTexture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      opacity: 0.18
    })
  );
  cloud.renderOrder = 10;
  cloud.scale.set(54 + index * 7, 18 + (index % 3) * 5, 1);
  cloud.userData.baseX = -140 + index * 48;
  cloud.userData.baseZ = -96 + (index % 4) * 58;
  cloud.userData.phase = index * 0.73;
  cloudSprites.push(cloud);
  cloudGroup.add(cloud);
}

scene.add(cloudGroup);

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

function rebuildWaterSystemVisuals(): void {
  clearGroup(waterSystemGroup);

  if (!terrainSampler) {
    return;
  }

  qinlingWaterSystem.forEach((river) => {
    const points = featureWorldPoints(river);
    const ribbonGeometry = new BufferGeometry();
    ribbonGeometry.setAttribute(
      "position",
      new BufferAttribute(
        buildRouteRibbonVertices(points, {
          width: river.displayPriority >= 9 ? 1.7 : 1.15,
          yOffset: 0.5,
          sampleHeight: (x, z) => terrainSampler!.sampleHeight(x, z)
        }),
        3
      )
    );

    const ribbon = new Mesh(
      ribbonGeometry,
      new MeshBasicMaterial({
        color: 0x4fb6c8,
        transparent: true,
        opacity: river.displayPriority >= 9 ? 0.72 : 0.5,
        side: DoubleSide,
        depthWrite: false
      })
    );
    ribbon.renderOrder = 9;
    waterSystemGroup.add(ribbon);

    const positions: number[] = [];

    points.forEach((point) => {
      positions.push(
        point.x,
        terrainSampler!.sampleHeight(point.x, point.y) + 0.64,
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
        color: 0x62c3d4,
        transparent: true,
        opacity: river.displayPriority >= 9 ? 0.9 : 0.68,
        linewidth: 2
      })
    );
    line.renderOrder = 10;
    waterSystemGroup.add(line);
  });
}

function rebuildRouteVisuals(): void {
  clearGroup(routeGroup);

  if (!terrainSampler) {
    return;
  }

  qinlingRoutes.forEach((route) => {
    if (route.labelPoint && route.label) {
      const routeLabel = createTextSprite(route.label, "#f6d783");
      routeLabel.scale.set(16.5, 4.7, 1);
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

function drawAtlasMapCanvas(
  canvas: HTMLCanvasElement,
  asset: DemAsset,
  playerPosition: Vector3
): void {
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  const { width, height } = canvas;
  const image = context.createImageData(width, height);
  const heightRange = asset.maxHeight - asset.minHeight || 1;

  for (let y = 0; y < height; y += 1) {
    const row = Math.min(
      asset.grid.rows - 1,
      Math.max(0, Math.floor((y / height) * asset.grid.rows))
    );

    for (let x = 0; x < width; x += 1) {
      const column = Math.min(
        asset.grid.columns - 1,
        Math.max(0, Math.floor((x / width) * asset.grid.columns))
      );
      const sample = asset.heights[row * asset.grid.columns + column] ?? asset.minHeight;
      const h = MathUtils.clamp((sample - asset.minHeight) / heightRange, 0, 1);
      const lowland = h < 0.28;
      const ridge = h > 0.58;
      const offset = (y * width + x) * 4;

      image.data[offset] = lowland ? 178 : ridge ? 224 : 190 + h * 34;
      image.data[offset + 1] = lowland ? 178 : ridge ? 211 : 170 + h * 40;
      image.data[offset + 2] = lowland ? 126 : ridge ? 160 : 108 + h * 36;
      image.data[offset + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);
  context.fillStyle = "rgba(247, 230, 174, 0.12)";
  context.fillRect(0, 0, width, height);

  const atlasLayers = qinlingAtlasLayers.map((layer) => ({
    ...layer,
    defaultVisible: atlasWorkbench.visibleLayerIds.has(layer.id)
  }));
  const selectedFeature = selectedAtlasFeature(atlasWorkbench, qinlingAtlasFeatures);

  atlasVisibleFeatures(qinlingAtlasFeatures, atlasLayers).forEach(
    (feature) => {
      drawAtlasFeature(context, feature, asset, canvas);
    }
  );

  if (selectedFeature) {
    drawAtlasFeatureSelection(context, selectedFeature, asset, canvas);
  }

  const playerX = MathUtils.clamp(
    (playerPosition.x / asset.world.width + 0.5) * width,
    0,
    width
  );
  const playerY = MathUtils.clamp(
    (0.5 - playerPosition.z / asset.world.depth) * height,
    0,
    height
  );

  context.beginPath();
  context.arc(playerX, playerY, 5.5, 0, Math.PI * 2);
  context.fillStyle = "#f5e7a4";
  context.fill();
  context.lineWidth = 2;
  context.strokeStyle = "rgba(44, 24, 14, 0.8)";
  context.stroke();
}

function drawOverviewMap(asset: DemAsset, playerPosition: Vector3): void {
  drawAtlasMapCanvas(hud.overviewCanvas, asset, playerPosition);

  if (atlasWorkbench.isFullscreen) {
    resizeAtlasCanvasToDisplaySize(hud.atlasFullscreenCanvas);
    drawAtlasMapCanvas(hud.atlasFullscreenCanvas, asset, playerPosition);
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

function drawAtlasPath(
  context: CanvasRenderingContext2D,
  feature: QinlingAtlasFeature,
  asset: DemAsset,
  canvas: HTMLCanvasElement
): void {
  const points = featureWorldPoints(feature).map((point) =>
    atlasCanvasPoint(point, asset.world, canvas)
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
  asset: DemAsset,
  canvas: HTMLCanvasElement
): void {
  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";

  if (feature.layer === "landform") {
    drawAtlasPath(context, feature, asset, canvas);
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
      context.closePath();
      context.fill();
      context.stroke();
    } else if (feature.geometry === "polyline") {
      context.strokeStyle = "rgba(87, 65, 35, 0.58)";
      context.lineWidth = 2.4;
      context.stroke();
    }
  }

  if (feature.layer === "water") {
    drawAtlasPath(context, feature, asset, canvas);
    context.strokeStyle = "rgba(20, 63, 73, 0.52)";
    context.lineWidth = feature.displayPriority >= 9 ? 4.2 : 3.1;
    context.stroke();
    drawAtlasPath(context, feature, asset, canvas);
    context.strokeStyle = "rgba(97, 198, 219, 0.9)";
    context.lineWidth = feature.displayPriority >= 9 ? 2 : 1.35;
    context.stroke();
  }

  if (feature.layer === "road") {
    drawAtlasPath(context, feature, asset, canvas);
    context.setLineDash([5, 4]);
    context.strokeStyle = "rgba(93, 52, 18, 0.44)";
    context.lineWidth = 2.4;
    context.stroke();
    drawAtlasPath(context, feature, asset, canvas);
    context.strokeStyle = "rgba(229, 168, 82, 0.76)";
    context.lineWidth = 1.25;
    context.stroke();
    context.setLineDash([]);
  }

  if (feature.geometry === "point") {
    const center = atlasFeatureCenter(feature, asset.world, canvas);
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
    const center = atlasFeatureCenter(feature, asset.world, canvas);
    context.font = feature.layer === "landform"
      ? "600 12px 'Noto Sans SC', 'PingFang SC', sans-serif"
      : "600 10px 'Noto Sans SC', 'PingFang SC', sans-serif";
    context.fillStyle = feature.layer === "water"
      ? "rgba(24, 82, 92, 0.86)"
      : feature.layer === "road" || feature.layer === "pass"
        ? "rgba(92, 45, 18, 0.84)"
        : "rgba(45, 35, 20, 0.8)";
    context.fillText(feature.name, center.x + 5, center.y - 4);
  }

  context.restore();
}

function drawAtlasFeatureSelection(
  context: CanvasRenderingContext2D,
  feature: QinlingAtlasFeature,
  asset: DemAsset,
  canvas: HTMLCanvasElement
): void {
  const center = atlasFeatureCenter(feature, asset.world, canvas);

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
  hud.renderAtlasFeature(
    selectedAtlasFeature(atlasWorkbench, qinlingAtlasFeatures)
  );
  hud.setAtlasFullscreenOpen(atlasWorkbench.isFullscreen);
  hudDirty = true;
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
        const scenery = createChunkScenery(
          chunkSampler,
          runtimeBudget.scenery
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

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && atlasWorkbench.isFullscreen) {
    event.preventDefault();
    keys.clear();
    atlasWorkbench = setAtlasFullscreen(atlasWorkbench, false);
    refreshAtlasWorkbench();
    return;
  }

  if (event.key.toLowerCase() === "m") {
    event.preventDefault();
    keys.clear();
    atlasWorkbench = setAtlasFullscreen(atlasWorkbench, !atlasWorkbench.isFullscreen);
    refreshAtlasWorkbench();
    return;
  }

  if (atlasWorkbench.isFullscreen) {
    return;
  }

  if (event.key >= "1" && event.key <= "4") {
    currentMode = viewModes[Number(event.key) - 1]!;
    if (lastVisuals) {
      updateTerrainColors(lastVisuals);
    }
    hudDirty = true;
    return;
  }

  if (event.key.toLowerCase() === "j") {
    journalOpen = !journalOpen;
    renderJournal();
    return;
  }

  if (event.key.toLowerCase() === "k") {
    environmentController.advanceWeather();
    hudDirty = true;
    return;
  }

  if (event.key.toLowerCase() === "l") {
    environmentController.advanceSeason();
    hudDirty = true;
    return;
  }

  if (event.key.toLowerCase() === "t") {
    environmentController.state.timeOfDay =
      (environmentController.state.timeOfDay + 3) % 24;
    hudDirty = true;
    return;
  }

  if (event.key.toLowerCase() === "o") {
    cameraViewMode = "overview";
    cameraDistance = qinlingCameraRig.maxDistance;
    cameraElevation = qinlingCameraRig.maxElevation;
    return;
  }

  if (event.key.toLowerCase() === "f") {
    cameraViewMode = "follow";
    cameraDistance = qinlingCameraRig.minDistance + 10;
    cameraElevation = 0.52;
    return;
  }

  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.key)) {
    event.preventDefault();
  }

  keys.add(event.key.toLowerCase());
});

document.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
  const selectedFeature = selectedAtlasFeature(atlasWorkbench, qinlingAtlasFeatures);

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
  const feature = findAtlasFeatureAtCanvasPoint(
    qinlingAtlasFeatures,
    atlasWorkbench,
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
  selectAtlasFeatureFromCanvas(hud.atlasFullscreenCanvas, event);
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
  skyShell.material.color.copy(visuals.skyColor);
  starDomeMaterial.opacity = visuals.starOpacity;

  const sunDomeVector = celestialDomeVector({
    timeOfDay: environment.timeOfDay,
    body: "sun"
  });
  const moonDomeVector = celestialDomeVector({
    timeOfDay: environment.timeOfDay,
    body: "moon",
    radius: skyDomePolicy.radius * skyBodyStyle.moon.radiusMultiplier
  });
  sunSkyDisc.position.set(sunDomeVector.x, sunDomeVector.y, sunDomeVector.z);
  sunSkyDisc.scale.setScalar(46 + Math.max(0, sunDomeVector.altitude) * 24);
  sunSkyDisc.material.opacity = visuals.sunDiscOpacity;
  moonSkyDisc.position.set(moonDomeVector.x, moonDomeVector.y, moonDomeVector.z);
  moonSkyDisc.scale.setScalar(
    MathUtils.lerp(
      skyBodyStyle.moon.minScale,
      skyBodyStyle.moon.maxScale,
      Math.max(0, moonDomeVector.altitude)
    )
  );
  moonSkyDisc.material.opacity = visuals.moonOpacity;
  mistPlane.material.opacity = visuals.mistOpacity;
  waterRibbon.material.opacity = 0.05 + visuals.waterShimmer * 0.08;
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

  let forwardInput = 0;
  let rightInput = 0;

  if (keys.has("w") || keys.has("arrowup")) {
    forwardInput += 1;
  }
  if (keys.has("s") || keys.has("arrowdown")) {
    forwardInput -= 1;
  }
  if (keys.has("a") || keys.has("arrowleft")) {
    rightInput -= 1;
  }
  if (keys.has("d") || keys.has("arrowright")) {
    rightInput += 1;
  }

  if (keys.has("q")) {
    cameraHeading += deltaSeconds * 1.2;
  }
  if (keys.has("e")) {
    cameraHeading -= deltaSeconds * 1.2;
  }

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
  const baseSpeed = keys.has("shift") ? 20 : 13.5;
  const speed = baseSpeed * (slopePenalty + routeBonus) * offRouteCost;
  const isMoving = forwardInput !== 0 || rightInput !== 0;

  if (isMoving) {
    cameraViewMode = "follow";
    const movement = movementVectorFromInput({
      heading: cameraHeading,
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

  const horizontalDistance = Math.cos(cameraElevation) * cameraDistance;
  const verticalDistance = Math.sin(cameraElevation) * cameraDistance;
  const nextLookTarget = cameraLookTargetForMode({
    mode: cameraViewMode,
    player: {
      x: player.position.x,
      y: player.position.y,
      z: player.position.z
    },
    lookAtHeight: qinlingCameraRig.lookAtHeight
  });

  targetCameraPosition.set(
    nextLookTarget.x + Math.sin(cameraHeading) * horizontalDistance,
    nextLookTarget.y + verticalDistance,
    nextLookTarget.z + Math.cos(cameraHeading) * horizontalDistance
  );

  camera.position.lerp(targetCameraPosition, qinlingCameraRig.followLerp);
  lookTarget.set(
    nextLookTarget.x,
    nextLookTarget.y,
    nextLookTarget.z
  );
  camera.lookAt(lookTarget);

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
  camera.position.set(-28, 40, 60);
  camera.lookAt(new Vector3(0, 0, 0));
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
