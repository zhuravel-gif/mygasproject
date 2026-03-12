const IMPORT_CONFIG = {
  SOURCE_FOLDER_ID: '1xdR6UTj8kpiuu3YqdDbty2tZTl8jM9e7',
  TARGET_SHEET_NAME: 'Info',
  DELETE_TEMP_CONVERTED_FILE: true
};

/**
 * Открывает модальное окно импорта.
 */
function showImportXlsxDialog() {
  const html = HtmlService.createHtmlOutputFromFile('ImportXlsxDialog')
    .setWidth(560)
    .setHeight(500);

  SpreadsheetApp.getUi().showModalDialog(html, 'Импорт XLSX в Info');
}

/**
 * Возвращает список XLSX-файлов из папки для выбора в диалоге.
 */
function getImportableFiles() {
  validateImportConfig_();

  const folder = DriveApp.getFolderById(IMPORT_CONFIG.SOURCE_FOLDER_ID);
  const files = folder.getFiles();
  const result = [];

  while (files.hasNext()) {
    const file = files.next();
    const name = file.getName();

    if (!name.toLowerCase().endsWith('.xlsx')) {
      continue;
    }

    result.push({
      id: file.getId(),
      name: name,
      updated: file.getLastUpdated().getTime(),
      updatedFormatted: Utilities.formatDate(
        file.getLastUpdated(),
        Session.getScriptTimeZone(),
        'dd.MM.yyyy HH:mm:ss'
      )
    });
  }

  result.sort(function(a, b) {
    return b.updated - a.updated;
  });

  return {
    targetSheetName: IMPORT_CONFIG.TARGET_SHEET_NAME,
    files: result
  };
}

/**
 * Импорт выбранного XLSX из HTML-диалога.
 */
function importSelectedXlsxToInfo(fileId) {
  return importXlsxFileToInfoCore_(fileId);
}

/**
 * Отдельная функция для триггера:
 * берёт самый свежий XLSX из папки и импортирует его в Info без UI.
 */
function importLatestXlsxToInfoForTrigger() {
  validateImportConfig_();

  const latestFile = getLatestXlsxFileFromFolder_(IMPORT_CONFIG.SOURCE_FOLDER_ID);

  if (!latestFile) {
    return {
      ok: false,
      message: 'В указанной папке не найдено ни одного .xlsx файла.'
    };
  }

  return importXlsxFileToInfoCore_(latestFile.getId());
}

/**
 * Общая логика импорта XLSX в Info.
 *
 * Логика:
 * 1. Конвертируем XLSX во временный Google Sheets
 * 2. Берём 1 строку как заголовки источника
 * 3. Импортируем данные со 2 строки
 * 4. Строим лист Info строго по INFO_SCHEMA
 * 5. Если какого-то sourceHeader нет в XLSX — в колонке будут пустые значения
 */
function importXlsxFileToInfoCore_(fileId) {
  validateImportConfig_();

  if (!fileId) {
    return {
      ok: false,
      message: 'Не выбран файл для импорта.'
    };
  }

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const targetSheet = getOrCreateSheet_(spreadsheet, IMPORT_CONFIG.TARGET_SHEET_NAME);

  let sourceFile;
  let tempSpreadsheetId = null;

  try {
    sourceFile = DriveApp.getFileById(fileId);

    if (!sourceFile.getName().toLowerCase().endsWith('.xlsx')) {
      throw new Error('Выбранный файл не является XLSX.');
    }

    tempSpreadsheetId = convertExcelToGoogleSheet_(sourceFile);
    SpreadsheetApp.flush();

    const tempSpreadsheet = SpreadsheetApp.openById(tempSpreadsheetId);
    const sourceSheet = tempSpreadsheet.getSheets()[0];

    if (!sourceSheet) {
      throw new Error('Во временно конвертированном файле не найден ни один лист.');
    }

    const allValues = sourceSheet.getDataRange().getValues();

    if (!allValues.length) {
      writeInfoSheet_(targetSheet, []);
      return {
        ok: true,
        fileName: sourceFile.getName(),
        targetSheetName: IMPORT_CONFIG.TARGET_SHEET_NAME,
        rows: 0,
        columns: INFO_SCHEMA.length,
        message: 'Файл пустой. В лист Info записаны только заголовки.'
      };
    }

    const sourceHeaders = normalizeHeaderRow_(allValues[0]);
    const sourceIndexMap = buildSourceIndexMap_(sourceHeaders);

    // Данные только со 2 строки
    const sourceDataRows = allValues.slice(1);

    const mappedRows = sourceDataRows.map(function(row) {
      return INFO_SCHEMA.map(function(col) {
        const sourceIndex = sourceIndexMap[col.sourceHeader];
        return sourceIndex === undefined ? '' : safeCellValue_(row[sourceIndex]);
      });
    });

    writeInfoSheet_(targetSheet, mappedRows);

    SpreadsheetApp.flush();

    return {
      ok: true,
      fileName: sourceFile.getName(),
      targetSheetName: IMPORT_CONFIG.TARGET_SHEET_NAME,
      rows: mappedRows.length,
      columns: INFO_SCHEMA.length,
      message:
        'Импорт завершён. Файл: ' + sourceFile.getName() +
        '. Обработано строк: ' + mappedRows.length +
        ', столбцов: ' + INFO_SCHEMA.length + '.'
    };
  } catch (error) {
    return {
      ok: false,
      fileName: sourceFile ? sourceFile.getName() : '',
      message: error.message || String(error)
    };
  } finally {
    if (tempSpreadsheetId && IMPORT_CONFIG.DELETE_TEMP_CONVERTED_FILE) {
      try {
        DriveApp.getFileById(tempSpreadsheetId).setTrashed(true);
      } catch (cleanupError) {
        Logger.log('Не удалось удалить временный файл: ' + cleanupError);
      }
    }
  }
}

function validateImportConfig_() {
  if (!IMPORT_CONFIG.SOURCE_FOLDER_ID || IMPORT_CONFIG.SOURCE_FOLDER_ID === 'PASTE_FOLDER_ID_HERE') {
    throw new Error('Не заполнен IMPORT_CONFIG.SOURCE_FOLDER_ID в файле ImportXlsx.gs');
  }

  if (!IMPORT_CONFIG.TARGET_SHEET_NAME) {
    throw new Error('Не заполнен IMPORT_CONFIG.TARGET_SHEET_NAME');
  }

  if (typeof INFO_SCHEMA === 'undefined' || !Array.isArray(INFO_SCHEMA) || !INFO_SCHEMA.length) {
    throw new Error('INFO_SCHEMA не найден. Проверь файл Schema.gs и его порядок в проекте.');
  }
}

function getOrCreateSheet_(spreadsheet, sheetName) {
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }
  return sheet;
}

function clearSheetFully_(sheet) {
  const filter = sheet.getFilter();
  if (filter) {
    filter.remove();
  }

  sheet.clearContents();
  sheet.clearFormats();
  sheet.clearNotes();

  const maxRows = sheet.getMaxRows();
  const maxCols = sheet.getMaxColumns();

  if (maxRows > 0 && maxCols > 0) {
    sheet.getRange(1, 1, maxRows, maxCols).clearDataValidations();
  }
}

function convertExcelToGoogleSheet_(file) {
  const resource = {
    title: '[TEMP IMPORT] ' + file.getName(),
    mimeType: 'application/vnd.google-apps.spreadsheet'
  };

  const convertedFile = Drive.Files.copy(resource, file.getId());
  return convertedFile.id;
}

function normalizeHeaderRow_(headerRow) {
  return headerRow.map(function(value) {
    return String(value).trim();
  });
}

function buildSourceIndexMap_(sourceHeaders) {
  const map = {};

  sourceHeaders.forEach(function(header, index) {
    if (!(header in map)) {
      map[header] = index;
    }
  });

  return map;
}

function safeCellValue_(value) {
  return value === undefined || value === null ? '' : value;
}

function getInfoHeaders_() {
  return INFO_SCHEMA.map(function(col) {
    return col.infoHeader;
  });
}

/**
 * Полностью переписывает лист Info:
 * 1 строка — фиксированные заголовки из INFO_SCHEMA
 * со 2 строки — импортированные данные
 */
function writeInfoSheet_(sheet, dataRows) {
  clearSheetFully_(sheet);

  const headers = getInfoHeaders_();
  const totalRows = Math.max(1, dataRows.length + 1);
  const totalCols = headers.length;

  ensureSheetSize_(sheet, totalRows, totalCols);

  // Заголовки
  sheet.getRange(1, 1, 1, totalCols).setValues([headers]);

  // Данные
  if (dataRows.length > 0) {
    sheet.getRange(2, 1, dataRows.length, totalCols).setValues(dataRows);
  }

  // Закрепляем первую строку
  sheet.setFrozenRows(1);
}

function ensureSheetSize_(sheet, requiredRows, requiredCols) {
  const currentRows = sheet.getMaxRows();
  const currentCols = sheet.getMaxColumns();

  if (currentRows < requiredRows) {
    sheet.insertRowsAfter(currentRows, requiredRows - currentRows);
  }

  if (currentCols < requiredCols) {
    sheet.insertColumnsAfter(currentCols, requiredCols - currentCols);
  }
}

function getLatestXlsxFileFromFolder_(folderId) {
  const folder = DriveApp.getFolderById(folderId);
  const files = folder.getFiles();

  let latestFile = null;
  let latestUpdated = 0;

  while (files.hasNext()) {
    const file = files.next();
    const name = file.getName().toLowerCase();

    if (!name.endsWith('.xlsx')) {
      continue;
    }

    const updated = file.getLastUpdated().getTime();
    if (!latestFile || updated > latestUpdated) {
      latestFile = file;
      latestUpdated = updated;
    }
  }

  return latestFile;
}