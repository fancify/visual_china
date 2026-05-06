"""
ETOPO 2022 60s NetCDF → GeoTIFF 转换器

用途：当 data/etopo/ETOPO_2022_v1_60s_N90W180_bed.tif 缺失或损坏时，
从 NetCDF 源文件重生成 TIFF，供 scripts/etopo-fallback.mjs 使用。

依赖：h5py, numpy, rasterio
安装：uv pip install h5py numpy rasterio

下载源数据（一次性）：
    curl -L -o data/etopo/ETOPO_2022_v1_60s_N90W180_bed.nc \\
      'https://www.ngdc.noaa.gov/thredds/fileServer/global/ETOPO2022/60s/60s_bed_elev_netcdf/ETOPO_2022_v1_60s_N90W180_bed.nc'

运行：
    /tmp/etopo-convert/bin/python scripts/etopo-nc-to-tiff.py
"""

from pathlib import Path

import h5py
import numpy as np
import rasterio
from rasterio.transform import from_bounds

REPO_ROOT = Path(__file__).resolve().parent.parent
NC_PATH = REPO_ROOT / "data/etopo/ETOPO_2022_v1_60s_N90W180_bed.nc"
TIFF_PATH = REPO_ROOT / "data/etopo/ETOPO_2022_v1_60s_N90W180_bed.tif"

# 1) 读 NetCDF
print(f"Reading {NC_PATH}...")
with h5py.File(NC_PATH) as f:
    z = f["z"][:]
print(f"  shape={z.shape}, dtype={z.dtype}")

# 2) 翻转：NetCDF lat[0]=-90 (south)，GeoTIFF 要求 north-up
z = np.flipud(z)

# 3) Float32 → Int16 (米级精度，体积减半，DEFLATE 压缩率大幅提升)
z_int = np.round(z).astype(np.int16)
print(f"  Int16 range: {z_int.min()} .. {z_int.max()} m")

# 4) 写 GeoTIFF (Int16 + DEFLATE + predictor=2 + tiled)
transform = from_bounds(-180, -90, 180, 90, 21600, 10800)
print(f"Writing {TIFF_PATH}...")
with rasterio.open(
    TIFF_PATH, "w",
    driver="GTiff",
    height=10800, width=21600, count=1,
    dtype="int16",
    crs="EPSG:4326",
    transform=transform,
    compress="DEFLATE",
    predictor=2,        # 水平差分预测，对地形数据极有效
    tiled=True,
    blockxsize=256, blockysize=256,
    nodata=-32768,
) as dst:
    dst.write(z_int, 1)

size_mb = TIFF_PATH.stat().st_size / (1024 * 1024)
print(f"Done. TIFF size: {size_mb:.0f} MB")
