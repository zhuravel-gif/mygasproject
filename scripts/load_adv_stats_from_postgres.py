"""
Script to export advertising statistics from Postgres.

This script retrieves data from the `wb_adv` table for the
last 365 days. The selected columns cover the fields necessary to
build sales funnels and calculate DRR: the date of the statistic,
Wildberries article (`nmid`), number of views, number of clicks,
number of added to cart events (`atbs` in source, exported as
`to_cart`), number of orders, advertising spend (`sum` in source,
exported as `price`), cost per click (`cpc`) and, optionally,
`sum_price` which may represent another monetary metric. The query
aliases the columns so that downstream consumers (DuckDB SQL) can
expect consistent names: `operation_date`, `to_cart`, and `price`.

If `nmid` does not exist in the source, you will need to adjust the
query to join with another table that maps `advertid` to `nmid`.

Results are written to `data/raw/adv_stats.csv` with UTF‑8 BOM
encoding. An empty result raises an error.
"""

import os
from pathlib import Path

import pandas as pd
import psycopg


# SQL selecting advertising statistics for the last 365 days. We select
# only the relevant columns for the dashboard. Adjust as needed when
# more fields are required. The query aliases columns from `wb_adv`
# to match the expectations of downstream scripts: `date` becomes
# `operation_date`, `atbs` becomes `to_cart`, and `sum` becomes `price`.
# `sum_price` is also selected for completeness but may not be used in
# calculations yet.
SQL_ADV_STATS = """
SELECT
  date AS operation_date,
  nmid,
  views,
  clicks,
  atbs AS to_cart,
  orders,
  sum_price,
  cpc,
  "sum" AS price
FROM wb_adv
WHERE date >= CURRENT_DATE - INTERVAL '365 days'
"""


def main() -> None:
    repo_root = Path(__file__).resolve().parent.parent
    out_dir = repo_root / "data" / "raw"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "adv_stats.csv"

    conn = psycopg.connect(
        host=os.environ["POSTGRES_HOST"],
        port=int(os.environ["POSTGRES_PORT"]),
        dbname=os.environ["POSTGRES_DB"],
        user=os.environ["POSTGRES_USER"],
        password=os.environ["POSTGRES_PASSWORD"],
        sslmode=os.environ.get("POSTGRES_SSLMODE", "prefer"),
    )
    try:
        df = pd.read_sql_query(SQL_ADV_STATS, conn)
    finally:
        conn.close()

    if df.empty:
        raise RuntimeError(
            "Таблица wb_adv из Postgres вернулась пустой за 365 дней"
        )

    df.to_csv(out_path, index=False, encoding="utf-8-sig")
    print(f"Exported adv_stats to: {out_path}")
    print(f"Rows exported: {len(df)}")


if __name__ == "__main__":
    main()