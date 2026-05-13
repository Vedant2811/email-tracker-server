"""
api/track.py
------------
Vercel serverless function — email open tracking pixel.

GET /api/track?id=EMAIL_ID
  Returns a 1x1 transparent GIF and logs the open event to Google Sheets.

Required environment variables:
  SPREADSHEET_ID           — Google Sheet to write to
  GOOGLE_CREDENTIALS_JSON  — Service account JSON (full contents as a string)
"""

import json
import os
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

import gspread
from google.oauth2.service_account import Credentials

# Minimal 1x1 transparent GIF (35 bytes)
_TRANSPARENT_GIF = (
    b"\x47\x49\x46\x38\x39\x61\x01\x00\x01\x00\x80\x00\x00"
    b"\xff\xff\xff\x00\x00\x00\x21\xf9\x04\x00\x00\x00\x00"
    b"\x00\x2c\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02"
    b"\x44\x01\x00\x3b"
)

_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
_HEADERS = ["Email ID", "Open Count", "First Opened", "Last Opened"]


def _get_sheet():
    creds_json = os.environ["GOOGLE_CREDENTIALS_JSON"]
    creds_dict = json.loads(creds_json)
    creds = Credentials.from_service_account_info(creds_dict, scopes=_SCOPES)
    gc = gspread.authorize(creds)
    spreadsheet_id = os.environ["SPREADSHEET_ID"]
    sh = gc.open_by_key(spreadsheet_id)
    try:
        ws = sh.worksheet("Tracking")
    except gspread.WorksheetNotFound:
        ws = sh.add_worksheet(title="Tracking", rows=1000, cols=4)
        ws.append_row(_HEADERS)
    return ws


def _log_open(email_id: str):
    ws = _get_sheet()
    now = datetime.now(tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    # Find existing row by Email ID (column 1)
    try:
        cell = ws.find(email_id, in_column=1)
    except gspread.exceptions.CellNotFound:
        cell = None

    if cell:
        row = cell.row
        open_count = int(ws.cell(row, 2).value or 0) + 1
        ws.update_cell(row, 2, open_count)
        ws.update_cell(row, 4, now)
    else:
        ws.append_row([email_id, 1, now, now])


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        email_id = params.get("id", [None])[0]

        if email_id:
            try:
                _log_open(email_id)
            except Exception:
                pass  # never block the pixel response on a sheet error

        self.send_response(200)
        self.send_header("Content-Type", "image/gif")
        self.send_header("Content-Length", str(len(_TRANSPARENT_GIF)))
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.end_headers()
        self.wfile.write(_TRANSPARENT_GIF)
