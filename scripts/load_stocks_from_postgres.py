"""
Script for exporting stocks data from Postgres.

This script connects to the configured Postgres instance and
retrieves stock balances for the last 365 calendar days. Only
relevant columns are selected: the date of change, the Wildberries
article (`nmid`), the quantity of goods, the type of stock (tip) and
the name of the Wildberries warehouse (`warehousename`).

The result is written to `data/raw/stocks.csv` in UTF‑8 with BOM
encoding to remain consistent with other exports. If the query
returns no rows the script will raise a RuntimeError so failures are
detected early during ETL runs.

Environment variables required:
  - POSTGRES_HOST
  - POSTGRES_PORT
  - POSTGRES_DB
  - POSTGRES_USER
  - POSTGRES_PASSWORD
  - POSTGRES_SSLMODE (optional, defaults to "prefer")

"""

import os
from pathlib import Path

import pandas as pd
import psycopg


# SQL that selects stocks for the last 365 days. We cast the date field
# to a date type so DuckDB can later operate on a simple date column.
SQL_STOCKS = """
SELECT
  lastchangedate,
  nmid,
  quantity,
  tip,
  warehousename
FROM stocks
WHERE lastchangedate >= CURRENT_DATE - INTERVAL '365 days'
"""


def main() -> None:
    """Run the export of stocks into a CSV file."""
    # Determine where to write the CSV file within the repository.
    repo_root = Path(__file__).resolve().parent.parent
    out_dir = repo_root / "data" / "raw"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "stocks.csv"

    # Build connection to Postgres using environment variables. SSL mode is
    # optional and falls back to "prefer". See psycopg documentation for
    # details.
    conn = psycopg.connect(
        host=os.environ["POSTGRES_HOST"],
        port=int(os.environ["POSTGRES_PORT"]),
        dbname=os.environ["POSTGRES_DB"],
        user=os.environ["POSTGRES_USER"],
        password=os.environ["POSTGRES_PASSWORD"],
        sslmode=os.environ.get("POSTGRES_SSLMODE", "prefer"),
    )
    try:
        # Read the query directly into a DataFrame. This keeps all
        # conversions consistent with pandas types. We do not coerce types
        # here; DuckDB will handle them later.
        df = pd.read_sql_query(SQL_STOCKS, conn)
    finally:
        conn.close()

    if df.empty:
        raise RuntimeError(
            "Таблица stocks из Postgres вернулась пустой за 365 дней"
        )

    # Write out as CSV with a BOM to maintain compatibility with Excel and
    # the rest of the pipeline.
    df.to_csv(out_path, index=False, encoding="utf-8-sig")
    print(f"Exported stocks to: {out_path}")
    print(f"Rows exported: {len(df)}")


if __name__ == "__main__":
    main()