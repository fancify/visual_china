import { qinlingBounds } from "./qinling-dem-common.mjs";

const WATERWAY_FILTER = '["waterway"~"^(river|stream|canal)$"]';

function parseNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return number;
}

export function parseBbox(value, fallbackBounds = qinlingBounds) {
  if (!value) {
    return {
      south: fallbackBounds.south,
      west: fallbackBounds.west,
      north: fallbackBounds.north,
      east: fallbackBounds.east
    };
  }

  const parts = value.split(",").map((part) => part.trim());
  if (parts.length !== 4) {
    throw new Error("--bbox must be formatted as south,west,north,east");
  }

  const [south, west, north, east] = parts.map((part, index) =>
    parseNumber(part, ["south", "west", "north", "east"][index])
  );

  if (south >= north || west >= east) {
    throw new Error("--bbox must satisfy south < north and west < east");
  }

  return { south, west, north, east };
}

export function parseOverpassFetchArgs(argv, fallbackBounds = qinlingBounds) {
  const args = new Map();
  argv.forEach((arg) => {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) {
      args.set(match[1], match[2]);
    }
  });

  const timeoutMs = args.has("timeout-ms")
    ? parseNumber(args.get("timeout-ms"), "timeout-ms")
    : 90_000;

  if (timeoutMs <= 0) {
    throw new Error("--timeout-ms must be greater than zero");
  }

  return {
    bbox: parseBbox(args.get("bbox"), fallbackBounds),
    minTileDegrees: args.has("min-tile-degrees")
      ? parseNumber(args.get("min-tile-degrees"), "min-tile-degrees")
      : 0.25,
    namedOnly: !argv.includes("--all"),
    overpassTimeoutSeconds: Math.max(10, Math.ceil(timeoutMs / 1000)),
    tileDegrees: args.has("tile-degrees") ? parseNumber(args.get("tile-degrees"), "tile-degrees") : 1,
    timeoutMs
  };
}

export function buildOverpassWaterwayQuery({ bbox, namedOnly, overpassTimeoutSeconds }) {
  const bboxText = [bbox.south, bbox.west, bbox.north, bbox.east].join(",");
  const selectors = namedOnly
    ? [
        `way${WATERWAY_FILTER}["name"](${bboxText});`,
        `way${WATERWAY_FILTER}["name:zh"](${bboxText});`
      ]
    : [`way${WATERWAY_FILTER}(${bboxText});`];

  return `
[out:json][timeout:${overpassTimeoutSeconds}];
(
  ${selectors.join("\n  ")}
);
out body;
>;
out skel qt;
`.trim();
}

export function splitBoundsIntoTiles(bounds, tileDegrees = 1) {
  if (tileDegrees <= 0) {
    throw new Error("tileDegrees must be greater than zero");
  }

  const tiles = [];
  for (let south = bounds.south; south < bounds.north; south += tileDegrees) {
    for (let west = bounds.west; west < bounds.east; west += tileDegrees) {
      tiles.push({
        south: Number(south.toFixed(6)),
        west: Number(west.toFixed(6)),
        north: Number(Math.min(south + tileDegrees, bounds.north).toFixed(6)),
        east: Number(Math.min(west + tileDegrees, bounds.east).toFixed(6))
      });
    }
  }

  return tiles;
}

export function splitTileInHalf(tile) {
  const width = tile.east - tile.west;
  const height = tile.north - tile.south;

  if (width >= height) {
    const middle = Number(((tile.west + tile.east) / 2).toFixed(6));
    return [
      { ...tile, east: middle },
      { ...tile, west: middle }
    ];
  }

  const middle = Number(((tile.south + tile.north) / 2).toFixed(6));
  return [
    { ...tile, north: middle },
    { ...tile, south: middle }
  ];
}

export function mergeOverpassJsons(parts) {
  const elements = new Map();

  parts.forEach((part) => {
    const partElements = Array.isArray(part.elements) ? part.elements : [];
    partElements.forEach((element) => {
      elements.set(`${element.type}:${element.id}`, element);
    });
  });

  return {
    version: parts.find((part) => part.version)?.version,
    generator: "visual-china-overpass-tile-merge",
    osm3s: parts.find((part) => part.osm3s)?.osm3s,
    elements: [...elements.values()]
  };
}
