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

  SpreadsheetApp.getUi().alert(
    `Отчет успешно сформирован на листе "${REPORT_SHEET_NAME}". ` +
      `Обработано уникальных номенклатур: ${reportRows.length}. ` +
      `Дней для уходимости: ${aggregation.daysCount}.`
  );
}
