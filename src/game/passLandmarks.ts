import {
  BoxGeometry,
  ConeGeometry,
  Mesh,
  type BufferGeometry,
  type MeshPhongMaterial
} from "three";

export type PassLandmarkSubKind = "major-pass" | "gorge-pass" | "memorial-stele";

export interface PassLandmarkMaterials {
  body: MeshPhongMaterial;
  accent: MeshPhongMaterial;
}

interface PassLandmarkPieceSpec {
  geometry: BufferGeometry;
  material: keyof PassLandmarkMaterials;
  name: string;
  offset: [number, number, number];
  rotation?: [number, number, number];
}

export const passLandmarkGeometries = {
  stele: new BoxGeometry(0.7, 2.1, 0.22),
  steleBase: new BoxGeometry(0.95, 0.32, 0.4),
  steleCap: new BoxGeometry(0.85, 0.18, 0.32),
  majorPass: {
    base: new BoxGeometry(0.72, 0.12, 0.42),
    lowerWallSide: new BoxGeometry(0.22, 0.35, 0.36),
    upperTower: new BoxGeometry(0.46, 0.36, 0.29),
    eaveCorner: new ConeGeometry(0.06, 0.16, 4)
  },
  gorgePass: {
    centerTower: new BoxGeometry(1.0, 1.3, 0.82),
    centerCap: new ConeGeometry(0.72, 0.75, 4),
    flankWall: new BoxGeometry(1.4, 0.5, 0.5)
  }
};

interface PassLandmarkBuildOptions {
  chunkId: string | null;
  ground?: number;
  materials: PassLandmarkMaterials;
  position: {
    x: number;
    y: number;
  };
  subKind?: string;
}

export function resolvePassLandmarkSubKind(subKind?: string): PassLandmarkSubKind {
  if (subKind === "major-pass") {
    return "major-pass";
  }
  if (subKind === "memorial-stele") {
    return "memorial-stele";
  }
  if (subKind === undefined || subKind === "gorge-pass") {
    return "gorge-pass";
  }
  return "memorial-stele";
}

function passLandmarkPieceSpecs(subKind: PassLandmarkSubKind): PassLandmarkPieceSpec[] {
  if (subKind === "major-pass") {
    return [
      {
        geometry: passLandmarkGeometries.majorPass.base,
        material: "accent",
        name: "pass-major-base",
        offset: [0, 0.06, 0]
      },
      {
        geometry: passLandmarkGeometries.majorPass.lowerWallSide,
        material: "accent",
        name: "pass-major-lower-wall-west",
        offset: [-0.192, 0.294, 0]
      },
      {
        geometry: passLandmarkGeometries.majorPass.lowerWallSide,
        material: "accent",
        name: "pass-major-lower-wall-east",
        offset: [0.192, 0.294, 0]
      },
      {
        geometry: passLandmarkGeometries.majorPass.upperTower,
        material: "body",
        name: "pass-major-upper-tower",
        offset: [0, 0.645, 0]
      },
      {
        geometry: passLandmarkGeometries.majorPass.eaveCorner,
        material: "body",
        name: "pass-major-eave-nw",
        offset: [-0.189, 0.948, -0.102],
        rotation: [0.18, Math.PI * 0.25, -0.16]
      },
      {
        geometry: passLandmarkGeometries.majorPass.eaveCorner,
        material: "body",
        name: "pass-major-eave-ne",
        offset: [0.189, 0.948, -0.102],
        rotation: [0.18, Math.PI * 0.25, 0.16]
      },
      {
        geometry: passLandmarkGeometries.majorPass.eaveCorner,
        material: "body",
        name: "pass-major-eave-sw",
        offset: [-0.189, 0.948, 0.102],
        rotation: [-0.18, Math.PI * 0.25, -0.16]
      },
      {
        geometry: passLandmarkGeometries.majorPass.eaveCorner,
        material: "body",
        name: "pass-major-eave-se",
        offset: [0.189, 0.948, 0.102],
        rotation: [-0.18, Math.PI * 0.25, 0.16]
      }
    ];
  }

  if (subKind === "gorge-pass") {
    return [
      {
        geometry: passLandmarkGeometries.gorgePass.centerTower,
        material: "body",
        name: "pass-gorge-center-tower",
        offset: [0, 1.05, 0]
      },
      {
        geometry: passLandmarkGeometries.gorgePass.centerCap,
        material: "accent",
        name: "pass-gorge-center-cap",
        offset: [0, 2.23, 0],
        rotation: [0, Math.PI * 0.25, 0]
      },
      {
        geometry: passLandmarkGeometries.gorgePass.flankWall,
        material: "accent",
        name: "pass-gorge-flank-west",
        offset: [-1.02, 0.45, 0]
      },
      {
        geometry: passLandmarkGeometries.gorgePass.flankWall,
        material: "accent",
        name: "pass-gorge-flank-east",
        offset: [1.02, 0.45, 0]
      }
    ];
  }

  return [
    {
      geometry: passLandmarkGeometries.steleBase,
      material: "accent",
      name: "pass-memorial-base",
      offset: [0, 0.16, 0]
    },
    {
      geometry: passLandmarkGeometries.stele,
      material: "body",
      name: "pass-memorial-stele",
      offset: [0, 1.37, 0]
    },
    {
      geometry: passLandmarkGeometries.steleCap,
      material: "accent",
      name: "pass-memorial-cap",
      offset: [0, 2.41, 0]
    }
  ];
}

export function buildPassLandmarkMeshes({
  chunkId,
  ground = 0,
  materials,
  position,
  subKind
}: PassLandmarkBuildOptions): Mesh[] {
  const resolvedSubKind = resolvePassLandmarkSubKind(subKind);
  return passLandmarkPieceSpecs(resolvedSubKind).map((spec) => {
    const piece = new Mesh(spec.geometry, materials[spec.material]);
    piece.name = spec.name;
    piece.position.set(
      position.x + spec.offset[0],
      ground + spec.offset[1],
      position.y + spec.offset[2]
    );
    if (spec.rotation) {
      piece.rotation.set(spec.rotation[0], spec.rotation[1], spec.rotation[2]);
    }
    piece.userData.chunkId = chunkId;
    piece.userData.sharedResources = true;
    piece.userData.terrainYOffset = spec.offset[1];
    return piece;
  });
}
