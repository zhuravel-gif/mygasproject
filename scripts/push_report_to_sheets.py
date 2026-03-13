import csv
from pathlib import Path

from common_gsheets import ensure_worksheet, get_repo_root, get_spreadsheet


REPORT_SHEET_NAME = "report"


def read_csv_rows(path: Path):
    with path.open("r", newline="", encoding="utf-8-sig") as f:
        return list(csv.reader(f))


def chunked(seq, size):
    for i in range(0, len(seq), size):
        yield seq[i:i + size]


def main():
    repo_root = get_repo_root()
    report_csv = repo_root / "data" / "out" / "report.csv"

    if not report_csv.exists():
        raise FileNotFoundError(f"Не найден report.csv: {report_csv}")

    rows = read_csv_rows(report_csv)
    if not rows:
        raise RuntimeError("report.csv пустой")

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

    print(f"Uploaded report to worksheet '{REPORT_SHEET_NAME}'")
    print(f"Rows uploaded: {len(rows)}")


if __name__ == "__main__":
    main()