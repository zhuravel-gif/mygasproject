const IMPORT_CONFIG = {
  // Папка на Диске (используется для ручного импорта и как временная для Gmail)
  SOURCE_FOLDER_ID: '1xdR6UTj8kpiuu3YqdDbty2tZTl8jM9e7',
  TARGET_SHEET_NAME: 'Info',
  DELETE_TEMP_CONVERTED_FILE: true,
  
  // --- НАСТРОЙКИ ДЛЯ GMAIL (ДЛЯ ТРИГГЕРА) ---
  GMAIL_SEARCH_QUERY: 'from:zhuravel@rocknail.ru to:zhuravel@rocknail.ru subject:"Остатки товаров компании" has:attachment filename:xlsx',
  DELETE_EMAIL_AFTER_IMPORT: true, // Удалять письмо в корзину после успешного импорта
  DELETE_SAVED_ATTACHMENT: true // Удалять временный файл вложения с Диска
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
 * Возвращает список XLSX-файлов из папки для выбора в диалоге (Ручной импорт).
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
 * Импорт выбранного XLSX из HTML-диалога (Ручной импорт).
 */
function importSelectedXlsxToInfo(fileId) {
  return importXlsxFileToInfoCore_(fileId);
}

/**
 * АВТОМАТИЧЕСКИЙ ИМПОРТ ИЗ ПОЧТЫ (ДЛЯ ТРИГГЕРА):
 * Ищет последнее письмо в Gmail, берет XLSX-вложение, временно сохраняет на Диск, 
 * импортирует и удаляет письмо в Корзину.
 */
function importLatestXlsxFromGmailForTrigger() {
  validateImportConfig_();

  // Ищем письма по настроенному запросу
  const threads = GmailApp.search(IMPORT_CONFIG.GMAIL_SEARCH_QUERY, 0, 1);
  
  if (threads.length === 0) {
    Logger.log('Не найдено писем по запросу: ' + IMPORT_CONFIG.GMAIL_SEARCH_QUERY);
    return { ok: false, message: 'Писем с XLSX от zhuravel@rocknail.ru не найдено.' };
  }

  const thread = threads[0];
  const messages = thread.getMessages();
  const latestMessage = messages[messages.length - 1];
  
  const attachments = latestMessage.getAttachments();
  let xlsxAttachment = null;
  
  for (let i = 0; i < attachments.length; i++) {
    if (attachments[i].getName().toLowerCase().endsWith('.xlsx')) {
      xlsxAttachment = attachments[i];
      break;
    }
  }

  if (!xlsxAttachment) {
    return { ok: false, message: 'В найденном письме нет XLSX вложения.' };
  }

  // Временно сохраняем вложение на Диск
  const folder = DriveApp.getFolderById(IMPORT_CONFIG.SOURCE_FOLDER_ID);
  const tempFile = folder.createFile(xlsxAttachment);
  const tempFileId = tempFile.getId();
  
  let result;
  
  try {
    // Импортируем данные
    result = importXlsxFileToInfoCore_(tempFileId);
    
    // Если импорт успешен, перемещаем цепочку писем в Корзину
    if (result.ok && IMPORT_CONFIG.DELETE_EMAIL_AFTER_IMPORT) {
      thread.moveToTrash();
    }
  } finally {
    // Всегда удаляем сохраненное вложение (чтобы не засорять Диск)
    if (IMPORT_CONFIG.DELETE_SAVED_ATTACHMENT) {
      try {
        tempFile.setTrashed(true);
      } catch (e) {
        Logger.log('Не удалось удалить временный файл вложения: ' + e);
      }
    }
  }

  return result;
}

/**
 * РУЧНОЙ ИМПОРТ ИЗ ПАПКИ (БЕЗ ОКНА):
 * Вызывается из меню Code.gs -> runImportXlsxFromMenu
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
        message: 'Файл пустой.\nВ лист Info записаны только заголовки.'
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
        'Импорт завершён.\nФайл: ' + sourceFile.getName() +
        '.\nОбработано строк: ' + mappedRows.length +
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

function writeInfoSheet_(sheet, dataRows) {
  clearSheetFully_(sheet);
  const headers = getInfoHeaders_();
  const totalRows = Math.max(1, dataRows.length + 1);
  const totalCols = headers.length;

  ensureSheetSize_(sheet, totalRows, totalCols);
  sheet.getRange(1, 1, 1, totalCols).setValues([headers]);

  if (dataRows.length > 0) {
    sheet.getRange(2, 1, dataRows.length, totalCols).setValues(dataRows);
  }

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