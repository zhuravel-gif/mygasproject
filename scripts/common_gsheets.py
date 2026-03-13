import json
import os
from pathlib import Path

import gspread
from google.oauth2.service_account import Credentials


SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]


def get_repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


def get_credentials():
    raw = os.environ["GOOGLE_SERVICE_ACCOUNT_JSON"]
    info = json.loads(raw)
    return Credentials.from_service_account_info(info, scopes=SCOPES)


def get_spreadsheet():
    spreadsheet_id = os.environ["GOOGLE_SPREADSHEET_ID"]
    gc = gspread.authorize(get_credentials())
    return gc.open_by_key(spreadsheet_id)


def ensure_worksheet(spreadsheet, title: str, rows: int = 1000, cols: int = 50):
    try:
        return spreadsheet.worksheet(title)
    except gspread.WorksheetNotFound:
        return spreadsheet.add_worksheet(title=title, rows=rows, cols=cols)