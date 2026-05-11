---
type: moc
status: current
tags: [epoch, tang, historical]
updated: 2026-05-12
---

# 05 — 历史 epoch 数据

每个 epoch 是一个时间切片：地形复用现代 DEM，水系/城市/POI/visualProfile/landmark 按时代独立 author。

## 当前 epoch

| Epoch | 状态 | 文档 |
|---|---|---|
| **modern** | shipped | manifest at `public/data/epochs/modern/manifest.json` |
| **tang-tianbao-14** | S4a ✅ schema / S4b ⏸ 数据 sourcing 暂搁（等 terrain rewrite 完） | [POI database](./tang-epoch-755-poi-database.md) |

## Tang 755 (天宝十四年) 关键约束

详见 [memory/project_epoch_decision](../../.claude/projects/-Users-chen-Documents-GitHub-visual-china/memory/project_epoch_decision.md)：
- 黄河走唐代 "汉志河道" 北流入渤海（不是现代山东东营）
- 济水独流入海（被黄河夺道前的状态）
- 淮河独流入海（南宋黄河夺淮前）
- 隋唐大运河：永济渠 + 通济渠 + 邗沟 + 江南河
- 永定河叫桑干河，清水状态

## Tang 755 周边文明（必含）

详见 [memory/project_tang_epoch_neighbors](../../.claude/projects/-Users-chen-Documents-GitHub-visual-china/memory/project_tang_epoch_neighbors.md)：
吐蕃（逻些）/ 西域（高昌 / 龟兹 / 于阗 / 疏勒 / 碎叶）/ 南诏（太和城 / 大理）/ 渤海国（上京龙泉府）/ 新罗（庆州）/ 日本（平城京）/ 回纥（鄂尔浑河）/ 大食（撒马尔罕）。

---

# POI 体系 (S4b)

**S4b 阶段任务**：建立 Tang 755 完整 POI 知识库——城市、山水、古迹、交通——含图文介绍 + Tang 视角 + 历史长河。

## 4 大类（不是 12 类，已合并）

| # | 类别 | 实体定义 | 含子条目（doc 内章节，不另立 POI） | 数量级 |
|---|---|---|---|---|
| 1 | **城市 / 治所** | 有城墙的居住点 | 城内宫殿、坊市、寺观、衙署、馆驿、城门、城内古迹、节度治所、学校、外交馆 | 50-80 |
| 2 | **山水 / 自然** | 自然地理实体 | 山中峰岭、瀑布、温泉、山中寺观、传说神迹地 | 30-50 |
| 3 | **古迹 / 独立遗址** | 不归属城市或山水的历史地点 | 遗址内多个 components | 80-100 |
| 4 | **交通 / 路线** | 跨越多地的线性 + 节点 | 沿途驿站、关塞、桥梁 | 50-80 |
| **总** | — | — | — | **~250-350 docs** |

### 已拍板的边界 case
- **莫高窟 / 龙门石窟 / 云冈 独立**（不归城市），文化分量 >> 城市附庸
- **汉陵各帝独立**（长 / 茂 / 阳 / 杜 / 霸 等各 1 doc），各陵各帝 Tang 视角不同

## 独立性原则（核心 spec）

| 原则 | 执行 |
|---|---|
| **不嵌套** | 庐山瀑布 / 大慈恩寺 等子条目作母 POI doc 的 section，**不另立** entry |
| **同级引用** | 相关 POI 用 markdown link 平级，**不写父子** |
| **避免双重出现** | 大慈恩寺只在 长安 doc 出现，不在 religious/ 单独立 doc |
| **Obsidian 内搜得到** | doc 内子条目用 `## 大慈恩寺` heading 锚定，全文搜索可跳转 |

## POI doc schema

每个 POI 一个 `.md` 文件，frontmatter + body：

```markdown
---
type: poi
category: relic                # city/scenic/relic/transport
tang_polity: tang
tang_dao: guannei
tang_admin: jingzhao-fu
geo: {lat: 34.10, lon: 109.55}
visual_hierarchy: medium       # gravity/large/medium/small (BotW Triangle)
tang_status: extant            # extant/extinct
provenance:                    # 数据来源（feedback_tang_data_sourcing 守则）
  - source: "旧唐书·王维传"
    confidence: verified
aliases: [辋川山庄]
tags: [poi, tang, relic, 关内道, wangwei]
updated: 2026-05-12
---

# {名}

## 一句话
[20-40 字 hook]

## 一处什么样的地方                  ← 地方画像 (Tang 视角之前先建空间感)
[范围 / 景色 / 特色 糅成 2-3 段叙事。先一句立画面（譬如"算不得园林——倒像沿溪谷铺开的山中长廊"），再走入空间细节，最后点睛特色或物候]

## Tang 755 视角
[人 + 事 + 当时意味。先点时间 + 人物 + 状态；中段当时活动；末段升华为 "对 Tang 人意味着..."]

## 子条目（视类型而定）
[城市：城内地标；山水：峰岭瀑布古寺；古迹：遗址 components；交通：沿途节点]

## 历史长河（755 → 今）
**中晚唐**　[1-2 段散文]
**五代至宋**　[1-2 段]
**明清**　[1-2 段]
**民国至今**　[1 段]
（朝代分段视具体 POI 而定）

## 引文（如适用）
[Tang 诗词 / 史志原文]

## 图
[1-3 张图，附 caption + 出处]

## 额外章节（视该 POI 特点而定）
[per-POI 1-3 个独家：诗人故居 → 诗作年表；山 → 登临诗+天象；古都 → 考古发掘；港 → 贸易货物]

## 相关 POI（同级，不嵌套）
- [X](../category/x.md) — 关联说明
```

## 写作 voice (v3, 2026-05-12 拍板)

**克制 + 浪漫 + 怀古 + 高可读性**。参考《明朝那些事儿》叙事流畅，**减**当年明月的 casual joke 调子，**加**怀古留白。

### 三大手法

**① 时间错位的并置**（怀古核心）—— 同句把"那时"和"如今/后人"并置，不抒情，距离自现：

> 王维诗里那些"空山新雨后"、"独坐幽篁里"——**后人**当成泛指的山水读，**那时**其实都是这园子里某一日某一处。

> 毕沅再立一碑标识——**距王维去世已逾千年**。

**② 句长节奏**（可读性核心）—— 短句 (4-6 字) 与长句交错呼吸：

- 短：湖水清浅。曲转随山。
- 长：朝廷追究当年降叛之官，王维原本该重罚——他在被囚期间偷偷写过一首《凝碧池》，借诗陈明心迹。
- 短收尾：那首诗救了他一命。

**③ 否定 + 肯定立画面**——开篇用"不是 X，而是 Y"立刻给读者空间感：

> 辋川别业**算不得**园林——倒像沿溪谷铺开的一段山中长廊。

> 这园子**不堆**假山，**不挖**人工池。溪是溪，林是林，岩还是岩。

### 词汇取舍

| ✅ 用（节制） | ❌ 不用 |
|---|---|
| 倒像 / 算不得 / 便 / 至于 | 似乎 / 不能算 / 然后 / 关于 |
| 不可考 / 散尽 / 渐荒 | 不清楚 / 都没了 / 慢慢荒废 |
| 挚友 / 携 / 答之 / 借诗陈明心迹 (段内限 1 处古意) | 朋友 / 带 / 回应了 (现代为主) |
| "**可达的隐**" 加粗记忆点 (一 doc 限 1-2 处) | 抒情泛滥 / 总结陈词 |
| 数字年份 (756) (乾隆四十年) | "公元 756 年的时候" |
| "盛唐的雅集、诗社、文人私园——这场乱之后，大半都成了过去式" (盛衰隐性对照) | "唉，盛唐就这样消逝了" (直接抒情) |
| "考古至今也没碰到过" (轻轻一压) | "至今未被发现（令人遗憾）" (直白抒情) |

### 怀古技巧（per-段至少 1 处）

| 技巧 | 例 |
|---|---|
| 时间距离 marker | "距王维去世已逾千年" / "地名'辋川镇'独存" |
| ruined object 起点 | "原是一处荒废已久的古城遗址，王维就着旧址盖了几间屋" |
| 后人 vs 那时 并置 | "后人当成泛指，那时都是某一日某一处" |
| 盛衰隐性对照 | "盛唐的雅集、诗社、文人私园——大半都成了过去式" |
| 收尾轻压 | "辋川只是其中一处" / "考古至今也没碰到过" / "说不清了" |

## Voice baseline sample — 辋川别业 v3

> ## 一处什么样的地方
>
> 辋川别业算不得园林——倒像沿溪谷铺开的一段山中长廊。
>
> 北从孟城坳起——那地方原是一处荒废已久的古城遗址，王维就着旧址盖了几间屋。沿辋谷水一路南行十余里：先穿华子冈的松林，过斤竹岭的竹丛，便到欹湖。湖水清浅，曲转随山，王维与裴迪常在湖上荡舟。再南，有辛夷坞——春日辛夷满坡，紫白如海；有竹里馆——夜深处独坐抚琴；最末是椒园。
>
> 这园子不堆假山，不挖人工池。溪是溪，林是林，岩还是岩——只在恰好的位置加一间小亭、几丛栽植、一块题着名字的石头。让山水自己说话。后世文人园里讲究的"随地立名、就景题诗"，源头便在这里。
>
> 物候是辋川的一部分。三月辛夷开，五月新笋出土，秋来栾树满坡变红，冬日欹湖结薄冰。王维诗里那些"空山新雨后"、"独坐幽篁里"、"明月松间照"——后人当成泛指的山水读，那时其实都是这园子里某一日某一处。

> ## Tang 755 视角
>
> 天宝十四载（755），王维五十五岁，时任给事中。这一处辋川别业他经营了已经十多年——原是前朝诗人宋之问的旧宅，王维买下后慢慢拓出二十处景。
>
> 半生在朝中，到了这个年纪基本以"半官半隐"自处——朝中点卯，下朝便往山里跑。常携挚友裴迪同来，两人就园中每一处景轮流写诗：王维写"独坐幽篁里"，裴迪以《辋口遇雨》答之。这些诗最后合成《辋川集》，二十处景二十首诗——盛唐的山水诗，自此立下标杆。
>
> 对长安那一代士人来说，辋川意味着一种**可达的隐**——离皇城不远，跟宦海并行不悖，不必远走江湖。

> ## 历史长河（节选）
>
> **中晚唐**　安禄山起兵的第二年（756），玄宗仓皇西奔。王维没来得及随驾，被叛军囚禁后强授伪职。两京收复后，朝廷追究当年降叛之官，王维原本该重罚——他在被囚期间偷偷写过一首《凝碧池》，借诗陈明心迹。那首诗救了他一命。
>
> 乾元二年（759），王维在长安去世。辋川归他弟弟王缙；王缙再传给几位侄子，再后来便不可考。到德宗朝，园子已经渐渐荒了。中唐的裴度曾过访旧迹，所能辨认的，只剩孟城那一带的轮廓。
>
> 盛唐的雅集、诗社、文人私园——这场乱之后，大半都成了过去式。辋川只是其中一处。
>
> **明清**　万历年间，陕西几位士绅在孟城坳立了一块"王维隐居处"碑，象征性地重建了一下。乾隆四十年，陕西巡抚毕沅再立一碑标识——距王维去世已逾千年。同代考据派学者拿着《辋川图》比对地形，结论是：大多数景点的具体位置，其实已经说不清了。
>
> **民国至今**　清末民国间彻底荒废，只有地名"辋川镇"独存。2010 年代起，蓝田县规划遗址公园，恢复了鹿柴、竹里馆的地名标牌。至于王维当年实际居住的地方，考古至今也没碰到过。

## 目录结构（建立时）

```
docs/05-epoch/
├── README.md                ← 本文档（框架）
├── tang-755/                ← 新 epoch namespace（S4b 建）
│   ├── README.md            ← 子 MOC（导航 4 类）
│   ├── polity/              ← 政体 (8 个：tang / tubo / nanzhao / bohai / silla / wae / uyghur / abbasid)
│   ├── dao/                 ← 道 (15 + 都护府)
│   ├── cities/              ← 城市 50-80
│   ├── scenic/              ← 山水 30-50
│   ├── relics/              ← 古迹 80-100
│   ├── transport/           ← 交通 50-80
│   └── images/              ← 各 POI 引用的图集中存放
└── tang-epoch-755-poi-database.md  ← 现有 217 行清单（inventory，待 S4b 拆分到上面 4 类）
```

## 实施顺序（S4b 阶段）

1. ✅ **现在**：spec 落 memory + 本 README 框架完成
2. ⏳ **terrain rewrite (P1-P6) 完后**：进入 S4b（约 2 周后）
3. S4b-1：数据 sourcing 流程建立（参考 [memory/feedback_tang_data_sourcing](../../.claude/projects/-Users-chen-Documents-GitHub-visual-china/memory/feedback_tang_data_sourcing.md)）
4. S4b-2：polity / 道 polygon 数据 + 8 + 15 doc
5. S4b-3 → S4b-6：城市 → 山水 → 古迹 → 交通（按 ROI 排）
6. S4b-7：runtime zone enter toast + POI 详细面板 + 图加载

## S4b 数据 sourcing 守则（必读）

**绝对禁止** LLM 推测历史坐标 / 地名。详见 [memory/feedback_tang_data_sourcing](../../.claude/projects/-Users-chen-Documents-GitHub-visual-china/memory/feedback_tang_data_sourcing.md)：
- 先 collect raw sources（谭其骧地图集 / Harvard CHGIS / 旧唐书 / 新唐书 / 资治通鉴 / OSM historical）带 provenance citation
- derived manifest 是 build artifact，reads from sources
- 单源 confidence: "likely"；双源 cross-check 才能 "verified"

## 关联

- 上级 → [../README.md](../README.md)
- Epoch schema → [../02-architecture/terrain-rewrite-plan.md](../02-architecture/terrain-rewrite-plan.md)
- POI 数据 manifest → `public/data/epochs/tang-tianbao-14/manifest.json`
