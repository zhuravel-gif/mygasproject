/**
 * Импортирует данные из MXL(XML) файла в лист "info".
 * Приоритет источника:
 * 1) Script Properties: MXL_FILE_ID
 * 2) Константа: MXL_SOURCE_FILE_ID
 * 3) Последний подходящий файл из папки (MXL_SOURCE_FOLDER_ID)
 */
function importInfoFromMxl() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let infoSheet = ss.getSheetByName('info');

  if (!infoSheet) {
    infoSheet = ss.insertSheet('info');
  }

  let sourceFile;
  try {
    sourceFile = resolveMxlSourceFile_();
  } catch (error) {
    const result = {
      status: 'error',
      rowsImported: 0,
      message: 'Не удалось определить источник MXL: ' + error.message
    };
    Logger.log(result.message);
    return result;
  }

  if (!sourceFile) {
    const result = {
      status: 'error',
      rowsImported: 0,
      message: 'Источник MXL не найден. Укажите MXL_FILE_ID/MXL_SOURCE_FILE_ID или добавьте XML/MXL файл в папку источника.'
    };
    Logger.log(result.message);
    return result;
  }

  let sourceBlob;
  let xmlText;
  try {
    sourceBlob = sourceFile.getBlob();
    xmlText = sourceBlob.getDataAsString();
  } catch (error) {
    const result = {
      status: 'error',
      rowsImported: 0,
      message: 'Не удалось прочитать файл MXL: ' + sourceFile.getName() + ' (' + sourceFile.getId() + ')'
    };
    Logger.log(result.message + '. ' + error.message);
    return result;
  }

  if (!xmlText || !String(xmlText).trim()) {
    const result = {
      status: 'error',
      rowsImported: 0,
      message: 'Файл MXL пустой: ' + sourceFile.getName()
    };
    Logger.log(result.message);
    return result;
  }

  let document;
  try {
    document = parseXmlDocumentWithFallback_(sourceBlob, xmlText);
  } catch (error) {
    const result = {
      status: 'error',
      rowsImported: 0,
      message: 'Невалидный XML/MXL формат в файле ' + sourceFile.getName() + ': ' + error.message
    };
    Logger.log(result.message);
    return result;
  }

  let rows;
  try {
    rows = flattenXmlDocument_(document);
  } catch (error) {
    const result = {
      status: 'error',
      rowsImported: 0,
      message: 'Ошибка структуры MXL: ' + error.message
    };
    Logger.log(result.message);
    return result;
  }

  if (!rows || rows.length <= 1) {
    const result = {
      status: 'error',
      rowsImported: 0,
      message: 'В MXL не найдены данные для импорта.'
    };
    Logger.log(result.message);
    return result;
  }

  infoSheet.clearContents();
  infoSheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);

  const result = {
    status: 'ok',
    rowsImported: rows.length - 1,
    message: 'Импорт завершен. Файл: ' + sourceFile.getName() + '. Загружено строк: ' + (rows.length - 1)
  };
  Logger.log(result.message);
  return result;
}


function parseXmlDocumentWithFallback_(blob, defaultText) {
  const attempted = [];
  const variants = [
    { label: 'utf-8', text: defaultText },
    { label: 'windows-1251', charset: 'windows-1251' },
    { label: 'cp1251', charset: 'cp1251' },
    { label: 'cp866', charset: 'cp866' }
  ];

  for (let i = 0; i < variants.length; i += 1) {
    const variant = variants[i];
    try {
      const variantText = Object.prototype.hasOwnProperty.call(variant, 'text')
        ? variant.text
        : blob.getDataAsString(variant.charset);
      const cleaned = normalizeXmlText_(variantText);
      if (!cleaned) {
        attempted.push(variant.label + ': empty');
        continue;
      }
      return XmlService.parse(cleaned);
    } catch (error) {
      attempted.push(variant.label + ': ' + error.message);
    }
  }

  throw new Error('не удалось распознать XML. Попытки: ' + attempted.join(' | '));
}

function normalizeXmlText_(text) {
  const input = String(text || '');
  if (!input.trim()) {
    return '';
  }

  const withoutBom = input.replace(/^\uFEFF/, '');
  const xmlStart = withoutBom.indexOf('<');

  if (xmlStart === -1) {
    return withoutBom.trim();
  }

  return withoutBom.slice(xmlStart).trim();
}

function resolveMxlSourceFile_() {
  const scriptProps = PropertiesService.getScriptProperties();
  const explicitFileId = String(scriptProps.getProperty('MXL_FILE_ID') || MXL_SOURCE_FILE_ID || '').trim();

  if (explicitFileId) {
    try {
      return DriveApp.getFileById(explicitFileId);
    } catch (error) {
      throw new Error('Файл по MXL_FILE_ID/MXL_SOURCE_FILE_ID не найден: ' + explicitFileId);
    }
  }

  const folderId = String(scriptProps.getProperty('MXL_FOLDER_ID') || MXL_SOURCE_FOLDER_ID || '').trim();
  if (!folderId) {
    return null;
  }

  let folder;
  try {
    folder = DriveApp.getFolderById(folderId);
  } catch (error) {
    throw new Error('Папка источника не найдена: ' + folderId);
  }

  return findLatestMxlFileInFolder_(folder);
}

function findLatestMxlFileInFolder_(folder) {
  const files = folder.getFiles();
  let latestFile = null;
  let latestTime = 0;

  while (files.hasNext()) {
    const file = files.next();
    const name = String(file.getName() || '').toLowerCase();
    const mimeType = String(file.getMimeType() || '').toLowerCase();
    const isMxlOrXml = /\.(mxl|xml)$/.test(name) || mimeType.indexOf('xml') !== -1;

    if (!isMxlOrXml) {
      continue;
    }

    const updatedAt = file.getLastUpdated().getTime();
    if (updatedAt > latestTime) {
      latestTime = updatedAt;
      latestFile = file;
    }
  }

  return latestFile;
}

/**
 * Преобразует XML в двумерный массив:
 * [path, text, attr:*]
 */
function flattenXmlDocument_(document) {
  const root = document.getRootElement();
  if (!root) {
    throw new Error('Отсутствует корневой элемент XML.');
  }

  const records = [];
  collectXmlRecords_(root, root.getName(), records);

  if (records.length === 0) {
    throw new Error('Отсутствуют элементы для записи.');
  }

  const attrNames = Array.from(records.reduce((set, record) => {
    Object.keys(record.attrs).forEach((name) => set.add(name));
    return set;
  }, new Set())).sort((a, b) => a.localeCompare(b));

  const headers = ['path', 'text'].concat(attrNames.map((name) => 'attr:' + name));
  const values = records.map((record) => {
    const row = [record.path, record.text];
    attrNames.forEach((name) => row.push(record.attrs[name] || ''));
    return row;
  });

  const hasData = values.some((row) => {
    return row.slice(1).some((cell) => String(cell).trim() !== '');
  });

  if (!hasData) {
    throw new Error('Структура XML не содержит текстовых значений или атрибутов.');
  }

  return [headers].concat(values);
}

function collectXmlRecords_(element, path, records) {
  const children = element.getChildren();
  const attrs = element.getAttributes().reduce((acc, attribute) => {
    acc[attribute.getName()] = attribute.getValue();
    return acc;
  }, {});

  const text = String(element.getText() || '').trim();
  const isLeaf = children.length === 0;
  const hasAttrs = Object.keys(attrs).length > 0;

  if (isLeaf || hasAttrs || text) {
    records.push({
      path: path,
      text: text,
      attrs: attrs
    });
  }

  children.forEach((child) => {
    collectXmlRecords_(child, path + '/' + child.getName(), records);
  });
}
