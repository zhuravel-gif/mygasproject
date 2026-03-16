"""
Upload report2.csv to a separate worksheet in Google Sheets.

This script locates `data/out/report2.csv` and uploads its contents
into a worksheet named "report2". If the worksheet does not exist it
will be created. Existing data in the sheet is cleared before the new
content is written. The upload is chunked to handle large reports.

Requires the environment variables defined in `common_gsheets.py` for
Google authentication and spreadsheet ID.
"""

import csv
from pathlib import Path

from common_gsheets import ensure_worksheet, get_repo_root, get_spreadsheet


REPORT_SHEET_NAME = "report2"


def read_csv_rows(path: Path):
    with path.open("r", newline="", encoding="utf-8-sig") as f:
        return list(csv.reader(f))


def chunked(seq, size):
    for i in range(0, len(seq), size):
        yield seq[i:i + size]


def main() -> None:
    repo_root = get_repo_root()
    report_csv = repo_root / "data" / "out" / "report2.csv"

    if not report_csv.exists():
        raise FileNotFoundError(f"Не найден report2.csv: {report_csv}")

    rows = read_csv_rows(report_csv)
    if not rows:
        raise RuntimeError("report2.csv пустой")

    header = rows[0]
    print("UPLOAD HEADER TO SHEETS:", header)
    print("UPLOAD COLUMN COUNT:", len(header))

    spreadsheet = get_spreadsheet()
    print("TARGET SPREADSHEET ID:", spreadsheet.id)
    print("TARGET SPREADSHEET TITLE:", spreadsheet.title)

    worksheet = ensure_worksheet(
        spreadsheet,
        REPORT_SHEET_NAME,
        rows=max(len(rows), 1000),
        cols=max(len(rows[0]), 50),
    )

    print("TARGET WORKSHEET TITLE:", worksheet.title)

    worksheet.clear()

    batch_size = 5000
    start_row = 1

    for chunk in chunked(rows, batch_size):
        worksheet.update(f"A{start_row}", chunk, value_input_option="RAW")
        start_row += len(chunk)

    print(f"Uploaded report2 to worksheet '{REPORT_SHEET_NAME}'")
    print(f"Rows uploaded: {len(rows)}")


if __name__ == "__main__":
    main()