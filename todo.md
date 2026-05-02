# 山河中国 — 下一阶段开发 todo

## P1：视觉急救包（~1.5 天）
- ✅ 1.1 Pitch 上限放开（minElevation 0.32 → 0.0）
- ✅ 1.2 河水颜色加深（0x6aa7b0 → 0x3d7d8c, opacity 1.4x → 1.9x）
- ✅ 1.3 星空加密（360 → 5000，size 1.1 → 0.85）
- ✅ 1.4 月亮地平线遮挡（smoothstep(altitude, -0.05, 0.04) fade）
- ⏳ 1.5 太阳/月亮 NASA 贴图替换
- ⏳ 1.6 奇怪几何体清理（Playwright 诊断 → 删除/修复）
- ⏳ 1.7 月相 shader（terminator 在 fragment shader 算）

## P2：地表色调修复（~2-3 天，CGLS-LC100 100m）
- ⏳ 2.1 下载 CGLS-LC100 中国区域数据
- ⏳ 2.2 转 land-cover lookup texture
- ⏳ 2.3 terrain shader 引入 biome 染色
- ⏳ 2.4 视觉验收（截图前后对比"沙漠化"消退）

## P3：天气平滑 + 阴天/多云（~1.5 天）
- ⏳ 3.1 weather state lerp（晴 ↔ 雨）
- ⏳ 3.2 cloudy / overcast variant
- ❌ 彩虹（已砍）

## P4：城市存在感（~2 天）
- ✅ 4.1 instanced building prefab（京城 / 州府 / 县城 三档）
- ✅ 4.2 长安 / 汉中 / 广元 等真实坐标摆放（28 个真实城市）
- ✅ 4.3 京城 / 州府 文字名签（9 个 sprite，性能保住）
- ⏳ 4.4 县城名签：proximity-trigger 或 DOM overlay（避开 28 sprite 撞 fps）

## P5：信息分层 UI + POI 内容容器（~2 天）
- ⏳ 5.1 progressive disclosure panel 框架
- ⏳ 5.2 POI 富文本渲染（markdown 子集）
- ⏳ 5.3 内容存储格式定义（JSON schema）

## P6：内容灌注（增量，Wikipedia 中文 first draft）
- ⏳ 6.1 主要 POI 第一批（长安、汉中、剑门关、五丈原等）
- ⏳ 6.2 历史事件第一批（三国时期 + 秦岭范围内）

## P7：趣味性（~1 天）
- ⏳ 7.1 instanced 动物 prefab（鹿 / 飞鸟 / 水鸟）
- ⏳ 7.2 wander AI（简单状态机）

## 待复评 / 暂缓
- ⏸️ 古道真实化（前提：数据完整准确，需先看数据质量）
- ⏸️ POI 位置准确性审计（同上）

## 用户新增需求（2026-05-02）
- ⏳ **真实城市 + 古道节点连接图**（参考"古蜀道示意全图"）
  - **诉求**：现在地图上没有真实城市的视觉锚点，导致"诸葛亮六出祁山"
    "金牛道入蜀"这种历史事件无法在地图上识别走向。
  - **范围**：把参考图里的关键节点 — 西安/宝鸡/眉县/周至/陈仓/凤县/
    太白/留坝/褒城/汉中/勉县/略阳/西和/成县/天水/祁山/广元/昭化/剑门/
    武连/梓潼/绵阳/德阳/成都/宁强/南江/巴中/西乡/镇巴/涪陵 — 用真实
    经纬度落到 atlas + 3D；
  - 古道连接由真实节点构成 polyline（祁山道/陈仓道/褒斜道/傥骆道/
    子午道/金牛道/米仓道/荔枝道），替换掉 qinlingRoutes.js 里的
    manual-route-draft；
  - **跟 P4 整合**：P4 城市存在感的 instanced 建筑就摆在这些真实节点
    上，三档 = 京城（西安/成都）/ 州府（汉中/广元/天水）/ 县城（其余）。
  - **预计**：数据 + 落图 2-3 天，做完后讲历史能"指着地图说"

## 跨 phase 流程约定
- 每个 phase 末：commit 后跑 `/codex review`（**先 commit 数据**避免上次的假阳性陷阱）
- 每个 phase 末：`npm test` + `npm run build` 必须通过
- 每个 phase 末：Playwright 截图前后对比，附进 commit
