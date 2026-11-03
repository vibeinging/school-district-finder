#!/usr/bin/env python3
"""把 SQLite 数据集导出为前端静态数据文件（项目 web 目录下）。

产出全局数据对象（window.APP_DATA），由前端页面直接引入，
支持本地双击打开，无需服务器。所有读写路径均为项目内固定位置，
写入前做规范化与目录边界校验。运行方式见项目 README。
"""

from __future__ import annotations

import json
import os
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    from pypinyin import lazy_pinyin
except ImportError:
    print("需要 pypinyin（项目虚拟环境内安装）", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent


def load_rows() -> list[tuple]:
    db_path = (ROOT / "data" / "chaoyang_2026.sqlite").resolve()
    if not str(db_path).startswith(str(ROOT) + os.sep):
        raise ValueError(f"读取路径越界: {db_path}")
    conn = sqlite3.connect(db_path)
    try:
        return conn.execute(
            "SELECT name, school_main, schools_after30, duo, same FROM communities WHERE success = 1 ORDER BY name"
        ).fetchall()
    finally:
        conn.close()


def write_payload(payload: str) -> Path:
    out_dir = (ROOT / "web").resolve()
    out_path = out_dir / "data.js"
    if not str(out_path).startswith(str(out_dir) + os.sep):
        raise ValueError(f"输出路径越界: {out_path}")
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path.write_text(payload, encoding="utf-8")
    return out_path


def main() -> int:
    rows = load_rows()

    communities = []
    by_school: dict[str, dict[str, list[int]]] = {}
    for idx, (name, main_json, after_json, duo, same) in enumerate(rows):
        schools = json.loads(main_json or "[]")
        after30 = json.loads(after_json or "[]")
        py = lazy_pinyin(name)
        communities.append({
            "n": name,
            "p": "".join(py),
            "i": "".join(s[0] for s in py),
            "s": schools,
            "a": after30,
            "d": 1 if duo else 0,
            "m": 1 if same else 0,
        })
        for s in schools:
            by_school.setdefault(s, {"c": [], "a": []})["c"].append(idx)
        for s in after30:
            by_school.setdefault(s, {"c": [], "a": []})["a"].append(idx)

    schools = []
    for n, v in by_school.items():
        sp = lazy_pinyin(n)
        schools.append({
            "n": n,
            "p": "".join(sp),
            "i": "".join(s[0] for s in sp),
            "c": len(v["c"]),
            "ac": len(v["a"]),
        })
    schools.sort(key=lambda x: (-x["c"], x["n"]))

    data = {
        "meta": {
            "district": "朝阳区",
            "stage": "小学",
            "year": 2026,
            "count": len(communities),
            "school_count": len(schools),
            "cutoff": "2017-06-30",
            "built_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "source": "北京市朝阳区招生考试中心《2026年朝阳区住宅区对应入学服务片查询（小学）》",
        },
        "communities": communities,
        "schools": schools,
        "by_school": by_school,
    }

    payload = "window.APP_DATA=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n"
    out_path = write_payload(payload)

    size_mb = out_path.stat().st_size / 1024 / 1024
    print(f"导出完成: {out_path} ({size_mb:.2f} MB)")
    print(f"小区 {len(communities)} | 学校 {len(schools)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
