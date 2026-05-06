import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Mesh,
  SphereGeometry,
  Vector2,
  type BufferGeometry,
  type MeshPhongMaterial
} from "three";

export type ScenicPoiRole =
  | "alpine-peak"
  | "religious-mountain"
  | "karst-lake-system"
  | "buddhist-relic"
  | "imperial-mausoleum"
  | "travertine-terraces"
  | "karst-sinkhole";

export interface ScenicPoiMaterials {
  alpineRock: MeshPhongMaterial;
  alpineSnow: MeshPhongMaterial;
  forestGreen: MeshPhongMaterial;
  pavilionWall: MeshPhongMaterial;
  pavilionRoof: MeshPhongMaterial;
  karstWater: MeshPhongMaterial;
  karstTree: MeshPhongMaterial;
  pagodaWall: MeshPhongMaterial;
  pagodaBaseStone: MeshPhongMaterial;
  mausoleumEarth: MeshPhongMaterial;
  mausoleumStele: MeshPhongMaterial;
  travertineGold: MeshPhongMaterial;
  tiankengWell: MeshPhongMaterial;
  tiankengRim: MeshPhongMaterial;
}

interface ScenicPoiPieceSpec {
  geometry: BufferGeometry;
  material: keyof ScenicPoiMaterials;
  name: string;
  offset: [number, number, number];
}

const scenicPoiGeometries = {
  alpinePeakBody: new ConeGeometry(5.5, 8, 8),
  alpineSnowCap: new ConeGeometry(2.2, 2.8, 8),
  forestPeakDome: new SphereGeometry(4.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
  forestPavilion: new BoxGeometry(1.2, 0.6, 1.2),
  forestPavilionRoof: new ConeGeometry(0.95, 0.6, 4),
  karstPool: new CylinderGeometry(0.6, 0.6, 0.12, 20),
  karstPoolSmall: new CylinderGeometry(0.4, 0.4, 0.1, 16),
  karstFringeTree: new ConeGeometry(0.16, 0.5, 5),
  pagodaBase: new BoxGeometry(0.8, 0.18, 0.8),
  pagodaTier1: new BoxGeometry(0.65, 0.27, 0.65),
  pagodaTier2: new BoxGeometry(0.58, 0.27, 0.58),
  pagodaTier3: new BoxGeometry(0.49, 0.27, 0.49),
  pagodaTier4: new BoxGeometry(0.4, 0.27, 0.4),
  pagodaSpire: new ConeGeometry(0.18, 0.55, 6),
  mausoleumMound: new SphereGeometry(1.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
  mausoleumStele: new BoxGeometry(0.18, 0.85, 0.07),
  travertineDisk1: new CylinderGeometry(0.7, 0.7, 0.08, 20),
  travertineDisk2: new CylinderGeometry(0.6, 0.6, 0.08, 18),
  travertineDisk3: new CylinderGeometry(0.5, 0.5, 0.08, 16),
  travertineDisk4: new CylinderGeometry(0.42, 0.42, 0.08, 14),
  travertineDisk5: new CylinderGeometry(0.33, 0.33, 0.08, 12),
  travertineDisk6: new CylinderGeometry(0.25, 0.25, 0.08, 10),
  tiankengWell: new CylinderGeometry(0.7, 0.7, 0.1, 20),
  tiankengRimOuter: new CylinderGeometry(1.0, 1.0, 0.16, 18),
  tiankengRimInner: new CylinderGeometry(0.75, 0.75, 0.18, 18)
};

export const scenicPoiLabelHeights: Record<ScenicPoiRole, number> = {
  "alpine-peak": 1.9,
  "religious-mountain": 1.7,
  "karst-lake-system": 1.6,
  "buddhist-relic": 1.8,
  "imperial-mausoleum": 1.65,
  "travertine-terraces": 1.5,
  "karst-sinkhole": 1.5
};

const scenicPoiPieceSpecs: Record<ScenicPoiRole, ScenicPoiPieceSpec[]> = {
  "alpine-peak": [],
  "religious-mountain": [],
  "karst-lake-system": [
    {
      geometry: scenicPoiGeometries.karstPool,
      material: "karstWater",
      name: "scenic-karst-pool-main",
      offset: [0, 0.06, 0]
    },
    {
      geometry: scenicPoiGeometries.karstPoolSmall,
      material: "karstWater",
      name: "scenic-karst-pool-east",
      offset: [0.85, 0.05, 0.4]
    },
    {
      geometry: scenicPoiGeometries.karstPoolSmall,
      material: "karstWater",
      name: "scenic-karst-pool-west",
      offset: [-0.7, 0.05, -0.5]
    },
    {
      geometry: scenicPoiGeometries.karstFringeTree,
      material: "karstTree",
      name: "scenic-karst-tree-nw",
      offset: [-0.45, 0.25, 0.35]
    },
    {
      geometry: scenicPoiGeometries.karstFringeTree,
      material: "karstTree",
      name: "scenic-karst-tree-ne",
      offset: [0.55, 0.25, 0.28]
    },
    {
      geometry: scenicPoiGeometries.karstFringeTree,
      material: "karstTree",
      name: "scenic-karst-tree-sw",
      offset: [-0.9, 0.25, -0.1]
    },
    {
      geometry: scenicPoiGeometries.karstFringeTree,
      material: "karstTree",
      name: "scenic-karst-tree-se",
      offset: [0.78, 0.25, -0.72]
    }
  ],
  "buddhist-relic": [
    {
      geometry: scenicPoiGeometries.pagodaBase,
      material: "pagodaBaseStone",
      name: "scenic-pagoda-base",
      offset: [0, 0.09, 0]
    },
    {
      geometry: scenicPoiGeometries.pagodaTier1,
      material: "pagodaWall",
      name: "scenic-pagoda-tier-1",
      offset: [0, 0.315, 0]
    },
    {
      geometry: scenicPoiGeometries.pagodaTier2,
      material: "pagodaWall",
      name: "scenic-pagoda-tier-2",
      offset: [0, 0.555, 0]
    },
    {
      geometry: scenicPoiGeometries.pagodaTier3,
      material: "pagodaWall",
      name: "scenic-pagoda-tier-3",
      offset: [0, 0.795, 0]
    },
    {
      geometry: scenicPoiGeometries.pagodaTier4,
      material: "pagodaWall",
      name: "scenic-pagoda-tier-4",
      offset: [0, 1.035, 0]
    },
    {
      geometry: scenicPoiGeometries.pagodaSpire,
      material: "pagodaWall",
      name: "scenic-pagoda-spire",
      offset: [0, 1.28, 0]
    }
  ],
  "imperial-mausoleum": [
    {
      geometry: scenicPoiGeometries.mausoleumMound,
      material: "mausoleumEarth",
      name: "scenic-mausoleum-mound",
      offset: [0, 0, 0]
    },
    {
      geometry: scenicPoiGeometries.mausoleumStele,
      material: "mausoleumStele",
      name: "scenic-mausoleum-stele-west",
      offset: [-0.45, 0.425, 1.35]
    },
    {
      geometry: scenicPoiGeometries.mausoleumStele,
      material: "mausoleumStele",
      name: "scenic-mausoleum-stele-east",
      offset: [0.45, 0.425, 1.35]
    }
  ],
  "travertine-terraces": [
    {
      geometry: scenicPoiGeometries.travertineDisk1,
      material: "travertineGold",
      name: "scenic-travertine-1",
      offset: [0, 0.04, 0]
    },
    {
      geometry: scenicPoiGeometries.travertineDisk2,
      material: "travertineGold",
      name: "scenic-travertine-2",
      offset: [0, 0.12, 0]
    },
    {
      geometry: scenicPoiGeometries.travertineDisk3,
      material: "travertineGold",
      name: "scenic-travertine-3",
      offset: [0, 0.2, 0]
    },
    {
      geometry: scenicPoiGeometries.travertineDisk4,
      material: "travertineGold",
      name: "scenic-travertine-4",
      offset: [0, 0.28, 0]
    },
    {
      geometry: scenicPoiGeometries.travertineDisk5,
      material: "travertineGold",
      name: "scenic-travertine-5",
      offset: [0, 0.36, 0]
    },
    {
      geometry: scenicPoiGeometries.travertineDisk6,
      material: "travertineGold",
      name: "scenic-travertine-6",
      offset: [0, 0.44, 0]
    }
  ],
  "karst-sinkhole": [
    {
      geometry: scenicPoiGeometries.tiankengWell,
      material: "tiankengWell",
      name: "scenic-tiankeng-well",
      offset: [0, -0.05, 0]
    },
    {
      geometry: scenicPoiGeometries.tiankengRimOuter,
      material: "tiankengRim",
      name: "scenic-tiankeng-rim-outer",
      offset: [0, 0.08, 0]
    },
    {
      geometry: scenicPoiGeometries.tiankengRimInner,
      material: "tiankengWell",
      name: "scenic-tiankeng-rim-inner",
      offset: [0, 0.09, 0]
    }
  ]
};

export function buildScenicPoiMeshes({
  chunkId,
  ground = 0,
  materials,
  position,
  role
}: {
  chunkId: string | null;
  ground?: number;
  materials: ScenicPoiMaterials;
  position: Vector2;
  role: ScenicPoiRole;
}): Mesh[] {
  // 未知 role（譬如 east-extend 加入但还没单独建模的 lake-system / ancient-tower /
  // battlefield）fallback 到 alpine-peak 视觉，避免 .map(undefined) 崩溃。
  const specs = scenicPoiPieceSpecs[role] ?? scenicPoiPieceSpecs["alpine-peak"];
  return specs.map((spec) => {
    const piece = new Mesh(spec.geometry, materials[spec.material]);
    piece.name = spec.name;
    piece.position.set(
      position.x + spec.offset[0],
      ground + spec.offset[1],
      position.y + spec.offset[2]
    );
    piece.userData.chunkId = chunkId;
    piece.userData.sharedResources = true;
    piece.userData.terrainYOffset = spec.offset[1];
    return piece;
  });
}
