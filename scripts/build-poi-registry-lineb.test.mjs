import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { scanPoiDocs } from "./build-poi-registry.mjs";

test("Line B POI docs produce stable runtime facts with summary text", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "lineb-poi-"));
  const docsRoot = path.join(tmp, "docs", "05-epoch", "tang-755");
  await fs.mkdir(path.join(docsRoot, "cities"), { recursive: true });
  await fs.writeFile(
    path.join(docsRoot, "poi-taxonomy.json"),
    JSON.stringify({
      regions: [{ id: "guanzhong", name: "关中", order: 10 }],
      kinds: [{ id: "capital", name: "都城", order: 10 }]
    }),
    "utf8"
  );
  await fs.writeFile(
    path.join(docsRoot, "cities", "长安.md"),
    `---
type: poi
category: city
region: guanzhong
region_name: "关中"
subregion: changan-jingji
subregion_name: "长安京畿"
kind: capital
kind_name: "都城"
tang_polity: tang
tang_polity_name: "唐"
tang_dao: guannei
tang_dao_name: "关内道"
tang_admin: jingzhao-fu
tang_admin_name: "京兆府"
geo: {lat: 34.27, lon: 108.95}
foundation: {label: "隋开皇二年（582）始筑大兴城", year: 582, precision: exact}
elevation_m: 400
visual_hierarchy: gravity
provenance:
  - source: "新唐书"
    confidence: verified
---

# 长安

## 一句话

天宝十四载冬，唐人称百万家的城。

## 形貌

长安是一张方方正正、按图谱铺开的巨型棋盘。

## 大唐天宝十四载（755年）

隋文帝开皇二年（582）另起大兴城，唐武德元年改名长安。
`,
    "utf8"
  );

  const entries = await scanPoiDocs(tmp);

  assert.equal(entries.length, 1);
  assert.deepEqual(entries[0], {
    id: "changan",
    name: "长安",
    category: "city",
    region: "guanzhong",
    regionName: "关中",
    regionOrder: 10,
    subregion: "changan-jingji",
    subregionName: "长安京畿",
    kind: "capital",
    kindName: "都城",
    kindOrder: 10,
    tangPolity: "tang",
    tangPolityName: "唐",
    tangDao: "guannei",
    tangDaoName: "关内道",
    tangAdmin: "jingzhao-fu",
    tangAdminName: "京兆府",
    tangNavGroup: "guannei",
    lat: 34.27,
    lon: 108.95,
    hierarchy: "gravity",
    archetype: "city",
    size: "large",
    summary: "天宝十四载冬，唐人称百万家的城。",
    founded: "隋开皇二年（582）始筑大兴城",
    elevation: "海拔 400 米",
    elevationMeters: 400,
    detail: "# 长安\n\n## 一句话\n\n天宝十四载冬，唐人称百万家的城。\n\n## 形貌\n\n长安是一张方方正正、按图谱铺开的巨型棋盘。\n\n## 大唐天宝十四载（755年）\n\n隋文帝开皇二年（582）另起大兴城，唐武德元年改名长安。",
    detailSections: [
      { level: 1, title: "长安", anchor: "1-长安" },
      { level: 2, title: "一句话", anchor: "2-一句话" },
      { level: 2, title: "形貌", anchor: "3-形貌" },
      { level: 2, title: "大唐天宝十四载（755年）", anchor: "4-大唐天宝十四载-755年" }
    ],
    sourceQuality: "verified",
    docPath: "docs/05-epoch/tang-755/cities/长安.md"
  });
});

test("Line B legacy plural category names normalize to runtime categories", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "lineb-poi-"));
  const docsRoot = path.join(tmp, "docs", "05-epoch", "tang-755");
  await fs.mkdir(path.join(docsRoot, "relics"), { recursive: true });
  await fs.writeFile(
    path.join(docsRoot, "relics", "白马寺.md"),
    `---
type: poi
category: relics
geo: {lat: 34.7227, lon: 112.5944}
visual_hierarchy: large
---

# 白马寺

## 一句话

洛阳城东的佛寺。
`,
    "utf8"
  );

  const entries = await scanPoiDocs(tmp);

  assert.equal(entries.length, 1);
  assert.equal(entries[0].id, "baima-si");
  assert.equal(entries[0].category, "relic");
});

test("Line B low visual hierarchy normalizes to small", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "lineb-poi-"));
  const docsRoot = path.join(tmp, "docs", "05-epoch", "tang-755");
  await fs.mkdir(path.join(docsRoot, "cities"), { recursive: true });
  await fs.writeFile(
    path.join(docsRoot, "cities", "朔州.md"),
    `---
type: poi
category: city
geo: {lat: 39.33, lon: 112.43}
visual_hierarchy: low
---

# 朔州

## 一句话

雁门关北第一州。
`,
    "utf8"
  );

  const entries = await scanPoiDocs(tmp);

  assert.equal(entries.length, 1);
  assert.equal(entries[0].hierarchy, "small");
});

test("Line B high visual hierarchy normalizes to large", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "lineb-poi-"));
  const docsRoot = path.join(tmp, "docs", "05-epoch", "tang-755");
  await fs.mkdir(path.join(docsRoot, "scenic"), { recursive: true });
  await fs.writeFile(
    path.join(docsRoot, "scenic", "泰山.md"),
    `---
type: poi
category: scenic
geo: {lat: 36.2566, lon: 117.101}
visual_hierarchy: high
---

# 泰山

## 一句话

东岳。
`,
    "utf8"
  );

  const entries = await scanPoiDocs(tmp);

  assert.equal(entries.length, 1);
  assert.equal(entries[0].hierarchy, "large");
});

test("Line B Tang admin fields classify cross-road routes into the ancient roads nav group", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "lineb-poi-"));
  const docsRoot = path.join(tmp, "docs", "05-epoch", "tang-755");
  await fs.mkdir(path.join(docsRoot, "transport"), { recursive: true });
  await fs.writeFile(
    path.join(docsRoot, "transport", "褒斜道.md"),
    `---
type: poi
category: transport
region: qinling
region_name: "秦岭与汉水"
subregion: north-qinling
subregion_name: "秦岭北麓"
kind: route
kind_name: "道路"
tang_polity: tang
tang_dao: [guannei, shannan-west]
tang_admin: [fengxiang-fu, liangzhou]
geo: {lat: 33.67, lon: 107.39}
visual_hierarchy: medium
---

# 褒斜道

## 一句话

关中入汉中的秦岭古道。
`,
    "utf8"
  );

  const entries = await scanPoiDocs(tmp);

  assert.equal(entries.length, 1);
  assert.deepEqual(entries[0].tangDao, ["guannei", "shannan-west"]);
  assert.deepEqual(entries[0].tangAdmin, ["fengxiang-fu", "liangzhou"]);
  assert.equal(entries[0].tangNavGroup, "ancient-roads");
});

test("Line B non-Tang polity POIs remain outside direct Tang dao groups", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "lineb-poi-"));
  const docsRoot = path.join(tmp, "docs", "05-epoch", "tang-755");
  await fs.mkdir(path.join(docsRoot, "cities"), { recursive: true });
  await fs.writeFile(
    path.join(docsRoot, "cities", "白崖城.md"),
    `---
type: poi
category: city
region: nanzhao
region_name: "南诏云南"
subregion: nanzhao-yunnan
subregion_name: "南诏云南"
kind: city
kind_name: "城市州郡"
tang_polity: nanzhao
tang_dao: null
tang_admin: nanzhao-liuzhao-guodi
geo: {lat: 25.51, lon: 100.57}
visual_hierarchy: medium
---

# 白崖城

## 一句话

南诏腹地的城。
`,
    "utf8"
  );

  const entries = await scanPoiDocs(tmp);

  assert.equal(entries.length, 1);
  assert.equal(entries[0].tangDao, null);
  assert.equal(entries[0].tangNavGroup, "non-tang-direct");
});
