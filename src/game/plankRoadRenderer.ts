import {
  BoxGeometry,
  Group,
  InstancedMesh,
  MeshPhongMaterial,
  Object3D
} from "three";

import type { TerrainSampler } from "./demSampler";

const DEFAULT_PLANK_SPACING = 0.4;
const DEFAULT_LIFT_ABOVE_GROUND = 0.18;
const PLANK_SIZE = Object.freeze({
  x: 0.5,
  y: 0.04,
  z: 0.18
});
const POST_SIZE = Object.freeze({
  x: 0.04,
  y: 0.4,
  z: 0.04
});
const POST_INTERVAL = 2;
const POST_PAIR_OFFSET = 0.16;
const EPSILON = 1e-6;

const plankGeometry = new BoxGeometry(PLANK_SIZE.x, PLANK_SIZE.y, PLANK_SIZE.z);
const postGeometry = new BoxGeometry(POST_SIZE.x, POST_SIZE.y, POST_SIZE.z);

const plankMaterial = new MeshPhongMaterial({
  color: 0x6b4a2a,
  flatShading: true,
  shininess: 10
});
const postMaterial = new MeshPhongMaterial({
  color: 0x4d3520,
  flatShading: true,
  shininess: 6
});

interface RoutePoint {
  x: number;
  y: number;
}

interface PlankSlot {
  position: { x: number; z: number };
  tangentRad: number;
}

interface SegmentSample {
  start: { x: number; z: number };
  end: { x: number; z: number };
  length: number;
  tangentRad: number;
}

export interface PlankRoadHandle {
  group: Group;
  plankMesh: InstancedMesh;
  postMesh: InstancedMesh;
  plankCount: number;
  postCount: number;
}

export interface PlankRoadInput {
  points: Array<{ x: number; y: number }>;
  sampler: TerrainSampler;
  plankSpacing?: number;
  liftAboveGround?: number;
}

function buildSegments(points: RoutePoint[]): SegmentSample[] {
  const segments: SegmentSample[] = [];

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const dx = end.x - start.x;
    const dz = end.y - start.y;
    const length = Math.hypot(dx, dz);

    if (length <= EPSILON) {
      continue;
    }

    segments.push({
      start: { x: start.x, z: start.y },
      end: { x: end.x, z: end.y },
      length,
      tangentRad: Math.atan2(dz, dx)
    });
  }

  return segments;
}

function plankCountForLength(totalLength: number, plankSpacing: number): number {
  if (totalLength <= EPSILON) {
    return 0;
  }

  return Math.floor(totalLength / plankSpacing) + 1;
}

function densifyPathToPlanks(
  points: RoutePoint[],
  plankSpacing = DEFAULT_PLANK_SPACING
): PlankSlot[] {
  const spacing = plankSpacing > EPSILON ? plankSpacing : DEFAULT_PLANK_SPACING;
  const segments = buildSegments(points);

  if (segments.length === 0) {
    return [];
  }

  const totalLength = segments.reduce((sum, segment) => sum + segment.length, 0);
  const slots: PlankSlot[] = [];
  let segmentIndex = 0;
  let segmentStartDistance = 0;
  let segmentEndDistance = segments[0]!.length;

  for (let slotIndex = 0; slotIndex < plankCountForLength(totalLength, spacing); slotIndex += 1) {
    const distance = Math.min(slotIndex * spacing, totalLength);

    while (
      segmentIndex < segments.length - 1 &&
      distance > segmentEndDistance - EPSILON
    ) {
      segmentIndex += 1;
      segmentStartDistance = segmentEndDistance;
      segmentEndDistance += segments[segmentIndex]!.length;
    }

    const segment = segments[segmentIndex]!;
    const localDistance = Math.max(0, Math.min(segment.length, distance - segmentStartDistance));
    const t = segment.length <= EPSILON ? 0 : localDistance / segment.length;

    slots.push({
      position: {
        x: segment.start.x + (segment.end.x - segment.start.x) * t,
        z: segment.start.z + (segment.end.z - segment.start.z) * t
      },
      tangentRad: segment.tangentRad
    });
  }

  return slots;
}

function createInstancedMesh(
  geometry: BoxGeometry,
  material: MeshPhongMaterial,
  count: number,
  name: string
): InstancedMesh {
  const mesh = new InstancedMesh(geometry, material, Math.max(count, 1));
  mesh.name = name;
  mesh.count = count;
  mesh.visible = count > 0;
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  return mesh;
}

function buildHandleFromSlots(
  slotsByRoute: PlankSlot[][],
  sampler: Pick<TerrainSampler, "sampleSurfaceHeight">,
  liftAboveGround: number
): PlankRoadHandle {
  const plankCount = slotsByRoute.reduce((sum, slots) => sum + slots.length, 0);
  const postCount = slotsByRoute.reduce(
    (sum, slots) => sum + Math.ceil(slots.length / POST_INTERVAL) * 2,
    0
  );
  const group = new Group();
  group.name = "plank-road";
  const plankMesh = createInstancedMesh(plankGeometry, plankMaterial, plankCount, "plank-road-deck");
  const postMesh = createInstancedMesh(postGeometry, postMaterial, postCount, "plank-road-posts");
  const dummy = new Object3D();
  let plankIndex = 0;
  let postIndex = 0;

  slotsByRoute.forEach((slots) => {
    slots.forEach((slot, slotIndex) => {
      const plankY =
        sampler.sampleSurfaceHeight(slot.position.x, slot.position.z) + liftAboveGround;
      const cos = Math.cos(slot.tangentRad);
      const sin = Math.sin(slot.tangentRad);

      dummy.position.set(slot.position.x, plankY, slot.position.z);
      dummy.rotation.set(0, -slot.tangentRad, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      plankMesh.setMatrixAt(plankIndex, dummy.matrix);
      plankIndex += 1;

      if (slotIndex % POST_INTERVAL !== 0) {
        return;
      }

      [-POST_PAIR_OFFSET, POST_PAIR_OFFSET].forEach((offset) => {
        dummy.position.set(
          slot.position.x + cos * offset,
          plankY - POST_SIZE.y * 0.5,
          slot.position.z + sin * offset
        );
        dummy.rotation.set(0, -slot.tangentRad, 0);
        dummy.updateMatrix();
        postMesh.setMatrixAt(postIndex, dummy.matrix);
        postIndex += 1;
      });
    });
  });

  plankMesh.instanceMatrix.needsUpdate = true;
  postMesh.instanceMatrix.needsUpdate = true;
  plankMesh.renderOrder = 11;
  postMesh.renderOrder = 10;
  group.add(postMesh);
  group.add(plankMesh);

  return {
    group,
    plankMesh,
    postMesh,
    plankCount,
    postCount
  };
}

export function buildPlankRoad(input: PlankRoadInput): PlankRoadHandle {
  return buildPlankRoadNetwork([input]);
}

export function buildPlankRoadNetwork(inputs: PlankRoadInput[]): PlankRoadHandle {
  const slotsByRoute = inputs.map((input) =>
    densifyPathToPlanks(input.points, input.plankSpacing ?? DEFAULT_PLANK_SPACING)
  );
  const firstInput = inputs[0];
  const liftAboveGround = firstInput?.liftAboveGround ?? DEFAULT_LIFT_ABOVE_GROUND;
  const sampler = firstInput?.sampler;

  if (!sampler) {
    return buildHandleFromSlots([], { sampleSurfaceHeight: () => 0 }, liftAboveGround);
  }

  return buildHandleFromSlots(slotsByRoute, sampler, liftAboveGround);
}

export function disposePlankRoad(handle: PlankRoadHandle): void {
  handle.group.clear();
  handle.plankMesh.count = 0;
  handle.postMesh.count = 0;
}
