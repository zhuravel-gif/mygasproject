/**
 * Импортирует данные из XLSX файла в лист "1C".
 * Приоритет источника:
 * 1) Script Properties: XLSX_FILE_ID
 * 2) Константа: XLSX_SOURCE_FILE_ID
 * 3) Последний XLSX из папки (Script Properties XLSX_FOLDER_ID или XLSX_SOURCE_FOLDER_ID)
 *
 * Требуется включенный Advanced Google service: Drive API.
 */
function import1CFromXlsx() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let targetSheet = ss.getSheetByName('1C');
  if (!targetSheet) {
    targetSheet = ss.insertSheet('1C');
  }

  const sourceFile = resolveXlsxSourceFile_();
  if (!sourceFile) {
    throw new Error('Источник XLSX не найден. Укажите XLSX_FILE_ID/XLSX_SOURCE_FILE_ID или добавьте xlsx в папку источника.');
  }

  const convertedFileId = convertXlsxToTemporaryGoogleSheet_(sourceFile);

  try {
    const sourceSpreadsheet = SpreadsheetApp.openById(convertedFileId);
    const sourceSheet = sourceSpreadsheet.getSheets()[0];

    if (!sourceSheet) {
      throw new Error('Во временно конвертированном файле не найдено листов.');
    }

    const data = sourceSheet.getDataRange().getValues();
    targetSheet.clearContents();

    if (data.length > 0 && data[0].length > 0) {
      targetSheet.getRange(1, 1, data.length, data[0].length).setValues(data);
    }

    return {
      status: 'ok',
      rowsImported: Math.max(data.length - 1, 0),
      fileName: sourceFile.getName(),
      fileId: sourceFile.getId()
    };
  } finally {
    trashTemporaryFile_(convertedFileId);
  }
}

function resolveXlsxSourceFile_() {
  const scriptProps = PropertiesService.getScriptProperties();
  const explicitFileId = String(scriptProps.getProperty('XLSX_FILE_ID') || XLSX_SOURCE_FILE_ID || '').trim();

  if (explicitFileId) {
    return DriveApp.getFileById(explicitFileId);
  }

  const folderId = String(scriptProps.getProperty('XLSX_FOLDER_ID') || XLSX_SOURCE_FOLDER_ID || '').trim();
  if (!folderId) {
    return null;
  }

  const folder = DriveApp.getFolderById(folderId);
  return findLatestXlsxFileInFolder_(folder);
}

function findLatestXlsxFileInFolder_(folder) {
  const files = folder.getFiles();
  let latestFile = null;
  let latestTime = 0;

  while (files.hasNext()) {
    const file = files.next();
    const name = String(file.getName() || '').toLowerCase();
    if (!/\.xlsx$/.test(name)) continue;

    const updatedAt = file.getLastUpdated().getTime();
    if (updatedAt > latestTime) {
      latestTime = updatedAt;
      latestFile = file;
    }
  }

  return latestFile;
}

function convertXlsxToTemporaryGoogleSheet_(file) {
  const resource = {
    title: '[tmp-import] ' + file.getName() + ' ' + new Date().toISOString(),
    mimeType: MimeType.GOOGLE_SHEETS
  };

  const converted = Drive.Files.insert(resource, file.getBlob(), { convert: true });
  if (!converted || !converted.id) {
    throw new Error('Не удалось конвертировать XLSX в Google Sheets.');
  }

  return converted.id;
}

function trashTemporaryFile_(fileId) {
  if (!fileId) return;
  DriveApp.getFileById(fileId).setTrashed(true);
}
