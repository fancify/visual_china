function averagePoolHeights(heights, srcCols, srcRows, factor) {
  const dstCols = Math.max(2, Math.ceil(srcCols / factor));
  const dstRows = Math.max(2, Math.ceil(srcRows / factor));
  const out = new Array(dstCols * dstRows);

  for (let row = 0; row < dstRows; row += 1) {
    const r0 = row * factor;
    const r1 = Math.min(srcRows, r0 + factor);
    for (let col = 0; col < dstCols; col += 1) {
      const c0 = col * factor;
      const c1 = Math.min(srcCols, c0 + factor);
      let sum = 0;
      let count = 0;
      for (let rr = r0; rr < r1; rr += 1) {
        for (let cc = c0; cc < c1; cc += 1) {
          sum += heights[rr * srcCols + cc] ?? 0;
          count += 1;
        }
      }
      out[row * dstCols + col] = count > 0 ? sum / count : 0;
    }
  }

  return {
    grid: { columns: dstCols, rows: dstRows },
    heights: out
  };
}

export function buildChunkLodHeights(asset) {
  const { columns, rows } = asset.grid;
  return {
    L1: averagePoolHeights(asset.heights, columns, rows, 2),
    L2: averagePoolHeights(asset.heights, columns, rows, 4),
    L3: averagePoolHeights(asset.heights, columns, rows, 8)
  };
}
