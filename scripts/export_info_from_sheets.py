import csv
from pathlib import Path

from common_gsheets import get_repo_root, get_spreadsheet


INFO_SHEET_NAME = "Info"


def main():
    repo_root = get_repo_root()
    out_dir = repo_root / "data" / "raw"
    out_dir.mkdir(parents=True, exist_ok=True)

    out_path = out_dir / "info.csv"

    spreadsheet = get_spreadsheet()
    worksheet = spreadsheet.worksheet(INFO_SHEET_NAME)

    values = worksheet.get_all_values()

    if not values:
        raise RuntimeError("Лист Info пустой")

    with out_path.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerows(values)

    print(f"Exported Info to: {out_path}")
    print(f"Rows exported: {len(values)}")


if __name__ == "__main__":
    main()