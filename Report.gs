const REPORT_SHEET_NAME = 'report';
const INFO_SHEET_NAME = 'Info';
const ORDERS_SHEET_NAME = 'orders';
const REPORT_LOOKBACK_DAYS = 14;

function buildReportForTrigger() {
  return buildReport();
}

function buildReport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const infoSheet = getRequiredSheet_(INFO_SHEET_NAME);
  const ordersSheet = getRequiredSheet_(ORDERS_SHEET_NAME);
  const reportSheet = getOrCreateSheet_(ss, REPORT_SHEET_NAME);

  const infoSchema = getReportInfoSchema_();
  const infoColumns = getInfoColumnsMap_();
  const reportHeaders = getReportHeaders_();

  const infoData = getSheetDataWithoutHeader_(infoSheet);
  const ordersData = getSheetDataWithoutHeader_(ordersSheet);

  const orderStatsByNmid = buildOrdersStatsByNmid_(ordersData);
  const reportRows = buildReportRows_(infoData, orderStatsByNmid, infoSchema, infoColumns);

  writeReportSheet_(reportSheet, reportHeaders, reportRows);

  SpreadsheetApp.flush();

  return {
    ok: true,
    rows: reportRows.length,
    columns: reportHeaders.length,
    message:
      'Report построен. Строк: ' + reportRows.length +
      ', столбцов: ' + reportHeaders.length + '.'
  };
}

function getReportInfoSchema_() {
  return INFO_SCHEMA.filter(function(col) {
    return !!col.varName;
  });
}

function getReportOrderHeaders_() {
  return [
    'ordersFBO',
    'ordersFBS',
    'orderssum',
    'sumstock',
    'dayorders',
    'zapas',
    'trend14d'
  ];
}

function getReportHeaders_() {
  const infoSchema = getReportInfoSchema_();
  return infoSchema.map(function(col) {
    return col.infoHeader;
  }).concat(getReportOrderHeaders_());
}

function getInfoColumnsMap_() {
  const map = {};

  INFO_SCHEMA.forEach(function(col, index) {
    if (col.varName) {
      map[col.varName] = {
        index: index,
        colNumber: index + 1,
        sourceHeader: col.sourceHeader,
        infoHeader: col.infoHeader,
        varName: col.varName
      };
    }
  });

  return map;
}

function getOrCreateSheet_(spreadsheet, sheetName) {
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }
  return sheet;
}

function getRequiredSheet_(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Лист не найден: ' + sheetName);
  }
  return sheet;
}

function getSheetDataWithoutHeader_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow < 2 || lastCol < 1) {
    return [];
  }

  return sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
}

function buildOrdersStatsByNmid_(ordersRows) {
  const stats = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dateKeys = [];
  for (let i = REPORT_LOOKBACK_DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dateKeys.push(reportDateKey_(d));
  }

  const lookbackSet = dateKeys.reduce(function(acc, key) {
    acc[key] = true;
    return acc;
  }, {});

  ordersRows.forEach(function(row) {
    const isCancelRaw = row[ORDERS_COLUMNS.iscancel.index];
    const isCancel = normalizeNumberLike_(isCancelRaw);

    if (isCancel !== '0') {
      return;
    }

    const nmidRaw = row[ORDERS_COLUMNS.nmid.index];
    const nmid = normalizeKey_(nmidRaw);
    if (!nmid || nmid === '0') {
      return;
    }

    const warehouseType = normalizeText_(row[ORDERS_COLUMNS.warehousetype.index]);
    const dateKey = reportParseOrderDateToKey_(row[ORDERS_COLUMNS.date.index]);

    if (!stats[nmid]) {
      stats[nmid] = {
        ordersFBO: 0,
        ordersFBS: 0,
        orderssum: 0,
        dailyCounts: {},
        activeDays: 0,
        total14: 0,
        trend14d: ''
      };
    }

    stats[nmid].orderssum += 1;

    if (warehouseType === 'склад wb') {
      stats[nmid].ordersFBO += 1;
    } else if (warehouseType === 'склад продавца') {
      stats[nmid].ordersFBS += 1;
    }

    if (dateKey && lookbackSet[dateKey]) {
      if (!stats[nmid].dailyCounts[dateKey]) {
        stats[nmid].dailyCounts[dateKey] = 0;
        stats[nmid].activeDays += 1;
      }
      stats[nmid].dailyCounts[dateKey] += 1;
      stats[nmid].total14 += 1;
    }
  });

  Object.keys(stats).forEach(function(nmid) {
    stats[nmid].trend14d = dateKeys.map(function(dateKey) {
      return stats[nmid].dailyCounts[dateKey] || 0;
    }).join(',');
  });

  return stats;
}

function buildReportRows_(infoRows, orderStatsByNmid, infoSchema, infoColumns) {
  return infoRows
    .filter(function(row) {
      return isInfoRowAllowedForReport_(row, infoColumns);
    })
    .map(function(infoRow) {
      const infoPart = infoSchema.map(function(col) {
        return infoRow[infoColumns[col.varName].index];
      });

      const artwbValue = infoRow[infoColumns.artwb.index];
      const nmidKey = normalizeKey_(artwbValue);
      const stats = orderStatsByNmid[nmidKey] || {
        ordersFBO: 0,
        ordersFBS: 0,
        orderssum: 0,
        activeDays: 0,
        total14: 0,
        trend14d: new Array(REPORT_LOOKBACK_DAYS).fill(0).join(',')
      };

      const stock = toNumber_(infoRow[infoColumns.stock.index]);
      const reserved = toNumber_(infoRow[infoColumns.reserved.index]);
      const shipped = toNumber_(infoRow[infoColumns.shipped.index]);
      const fbostock = toNumber_(infoRow[infoColumns.fbostock.index]);

      const sumstock = stock + reserved + shipped + fbostock;
      const dayorders = stats.activeDays > 0 ? stats.total14 / stats.activeDays : '';
      const zapas = dayorders !== '' && dayorders > 0 ? sumstock / dayorders : '';

      return [
        ...infoPart,
        stats.ordersFBO,
        stats.ordersFBS,
        stats.orderssum,
        sumstock,
        dayorders,
        zapas,
        stats.trend14d
      ];
    });
}

function isInfoRowAllowedForReport_(row, infoColumns) {
  const artwbValue = row[infoColumns.artwb.index];
  return hasMeaningfulKey_(artwbValue);
}

function writeReportSheet_(sheet, headers, rows) {
  clearSheetFully_(sheet);

  const requiredRows = Math.max(1, rows.length + 1);
  const requiredCols = headers.length;

  ensureSheetSize_(sheet, requiredRows, requiredCols);

  sheet.getRange(1, 1, 1, requiredCols).setValues([headers]);

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, requiredCols).setValues(rows);
  }

  sheet.setFrozenRows(1);
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

function normalizeKey_(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
}

function normalizeText_(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim().toLowerCase();
}

function normalizeNumberLike_(value) {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  const num = Number(value);
  if (!isNaN(num)) {
    return String(num);
  }

  return String(value).trim();
}

function hasMeaningfulKey_(value) {
  if (value === null || value === undefined) {
    return false;
  }

  const text = String(value).trim();
  if (text === '') {
    return false;
  }

  if (text === '0') {
    return false;
  }

  return true;
}

function toNumber_(value) {
  const num = Number(value);
  return isNaN(num) ? 0 : num;
}

function reportDateKey_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function reportParseOrderDateToKey_(value) {
  if (!value) {
    return '';
  }

  let dateObj = null;

  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) {
    dateObj = new Date(value);
  } else {
    const parsed = new Date(value);
    if (!isNaN(parsed)) {
      dateObj = parsed;
    }
  }

  if (!dateObj) {
    return '';
  }

  dateObj.setHours(0, 0, 0, 0);
  return reportDateKey_(dateObj);
}