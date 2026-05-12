---
type: design
status: wip
tags: [terrain, dem, pyramid, ingestion, P1]
updated: 2026-05-12
---

# P1 — build-dem-pyramid.mjs 设计

> [terrain-rewrite-plan.md](./terrain-rewrite-plan.md) Phase 1 落地。从 984 个 FABDEM tile（30m raw）烤出 L0-L4 5-tier pyramid。

## 输入

- **源**：`data/fabdem/china/tiles/N{lat}E{lon}_FABDEM_V1-2.tif` × 984 个（27 GB raw）
- **覆盖**：China 73-135°E × 18-53°N（984 个 1°×1° tile 覆盖陆地；海洋 tile 不存在）
- **每 tile**：3600×3600 像素 Float32，1 arcsec ≈ 30m，bare-earth elevation in meters

## 输出

5 tier，每 tier 一组 chunk JSON files + 一份 manifest：

```
public/data/dem/
├── manifest.json                ← 5 tier 元数据 + bounds + projection
├── L0/                          ← 450m/cell，近相机用
│   ├── 0_0.bin    256×256 Float16 = 128 KB
│   ├── 0_1.bin
│   └── ...                      约 2000 chunks
├── L1/                          ← 900m/cell
│   ├── 0_0.bin    256×256 Float16 = 128 KB
│   └── ...                      约 500 chunks
├── L2/                          ← 1.8 km/cell
├── L3/                          ← 3.6 km/cell
└── L4/                          ← 7.2 km/cell，整图底
    └── 0_0.bin                  约 30 chunks
```

## Tier 参数

| Tier | cell 精度 | chunk size | chunk 物理大小 | 全图 chunk 数（估） | 单 chunk 字节 | tier 总大小 |
|---|---|---|---|---|---|---|
| L0 | **450 m** | 256×256 | 115×115 km | ~2000 | 128 KB | ~256 MB |
| L1 | 900 m | 256×256 | 230×230 km | ~500 | 128 KB | ~64 MB |
| L2 | 1.8 km | 256×256 | 460×460 km | ~125 | 128 KB | ~16 MB |
| L3 | 3.6 km | 256×256 | 920×920 km | ~32 | 128 KB | ~4 MB |
| L4 | 7.2 km | 256×256 | 1840×1840 km | ~8 | 128 KB | ~1 MB |
| **全 pyramid** | — | — | — | ~2665 | — | **~340 MB** |

实际更小（边界 chunks 多 sparse + 海洋区跳过烤）—— 估**~150-200 MB**。

> 比 terrain-rewrite-plan.md 原估 70 MB 大 ~3×。原因：那时 chunk 用 64×64，现 256×256 减少 chunk 数量但单 chunk 信息密度更高 = 总磁盘更稳健（chunk 边界 overhead 少）。

## chunk 坐标系

每 tier 用同一个全图整数 chunk grid，原点在 west-north 角：

```
chunk(x, z) at tier N covers:
  west  = chinaBounds.west  + x      * chunkSize_deg(N)
  east  = chinaBounds.west  + (x+1)  * chunkSize_deg(N)
  north = chinaBounds.north - z      * chunkSize_deg(N)
  south = chinaBounds.north - (z+1)  * chunkSize_deg(N)
```

其中 `chunkSize_deg(N) = 256 * cell_deg(N)`，且 `cell_deg(L0) = 450m / 111km*deg ≈ 0.00405°`。

L1 chunk(x,z) = 包含 L0 chunks (2x, 2z), (2x+1, 2z), (2x, 2z+1), (2x+1, 2z+1)；L2 同理。**完美 2× hierarchy** — 利于 mipmap morph shader。

## 二进制格式

每 chunk binary：

```
header (8 bytes):
  uint16 magic = 0xDEAD
  uint8  version = 1
  uint8  tier (0-4)
  uint16 chunkX
  uint16 chunkZ

data:
  Float16 × 256 × 256 = 131072 bytes（实际 raw bytes; pad nan for missing）
```

总 chunk 文件大小：**131080 bytes**（128 KB + 8 byte header）。

NaN 表示该 cell 无数据（海洋 / 未覆盖 / 边界）—— shader 看见 NaN 退到下一级 tier 或天空色。

## 处理 pipeline

```
1. 加载所有 FABDEM tiles 索引（984 tile name → bounds）
2. 对全图 L0 chunk grid 每个 chunk:
   a. 计算该 chunk geographic bounds
   b. 找重叠的 FABDEM tiles（1-4 个）
   c. 用 geotiff lib 读相应 raster 区域
   d. 重采样到 256×256 = 450m/cell（双线性 average pooling）
   e. 输出 Float16 binary
3. L1 = L0 2×2 mean pool down
4. L2 = L1 2×2 mean pool down
5. ... L4
6. 输出 manifest.json
```

## CLI

```bash
node scripts/build-dem-pyramid.mjs                     # 默认全国全 tier
node scripts/build-dem-pyramid.mjs --tier=L0           # 只烤 L0
node scripts/build-dem-pyramid.mjs --bbox=73,18,90,40  # 测试小区域
node scripts/build-dem-pyramid.mjs --dry-run           # 不写，只算 chunk grid
node scripts/build-dem-pyramid.mjs --concurrency=8     # 并发烤
```

## 估计运行时间

- 984 FABDEM tiles 总 27 GB 解码 + resampling
- 单 tile 解码 + downsample (3600×3600 → 247×247) ≈ 5-10 sec 单线程
- 全图 L0 = 984 × 5-10 sec / 8 并发 = **~10-20 分钟**
- L1-L4 是 L0 2× 下采样，**极快**（~1-2 min 全部）
- **总 ~15-25 min** 烤通

## Invariants 检查

ingestion 完后跑一组 sanity test：
- L0 chunk count 实测 vs 估计 (~2000) 差 < 20%
- 每 L_{n+1} chunk 包含 4 个 L_n（无 orphan）
- 抽样 5 个 chunks 比对边缘 cell 值连续（无 seam）
- 总 disk size < 500 MB（防失控）
- L0 任意 cell 可逆 trace 到 FABDEM raw tile（"single source" invariant）

## 风险

- **NaN 边界 handling**：海洋 tile 不存在 + 部分陆地 tile 缺失 → chunk 内部分 NaN，需 shader 兜底
- **重采样选择**：mean pooling 适合远景；近景 (L0) 是否要 max + 边缘锐化？保守先 mean，看效果再调
- **chunk size 256 vs 64**：256 GPU 上传开销稍高但减少 draw call；如果性能差再切 128 / 64
- **磁盘空间**：~200 MB 增加，CI / build artifact 需注意

## 下一步（P1 落地后）

- P2 `build-rivers-chunked.mjs` — HydroSHEDS shp → 每个 chunk 一份 rivers polyline JSON
- P3 新 renderer `src/game/terrain/` — pyramid loader + morph shader
- P4 ocean coast mask + river ribbon
- P5 callsite 切到新 SurfaceProvider
- P6 删旧 terrain code
