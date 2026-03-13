from pathlib import Path
import csv

import duckdb


def main():
    repo_root = Path(__file__).resolve().parent.parent
    raw_dir = repo_root / "data" / "raw"
    out_dir = repo_root / "data" / "out"
    sql_dir = repo_root / "duckdb"

    raw_dir.mkdir(parents=True, exist_ok=True)
    out_dir.mkdir(parents=True, exist_ok=True)

    info_csv = raw_dir / "info.csv"
    orders_csv = raw_dir / "orders.csv"
    report_csv = out_dir / "report.csv"
    sql_path = sql_dir / "report.sql"

    if not info_csv.exists():
        raise FileNotFoundError(f"Не найден файл Info: {info_csv}")

    if not orders_csv.exists():
        raise FileNotFoundError(f"Не найден файл orders: {orders_csv}")

    sql = sql_path.read_text(encoding="utf-8")
    sql = sql.replace("__REPORT_CSV_PATH__", str(report_csv).replace("\\", "/"))

    con = duckdb.connect()

    info_path = str(info_csv).replace("\\", "/")
    orders_path = str(orders_csv).replace("\\", "/")

    con.execute(
        f"""
        CREATE OR REPLACE VIEW info_src AS
        SELECT *
        FROM read_csv_auto(
          '{info_path}',
          header = true,
          all_varchar = true,
          ignore_errors = true
        )
        """
    )

    con.execute(
        f"""
        CREATE OR REPLACE VIEW orders_src AS
        SELECT *
        FROM read_csv_auto(
          '{orders_path}',
          header = true,
          all_varchar = true,
          ignore_errors = true
        )
        """
    )

    con.execute(sql)

    print(f"Built report: {report_csv}")

    with report_csv.open("r", newline="", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        header = next(reader, [])
        print("REPORT HEADER FROM CSV:", header)
        print("REPORT COLUMN COUNT:", len(header))


if __name__ == "__main__":
    main()