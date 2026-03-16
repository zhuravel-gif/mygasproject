"""
Script for exporting sales data from Postgres.

This script extracts sales for the last 365 calendar days. Only
non‑cancelled sales (`isstorno = 0`) are included. Each row in the
`sales` table represents one item sold, so counting rows gives the
sales volume. We select the sale date, Wildberries article (`nmid`),
final sale price (`forpay`), permanent customer discount (`spp`) and
legal entity identifier (`lk`).

The result is written to `data/raw/sales.csv` in UTF‑8 with BOM
encoding. If no rows are returned an error is raised.
"""

import os
from pathlib import Path

import pandas as pd
import psycopg


# SQL for selecting sales in the last 365 days. We filter out
# cancelled transactions (isstorno = 0) and cast the date to DATE.
SQL_SALES = """
SELECT
  date,
  nmid,
  forpay,
  spp,
  lk
FROM sales
WHERE date >= CURRENT_DATE - INTERVAL '365 days'
  AND COALESCE(isstorno, 0) = 0
"""


def main() -> None:
    repo_root = Path(__file__).resolve().parent.parent
    out_dir = repo_root / "data" / "raw"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "sales.csv"

    conn = psycopg.connect(
        host=os.environ["POSTGRES_HOST"],
        port=int(os.environ["POSTGRES_PORT"]),
        dbname=os.environ["POSTGRES_DB"],
        user=os.environ["POSTGRES_USER"],
        password=os.environ["POSTGRES_PASSWORD"],
        sslmode=os.environ.get("POSTGRES_SSLMODE", "prefer"),
    )
    try:
        df = pd.read_sql_query(SQL_SALES, conn)
    finally:
        conn.close()

    if df.empty:
        raise RuntimeError(
            "Таблица sales из Postgres вернулась пустой за 365 дней"
        )

    df.to_csv(out_path, index=False, encoding="utf-8-sig")
    print(f"Exported sales to: {out_path}")
    print(f"Rows exported: {len(df)}")


if __name__ == "__main__":
    main()