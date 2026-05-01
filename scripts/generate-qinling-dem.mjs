import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const outputPath = path.join(root, "public", "data", "qinling-slice-dem.json");

const world = {
  width: 180,
  depth: 240
};

const grid = {
  columns: 129,
  rows: 171
};

function smoothBell(x, z, cx, cz, sx, sz) {
  const dx = (x - cx) / sx;
  const dz = (z - cz) / sz;
  return Math.exp(-(dx * dx + dz * dz));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(value, min, max) {
  if (min === max) {
    return value < min ? 0 : 1;
  }

  const t = clamp((value - min) / (max - min), 0, 1);
  return t * t * (3 - 2 * t);
}

function ridge(x, z, start, end, width) {
  const px = end.x - start.x;
  const pz = end.z - start.z;
  const lengthSq = px * px + pz * pz;
  const t = clamp(((x - start.x) * px + (z - start.z) * pz) / lengthSq, 0, 1);
  const cx = start.x + px * t;
  const cz = start.z + pz * t;
  const distance = Math.hypot(x - cx, z - cz);
  return Math.exp(-Math.pow(distance / width, 2));
}

function riverValue(x, z) {
  const wei = ridge(x, z, { x: -82, z: 82 }, { x: 70, z: 78 }, 6);
  const han = ridge(x, z, { x: -60, z: -22 }, { x: 58, z: -26 }, 5);
  const jialing = ridge(x, z, { x: 18, z: -10 }, { x: -16, z: -110 }, 5);
  const min = ridge(x, z, { x: -54, z: -116 }, { x: -44, z: -84 }, 4);
  return Math.max(wei * 0.74, han, jialing * 0.92, min * 0.8);
}

function passValue(x, z) {
  return Math.max(
    smoothBell(x, z, -48, 34, 10, 10),
    smoothBell(x, z, 18, 10, 10, 10),
    smoothBell(x, z, 8, -84, 12, 10)
  );
}

function terrainHeight(x, z) {
  const northUplands = smoothBell(x, z, -10, 98, 120, 48) * 7;
  const guanzhongPlain = smoothBell(x, z, 0, 80, 88, 22) * -8;
  const qinlingWall = ridge(x, z, { x: -90, z: 26 }, { x: 90, z: 8 }, 13) * 22;
  const westQinling = smoothBell(x, z, -48, 24, 34, 22) * 10;
  const taibai = smoothBell(x, z, 4, 18, 18, 16) * 13;
  const qinlingPasses =
    smoothBell(x, z, -48, 34, 10, 10) * -11 +
    smoothBell(x, z, 18, 10, 11, 11) * -10;
  const hanzhongBasin = smoothBell(x, z, 4, -22, 72, 20) * -12;
  const bashan = ridge(x, z, { x: -88, z: -40 }, { x: 88, z: -54 }, 15) * 12;
  const micang = ridge(x, z, { x: -84, z: -72 }, { x: 74, z: -86 }, 12) * 10;
  const southernPass = smoothBell(x, z, 8, -84, 14, 12) * -8;
  const sichuanBasin = smoothBell(x, z, -8, -100, 96, 40) * -13;
  const chengduPlain = smoothBell(x, z, -48, -104, 28, 16) * -7;
  const westernRim = smoothBell(x, z, -70, -90, 26, 34) * 7;
  const rivers = riverValue(x, z) * -4.2;

  const edgeFadeX = smoothstep(world.width * 0.5 - Math.abs(x), 0, 18);
  const edgeFadeZ = smoothstep(world.depth * 0.5 - Math.abs(z), 0, 18);
  const edgeLift = (1 - Math.min(edgeFadeX, edgeFadeZ)) * -2.8;

  return (
    northUplands +
    guanzhongPlain +
    qinlingWall +
    westQinling +
    taibai +
    qinlingPasses +
    hanzhongBasin +
    bashan +
    micang +
    southernPass +
    sichuanBasin +
    chengduPlain +
    westernRim +
    rivers +
    edgeLift
  );
}

function sampleSlope(x, z) {
  const delta = 0.75;
  const dx = terrainHeight(x + delta, z) - terrainHeight(x - delta, z);
  const dz = terrainHeight(x, z + delta) - terrainHeight(x, z - delta);
  return Math.min(Math.hypot(dx, dz) / 4.2, 1);
}

function settlementValue(x, z) {
  const basin = Math.max(
    smoothBell(x, z, 0, 80, 88, 22),
    smoothBell(x, z, 4, -22, 72, 20),
    smoothBell(x, z, -48, -104, 28, 16)
  );
  const height = terrainHeight(x, z);
  const slope = sampleSlope(x, z);
  const normalizedHeight = clamp((height + 18) / 52, 0, 1);
  return clamp(
    0.84 - normalizedHeight * 0.4 - slope * 0.85 + riverValue(x, z) * 0.52 + basin * 0.28,
    0,
    1
  );
}

const heights = [];
const riverMask = [];
const passMask = [];
const settlementMask = [];

let minHeight = Number.POSITIVE_INFINITY;
let maxHeight = Number.NEGATIVE_INFINITY;

for (let row = 0; row < grid.rows; row += 1) {
  const v = row / (grid.rows - 1);
  const z = world.depth * 0.5 - v * world.depth;

  for (let column = 0; column < grid.columns; column += 1) {
    const u = column / (grid.columns - 1);
    const x = -world.width * 0.5 + u * world.width;
    const height = terrainHeight(x, z);
    const river = riverValue(x, z);
    const pass = passValue(x, z);
    const settlement = settlementValue(x, z);

    heights.push(Number(height.toFixed(3)));
    riverMask.push(Number(river.toFixed(4)));
    passMask.push(Number(pass.toFixed(4)));
    settlementMask.push(Number(settlement.toFixed(4)));

    minHeight = Math.min(minHeight, height);
    maxHeight = Math.max(maxHeight, height);
  }
}

const asset = {
  name: "qinling-slice-prototype",
  sourceType: "procedural-placeholder-for-dem",
  generatedAt: new Date().toISOString(),
  world,
  grid,
  minHeight: Number(minHeight.toFixed(3)),
  maxHeight: Number(maxHeight.toFixed(3)),
  heights,
  riverMask,
  passMask,
  settlementMask,
  notes: [
    "This asset mirrors the current gameplay-facing Qinling slice.",
    "Replace this generated placeholder with processed DEM data in the next phase."
  ]
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(asset, null, 2)}\n`, "utf8");

console.log(`Generated ${outputPath}`);
