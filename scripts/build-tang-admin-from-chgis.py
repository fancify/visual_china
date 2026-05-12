#!/usr/bin/env python3
"""
Build Tang 755 admin geography data from CHGIS V6 shapefiles.

Input:
  data/references/chgis-v6/extracted/cnty_pts/v6_time_cnty_pts_utf_wgs84.shp
  data/references/chgis-v6/extracted/pref_pts/v6_time_pref_pts_utf_wgs84.shp
  data/references/chgis-v6/extracted/pref_pgn/v6_time_pref_pgn_utf_wgs84.shp

Filter: BEG_YR <= 755 AND END_YR >= 755 (Tang Xuanzong 天宝十四载 epoch)

Output: public/data/tang-755/
  counties.json          (~1470 entries, county-level admin pts)
  prefectures.json       (~339 entries, prefecture/府 治所)
  prefecture-polygons.json (~121 entries, 州/府 疆域 polygon)
  manifest.json          (counts + provenance)

Source: CHGIS V6 by Harvard CGA + 复旦大学历史地理研究中心
  https://chgis.fas.harvard.edu/
  Berman, Lex, 2017. v6_time_*_utf_wgs84

Usage:
  python3 scripts/build-tang-admin-from-chgis.py
"""

import os
import sys
import json
import shapefile  # pyshp

TANG_YR = 755
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC_BASE = os.path.join(ROOT, "data/references/chgis-v6/extracted")
OUT_DIR = os.path.join(ROOT, "public/data/tang-755")

DATASETS = [
    ("counties", f"{SRC_BASE}/cnty_pts/v6_time_cnty_pts_utf_wgs84", "POINT"),
    ("prefectures", f"{SRC_BASE}/pref_pts/v6_time_pref_pts_utf_wgs84", "POINT"),
    ("prefecture-polygons", f"{SRC_BASE}/pref_pgn/v6_time_pref_pgn_utf_wgs84", "POLYGON"),
]


def get_field_index(fields, name):
    for i, f in enumerate(fields[1:]):  # skip deletion flag
        if f[0] == name:
            return i
    return None


def filter_and_export(sf, kind):
    fields = sf.fields
    idx = {
        "name_ch": get_field_index(fields, "NAME_CH"),
        "name_py": get_field_index(fields, "NAME_PY"),
        "type_ch": get_field_index(fields, "TYPE_CH"),
        "type_py": get_field_index(fields, "TYPE_PY"),
        "lev": get_field_index(fields, "LEV_RANK"),
        "pres_loc": get_field_index(fields, "PRES_LOC"),
        "beg_yr": get_field_index(fields, "BEG_YR"),
        "end_yr": get_field_index(fields, "END_YR"),
        "sys_id": get_field_index(fields, "SYS_ID"),
        "obj_type": get_field_index(fields, "OBJ_TYPE"),
    }
    def f(rec, key, default=None):
        i = idx[key]
        return rec[i] if i is not None else default

    entries = []
    for shape_rec in sf.shapeRecords():
        rec = shape_rec.record
        beg = f(rec, "beg_yr") or -9999
        end = f(rec, "end_yr") or 9999
        if not (beg <= TANG_YR <= end):
            continue
        sys_id = f(rec, "sys_id")
        base = {
            "id": int(sys_id) if sys_id else None,
            "nameCH": f(rec, "name_ch"),
            "namePY": f(rec, "name_py"),
            "type": f(rec, "type_ch"),
            "typePY": f(rec, "type_py"),
            "level": f(rec, "lev"),
            "modernLoc": f(rec, "pres_loc"),
            "begYr": beg,
            "endYr": end,
        }
        # drop None values for compactness
        base = {k: v for k, v in base.items() if v not in (None, "")}
        shape = shape_rec.shape
        if kind == "POINT":
            if not shape.points:
                continue
            pt = shape.points[0]
            base["lon"] = round(pt[0], 5)
            base["lat"] = round(pt[1], 5)
        else:  # POLYGON
            # shape.points: flat list, shape.parts: ring-start indices
            if not shape.points or len(shape.parts) == 0:
                continue
            rings = []
            parts = list(shape.parts) + [len(shape.points)]
            for i in range(len(parts) - 1):
                ring = shape.points[parts[i] : parts[i + 1]]
                # Reduce precision (5 decimal ~1m) + skip degenerate
                if len(ring) < 3:
                    continue
                rings.append([[round(p[0], 5), round(p[1], 5)] for p in ring])
            if not rings:
                continue
            base["rings"] = rings
        entries.append(base)
    return entries


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    manifest = {
        "schemaVersion": "visual-china.tang-admin.v1",
        "epoch": "Tang 755 (天宝十四载)",
        "source": "CHGIS V6 (Harvard CGA + Fudan Univ)",
        "url": "https://chgis.fas.harvard.edu/",
        "citation": "Berman, Lex (2017). v6_time_*_utf_wgs84. Harvard Dataverse.",
        "filter": f"BEG_YR <= {TANG_YR} AND END_YR >= {TANG_YR}",
        "datasets": {},
    }

    for name, base, kind in DATASETS:
        print(f"  Loading {name} ({kind})...")
        sf = shapefile.Reader(base)
        entries = filter_and_export(sf, kind)
        out_file = os.path.join(OUT_DIR, f"{name}.json")
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(entries, f, ensure_ascii=False, separators=(",", ":"))
        size_kb = os.path.getsize(out_file) / 1024
        print(f"    {len(entries)} entries → {out_file} ({size_kb:.1f} KB)")
        manifest["datasets"][name] = {
            "kind": kind,
            "count": len(entries),
            "file": f"{name}.json",
            "sizeKB": round(size_kb, 1),
        }

    manifest_path = os.path.join(OUT_DIR, "manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(f"\nManifest: {manifest_path}")


if __name__ == "__main__":
    main()
