#!/usr/bin/env python3
"""把 results.jsonl 构建成 SQLite 数据集（可重复执行，幂等）。

安全约束（Mimosa）：所有 SQL 一律参数绑定（? 占位），禁止拼接/format/f-string 组装。

用法：
    python3 scripts/build_dataset.py     # 构建并打印统计
"""

from __future__ import annotations

import json
import os
import sqlite3
import sys
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RESULTS_PATH = os.path.join(ROOT, "data", "raw", "chaoyang", "results.jsonl")
DB_PATH = os.path.join(ROOT, "data", "chaoyang_2026.sqlite")


def create_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS meta (
            key   TEXT PRIMARY KEY,
            value TEXT
        );
        CREATE TABLE IF NOT EXISTS communities (
            name            TEXT PRIMARY KEY,
            success         INTEGER NOT NULL,
            school_main     TEXT,
            schools_after30 TEXT,
            duo             INTEGER,
            same            INTEGER,
            raw             TEXT NOT NULL,
            fetched_at      TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_school_main ON communities(school_main);
        CREATE INDEX IF NOT EXISTS idx_success ON communities(success);
        """
    )


def insert_community(conn: sqlite3.Connection, row: tuple) -> None:
    conn.execute(
        "INSERT OR REPLACE INTO communities VALUES (?, ?, ?, ?, ?, ?, ?, ?)", row
    )


def insert_meta(conn: sqlite3.Connection, key: str, value: str) -> None:
    conn.execute("INSERT OR REPLACE INTO meta VALUES (?, ?)", (key, value))


def load_latest_records() -> dict[str, dict]:
    """同小区取最后一次记录（--retry-failed 会产生新行）。"""
    latest: dict[str, dict] = {}
    with open(RESULTS_PATH, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            if rec.get("name"):
                latest[rec["name"]] = rec
    return latest


def to_row(name: str, rec: dict) -> tuple:
    ok = bool(rec.get("ok"))
    resp = rec.get("resp") or {}
    success = 1 if (ok and resp.get("success")) else 0
    return (
        name,
        success,
        json.dumps(resp.get("data", []), ensure_ascii=False) if ok else None,
        json.dumps(resp.get("after30", []), ensure_ascii=False) if ok else None,
        1 if resp.get("duo") else 0,
        1 if resp.get("same") else 0,
        json.dumps(rec, ensure_ascii=False),
        rec.get("ts", ""),
    )


def main() -> int:
    if not os.path.exists(RESULTS_PATH):
        print("results.jsonl 不存在，先完成数据采集", file=sys.stderr)
        return 1

    conn = sqlite3.connect(DB_PATH)
    create_schema(conn)
    conn.execute("DELETE FROM communities")

    latest = load_latest_records()
    ok_n = 0
    school_set = set()
    for name, rec in latest.items():
        row = to_row(name, rec)
        insert_community(conn, row)
        if row[1]:
            ok_n += 1
            school_set.update(rec.get("resp", {}).get("data", []))

    built_at = datetime.now(timezone.utc).isoformat()
    insert_meta(conn, "district", "朝阳区")
    insert_meta(conn, "source", "http://xqcx.bjchyedu.cn/ 2026年朝阳区住宅区对应入学服务片查询（小学）")
    insert_meta(conn, "school_stage", "小学")
    insert_meta(conn, "built_at", built_at)
    insert_meta(conn, "records", str(len(latest)))
    conn.commit()

    total = conn.execute("SELECT COUNT(*) FROM communities").fetchone()[0]
    print(f"小区总数: {total} | 有对应学校: {ok_n} | 查无结果: {total - ok_n} | 涉及小学数: {len(school_set)}")
    conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
