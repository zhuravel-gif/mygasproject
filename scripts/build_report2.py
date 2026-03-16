"""
Build report2.csv using DuckDB.

This script orchestrates the transformation of raw CSV exports into an
aggregated dataset for Dashboard 3. It reads the raw data files (info,
orders, stocks, sales, abc_date, adv_stats) into DuckDB, runs the
`report2.sql` script to compute daily metrics over the last 365 days,
and writes the result to `data/out/report2.csv`.

The SQL file relies on views named `info_src`, `orders_src`,
`stocks_src`, `sales_src`, `abc_src` and `adv_src` that point to the
respective CSVs. See `duckdb/report2.sql` for details.
"""

from pathlib import Path
import csv

import duckdb


def _norm(path: Path) -> str:
    """Return a DuckDB-safe forward-slash path string."""
    return str(path).replace("\\", "/")


def main() -> None:
    repo_root = Path(__file__).resolve().parent.parent
    raw_dir = repo_root / "data" / "raw"
    out_dir = repo_root / "data" / "out"
    sql_dir = repo_root / "duckdb"

    out_dir.mkdir(parents=True, exist_ok=True)

    info_csv = raw_dir / "info.csv"
    orders_csv = raw_dir / "orders.csv"
    stocks_csv = raw_dir / "stocks.csv"
    sales_csv = raw_dir / "sales.csv"
    abc_csv = raw_dir / "abc_date.csv"
    adv_csv = raw_dir / "adv_stats.csv"
    report_csv = out_dir / "report2.csv"
    sql_path = sql_dir / "report2.sql"

    for path in [info_csv, orders_csv, stocks_csv, sales_csv, abc_csv, adv_csv, sql_path]:
        if not path.exists():
            raise FileNotFoundError(f"Не найден файл: {path}")

    sql_template = sql_path.read_text(encoding="utf-8")
    sql = sql_template.replace("__REPORT2_CSV_PATH__", _norm(report_csv))

    con = duckdb.connect()

    def register_view(name: str, path: Path) -> None:
        csv_path = _norm(path)
        con.execute(
            f"""
            CREATE OR REPLACE VIEW {name} AS
            SELECT *
            FROM read_csv_auto(
              '{csv_path}',
              header = true,
              all_varchar = true,
              ignore_errors = true
            )
            """
        )

    register_view("info_src", info_csv)
    register_view("orders_src", orders_csv)
    register_view("stocks_src", stocks_csv)
    register_view("sales_src", sales_csv)
    register_view("abc_src", abc_csv)
    register_view("adv_src", adv_csv)

    con.execute(sql)

    print(f"Built report2: {report_csv}")

    with report_csv.open("r", newline="", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        header = next(reader, [])
        print("REPORT2 HEADER FROM CSV:", header)
        print("REPORT2 COLUMN COUNT:", len(header))


if __name__ == "__main__":
    main()
