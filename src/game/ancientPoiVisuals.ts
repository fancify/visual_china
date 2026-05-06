import { BoxGeometry, BufferGeometry, ConeGeometry } from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";

function prepareForMerge(geometry: BufferGeometry): BufferGeometry {
  return geometry.index ? geometry.toNonIndexed() : geometry.clone();
}

export function buildImperialTombMound(scale: number): BufferGeometry {
  const parts: BufferGeometry[] = [];

  // 三层阶梯封土：底层方台、中层收窄、顶部四棱锥。
  const base = new BoxGeometry(2.4, 0.5, 2.4);
  base.translate(0, 0.25, 0);
  parts.push(base);

  const mid = new BoxGeometry(1.7, 0.5, 1.7);
  mid.translate(0, 0.75, 0);
  parts.push(mid);

  const top = new ConeGeometry(0.85, 0.7, 4);
  top.rotateY(Math.PI / 4);
  top.translate(0, 1.35, 0);
  parts.push(top);

  const merged = BufferGeometryUtils.mergeGeometries(parts.map(prepareForMerge));
  if (!merged) {
    return prepareForMerge(parts[0]!);
  }
  merged.scale(scale, scale, scale);
  merged.computeVertexNormals();
  merged.computeBoundingBox();
  return merged;
}
