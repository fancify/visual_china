import "./chinaLowresDemo.css";

import {
  AmbientLight,
  BufferAttribute,
  Color,
  DirectionalLight,
  FogExp2,
  MathUtils,
  Mesh,
  MeshPhongMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Vector3,
  WebGLRenderer
} from "three";

import { loadDemAsset, TerrainSampler, type DemAsset } from "./game/demSampler";

const root = document.querySelector<HTMLDivElement>("#china-lowres-root");

if (!root) {
  throw new Error("Missing #china-lowres-root");
}

const appRoot = root;
const demUrl = "/data/china-lowres-dem.json";
const heightScale = 28;
const displayGrid = {
  columns: 220,
  rows: 128
};

interface ViewerState {
  yaw: number;
  pitch: number;
  distance: number;
  target: Vector3;
  dragging: boolean;
  pointerX: number;
  pointerY: number;
}

function terrainColor(height: number, normalizedHeight: number, river: number): Color {
  if (height <= 0.001) {
    return new Color("#6f8f97");
  }

  const lowland = new Color("#d8c57f");
  const basin = new Color("#b6a666");
  const plateau = new Color("#8d855c");
  const mountain = new Color("#d5cba2");
  const snow = new Color("#f4eed5");
  const waterHint = new Color("#4e8f97");

  let color: Color;

  if (normalizedHeight < 0.12) {
    color = lowland.clone().lerp(basin, normalizedHeight / 0.12);
  } else if (normalizedHeight < 0.34) {
    color = basin.clone().lerp(plateau, (normalizedHeight - 0.12) / 0.22);
  } else if (normalizedHeight < 0.7) {
    color = plateau.clone().lerp(mountain, (normalizedHeight - 0.34) / 0.36);
  } else {
    color = mountain.clone().lerp(snow, (normalizedHeight - 0.7) / 0.3);
  }

  return color.lerp(waterHint, MathUtils.clamp(river * 0.22, 0, 0.22));
}

function stylizedHeight(rawHeight: number, asset: DemAsset): number {
  const normalizedHeight = MathUtils.clamp(
    (rawHeight - asset.minHeight) / (asset.maxHeight - asset.minHeight || 1),
    0,
    1
  );

  return Math.pow(normalizedHeight, 0.62) * heightScale;
}

function createChinaTerrain(asset: DemAsset): Mesh<PlaneGeometry, MeshPhongMaterial> {
  const sampler = new TerrainSampler(asset);
  const geometry = new PlaneGeometry(
    asset.world.width,
    asset.world.depth,
    displayGrid.columns - 1,
    displayGrid.rows - 1
  );
  geometry.rotateX(-Math.PI / 2);

  const positions = geometry.attributes.position as BufferAttribute;
  const colors = new BufferAttribute(new Float32Array(positions.count * 3), 3);
  const color = new Color();

  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const z = positions.getZ(index);
    const rawHeight = sampler.sampleHeight(x, z);
    const normalizedHeight = MathUtils.clamp(
      (rawHeight - asset.minHeight) / (asset.maxHeight - asset.minHeight || 1),
      0,
      1
    );

    positions.setY(index, stylizedHeight(rawHeight, asset));
    color.copy(terrainColor(rawHeight, normalizedHeight, sampler.sampleRiver(x, z)));
    colors.setXYZ(index, color.r, color.g, color.b);
  }

  geometry.setAttribute("color", colors);
  geometry.computeVertexNormals();

  return new Mesh(
    geometry,
    new MeshPhongMaterial({
      vertexColors: true,
      flatShading: false,
      shininess: 12
    })
  );
}

function mountShell(asset: DemAsset): {
  canvas: HTMLCanvasElement;
  resetButton: HTMLButtonElement;
} {
  appRoot.innerHTML = `
    <main class="china-lowres-shell">
      <canvas class="china-lowres-canvas" aria-label="中国低分辨率游戏地形预览"></canvas>
      <section class="china-lowres-panel">
        <div class="china-lowres-kicker">低分辨率全国母版 · Game Terrain Preview</div>
        <h1>山河中国</h1>
        <p>这是一张单独的游戏式全国低清地形原型：只看宏观高原、盆地、平原和海岸关系，不加载秦岭剧情、人物或 POI。</p>
        <div class="china-lowres-stats">
          <div class="china-lowres-stat"><strong>${asset.grid.columns}×${asset.grid.rows}</strong><span>DEM 网格</span></div>
          <div class="china-lowres-stat"><strong>${asset.minHeight}-${asset.maxHeight.toFixed(0)}m</strong><span>海平面夹平</span></div>
          <div class="china-lowres-stat"><strong>${displayGrid.columns}×${displayGrid.rows}</strong><span>显示网格</span></div>
        </div>
      </section>
      <aside class="china-lowres-controls">
        拖拽旋转视角，滚轮缩放，WASD 平移观察中心。
        <button id="china-lowres-reset" type="button">复位视角</button>
      </aside>
      <aside class="china-lowres-compass" aria-label="地图方位">
        <span class="north">北</span>
        <span class="west">西</span>
        <span class="east">东</span>
        <span class="south">南</span>
      </aside>
    </main>
  `;

  const canvas = appRoot.querySelector<HTMLCanvasElement>(".china-lowres-canvas");
  const resetButton = appRoot.querySelector<HTMLButtonElement>("#china-lowres-reset");

  if (!canvas || !resetButton) {
    throw new Error("Failed to mount China lowres demo shell.");
  }

  return { canvas, resetButton };
}

function updateCamera(camera: PerspectiveCamera, state: ViewerState): void {
  const radius = state.distance;
  const pitch = MathUtils.degToRad(state.pitch);
  const yaw = MathUtils.degToRad(state.yaw);
  const x = state.target.x + Math.sin(yaw) * Math.cos(pitch) * radius;
  const y = state.target.y + Math.sin(pitch) * radius;
  const z = state.target.z + Math.cos(yaw) * Math.cos(pitch) * radius;

  camera.position.set(x, y, z);
  camera.lookAt(state.target);
}

function installControls(
  canvas: HTMLCanvasElement,
  resetButton: HTMLButtonElement,
  state: ViewerState
): Set<string> {
  const keys = new Set<string>();

  function reset(): void {
    // mapOrientation 契约：北 = -Z（与 Three.js 默认相机 forward 对齐）。
    // yaw=0 → camera 在 +Z 方向看 -Z 方向，屏幕远端 = 北 ✓
    state.yaw = 0;
    state.pitch = 58;
    state.distance = 460;
    state.target.set(0, 8, 0);
  }

  resetButton.addEventListener("click", reset);

  canvas.addEventListener("pointerdown", (event) => {
    state.dragging = true;
    state.pointerX = event.clientX;
    state.pointerY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!state.dragging) {
      return;
    }

    const dx = event.clientX - state.pointerX;
    const dy = event.clientY - state.pointerY;
    state.pointerX = event.clientX;
    state.pointerY = event.clientY;
    state.yaw -= dx * 0.18;
    state.pitch = MathUtils.clamp(state.pitch + dy * 0.12, 18, 72);
  });

  canvas.addEventListener("pointerup", (event) => {
    state.dragging = false;
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  });

  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    state.distance = MathUtils.clamp(state.distance + event.deltaY * 0.24, 190, 720);
  }, { passive: false });

  window.addEventListener("keydown", (event) => {
    keys.add(event.key.toLowerCase());
  });

  window.addEventListener("keyup", (event) => {
    keys.delete(event.key.toLowerCase());
  });

  window.addEventListener("blur", () => {
    keys.clear();
  });

  reset();
  return keys;
}

function updateKeyboardPan(state: ViewerState, keys: Set<string>, deltaSeconds: number): void {
  // 全国 viewer 模式：pan 走世界对齐，不跟相机 yaw 旋转——让 W=北、D=东
  // 永远稳定。这是 worldAxis 契约的直接消费者。
  const panSpeed = 84 * deltaSeconds;
  const move = new Vector3();

  if (keys.has("w")) {
    move.z += 1;
  }
  if (keys.has("s")) {
    move.z -= 1;
  }
  if (keys.has("d")) {
    move.x += 1;
  }
  if (keys.has("a")) {
    move.x -= 1;
  }

  if (move.lengthSq() > 0) {
    move.normalize().multiplyScalar(panSpeed);
    state.target.add(move);
    state.target.x = MathUtils.clamp(state.target.x, -140, 140);
    state.target.z = MathUtils.clamp(state.target.z, -82, 82);
  }
}

async function start(): Promise<void> {
  const { asset } = await loadDemAsset(demUrl);
  const { canvas, resetButton } = mountShell(asset);
  const scene = new Scene();
  scene.background = new Color("#152b2f");
  scene.fog = new FogExp2("#152b2f", 0.0025);

  const camera = new PerspectiveCamera(42, 1, 0.1, 1400);
  const renderer = new WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

  const terrain = createChinaTerrain(asset);
  scene.add(terrain);
  scene.add(new AmbientLight("#f4ecd2", 1.8));

  const keyLight = new DirectionalLight("#ffe3ad", 3.2);
  keyLight.position.set(-180, 260, 120);
  scene.add(keyLight);

  const fillLight = new DirectionalLight("#83a7aa", 1.2);
  fillLight.position.set(240, 120, -200);
  scene.add(fillLight);

  const state: ViewerState = {
    yaw: 0,
    pitch: 58,
    distance: 460,
    target: new Vector3(0, 8, 0),
    dragging: false,
    pointerX: 0,
    pointerY: 0
  };
  const keys = installControls(canvas, resetButton, state);
  let lastTime = performance.now();

  function resize(): void {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
  }

  function animate(now: number): void {
    const deltaSeconds = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    resize();
    updateKeyboardPan(state, keys, deltaSeconds);
    updateCamera(camera, state);
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
}

start().catch((error: unknown) => {
  appRoot.innerHTML = `<div class="china-lowres-error">中国低分辨率地形试玩加载失败：${String(error)}</div>`;
  console.error(error);
});
