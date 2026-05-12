// FABDEM V1-2 per-tile downloader, using hf-mirror.com (国内可访问的 HF mirror)
//
// 用法：
//   node scripts/download-china-fabdem-hf.mjs                  # 默认 China 全图 + 并发 8
//   node scripts/download-china-fabdem-hf.mjs --concurrency=4   # 自定义并发
//   node scripts/download-china-fabdem-hf.mjs --dry-run         # 只列出会下啥
//
// 为啥不用官方 Bristol：Bristol U mirror 单连接 ~100 KB/s，全国 ~50 GB 要下 5 天。
// hf-mirror.com 单连接实测 9.6 MB/s（社区维护，镜像 Hugging Face links-ads/fabdem-v12）。
// 数据二进制等价（同源 FABDEM V1-2）。
//
// 输出：data/fabdem/china/tiles/N{lat}E{lon}_FABDEM_V1-2.tif

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";

const BASE = "https://hf-mirror.com/datasets/links-ads/fabdem-v12/resolve/main/tiles";
const BOUNDS = { south: 18, north: 53, west: 73, east: 135 };
const OUTPUT_DIR = "data/fabdem/china/tiles";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const concurrencyArg = args.find((a) => a.startsWith("--concurrency="));
// concurrency 默认 4 (之前 8 有时撞 hf-mirror 限流; 经验 4 稳健不慢)
const CONCURRENCY = concurrencyArg ? Number(concurrencyArg.split("=")[1]) : 4;

// FABDEM 命名:  lat 2 位 (N32), lon 3 位 (E102 / E080). 之前 padLat = padLon = 2
// 导致 lon < 100 (西部 73-99) 生成 "E80" 而非 "E080" → URL 404. 历史东部 lon ≥ 100
// 偶然 work, 西部全废.
function padLat(n) {
  return String(Math.abs(n)).padStart(2, "0");
}
function padLon(n) {
  return String(Math.abs(n)).padStart(3, "0");
}

function blockFolder(lat, lon) {
  const lat10 = Math.floor(lat / 10) * 10;
  const lon10 = Math.floor(lon / 10) * 10;
  return `N${padLat(lat10)}E${padLon(lon10)}-N${padLat(lat10 + 10)}E${padLon(lon10 + 10)}_FABDEM_V1-2`;
}

function tileName(lat, lon) {
  return `N${padLat(lat)}E${padLon(lon)}_FABDEM_V1-2.tif`;
}

function tileUrl(lat, lon) {
  return `${BASE}/${blockFolder(lat, lon)}/${tileName(lat, lon)}`;
}

function buildTileList() {
  const tiles = [];
  for (let lat = BOUNDS.south; lat < BOUNDS.north; lat += 1) {
    for (let lon = BOUNDS.west; lon < BOUNDS.east; lon += 1) {
      tiles.push({ lat, lon, name: tileName(lat, lon), url: tileUrl(lat, lon) });
    }
  }
  return tiles;
}

// 扫描所有已下载的 tile，不论位置
async function scanExisting() {
  const dirs = [
    "data/fabdem/china/tiles",
    "data/fabdem/qinling/tiles",
    "data/fabdem/qinling/recovery-local",
    "data/fabdem/qinling/recovery"
  ];
  const have = new Map(); // name → full path
  for (const d of dirs) {
    try {
      const files = await fsp.readdir(d);
      for (const f of files) {
        if (f.endsWith("_FABDEM_V1-2.tif")) {
          have.set(f, path.join(d, f));
        }
      }
    } catch {
      // dir 不存在，跳过
    }
  }
  return have;
}

async function downloadTile(tile, outputPath, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const resp = await fetch(tile.url, {
        // 避免 socks proxy 干扰 localhost-style 测试
        // (不过 hf-mirror 是真公网，proxy 如果有就用)
      });
      if (resp.status === 404) {
        return { tile, skipped: true, reason: "404 (ocean/no-coverage)" };
      }
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      const tmp = `${outputPath}.part`;
      await pipeline(resp.body, fs.createWriteStream(tmp));
      await fsp.rename(tmp, outputPath);
      const stat = await fsp.stat(outputPath);
      return { tile, downloaded: true, size: stat.size };
    } catch (e) {
      if (attempt === retries) {
        throw e;
      }
      // 退避重试
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
}

// N worker functions 共享 idx，依次取队列
async function withConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let idx = 0;
  async function loop() {
    while (idx < items.length) {
      const i = idx;
      idx += 1;
      try {
        results[i] = await worker(items[i], i);
      } catch (e) {
        results[i] = { error: e.message, tile: items[i] };
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, loop));
  return results;
}

// Main
const have = await scanExisting();
const all = buildTileList();
const missing = all.filter((t) => !have.has(t.name));

console.log(`========================================`);
console.log(`FABDEM V1-2 per-tile downloader (HF mirror)`);
console.log(`========================================`);
console.log(`Bounds: ${BOUNDS.south}-${BOUNDS.north}°N × ${BOUNDS.west}-${BOUNDS.east}°E`);
console.log(`Total tiles in bounds: ${all.length}`);
console.log(`Already have:          ${have.size}`);
console.log(`Missing to download:   ${missing.length}`);
console.log(`Concurrency:           ${CONCURRENCY}`);
console.log(`Output dir:            ${OUTPUT_DIR}`);
console.log(`Mirror:                ${BASE}`);
console.log("");

if (dryRun) {
  console.log("--dry-run: 不真下载。前 10 个 missing tile URL：");
  for (const t of missing.slice(0, 10)) {
    console.log(`  ${t.url}`);
  }
  process.exit(0);
}

await fsp.mkdir(OUTPUT_DIR, { recursive: true });

let done = 0;
let skipped = 0;
let failed = 0;
let bytes = 0;
const start = Date.now();

await withConcurrency(missing, CONCURRENCY, async (tile) => {
  const out = path.join(OUTPUT_DIR, tile.name);
  try {
    const r = await downloadTile(tile, out);
    if (r.skipped) {
      skipped += 1;
    } else {
      done += 1;
      bytes += r.size;
    }
  } catch (e) {
    failed += 1;
    console.error(`FAIL ${tile.name}: ${e.message}`);
  }
  // 每完成 25 个报一次进度
  const total = done + skipped + failed;
  if (total % 25 === 0 || total === missing.length) {
    const elapsed = (Date.now() - start) / 1000;
    const mbps = elapsed > 0 ? bytes / elapsed / 1024 / 1024 : 0;
    const eta = mbps > 0 ? (missing.length - total) * (bytes / done / 1024 / 1024) / mbps : 0;
    console.log(
      `progress: ${total}/${missing.length}  ` +
        `(${done} ok, ${skipped} skipped, ${failed} fail)  ` +
        `${(bytes / 1024 / 1024).toFixed(0)} MB @ ${mbps.toFixed(1)} MB/s  ` +
        `ETA ${(eta / 60).toFixed(0)} min`
    );
  }
});

const totalMin = (Date.now() - start) / 1000 / 60;
console.log("");
console.log(`========================================`);
console.log(`DONE in ${totalMin.toFixed(1)} min`);
console.log(`  ${done} downloaded (${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB)`);
console.log(`  ${skipped} skipped (ocean / 404)`);
console.log(`  ${failed} failed`);
console.log(`========================================`);

if (failed > 0) {
  console.error(`\n⚠ ${failed} tiles failed — re-run the script to retry (existing tiles are auto-skipped).`);
  process.exit(1);
}
