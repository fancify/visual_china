# 全国中国 DEM 母版方案

## 目标

在当前 `秦岭 - 关中 - 四川盆地` 切片之外，建立一套真正面向“整中国”的地形母版流程：

1. 下载全国级 DEM 原始分块
2. 解压和整理 GeoTIFF
3. 生成适合浏览器运行的全国低分辨率母版
4. 后续再从这张全国母版切出重点区域高精度切片

## 当前实现

当前仓库里已经补了 3 个脚本阶段：

- `npm run china:fabdem:download`
- `npm run china:fabdem:extract`
- `npm run china:dem:build`

以及公共配置：

- `scripts/china-dem-common.mjs`

## 目前选择的可执行源

当前先用 `FABDEM V1-2` 打通全国流程，原因是：

- 可直接通过公开 URL 下载
- 全球覆盖
- 1 arc-second，约 30 米
- 比普通 DSM 更接近裸地

注意：

- 其许可证为 `CC BY-NC-SA 4.0`
- 更适合原型与研究，不应默认视作商业最终源

后续若要商业化，应优先切换到：

- `ALOS AW3D30`
- `NASADEM`

## 中国覆盖范围

当前全国母版采用一个保守边界框：

- 西：`73`
- 东：`135`
- 南：`18`
- 北：`54`

这是一个“全国游戏母版边界”，不是严格国界。

## FABDEM 分组策略

FABDEM 提供的是 10° x 10° ZIP 包，ZIP 内部再放 1° x 1° GeoTIFF。

当前脚本采取的全国下载分组：

- `N10` 纬带仅拉取 `E100 / E110 / E120`，覆盖海南、台湾及南部海岸带
- `N20 / N30 / N40 / N50` 纬带拉取 `E070` 到 `E130`

这样可以覆盖全国主体，又避免明显无效的南海与远洋块。

## 建议执行方式

全国分块下载不是秒级任务，应分批进行，例如：

```bash
npm run china:fabdem:download -- --dry-run
npm run china:fabdem:download -- --limit=1
npm run china:fabdem:extract -- --limit=1
npm run china:dem:build
```

下载器当前会：

- 跳过已完成归档
- 使用 `.part` 临时文件写入
- 下载完成后再改名为正式 ZIP

这样在长时间下载过程中，中断不会把半截文件误当成完整归档。

## 生成的全国资产

构建脚本会输出：

- `public/data/china-national-dem.json`

当前目标输出栅格：

- `576 x 336`

这不是最终全国资产分辨率，而是适合网页原型验证的大地形母版。

## 下一阶段

1. 真正下载全国所需分组
2. 解压成完整中国 GeoTIFF 目录
3. 生成第一版全国资产
4. 把运行时从“秦岭专用数据”升级为“全国母版 + 区域切片”
5. 如果商业方向明确，再把源替换成 `ALOS` 或 `NASADEM`
