const VECTOR_INDEX_BIN_DEG = 0.25;
const RING_EDGE_BIN_DEG = 0.25;

function ringBounds(ring) {
  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  for (const [lon, lat] of ring) {
    if (lon < west) west = lon;
    if (lon > east) east = lon;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }
  return { west, east, south, north };
}

function containsBounds(bounds, lon, lat) {
  return lon >= bounds.west && lon <= bounds.east && lat >= bounds.south && lat <= bounds.north;
}

function pointInEdges(lon, lat, edges) {
  let inside = false;
  for (const { xi, yi, xj, yj } of edges) {
    const intersects =
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function indexRing(ring) {
  const edgeBins = new Map();
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi === yj) continue;
    const edge = { xi, yi, xj, yj };
    const y0 = Math.floor(Math.min(yi, yj) / RING_EDGE_BIN_DEG);
    const y1 = Math.floor(Math.max(yi, yj) / RING_EDGE_BIN_DEG);
    for (let y = y0; y <= y1; y += 1) {
      const bucket = edgeBins.get(y);
      if (bucket) bucket.push(edge);
      else edgeBins.set(y, [edge]);
    }
  }
  return { bounds: ringBounds(ring), edgeBins };
}

function pointInIndexedRing(lon, lat, ring) {
  const edges = ring.edgeBins.get(Math.floor(lat / RING_EDGE_BIN_DEG));
  return edges ? pointInEdges(lon, lat, edges) : false;
}

export function createLandMaskSamplerFromData(data) {
  if (!data.polygons.length) return null;
  const polygons = data.polygons
    .filter((rings) => rings.length > 0 && rings[0].length >= 3)
    .map((rings) => {
      const outer = indexRing(rings[0]);
      return {
        outer,
        holes: rings.slice(1).filter((ring) => ring.length >= 3).map(indexRing),
        bounds: outer.bounds
      };
    });
  const bins = new Map();
  const binKey = (x, y) => `${x}:${y}`;

  for (const polygon of polygons) {
    const x0 = Math.floor(polygon.bounds.west / VECTOR_INDEX_BIN_DEG);
    const x1 = Math.floor(polygon.bounds.east / VECTOR_INDEX_BIN_DEG);
    const y0 = Math.floor(polygon.bounds.south / VECTOR_INDEX_BIN_DEG);
    const y1 = Math.floor(polygon.bounds.north / VECTOR_INDEX_BIN_DEG);
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        const key = binKey(x, y);
        const bucket = bins.get(key);
        if (bucket) bucket.push(polygon);
        else bins.set(key, [polygon]);
      }
    }
  }

  return {
    isLand(lon, lat) {
      const x = Math.floor(lon / VECTOR_INDEX_BIN_DEG);
      const y = Math.floor(lat / VECTOR_INDEX_BIN_DEG);
      const candidates = bins.get(binKey(x, y));
      if (!candidates) return false;
      for (const polygon of candidates) {
        if (!containsBounds(polygon.bounds, lon, lat)) continue;
        if (!pointInIndexedRing(lon, lat, polygon.outer)) continue;
        let inHole = false;
        for (const hole of polygon.holes) {
          if (containsBounds(hole.bounds, lon, lat) && pointInIndexedRing(lon, lat, hole)) {
            inHole = true;
            break;
          }
        }
        if (!inHole) return true;
      }
      return false;
    }
  };
}
