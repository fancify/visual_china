import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  buildPyramidPoiDetailHtml,
  buildPyramidPoiHoverHtml,
  formatPoiLocation,
  inferPoiFounded
} from "../src/game/pyramidPoiHud.ts";

const poi = {
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
  founded: "隋文帝开皇二年（582）",
  elevation: "海拔 400 米",
  elevationMeters: 400,
  detail: `# 长安

## 一句话

天宝十四载冬，唐人称百万家的城。

## 形貌

长安是一张方方正正、按图谱铺开的巨型棋盘。

## 大唐天宝十四载（755年）

朱雀大街贯穿南北，坊市钟鼓分明。`,
  sourceQuality: "verified",
  docPath: "docs/05-epoch/tang-755/cities/长安.md"
};

test("pyramid POI hover panel renders basic Line B facts and I-key hint", () => {
  const html = buildPyramidPoiHoverHtml(poi);

  assert.match(html, /长安/);
  assert.match(html, /所处位置/);
  assert.match(html, /34\.27°N, 108\.95°E/);
  assert.match(html, /始建年代/);
  assert.match(html, /隋文帝开皇二年/);
  assert.match(html, /海拔/);
  assert.match(html, /海拔 400 米/);
  assert.match(html, /按 I 查看详细信息/);
});

test("pyramid POI detail drawer renders longer detail text", () => {
  const html = buildPyramidPoiDetailHtml(poi);

  assert.doesNotMatch(html, /Line B 文档/);
  assert.doesNotMatch(html, /一句话简介/);
  assert.doesNotMatch(html, /详细简介/);
  assert.doesNotMatch(html, />详细介绍</);
  assert.match(html, /海拔 400 米/);
  assert.match(html, /data-poi-index-mode="geo"/);
  assert.match(html, /data-poi-index-mode="admin"/);
  assert.match(html, /地理分区 · 类型 · 地点/);
  assert.match(html, /唐制归属/);
  assert.match(html, /关内道/);
  assert.match(html, /京兆府/);
  assert.doesNotMatch(html, /guannei/);
  assert.doesNotMatch(html, /jingzhao-fu/);
  assert.match(html, /天宝十四载冬，唐人称百万家的城。/);
  assert.match(html, /朱雀大街贯穿南北/);
});

test("pyramid POI detail index can switch to Tang administrative grouping", () => {
  const html = buildPyramidPoiDetailHtml(poi, "admin");

  assert.match(html, /唐制行政 · 类型 · 地点/);
  assert.match(html, /pyramid-poi-index-tab-active[^>]*data-poi-index-mode="admin"/);
  assert.match(html, /关内道/);
  assert.match(html, /都城/);
  assert.match(html, /长安/);
});

test("pyramid demo opens POI details directly on double click", () => {
  const source = fs.readFileSync(new URL("../src/pyramid-demo.ts", import.meta.url), "utf8");

  assert.match(source, /addEventListener\("dblclick"/);
  assert.match(source, /poiHud\.showDetail\(hoveredPoi\)/);
});

test("pyramid POI hover card follows the pointer instead of a fixed bottom anchor", () => {
  const hudSource = fs.readFileSync(new URL("../src/game/pyramidPoiHud.ts", import.meta.url), "utf8");
  const demoSource = fs.readFileSync(new URL("../src/pyramid-demo.ts", import.meta.url), "utf8");

  assert.match(hudSource, /interface PoiHoverPointer/);
  assert.match(hudSource, /hoverPointer\.clientX \+ offset/);
  assert.doesNotMatch(hudSource, /bottom:\s*28px/);
  assert.match(demoSource, /lastPoiPointerClient = \{ clientX: event\.clientX, clientY: event\.clientY \}/);
  assert.match(demoSource, /poiHud\.setHoverTarget\(hoveredPoi, lastPoiPointerClient\)/);
});

test("POI HUD can infer founded text from common Line B phrasing", () => {
  assert.equal(inferPoiFounded("北魏太延元年（435）法定禅师所立的山中禅寺"), "北魏太延元年（435）");
  assert.equal(inferPoiFounded("三国吴黄武二年（223）始建于江畔"), "三国吴黄武二年（223）");
  assert.equal(inferPoiFounded("具体年代不可考，但唐时已存"), "未详");
});

test("formatPoiLocation keeps compact coordinate text for the hover card", () => {
  assert.equal(formatPoiLocation({ lat: 34.27, lon: 108.95 }), "34.27°N, 108.95°E");
});
