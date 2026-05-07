// 把 slice-l1.json (3113×2158, 263 MB) 下采样到 ~390×270 (~5 MB)，
// 给浏览器初始加载用。原版 grid cells 1.8km，下采样后 ~14 km，对 atlas
// 概览 + 初始 terrain mesh 完全够用——细节由 chunks (50×50 cells = 90×90 km)
// 接管。
//
// Phase 2 全国扩张后用户报"Page Unresponsive"——main thread 在 fetch + parse
// 263 MB JSON 上卡死。下采样是 quickest fix。

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const INPUT = path.join(ROOT, "public/data/regions/qinling/slice-l1.json");
const OUTPUT = INPUT;  // 覆写

// Phase 3 全国 0.9 km grid (6225×4316)：4× 还有 1.7M cells / ~70 MB JSON，
// 浏览器 parse ~1 秒可接受但不舒适。8× → 778×540 = 420K cells / ~17 MB JSON，
// parse ~200 ms。L1 只用于 atlas 概览 + chunk 加载前的 fallback mesh，
// 7.2 km/cell 够用——细节由 chunks (45×45 km, 50×50 cells = 0.9 km/cell) 接管。
const STRIDE = 8;

const raw = await fs.readFile(INPUT, "utf8");
const asset = JSON.parse(raw);
const { columns, rows } = asset.grid;

const newColumns = Math.ceil(columns / STRIDE);
const newRows = Math.ceil(rows / STRIDE);
const newSize = newColumns * newRows;
console.log(`Old: ${columns}×${rows} = ${columns*rows} cells`);
console.log(`New: ${newColumns}×${newRows} = ${newSize} cells (×${(columns*rows/newSize).toFixed(1)} smaller)`);

function downsample(channel) {
  if (!Array.isArray(channel)) return channel;
  const out = new Array(newSize);
  for (let row = 0; row < newRows; row += 1) {
    const srcRow = Math.min(rows - 1, Math.floor(row * STRIDE + STRIDE / 2));
    for (let col = 0; col < newColumns; col += 1) {
      const srcCol = Math.min(columns - 1, Math.floor(col * STRIDE + STRIDE / 2));
      out[row * newColumns + col] = channel[srcRow * columns + srcCol];
    }
  }
  return out;
}

asset.heights = downsample(asset.heights);
if (asset.riverMask) asset.riverMask = downsample(asset.riverMask);
if (asset.passMask) asset.passMask = downsample(asset.passMask);
if (asset.settlementMask) asset.settlementMask = downsample(asset.settlementMask);
asset.grid = { columns: newColumns, rows: newRows };

asset.notes = asset.notes ?? [];
asset.notes.push(
  `Downsampled by ${STRIDE}× from full grid for browser-friendly initial load. Detailed terrain from chunked LODs.`
);

await fs.writeFile(OUTPUT, `${JSON.stringify(asset, null, 2)}\n`, "utf8");
const newSizeMb = (await fs.stat(OUTPUT)).size / 1024 / 1024;
console.log(`Wrote ${OUTPUT} (${newSizeMb.toFixed(2)} MB)`);
