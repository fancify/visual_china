import {
  Group,
  Mesh,
  MeshLambertMaterial,
  PerspectiveCamera,
  Raycaster,
  Sprite,
  SpriteMaterial,
  CanvasTexture,
  Vector2,
  Vector3,
  type Object3D
} from "three";

import { projectGeoToWorld } from "../mapOrientation.js";
import {
  qinlingRegionBounds,
  qinlingRegionWorld
} from "../../data/qinlingRegion.js";
import {
  POI_REGISTRY,
  type PoiEntry,
  type PoiHierarchy
} from "../../data/poiRegistry.generated.js";
import { POI_VISUAL_OVERRIDES } from "../../data/poiVisualOverrides.js";
import { resolvePoiModel } from "../poi/models/registry.js";
import { TANG_PALETTE } from "../poi/models/tangParts.js";
import type { PyramidSampler } from "./pyramidSampler.js";

export interface PoiArchetypeLayerHandle {
  group: Group;
  update(
    cameraAltitude: number,
    camera?: PerspectiveCamera,
    canvasHeightPx?: number,
    timeOfDay?: number
  ): void;
  nearestPoi(x: number, z: number, maxDistance?: number): PoiEntry | null;
  hoveredPoiAt(pointerNdc: Vector2, camera: PerspectiveCamera): PoiEntry | null;
  dispose(): void;
}

export interface PoiArchetypeLayerOptions {
  sampler: PyramidSampler;
  maxPois?: number;
}

const HIERARCHY_WEIGHT: Record<PoiHierarchy, number> = {
  gravity: 0,
  large: 1,
  medium: 2,
  small: 3
};

const LINE_B_POI_GLOBAL_SCALE = 1 / 15;
const LINE_B_CITY_MEDIUM_SCALE = LINE_B_POI_GLOBAL_SCALE * (3 / 5) * 1.2;
const LINE_B_CITY_LARGE_SCALE = LINE_B_POI_GLOBAL_SCALE * (3 / 8) * 1.2 * 1.2;
const LINE_A_POI_PREVIEW_SCALE = 6;
const POI_LABEL_MAX_DISTANCE_WORLD = 50;
const POI_LABEL_CANVAS_HEIGHT_PX = 104;
const POI_LABEL_CANVAS_FONT_PX = 28;
const POI_LABEL_MIN_SCREEN_FONT_PX = 10;
const POI_LABEL_MAX_SCREEN_FONT_PX = 12;
const POI_LABELS_VISIBLE_BY_DEFAULT = false;
const POI_LABEL_MIN_CHARS = 3;
const POI_LABEL_MAX_CHARS = 8;
const POI_LABEL_HORIZONTAL_PADDING_PX = 96;
const TANG_RED_GLOW_COLOR = 0xc83232;
const TANG_RED_GLOW_MAX_INTENSITY = 0.46;
const poiLabelWorldPosition = new Vector3();
const poiLabelRaycaster = new Raycaster();

export function poiVisibleForCameraAltitude(
  poi: Pick<PoiEntry, "hierarchy">,
  cameraAltitude: number
): boolean {
  if (poi.hierarchy === "gravity" || poi.hierarchy === "large") return true;
  if (poi.hierarchy === "medium") return cameraAltitude <= 120;
  return cameraAltitude <= 45;
}

export function poiLabelVisibleForCameraAltitude(cameraAltitude: number): boolean {
  void cameraAltitude;
  return true;
}

export function poiLabelVisibleForWorldDistance(distanceWorld: number): boolean {
  return distanceWorld <= POI_LABEL_MAX_DISTANCE_WORLD;
}

export function poiLabelsVisibleByDefault(): boolean {
  return POI_LABELS_VISIBLE_BY_DEFAULT;
}

export function poiRedPaintNightGlowIntensity(timeOfDay: number): number {
  const hour = ((timeOfDay % 24) + 24) % 24;
  const dusk = Math.max(0, Math.min(1, (hour - 18.2) / (20.2 - 18.2)));
  const duskSmooth = dusk * dusk * (3 - 2 * dusk);
  const dawn = Math.max(0, Math.min(1, (hour - 5.0) / (6.4 - 5.0)));
  const dawnSmooth = dawn * dawn * (3 - 2 * dawn);
  if (hour >= 18.2) return duskSmooth;
  if (hour <= 6.4) return 1 - dawnSmooth;
  return 0;
}

export function poiRotationY(defaultRotationY: number, overrideRotationY?: number): number {
  return defaultRotationY + (overrideRotationY ?? 0);
}

export function poiLabelWorldHeightForScreenFont({
  distance,
  cameraFovDeg,
  canvasHeightPx
}: {
  distance: number;
  cameraFovDeg: number;
  canvasHeightPx: number;
}): { screenFontPx: number; worldHeight: number } {
  const screenFontPx = distance > 30
    ? POI_LABEL_MIN_SCREEN_FONT_PX
    : POI_LABEL_MAX_SCREEN_FONT_PX;
  const fovRad = (cameraFovDeg * Math.PI) / 180;
  const targetSpriteScreenHeightPx =
    screenFontPx * (POI_LABEL_CANVAS_HEIGHT_PX / POI_LABEL_CANVAS_FONT_PX);
  const worldHeight =
    (targetSpriteScreenHeightPx * 2 * Math.max(distance, 0.001) * Math.tan(fovRad * 0.5)) /
    Math.max(canvasHeightPx, 1);
  return { screenFontPx, worldHeight };
}

export function poiLabelCanvasWidthForText(text: string): number {
  const visibleChars = Array.from(text.slice(0, POI_LABEL_MAX_CHARS));
  const widthChars = Math.max(POI_LABEL_MIN_CHARS, visibleChars.length);
  return Math.ceil(widthChars * POI_LABEL_CANVAS_FONT_PX + POI_LABEL_HORIZONTAL_PADDING_PX);
}

function labelSprite(text: string): Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = poiLabelCanvasWidthForText(text);
  canvas.height = 104;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(250, 238, 203, 0.92)";
  ctx.fillRect(18, 18, canvas.width - 36, canvas.height - 36);
  ctx.strokeStyle = "rgba(92, 48, 22, 0.55)";
  ctx.lineWidth = 3;
  ctx.strokeRect(22, 22, canvas.width - 44, canvas.height - 44);
  ctx.strokeStyle = "rgba(255, 255, 245, 0.72)";
  ctx.lineWidth = 1;
  ctx.strokeRect(28, 28, canvas.width - 56, canvas.height - 56);
  ctx.fillStyle = "rgba(36, 26, 16, 0.94)";
  ctx.font = "700 28px Songti SC, STSong, Noto Serif CJK SC, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text.slice(0, POI_LABEL_MAX_CHARS), canvas.width / 2, canvas.height / 2);
  const texture = new CanvasTexture(canvas);
  const sprite = new Sprite(new SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false
  }));
  sprite.scale.set(0.4, 0.13, 1);
  sprite.userData.aspect = canvas.width / canvas.height;
  return sprite;
}

function isTangRedPaintMesh(mesh: Mesh): boolean {
  const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  if (!(material instanceof MeshLambertMaterial)) return false;
  const name = mesh.name.toLowerCase();
  const isArchitecturalRedPart = /wall|body|column|pillar|shaft/.test(name);
  return isArchitecturalRedPart && material.color.getHex() === TANG_PALETTE.zhuHong;
}

function tangRedPaintMaterials(root: Object3D): MeshLambertMaterial[] {
  const materials = new Set<MeshLambertMaterial>();
  root.traverse((child) => {
    if (!(child instanceof Mesh) || !isTangRedPaintMesh(child)) return;
    const material = Array.isArray(child.material) ? child.material[0] : child.material;
    if (material instanceof MeshLambertMaterial) materials.add(material);
  });
  return [...materials];
}

function applyTangRedPaintNightGlow(
  materials: readonly MeshLambertMaterial[],
  intensity01: number
): void {
  const emissiveIntensity = Math.max(0, Math.min(1, intensity01)) * TANG_RED_GLOW_MAX_INTENSITY;
  for (const material of materials) {
    material.emissive.setHex(TANG_RED_GLOW_COLOR);
    material.emissiveIntensity = emissiveIntensity;
  }
}

function poiFromObjectHierarchy(object: Object3D): PoiEntry | null {
  let cursor: Object3D | null = object;
  while (cursor) {
    const poi = cursor.userData.poi as PoiEntry | undefined;
    if (poi) return poi;
    cursor = cursor.parent;
  }
  return null;
}

function poiSort(a: PoiEntry, b: PoiEntry): number {
  return HIERARCHY_WEIGHT[a.hierarchy] - HIERARCHY_WEIGHT[b.hierarchy] ||
    a.category.localeCompare(b.category) ||
    a.id.localeCompare(b.id);
}

export function poiModelScale(
  poi: Pick<PoiEntry, "hierarchy" | "archetype"> & Partial<Pick<PoiEntry, "size" | "variant">>
): number {
  if (poi.archetype === "city") {
    if (poi.size === "medium") return LINE_B_CITY_MEDIUM_SCALE * LINE_A_POI_PREVIEW_SCALE;
    if (poi.size === "large") return LINE_B_CITY_LARGE_SCALE * LINE_A_POI_PREVIEW_SCALE;
    return LINE_B_POI_GLOBAL_SCALE * LINE_A_POI_PREVIEW_SCALE;
  }
  if (poi.archetype === "mausoleum" && poi.variant === "imperial") {
    return (LINE_B_POI_GLOBAL_SCALE / 3) * LINE_A_POI_PREVIEW_SCALE;
  }
  if (poi.archetype === "pass") {
    return (LINE_B_POI_GLOBAL_SCALE / 3) * LINE_A_POI_PREVIEW_SCALE;
  }
  if (poi.archetype === "node" && poi.variant === "tower") {
    return (LINE_B_POI_GLOBAL_SCALE / 3) * LINE_A_POI_PREVIEW_SCALE;
  }
  if (poi.archetype === "cave") {
    return (LINE_B_POI_GLOBAL_SCALE / 2) * LINE_A_POI_PREVIEW_SCALE;
  }
  return LINE_B_POI_GLOBAL_SCALE * LINE_A_POI_PREVIEW_SCALE;
}

export function createPoiArchetypeLayer(
  opts: PoiArchetypeLayerOptions
): PoiArchetypeLayerHandle {
  const group = new Group();
  group.name = "line-b-poi-archetypes";
  const entries = POI_REGISTRY
    .slice()
    .sort(poiSort)
    .slice(0, opts.maxPois ?? 180);
  const items: Array<{
    poi: PoiEntry;
    object: Object3D;
    label: Sprite;
    redPaintMaterials: MeshLambertMaterial[];
    x: number;
    z: number;
  }> = [];

  for (const poi of entries) {
    const world = projectGeoToWorld(
      { lat: poi.lat, lon: poi.lon },
      qinlingRegionBounds,
      qinlingRegionWorld
    );
    const override = POI_VISUAL_OVERRIDES[poi.id];
    const x = world.x + (override?.worldOffset?.x ?? 0);
    const z = world.z + (override?.worldOffset?.z ?? 0);
    const yRaw = opts.sampler.sampleHeightWorldCached(x, z);
    const y = Number.isFinite(yRaw) ? yRaw : 0;
    const object = resolvePoiModel(poi)();
    const scale = (override?.scale ?? 1) * poiModelScale(poi);
    const redPaintMaterials = tangRedPaintMaterials(object);
    object.position.set(x, y + (override?.yOffset ?? 0.05), z);
    object.rotation.y = poiRotationY(object.rotation.y, override?.rotationY);
    object.scale.setScalar(scale);
    object.name = `line-b-poi-${poi.id}-${object.name}`;
    object.userData.poi = poi;
    object.userData.summary = poi.summary;
    const label = labelSprite(poi.name);
    label.position.set(0, 3.2, 0);
    object.add(label);
    group.add(object);
    items.push({ poi, object, label, redPaintMaterials, x, z });
  }

  return {
    group,
    update(cameraAltitude, camera, canvasHeightPx = 900, timeOfDay = 12) {
      const showLabel = poiLabelVisibleForCameraAltitude(cameraAltitude);
      const redGlowIntensity = poiRedPaintNightGlowIntensity(timeOfDay);
      for (const item of items) {
        applyTangRedPaintNightGlow(item.redPaintMaterials, redGlowIntensity);
        item.object.visible = poiVisibleForCameraAltitude(item.poi, cameraAltitude);
        const labelDistanceWorld = camera
          ? Math.hypot(camera.position.x - item.x, camera.position.z - item.z)
          : 0;
        item.label.visible =
          POI_LABELS_VISIBLE_BY_DEFAULT &&
          item.object.visible &&
          showLabel &&
          poiLabelVisibleForWorldDistance(labelDistanceWorld);
        if (camera && item.label.visible) {
          item.label.getWorldPosition(poiLabelWorldPosition);
          const distance = camera.position.distanceTo(poiLabelWorldPosition);
          const { worldHeight } = poiLabelWorldHeightForScreenFont({
            distance,
            cameraFovDeg: camera.fov,
            canvasHeightPx
          });
          const parentScale = Math.max(item.object.scale.y, 0.001);
          const localHeight = worldHeight / parentScale;
          const aspect = (item.label.userData.aspect as number | undefined) ?? 3.08;
          item.label.scale.set(localHeight * aspect, localHeight, 1);
        }
      }
    },
    nearestPoi(x, z, maxDistance = 8) {
      let best: PoiEntry | null = null;
      let bestDistance = maxDistance;
      for (const item of items) {
        if (!item.object.visible) continue;
        const d = Math.hypot(item.x - x, item.z - z);
        if (d < bestDistance) {
          bestDistance = d;
          best = item.poi;
        }
      }
      return best;
    },
    hoveredPoiAt(pointerNdc, camera) {
      const visibleObjects = items
        .filter((item) => item.object.visible)
        .map((item) => item.object);
      poiLabelRaycaster.setFromCamera(pointerNdc, camera);
      const intersections = poiLabelRaycaster.intersectObjects(visibleObjects, true);
      for (const intersection of intersections) {
        const poi = poiFromObjectHierarchy(intersection.object);
        if (poi) return poi;
      }
      return null;
    },
    dispose() {
      group.traverse((obj) => {
        const mesh = obj as Mesh;
        mesh.geometry?.dispose();
        const mat = mesh.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose();
      });
    }
  };
}
