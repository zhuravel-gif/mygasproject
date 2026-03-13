import os
from pathlib import Path

import pandas as pd
import psycopg


ORDERS_SQL = """
SELECT
  date,
  lastchangedate,
  supplierarticle,
  techsize,
  totalprice,
  discountpercent,
  warehousename,
  incomeid,
  odid,
  nmid,
  subject,
  category,
  brand,
  iscancel,
  cancel_dt,
  gnumber,
  srid,
  dateupdate,
  lk,
  ordertype,
  spp,
  finishedprice,
  pricewithdisc,
  country,
  region,
  warehousetype
FROM orders
"""


def main():
    repo_root = Path(__file__).resolve().parent.parent
    out_dir = repo_root / "data" / "raw"
    out_dir.mkdir(parents=True, exist_ok=True)

    out_path = out_dir / "orders.csv"

    conn = psycopg.connect(
        host=os.environ["POSTGRES_HOST"],
        port=int(os.environ["POSTGRES_PORT"]),
        dbname=os.environ["POSTGRES_DB"],
        user=os.environ["POSTGRES_USER"],
        password=os.environ["POSTGRES_PASSWORD"],
        sslmode=os.environ.get("POSTGRES_SSLMODE", "prefer"),
    )

    try:
        df = pd.read_sql_query(ORDERS_SQL, conn)
    finally:
        conn.close()

    if df.empty:
        raise RuntimeError("Таблица orders из Postgres вернулась пустой")

    df.to_csv(out_path, index=False, encoding="utf-8-sig")
    print(f"Exported orders to: {out_path}")
    print(f"Rows exported: {len(df)}")


if __name__ == "__main__":
    main()