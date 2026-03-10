/**
 * Основная функция генерации отчета.
 */
function generateWbReport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone() || Session.getScriptTimeZone();
  const sheetOrders = ss.getSheetByName('orders');
  const sheet1C = ss.getSheetByName('1C');

  if (!sheetOrders || !sheet1C) {
    SpreadsheetApp.getUi().alert('Ошибка: Не найден лист "orders" или "1C".');
    return;
  }

  let sheetReport = ss.getSheetByName(REPORT_SHEET_NAME);
  if (!sheetReport) {
    sheetReport = ss.insertSheet(REPORT_SHEET_NAME);
  } else {
    sheetReport.clear();
  }

  const ordersData = sheetOrders.getDataRange().getValues();
  const c1Data = sheet1C.getDataRange().getValues();

  if (ordersData.length < 1 || c1Data.length < 1) {
    SpreadsheetApp.getUi().alert('Ошибка: Один из исходных листов не содержит строку заголовков.');
    return;
  }

  if (!Array.isArray(ordersData[0]) || ordersData[0].length === 0 || !hasNonEmptyHeaders(ordersData[0])) {
    SpreadsheetApp.getUi().alert('Ошибка: Заголовок на листе "orders" некорректен или пуст.');
    return;
  }

  if (!Array.isArray(c1Data[0]) || c1Data[0].length === 0 || !hasNonEmptyHeaders(c1Data[0])) {
    SpreadsheetApp.getUi().alert('Ошибка: Заголовок на листе "1C" некорректен или пуст.');
    return;
  }

  if (ordersData.length === 1 || c1Data.length === 1) {
    sheetReport.getRange(1, 1, 1, REPORT_HEADERS.length).setValues([REPORT_HEADERS]);
    formatReportSheet(sheetReport, 1, REPORT_HEADERS.length);
    renderDashboard();
    SpreadsheetApp.getUi().alert('Данные после заголовков отсутствуют на одном или обоих исходных листах. Сформирован отчет только с заголовком.');
    return;
  }

  let aggregation;
  try {
    aggregation = aggregateOrders(ordersData, tz);
  } catch (error) {
    SpreadsheetApp.getUi().alert('Ошибка структуры orders: ' + error.message);
    return;
  }

  let reportRows;
  try {
    reportRows = buildReportRows(c1Data, aggregation.ordersMap, aggregation.daysCount);
  } catch (error) {
    SpreadsheetApp.getUi().alert('Ошибка структуры 1С: ' + error.message);
    return;
  }

  const finalOutput = [REPORT_HEADERS].concat(reportRows);
  sheetReport.getRange(1, 1, finalOutput.length, finalOutput[0].length).setValues(finalOutput);
  formatReportSheet(sheetReport, finalOutput.length, finalOutput[0].length);
  renderDashboard();

  SpreadsheetApp.getUi().alert(
    `Отчет успешно сформирован на листе "${REPORT_SHEET_NAME}". ` +
      `Обработано уникальных номенклатур: ${reportRows.length}. ` +
      `Дней для уходимости: ${aggregation.daysCount}.`
  );
}


/**
 * Рендер дашборда с KPI по общему отчету и по выбранным фильтрам.
 */
function renderDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const reportSheet = ss.getSheetByName(REPORT_SHEET_NAME);

  if (!reportSheet) return;

  let dashboardSheet = ss.getSheetByName(DASHBOARD_SHEET_NAME);
  if (!dashboardSheet) {
    dashboardSheet = ss.insertSheet(DASHBOARD_SHEET_NAME);
  } else {
    dashboardSheet.clear();
    dashboardSheet.clearConditionalFormatRules();
  }

  const lastRow = reportSheet.getLastRow();
  const lastCol = reportSheet.getLastColumn();

  dashboardSheet.getRange('A1').setValue('Dashboard').setFontSize(18).setFontWeight('bold');
  dashboardSheet.getRange('A2').setValue('Группа аналитического учёта');
  dashboardSheet.getRange('A3').setValue('Категория товаров');
  dashboardSheet.getRange('A4').setValue('Товарная группа 1');

  if (lastRow < 2) {
    dashboardSheet.getRange('A6').setValue('Нет данных для отображения KPI.');
    dashboardSheet.autoResizeColumns(1, 6);
    return;
  }

  const reportData = reportSheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const allOption = 'Все';

  const groupValues = getUniqueValues_(reportData, REPORT_COLUMNS.groupAn - 1);
  const selectedGroup = buildSelector_(dashboardSheet, 'B2', groupValues, allOption);

  const categorySource = reportData.filter((row) => selectedGroup === allOption || String(row[REPORT_COLUMNS.groupAn - 1]) === selectedGroup);
  const categoryValues = getUniqueValues_(categorySource, REPORT_COLUMNS.category - 1);
  const selectedCategory = buildSelector_(dashboardSheet, 'B3', categoryValues, allOption);

  const productGroupSource = categorySource.filter((row) => selectedCategory === allOption || String(row[REPORT_COLUMNS.category - 1]) === selectedCategory);
  const productGroupValues = getUniqueValues_(productGroupSource, REPORT_COLUMNS.productGroup1 - 1);
  const selectedProductGroup = buildSelector_(dashboardSheet, 'B4', productGroupValues, allOption);

  const filteredData = reportData.filter((row) => {
    const groupMatch = selectedGroup === allOption || String(row[REPORT_COLUMNS.groupAn - 1]) === selectedGroup;
    const categoryMatch = selectedCategory === allOption || String(row[REPORT_COLUMNS.category - 1]) === selectedCategory;
    const productGroupMatch = selectedProductGroup === allOption || String(row[REPORT_COLUMNS.productGroup1 - 1]) === selectedProductGroup;
    return groupMatch && categoryMatch && productGroupMatch;
  });

  dashboardSheet.getRange('A6').setValue('Общий KPI').setFontWeight('bold').setFontSize(12);
  renderKpiBlock_(dashboardSheet, 7, reportData);

  dashboardSheet.getRange('A13').setValue('KPI по фильтру').setFontWeight('bold').setFontSize(12);
  renderKpiBlock_(dashboardSheet, 14, filteredData);

  dashboardSheet.getRange('A2:A4').setFontWeight('bold');
  dashboardSheet.getRange('A2:B4').setBackground('#f5f7fa');
  dashboardSheet.setColumnWidths(1, 2, 260);
  dashboardSheet.autoResizeColumns(3, 6);
}

function getUniqueValues_(rows, idx) {
  const values = rows
    .map((row) => String(row[idx] || '').trim())
    .filter((value) => value !== '');
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function buildSelector_(sheet, a1, values, allOption) {
  const options = [allOption].concat(values);
  const range = sheet.getRange(a1);
  const currentValue = String(range.getValue() || '').trim();
  const nextValue = options.indexOf(currentValue) === -1 ? allOption : currentValue;

  const validation = SpreadsheetApp.newDataValidation()
    .requireValueInList(options, true)
    .setAllowInvalid(false)
    .build();

  range.setDataValidation(validation);
  range.setValue(nextValue);
  return nextValue;
}

function renderKpiBlock_(sheet, startRow, rows) {
  const metrics = calculateKpis_(rows);
  const cards = [
    ['SKU', metrics.skuCount, '#5b8ff9'],
    ['Сумма заказов', metrics.totalOrders, statusColorByValue_(metrics.totalOrders, 500, 100)],
    ['Средняя уходимость', metrics.avgTurnover.toFixed(2), statusColorByValue_(metrics.avgTurnover, 1, 0.5)],
    ['FBO/FBS', metrics.fbo + ' / ' + metrics.fbs, '#36cfc9']
  ];

  cards.forEach((card, idx) => {
    const col = idx * 2 + 1;
    const cardRange = sheet.getRange(startRow, col, 4, 2);

    cardRange
      .breakApart()
      .setBackground('#ffffff')
      .setBorder(true, true, true, true, true, true, card[2], SpreadsheetApp.BorderStyle.SOLID_MEDIUM)
      .setVerticalAlignment('middle')
      .setHorizontalAlignment('center');

    sheet.getRange(startRow + 1, col, 1, 2)
      .merge()
      .setValue(card[1])
      .setFontSize(22)
      .setFontWeight('bold')
      .setHorizontalAlignment('center');

    sheet.getRange(startRow + 3, col, 1, 2)
      .merge()
      .setValue(card[0])
      .setFontSize(10)
      .setFontColor('#5f6368')
      .setHorizontalAlignment('center');
  });
}

function calculateKpis_(rows) {
  return rows.reduce((acc, row) => {
    acc.skuCount += 1;
    acc.fbo += Number(row[REPORT_COLUMNS.ordersFbo - 1]) || 0;
    acc.fbs += Number(row[REPORT_COLUMNS.ordersFbs - 1]) || 0;
    acc.totalOrders += Number(row[REPORT_COLUMNS.ordersTotal - 1]) || 0;
    acc.turnoverSum += Number(row[REPORT_COLUMNS.turnover - 1]) || 0;
    return acc;
  }, {
    skuCount: 0,
    fbo: 0,
    fbs: 0,
    totalOrders: 0,
    turnoverSum: 0,
    get avgTurnover() {
      return this.skuCount ? this.turnoverSum / this.skuCount : 0;
    }
  });
}

function statusColorByValue_(value, greenThreshold, yellowThreshold) {
  if (value >= greenThreshold) return '#34a853';
  if (value >= yellowThreshold) return '#fbbc05';
  return '#ea4335';
}
