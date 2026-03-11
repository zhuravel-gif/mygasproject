const IMPORT_LOG_SHEET_NAME = 'logs';
const IMPORT_LOG_HEADERS = ['Timestamp', 'Job', 'Status', 'Rows', 'Message', 'Details'];

function appendImportLog_(status, message, meta) {
  const sheet = getOrCreateImportLogSheet_();
  const payload = meta || {};
  const details = payload.details !== undefined ? payload.details : '';
  const rows = payload.rows !== undefined ? payload.rows : '';

  sheet.appendRow([
    new Date(),
    'XLSX import',
    status,
    rows,
    message || '',
    details
  ]);
}

function getOrCreateImportLogSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(IMPORT_LOG_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(IMPORT_LOG_SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, IMPORT_LOG_HEADERS.length).setValues([IMPORT_LOG_HEADERS]);
  }

  return sheet;
}
