#!/usr/bin/env node
// 把 modern hydrography (lat/lon polylines) 投到 SVG 出一张南扩后水系总览。
// 输出到 tmp/river-map.svg，浏览器打开即可看。

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const HYDRO_PATH = join(ROOT, "public/data/regions/qinling/hydrography/modern.json");
const BOUNDS = { west: 103.5, east: 110.5, south: 22.0, north: 35.4 };

const data = JSON.parse(readFileSync(HYDRO_PATH, "utf-8"));
const W = 700;
const H = 1340;
const PAD = 40;

function project(lat, lon) {
  const u = (lon - BOUNDS.west) / (BOUNDS.east - BOUNDS.west);
  const v = (BOUNDS.north - lat) / (BOUNDS.north - BOUNDS.south);
  return { x: PAD + u * (W - 2 * PAD), y: PAD + v * (H - 2 * PAD) };
}

function inBounds(lat, lon) {
  return (
    lat >= BOUNDS.south && lat <= BOUNDS.north &&
    lon >= BOUNDS.west && lon <= BOUNDS.east
  );
}

const colors = {
  1: "#1e88c2",   // 主干
  2: "#3aa9d9",   // 一级支
  3: "#5dc1e6"    // 二级
};

const paths = [];
const labels = [];

data.features.forEach((feat) => {
  const pts = (feat.geometry?.points ?? []).filter((p) => inBounds(p.lat, p.lon));
  if (pts.length < 2) return;

  const projected = pts.map((p) => project(p.lat, p.lon));
  const d = projected
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const stroke = colors[feat.rank] ?? "#7eced9";
  const width = feat.rank === 1 ? 2.5 : feat.rank === 2 ? 1.6 : 1.0;
  paths.push(
    `<path d="${d}" stroke="${stroke}" stroke-width="${width}" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.9" />`
  );

  const mid = projected[Math.floor(projected.length / 2)];
  if (mid) {
    labels.push(
      `<text x="${(mid.x + 6).toFixed(1)}" y="${(mid.y - 4).toFixed(1)}" font-family="PingFang SC, Helvetica, sans-serif" font-size="12" fill="#0e3b56">${feat.name}</text>`
    );
  }
});

// 边框 + 标注
const cornerLabels = [
  { lat: BOUNDS.north, lon: BOUNDS.west, label: `NW ${BOUNDS.north}°N ${BOUNDS.west}°E` },
  { lat: BOUNDS.south, lon: BOUNDS.east, label: `SE ${BOUNDS.south}°N ${BOUNDS.east}°E` }
];
const corners = cornerLabels.map((c) => {
  const p = project(c.lat, c.lon);
  return `<text x="${p.x}" y="${p.y - 4}" font-family="Helvetica" font-size="10" fill="#666">${c.label}</text>`;
}).join("\n  ");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect x="0" y="0" width="${W}" height="${H}" fill="#f3f6f4" />
  <rect x="${PAD - 2}" y="${PAD - 2}" width="${W - 2 * PAD + 4}" height="${H - 2 * PAD + 4}" fill="#f9fbf9" stroke="#ccc" stroke-width="1" />
  <text x="${W / 2}" y="22" font-family="PingFang SC, Helvetica" font-size="14" font-weight="600" fill="#444" text-anchor="middle">水系总览（南扩后 lat 22-35.4 / lon 103.5-110.5）</text>
  ${paths.join("\n  ")}
  ${labels.join("\n  ")}
  ${corners}
  <text x="${PAD}" y="${H - 12}" font-family="Helvetica" font-size="10" fill="#888">${data.features.length} features · ${paths.length} drawn</text>
</svg>`;

mkdirSync(join(ROOT, "tmp"), { recursive: true });
const out = join(ROOT, "tmp", "river-map.svg");
writeFileSync(out, svg);
console.log(`Wrote ${out} — ${paths.length} rivers drawn`);
