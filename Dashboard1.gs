const DASHBOARD1_SHEET_NAME = 'Dashboard1';
const DASHBOARD_LOOKBACK_DAYS = 14;

function buildDashboard1ForTrigger() {
  return buildDashboard1();
}

function buildDashboard1() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const reportSheet = getRequiredSheet_('report');
  const dashboardSheet = getOrCreateSheet_(ss, DASHBOARD1_SHEET_NAME);

  const reportData = dashboardGetSheetDataWithHeaders_(reportSheet);

  if (!reportData.headers.length) {
    throw new Error('Лист report пустой или не содержит заголовков.');
  }

  const reportHeaderMap = dashboardBuildHeaderMap_(reportData.headers);

  dashboardValidateRequiredReportHeaders_(reportHeaderMap);

  const dashboardRows = dashboardBuildRows_(reportData.rows, reportHeaderMap);
  const headers = dashboardGetHeaders_();

  dashboardWriteSheet_(dashboardSheet, headers, dashboardRows);
  dashboardApplyFormatting_(dashboardSheet, headers, dashboardRows.length);
  dashboardHideHelperColumns_(dashboardSheet, headers);

  SpreadsheetApp.flush();

  return {
    ok: true,
    rows: dashboardRows.length,
    columns: headers.length,
    message:
      'Dashboard1 построен. Строк: ' + dashboardRows.length +
      ', столбцов: ' + headers.length + '.'
  };
}

function runBuildDashboard1FromMenu() {
  const result = buildDashboard1ForTrigger();
  SpreadsheetApp.getUi().alert('Dashboard1', result.message, SpreadsheetApp.getUi().ButtonSet.OK);
}

function dashboardGetHeaders_() {
  return [
    'brandinfo',
    'tg1',
    'tg2',
    'tg3',
    'nom',
    'art1C',
    'artwb',
    'cat',
    'order',
    'inwork',
    'rawstock',
    'stock',
    'reserved',
    'shipped',
    'fbostock',
    'ordersFBO',
    'ordersFBS',
    'orderssum',
    'ordersSpark14d',
    'sumstock',
    'dayorders',
    'zapas',
    'zapasFlag'
  ];
}

function dashboardGetSheetDataWithHeaders_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow < 1 || lastCol < 1) {
    return { headers: [], rows: [] };
  }

  const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  return {
    headers: values[0].map(function(h) { return String(h).trim(); }),
    rows: values.slice(1)
  };
}

function dashboardBuildHeaderMap_(headers) {
  const map = {};
  headers.forEach(function(header, index) {
    map[header] = index;
  });
  return map;
}

function dashboardValidateRequiredReportHeaders_(map) {
  const required = [
    'Бренд',
    'Товарная группа 1',
    'Товарная группа 2',
    'Товарная группа 3',
    'Наименование',
    'Артикул',
    'Артикул ВБ',
    'Категория товаров',
    'Заказано поставщику',
    'В производстве',
    'Остаток сырья в шт',
    'Готовая продукция на складе',
    'В резерве',
    'Отгружено на РВБ',
    'ФБО остаток',
    'ordersFBO',
    'ordersFBS',
    'orderssum',
    'sumstock',
    'dayorders',
    'zapas'
  ];

  required.forEach(function(name) {
    if (map[name] === undefined) {
      throw new Error('В report не найден обязательный столбец: ' + name);
    }
  });
}

function dashboardBuildRows_(reportRows, reportHeaderMap) {
  const rows = reportRows.map(function(reportRow) {
    const zapas = reportRow[reportHeaderMap['zapas']];

    return [
      reportRow[reportHeaderMap['Бренд']],
      reportRow[reportHeaderMap['Товарная группа 1']],
      reportRow[reportHeaderMap['Товарная группа 2']],
      reportRow[reportHeaderMap['Товарная группа 3']],
      reportRow[reportHeaderMap['Наименование']],
      reportRow[reportHeaderMap['Артикул']],
      reportRow[reportHeaderMap['Артикул ВБ']],
      reportRow[reportHeaderMap['Категория товаров']],
      reportRow[reportHeaderMap['Заказано поставщику']],
      reportRow[reportHeaderMap['В производстве']],
      reportRow[reportHeaderMap['Остаток сырья в шт']],
      reportRow[reportHeaderMap['Готовая продукция на складе']],
      reportRow[reportHeaderMap['В резерве']],
      reportRow[reportHeaderMap['Отгружено на РВБ']],
      reportRow[reportHeaderMap['ФБО остаток']],
      reportRow[reportHeaderMap['ordersFBO']],
      reportRow[reportHeaderMap['ordersFBS']],
      reportRow[reportHeaderMap['orderssum']],
      '',
      reportRow[reportHeaderMap['sumstock']],
      reportRow[reportHeaderMap['dayorders']],
      reportRow[reportHeaderMap['zapas']],
      (zapas !== '' && Number(zapas) < 30) ? 'Да' : 'Нет'
    ];
  });

  rows.sort(function(a, b) {
    return dashboardCompare_(a[0], b[0]) ||
      dashboardCompare_(a[1], b[1]) ||
      dashboardCompare_(a[2], b[2]) ||
      dashboardCompare_(a[3], b[3]) ||
      dashboardCompare_(a[4], b[4]);
  });

  return rows;
}

function dashboardWriteSheet_(sheet, headers, rows) {
  sheet.clear();
  sheet.clearConditionalFormatRules();

  const totalRows = Math.max(1, rows.length + 1);
  const totalCols = headers.length;
  dashboardEnsureSheetSize_(sheet, totalRows, totalCols);

  sheet.getRange(1, 1, 1, totalCols).setValues([headers]);

  if (rows.length) {
    sheet.getRange(2, 1, rows.length, totalCols).setValues(rows);
  }

  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(8);
  dashboardSetColumnWidths_(sheet, headers);
}

function dashboardApplyFormatting_(sheet, headers, rowCount) {
  const totalCols = headers.length;
  const headerRange = sheet.getRange(1, 1, 1, totalCols);
  headerRange
    .setFontWeight('bold')
    .setBackground('#d9eaf7')
    .setHorizontalAlignment('center');

  if (!rowCount) {
    return;
  }

  const lastRow = rowCount + 1;
  const dataRange = sheet.getRange(2, 1, rowCount, totalCols);
  dataRange.setVerticalAlignment('middle');

  const numericCols = [
    'order', 'inwork', 'rawstock', 'stock', 'reserved', 'shipped', 'fbostock',
    'ordersFBO', 'ordersFBS', 'orderssum', 'sumstock', 'dayorders', 'zapas'
  ];

  numericCols.forEach(function(name) {
    const col = headers.indexOf(name) + 1;
    if (col > 0) {
      sheet.getRange(2, col, rowCount, 1).setNumberFormat('#,##0.00');
    }
  });

  const integerCols = ['order', 'inwork', 'rawstock', 'stock', 'reserved', 'shipped', 'fbostock', 'ordersFBO', 'ordersFBS', 'orderssum', 'sumstock'];
  integerCols.forEach(function(name) {
    const col = headers.indexOf(name) + 1;
    if (col > 0) {
      sheet.getRange(2, col, rowCount, 1).setNumberFormat('#,##0');
    }
  });

  sheet.getRange(2, 1, rowCount, totalCols).setWrap(false);
  sheet.getRange(2, 1, rowCount, 8).setHorizontalAlignment('left');
  sheet.getRange(2, 9, rowCount, totalCols - 8).setHorizontalAlignment('center');

  const catCol = headers.indexOf('cat') + 1;
  const wholeDataRange = sheet.getRange(2, 1, rowCount, totalCols);
  const zapasCol = headers.indexOf('zapas') + 1;

  const rules = [];

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$' + dashboardColLetter_(catCol) + '2="Выведен"')
      .setFontColor('#d28a8a')
      .setRanges([wholeDataRange])
      .build()
  );

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenNumberLessThan(30)
      .setBackground('#f4cccc')
      .setRanges([sheet.getRange(2, zapasCol, rowCount, 1)])
      .build()
  );

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenNumberLessThan(15)
      .setBackground('#ea9999')
      .setRanges([sheet.getRange(2, zapasCol, rowCount, 1)])
      .build()
  );

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenNumberLessThan(7)
      .setBackground('#e06666')
      .setRanges([sheet.getRange(2, zapasCol, rowCount, 1)])
      .build()
  );

  sheet.setConditionalFormatRules(rules);

  sheet.getRange(1, 1, lastRow, totalCols)
    .setBorder(true, true, true, true, true, true, '#d0d0d0', SpreadsheetApp.BorderStyle.SOLID);

  dashboardPaintHeaderBlock_(sheet, headers, ['brandinfo', 'tg1', 'tg2', 'tg3', 'nom', 'art1C', 'artwb', 'cat'], '#eaf4ea');
  dashboardPaintHeaderBlock_(sheet, headers, ['order', 'inwork', 'rawstock', 'stock', 'reserved', 'shipped', 'fbostock', 'ordersFBO', 'ordersFBS', 'orderssum'], '#fff2cc');
  dashboardPaintHeaderBlock_(sheet, headers, ['ordersSpark14d', 'sumstock', 'dayorders', 'zapas', 'zapasFlag'], '#e8f0fe');
}

function dashboardPaintHeaderBlock_(sheet, headers, names, color) {
  names.forEach(function(name) {
    const col = headers.indexOf(name) + 1;
    if (col > 0) {
      sheet.getRange(1, col).setBackground(color);
    }
  });
}

function dashboardSetColumnWidths_(sheet, headers) {
  const widths = {
    brandinfo: 150,
    tg1: 150,
    tg2: 150,
    tg3: 150,
    nom: 260,
    art1C: 110,
    artwb: 110,
    cat: 130,
    order: 85,
    inwork: 85,
    rawstock: 85,
    stock: 85,
    reserved: 85,
    shipped: 85,
    fbostock: 85,
    ordersFBO: 80,
    ordersFBS: 80,
    orderssum: 85,
    ordersSpark14d: 95,
    sumstock: 90,
    dayorders: 90,
    zapas: 90,
    zapasFlag: 90
  };

  headers.forEach(function(name, index) {
    sheet.setColumnWidth(index + 1, widths[name] || 110);
  });
}

function dashboardHideHelperColumns_(sheet, headers) {
  ['brandinfo', 'tg1', 'tg2', 'tg3', 'zapasFlag'].forEach(function(name) {
    const col = headers.indexOf(name) + 1;
    if (col > 0) {
      sheet.hideColumns(col);
    }
  });
}

function dashboardEnsureSheetSize_(sheet, requiredRows, requiredCols) {
  const currentRows = sheet.getMaxRows();
  const currentCols = sheet.getMaxColumns();

  if (currentRows < requiredRows) {
    sheet.insertRowsAfter(currentRows, requiredRows - currentRows);
  }
  if (currentCols < requiredCols) {
    sheet.insertColumnsAfter(currentCols, requiredCols - currentCols);
  }
}

function dashboardNormalizeKey_(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
}

function dashboardNormalizeNumberLike_(value) {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  const num = Number(value);
  if (!isNaN(num)) {
    return String(num);
  }
  return String(value).trim();
}

function dashboardCompare_(a, b) {
  return String(a || '').localeCompare(String(b || ''), 'ru');
}

function dashboardMax_(arr) {
  return arr.reduce(function(max, v) { return v > max ? v : max; }, 0);
}

function dashboardColLetter_(col) {
  let temp = '';
  let letter = '';
  while (col > 0) {
    temp = (col - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    col = (col - temp - 1) / 26;
  }
  return letter;
}