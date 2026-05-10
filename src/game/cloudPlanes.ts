import {
  CanvasTexture,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
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
  windDirection: Vector2;
  elapsedSeconds: number;
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
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = x / size;
      const ny = y / size;
      const broad = fractalCloudNoise(nx * 2.8 + 11.4, ny * 2.8 - 5.8);
      const detail = fractalCloudNoise(nx * 9.5 - 3.2, ny * 9.5 + 17.1);
      const cellular = Math.max(0, broad * 1.25 + detail * 0.45 - 0.78);
      const alpha = Math.min(190, Math.max(0, cellular * 260));
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
  texture.repeat.set(1.8, 1.8);
  return texture;
}

export function createCloudLayer(): CloudLayerHandle {
  const group = new Group();
  const texture = createCloudPlaneTexture(256);
  const material = new MeshBasicMaterial({
    map: texture,
    color: 0xf6fbff,
    transparent: true,
    opacity: 0.42,
    depthTest: true,
    depthWrite: false,
    side: DoubleSide,
    fog: false
  });

  const heights = [8, 12, 16] as const;
  const planes = heights.map((heightOffset, index) => {
    const plane = new Mesh(new PlaneGeometry(600, 600, 1, 1), material) as unknown as CloudPlane;
    plane.name = `cloud-plane-${index + 1}`;
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = heightOffset;
    plane.renderOrder = -40 - index;
    plane.frustumCulled = false;
    plane.userData.heightOffset = heightOffset;
    plane.userData.driftSpeed = 0.45 + index * 0.28;
    plane.userData.baseX = (index - 1) * 37;
    plane.userData.baseZ = (1 - index) * 29;
    group.add(plane);
    return plane;
  });

  return { group, planes, sprites: planes, texture, material };
}

export function updateCloudLayer(layer: CloudLayerHandle, update: CloudLayerUpdate): void {
  layer.group.position.set(
    update.playerPosition.x * 0.18,
    update.playerPosition.y,
    update.playerPosition.z * 0.18
  );
  layer.material.opacity = update.opacity;
  layer.material.color.copy(update.farColor);

  const wind = update.windDirection.lengthSq() > 0.000001
    ? update.windDirection.clone().normalize()
    : new Vector2(1, 0);
  const scroll = update.elapsedSeconds * 0.0025;
  layer.texture.offset.set(wind.x * scroll, wind.y * scroll);

  layer.planes.forEach((plane, index) => {
    const speed = plane.userData.driftSpeed;
    const drift = update.elapsedSeconds * speed * 0.9;
    plane.position.set(
      plane.userData.baseX + wind.x * drift,
      plane.userData.heightOffset,
      plane.userData.baseZ + wind.y * drift + Math.sin(update.elapsedSeconds * 0.05 + index) * 4
    );
  });
}
