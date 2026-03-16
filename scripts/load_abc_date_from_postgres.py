"""
Script to export margin data from the `abc_date` table.

Currently, the user defines “маржинальная выручка” (margin revenue)
from the `abc_date` table. This script selects the date, article
(`nm_id`) and margin (`marga`) for the last 365 days. Additional
columns can be added here later if further metrics are required.

Output is written to `data/raw/abc_date.csv` in UTF‑8 with BOM
encoding. If the result is empty, an error is thrown.
"""

import os
from pathlib import Path

import pandas as pd
import psycopg


# SQL to select the margin from abc_date for the last 365 days.
SQL_ABC_DATE = """
SELECT
  date,
  nm_id,
  marga
FROM abc_date
WHERE date >= CURRENT_DATE - INTERVAL '365 days'
"""


def main() -> None:
    repo_root = Path(__file__).resolve().parent.parent
    out_dir = repo_root / "data" / "raw"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "abc_date.csv"

    conn = psycopg.connect(
        host=os.environ["POSTGRES_HOST"],
        port=int(os.environ["POSTGRES_PORT"]),
        dbname=os.environ["POSTGRES_DB"],
        user=os.environ["POSTGRES_USER"],
        password=os.environ["POSTGRES_PASSWORD"],
        sslmode=os.environ.get("POSTGRES_SSLMODE", "prefer"),
    )
    try:
        df = pd.read_sql_query(SQL_ABC_DATE, conn)
    finally:
        conn.close()

    if df.empty:
        raise RuntimeError(
            "Таблица abc_date из Postgres вернулась пустой за 365 дней"
        )

    df.to_csv(out_path, index=False, encoding="utf-8-sig")
    print(f"Exported abc_date to: {out_path}")
    print(f"Rows exported: {len(df)}")


if __name__ == "__main__":
    main()