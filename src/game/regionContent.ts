import { Vector2 } from "three";

import type { KnowledgeFragment } from "../data/fragments";
import type { Landmark, LandmarkKind } from "../data/qinlingSlice";
import { qinlingRegionBounds, qinlingRegionWorld } from "../data/qinlingRegion.js";
import { projectGeoToWorld } from "./mapOrientation.js";
import type { StoryBeat } from "./storyGuide";

// content.json 里的 position 可以是 (a) 旧格式 {x, y}（世界坐标）或
// (b) 新格式 {lat, lon}（地理坐标，运行期投到当前 bounds）。validatePoint2
// 同时接受两种，{lat, lon} 优先——新数据用，旧数据迁移期间也能跑。
interface RawPoint2 {
  x?: number;
  y?: number;
  lat?: number;
  lon?: number;
}

interface RawLandmark {
  name: string;
  kind: LandmarkKind;
  subKind?: string;
  position: RawPoint2;
  description: string;
}

interface RawFragmentDetails {
  geo: string;
  history: string;
  strategy: string;
}

interface RawKnowledgeFragment {
  id: string;
  title: string;
  zone: string;
  position: RawPoint2;
  pickupLine: string;
  details: RawFragmentDetails;
}

interface RawStoryBeat {
  id: string;
  title: string;
  guidance: string;
  completionLine: string;
  target: RawPoint2;
  completionRadius: number;
  requiredFragmentId?: string;
}

interface RegionPoiManifestLike {
  id: string;
  type: "region-poi-manifest";
  version: number;
  regionId: string;
  file: string;
}

interface RawRegionContent {
  routeStart: RawPoint2;
  landmarks: RawLandmark[];
  fragments: RawKnowledgeFragment[];
  storyBeats?: RawStoryBeat[];
}

export interface LoadedRegionContent {
  routeStart: Vector2;
  landmarks: Landmark[];
  knowledgeFragments: KnowledgeFragment[];
  storyBeats?: StoryBeat[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Region content field "${fieldName}" must be a non-empty string.`);
  }

  return value;
}

function asFiniteNumber(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Region content field "${fieldName}" must be a finite number.`);
  }

  return value;
}

function validatePoint2(raw: unknown, fieldName: string): Vector2 {
  if (!isRecord(raw)) {
    throw new Error(`Region content field "${fieldName}" must be an object.`);
  }

  // 优先 lat/lon（新格式）。投到当前 region 的世界坐标——bounds 改了，
  // 旧 position 自动跟着重新投影，避免 hardcoded 漂移。
  if (typeof raw.lat === "number" && typeof raw.lon === "number") {
    const wp = projectGeoToWorld(
      { lat: raw.lat, lon: raw.lon },
      qinlingRegionBounds,
      qinlingRegionWorld
    );
    return new Vector2(wp.x, wp.z);
  }

  return new Vector2(
    asFiniteNumber(raw.x, `${fieldName}.x`),
    asFiniteNumber(raw.y, `${fieldName}.y`)
  );
}

function isPoiManifestLike(raw: unknown): raw is RegionPoiManifestLike {
  return isRecord(raw) && raw.type === "region-poi-manifest";
}

function resolveRelativeUrl(baseUrl: string, relativePath: string): string {
  return new URL(relativePath, new URL(baseUrl, window.location.href)).toString();
}

function validateLandmark(raw: unknown, index: number): Landmark {
  if (!isRecord(raw)) {
    throw new Error(`Landmark ${index} must be an object.`);
  }

  return {
    name: asString(raw.name, `landmarks[${index}].name`),
    kind: asString(raw.kind, `landmarks[${index}].kind`) as LandmarkKind,
    subKind:
      raw.subKind === undefined ? undefined : asString(raw.subKind, `landmarks[${index}].subKind`),
    position: validatePoint2(raw.position, `landmarks[${index}].position`),
    description: asString(raw.description, `landmarks[${index}].description`)
  };
}

function validateFragment(raw: unknown, index: number): KnowledgeFragment {
  if (!isRecord(raw)) {
    throw new Error(`Fragment ${index} must be an object.`);
  }

  if (!isRecord(raw.details)) {
    throw new Error(`Fragment ${index} details must be an object.`);
  }

  return {
    id: asString(raw.id, `fragments[${index}].id`),
    title: asString(raw.title, `fragments[${index}].title`),
    zone: asString(raw.zone, `fragments[${index}].zone`),
    position: validatePoint2(raw.position, `fragments[${index}].position`),
    pickupLine: asString(raw.pickupLine, `fragments[${index}].pickupLine`),
    details: {
      geo: asString(raw.details.geo, `fragments[${index}].details.geo`),
      history: asString(raw.details.history, `fragments[${index}].details.history`),
      strategy: asString(raw.details.strategy, `fragments[${index}].details.strategy`)
    }
  };
}

function validateStoryBeat(raw: unknown, index: number): StoryBeat {
  if (!isRecord(raw)) {
    throw new Error(`Story beat ${index} must be an object.`);
  }

  const requiredFragmentId =
    raw.requiredFragmentId === undefined
      ? undefined
      : asString(raw.requiredFragmentId, `storyBeats[${index}].requiredFragmentId`);

  return {
    id: asString(raw.id, `storyBeats[${index}].id`),
    title: asString(raw.title, `storyBeats[${index}].title`),
    guidance: asString(raw.guidance, `storyBeats[${index}].guidance`),
    completionLine: asString(raw.completionLine, `storyBeats[${index}].completionLine`),
    target: validatePoint2(raw.target, `storyBeats[${index}].target`),
    completionRadius: asFiniteNumber(
      raw.completionRadius,
      `storyBeats[${index}].completionRadius`
    ),
    requiredFragmentId
  };
}

function validateRegionContent(raw: unknown): LoadedRegionContent {
  if (!isRecord(raw)) {
    throw new Error("Region content payload must be a JSON object.");
  }

  if (!Array.isArray(raw.landmarks)) {
    throw new Error('Region content field "landmarks" must be an array.');
  }

  if (!Array.isArray(raw.fragments)) {
    throw new Error('Region content field "fragments" must be an array.');
  }

  return {
    routeStart: validatePoint2(raw.routeStart, "routeStart"),
    landmarks: raw.landmarks.map(validateLandmark),
    knowledgeFragments: raw.fragments.map(validateFragment),
    storyBeats: Array.isArray(raw.storyBeats)
      ? raw.storyBeats.map(validateStoryBeat)
      : undefined
  };
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to load region content from ${url} (${response.status}).`);
  }

  return (await response.json()) as unknown;
}

export async function loadRegionContent(poiManifestUrl: string): Promise<LoadedRegionContent> {
  const rawManifest = await fetchJson(poiManifestUrl);

  if (!isPoiManifestLike(rawManifest)) {
    throw new Error("Unsupported region POI manifest format.");
  }

  const contentFile = asString(rawManifest.file, "file");
  const contentUrl = resolveRelativeUrl(poiManifestUrl, contentFile);

  return validateRegionContent(await fetchJson(contentUrl));
}
