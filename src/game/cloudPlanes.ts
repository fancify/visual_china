import {
  CanvasTexture,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MathUtils,
  PlaneGeometry,
  RepeatWrapping,
  Vector2,
  type Object3D
} from "three";

export interface CloudPlane extends Mesh {
  userData: {
    heightOffset: number;
    driftSpeed: number;
    baseX: number;
    baseZ: number;
    scale: number;
    phase: number;
  };
}

export interface CloudLayerHandle {
  group: Group;
  planes: CloudPlane[];
  /** Legacy alias for older callers/tests that still refer to cloud sprites. */
  sprites: Object3D[];
  texture: CanvasTexture;
  material: MeshBasicMaterial;
}

export interface CloudLayerUpdate {
  playerPosition: { x: number; y: number; z: number };
  opacity: number;
  farColor: Color;
  sunWarmColor?: Color;
  skyZenithColor?: Color;
  windDirection: Vector2;
  elapsedSeconds: number;
  profile?: CloudVisualProfile;
  daylight?: number;
  starOpacity?: number;
}

export interface CloudVisualProfile {
  coverage: number;
  opacityMultiplier: number;
  brightness: number;
  horizonMix: number;
  warmMix: number;
  zenithMix: number;
  heightMultiplier: number;
  repeatX: number;
  repeatY: number;
  driftMultiplier: number;
}

export type CloudWeather = "clear" | "windy" | "cloudy" | "rain" | "storm" | "snow" | "mist";

const cloudProfiles: Record<CloudWeather, CloudVisualProfile> = {
  clear: {
    coverage: 0.32,
    opacityMultiplier: 0.78,
    brightness: 1.05,
    horizonMix: 0.24,
    warmMix: 0.18,
    zenithMix: 0.18,
    heightMultiplier: 1,
    repeatX: 1.05,
    repeatY: 0.72,
    driftMultiplier: 1
  },
  windy: {
    coverage: 0.38,
    opacityMultiplier: 0.86,
    brightness: 1.02,
    horizonMix: 0.3,
    warmMix: 0.16,
    zenithMix: 0.2,
    heightMultiplier: 1.04,
    repeatX: 1.18,
    repeatY: 0.78,
    driftMultiplier: 1.28
  },
  cloudy: {
    coverage: 0.68,
    opacityMultiplier: 1.12,
    brightness: 0.82,
    horizonMix: 0.55,
    warmMix: 0.08,
    zenithMix: 0.34,
    heightMultiplier: 0.86,
    repeatX: 1.55,
    repeatY: 1.05,
    driftMultiplier: 0.78
  },
  rain: {
    coverage: 0.86,
    opacityMultiplier: 1.28,
    brightness: 0.58,
    horizonMix: 0.66,
    warmMix: 0.03,
    zenithMix: 0.42,
    heightMultiplier: 0.62,
    repeatX: 1.9,
    repeatY: 1.28,
    driftMultiplier: 0.92
  },
  storm: {
    coverage: 0.94,
    opacityMultiplier: 1.38,
    brightness: 0.46,
    horizonMix: 0.72,
    warmMix: 0.02,
    zenithMix: 0.48,
    heightMultiplier: 0.54,
    repeatX: 2.05,
    repeatY: 1.38,
    driftMultiplier: 1.18
  },
  snow: {
    coverage: 0.78,
    opacityMultiplier: 1.18,
    brightness: 0.88,
    horizonMix: 0.52,
    warmMix: 0.05,
    zenithMix: 0.38,
    heightMultiplier: 0.68,
    repeatX: 1.72,
    repeatY: 1.18,
    driftMultiplier: 0.62
  },
  mist: {
    coverage: 0.74,
    opacityMultiplier: 1.08,
    brightness: 0.7,
    horizonMix: 0.7,
    warmMix: 0.03,
    zenithMix: 0.44,
    heightMultiplier: 0.48,
    repeatX: 1.68,
    repeatY: 1.08,
    driftMultiplier: 0.38
  }
};

export function cloudVisualProfileForWeather(weather: CloudWeather): CloudVisualProfile {
  return cloudProfiles[weather];
}

function cloudNoise(x: number, y: number): number {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return value - Math.floor(value);
}

function smoothNoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = cloudNoise(ix, iy);
  const b = cloudNoise(ix + 1, iy);
  const c = cloudNoise(ix, iy + 1);
  const d = cloudNoise(ix + 1, iy + 1);
  return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
}

function fractalCloudNoise(x: number, y: number): number {
  let value = 0;
  let amplitude = 0.58;
  let frequency = 1;
  let norm = 0;
  for (let octave = 0; octave < 5; octave += 1) {
    value += smoothNoise(x * frequency, y * frequency) * amplitude;
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2.05;
  }
  return value / norm;
}

function createFallbackCanvas(size: number): HTMLCanvasElement {
  const data = new Uint8ClampedArray(size * size * 4);
  return {
    width: size,
    height: size,
    getContext: (type: string) => {
      if (type !== "2d") {
        return null;
      }
      return {
        createImageData: (width: number, height: number) => ({
          data,
          width,
          height,
          colorSpace: "srgb"
        }),
        putImageData: () => undefined
      };
    }
  } as unknown as HTMLCanvasElement;
}

export function createCloudPlaneTexture(size = 256): CanvasTexture {
  const canvas =
    typeof document === "undefined"
      ? createFallbackCanvas(size)
      : document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Failed to create cloud plane texture context");
  }

  const image = context.createImageData(size, size);
  let covered = 0;
  let softEdges = 0;
  let alphaSum = 0;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = x / size;
      const ny = y / size;
      const broad = fractalCloudNoise(nx * 1.65 + 11.4, ny * 1.18 - 5.8);
      const billow = fractalCloudNoise(nx * 3.8 - 19.6, ny * 2.6 + 7.4);
      const detail = fractalCloudNoise(nx * 11.5 - 3.2, ny * 8.5 + 17.1);
      const streak = Math.pow(
        Math.max(0, 1 - Math.abs(fractalCloudNoise(nx * 0.9, ny * 2.3) - 0.52) * 3.2),
        1.7
      );
      const cellular = Math.max(0, broad * 1.05 + billow * 0.72 + detail * 0.28 + streak * 0.2 - 1.03);
      const edgeDistance = Math.min(nx, 1 - nx, ny, 1 - ny);
      const edgeFade = MathUtils.smoothstep(edgeDistance, 0.02, 0.18);
      const alpha = Math.min(218, Math.max(0, Math.pow(cellular * 1.75, 1.35) * 255 * edgeFade));
      if (alpha > 12) covered += 1;
      if (alpha > 12 && alpha < 190) softEdges += 1;
      alphaSum += alpha;
      const i = (y * size + x) * 4;
      image.data[i] = 255;
      image.data[i + 1] = 255;
      image.data[i + 2] = 255;
      image.data[i + 3] = alpha;
    }
  }
  context.putImageData(image, 0, 0);

  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(1.05, 0.72);
  texture.userData.style = "botw-inspired-layered-cloud-mask";
  texture.userData.patchSilhouette = "edge-faded";
  texture.userData.coverageRatio = covered / (size * size);
  texture.userData.softEdgeRatio = softEdges / Math.max(1, covered);
  texture.userData.alphaMean = alphaSum / (size * size * 255);
  return texture;
}

export function createCloudLayer(): CloudLayerHandle {
  const group = new Group();
  const texture = createCloudPlaneTexture(256);
  const material = new MeshBasicMaterial({
    map: texture,
    color: 0xf8fcff,
    transparent: true,
    opacity: 0.55,
    depthTest: true,
    depthWrite: false,
    side: DoubleSide,
    fog: false
  });

  const patchConfigs = [
    [-430, -360, 28, 0.62],
    [90, -420, 36, 0.48],
    [470, -320, 44, 0.55],
    [-120, -230, 26, 0.36],
    [350, -110, 52, 0.38],
    [-520, 20, 34, 0.52],
    [-240, 120, 42, 0.42],
    [90, 90, 30, 0.58],
    [480, 180, 58, 0.46],
    [-380, 330, 48, 0.34],
    [210, 380, 38, 0.4],
    [610, 440, 62, 0.32]
  ] as const;
  const planes = patchConfigs.map(([baseX, baseZ, heightOffset, scale], index) => {
    const width = MathUtils.lerp(420, 880, scale);
    const depth = MathUtils.lerp(240, 520, scale);
    const plane = new Mesh(new PlaneGeometry(width, depth, 1, 1), material) as unknown as CloudPlane;
    plane.name = `cloud-patch-${index + 1}`;
    plane.rotation.x = -Math.PI / 2;
    plane.rotation.z = (index % 4 - 1.5) * 0.11;
    plane.position.y = heightOffset;
    plane.renderOrder = -40 - index;
    plane.frustumCulled = false;
    plane.userData.heightOffset = heightOffset;
    plane.userData.driftSpeed = 0.34 + (index % 5) * 0.09;
    plane.userData.baseX = baseX;
    plane.userData.baseZ = baseZ;
    plane.userData.scale = scale;
    plane.userData.phase = index * 1.731;
    group.add(plane);
    return plane;
  });

  return { group, planes, sprites: planes, texture, material };
}

export function updateCloudLayer(layer: CloudLayerHandle, update: CloudLayerUpdate): void {
  const profile = update.profile ?? cloudVisualProfileForWeather("clear");
  const daylight = Math.max(0, Math.min(1, update.daylight ?? 1));
  const fairWeatherSheet =
    profile.coverage < 0.45 &&
    profile.opacityMultiplier < 1;
  const nightVisibility = fairWeatherSheet
    ? MathUtils.smoothstep(daylight, 0.2, 0.48)
    : 1;
  layer.group.position.set(
    update.playerPosition.x * 0.18,
    update.playerPosition.y,
    update.playerPosition.z * 0.18
  );
  layer.material.opacity = Math.min(0.92, update.opacity * profile.opacityMultiplier * nightVisibility);
  layer.group.visible = layer.material.opacity > 0.04;
  const warm = update.sunWarmColor ?? new Color("#fff0c0");
  const zenith = update.skyZenithColor ?? new Color("#7ebee8");
  const cloudColor = new Color("#fff8dc")
    .lerp(warm, profile.warmMix)
    .lerp(zenith, profile.zenithMix)
    .lerp(update.farColor, profile.horizonMix)
    .multiplyScalar(profile.brightness);
  layer.material.color.copy(cloudColor);

  const wind = update.windDirection.lengthSq() > 0.000001
    ? update.windDirection.clone().normalize()
    : new Vector2(1, 0);
  const scroll = update.elapsedSeconds * 0.0025 * profile.driftMultiplier;
  layer.texture.repeat.set(profile.repeatX * 0.72, profile.repeatY * 0.72);
  layer.texture.offset.set(wind.x * scroll, wind.y * scroll);

  layer.planes.forEach((plane, index) => {
    const speed = plane.userData.driftSpeed;
    const drift = update.elapsedSeconds * speed * 0.9 * profile.driftMultiplier;
    plane.position.set(
      plane.userData.baseX + wind.x * drift,
      plane.userData.heightOffset * profile.heightMultiplier +
        Math.sin(update.elapsedSeconds * 0.045 + plane.userData.phase) * 1.8,
      plane.userData.baseZ + wind.y * drift + Math.sin(update.elapsedSeconds * 0.05 + index) * 7
    );
  });
}
