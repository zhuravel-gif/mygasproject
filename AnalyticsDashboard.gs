const ANALYTICS_SHEET_NAME = 'Аналитика_данные';
const DASHBOARD_SHEET_NAME = 'Dashboard';
const TOP_SKU_LABELS_COUNT = 20;
const ANALYTICS_CHART_COLUMN = 9;

const ANALYTICS_HEADERS = [
  'SKU',
  'Категория',
  'Уходимость',
  'Покрытие запасом (дни)',
  'Остаток',
  'Продажи',
  'Подпись'
];

/**
 * Подготавливает лист аналитики и создает bubble chart на том же листе.
 */
function buildAnalyticsDashboard(ss, reportRows) {
  const analyticsRows = buildAnalyticsRows(reportRows);
  const analyticsSheet = getOrCreateSheet_(ss, ANALYTICS_SHEET_NAME);

  analyticsSheet.clear();
  analyticsSheet.getCharts().forEach((chart) => analyticsSheet.removeChart(chart));
  analyticsSheet.getRange(1, 1, 1, ANALYTICS_HEADERS.length).setValues([ANALYTICS_HEADERS]);

  if (analyticsRows.length > 0) {
    analyticsSheet.getRange(2, 1, analyticsRows.length, ANALYTICS_HEADERS.length).setValues(analyticsRows);
  }

  formatAnalyticsSheet_(analyticsSheet, analyticsRows.length + 1);
  createAnalyticsBubbleChart_(analyticsSheet, analyticsRows.length);
}

/**
 * Формирует набор данных для аналитики.
 */
function buildAnalyticsRows(reportRows) {
  const salesBySku = reportRows
    .map((row) => ({ sku: String(row[5] || ''), sales: analyticsToNumber_(row[17]) }))
    .filter((item) => item.sku)
    .sort((a, b) => b.sales - a.sales);

  const labeledSkuSet = new Set(
    salesBySku.slice(0, TOP_SKU_LABELS_COUNT).map((item) => item.sku)
  );

  return reportRows
    .map((row) => {
      const sku = String(row[5] || '');
      if (!sku) return null;

      const category = row[1] || 'Без категории';
      const turnover = analyticsToNumber_(row[18]);
      const totalStock = getTotalStock_(row);
      const coverageDays = turnover > 0 ? Number((totalStock / turnover).toFixed(2)) : '';
      const sales = analyticsToNumber_(row[17]);
      const label = labeledSkuSet.has(sku) ? sku : '';

      return [sku, category, turnover, coverageDays, totalStock, sales, label];
    })
    .filter(Boolean);
}

function getTotalStock_(reportRow) {
  const stockIndexes = [10, 11, 12, 13, 14];
  return stockIndexes.reduce((sum, index) => sum + analyticsToNumber_(reportRow[index]), 0);
}

function analyticsToNumber_(value) {
  const parsed = Number(value);
  return isNaN(parsed) ? 0 : parsed;
}

function getOrCreateSheet_(ss, sheetName) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  return sheet;
}

function formatAnalyticsSheet_(sheet, rowsCount) {
  const header = sheet.getRange(1, 1, 1, ANALYTICS_HEADERS.length);
  header
    .setFontWeight('bold')
    .setBackground('#1f4e78')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center');

  sheet.setFrozenRows(1);

  if (rowsCount > 1) {
    sheet.getRange(2, 3, rowsCount - 1, 3).setNumberFormat('0.00');
    sheet.getRange(2, 6, rowsCount - 1, 1).setNumberFormat('0');
  }

  sheet.autoResizeColumns(1, ANALYTICS_HEADERS.length);
}

function createAnalyticsBubbleChart_(analyticsSheet, dataRowsCount) {
  if (dataRowsCount === 0) {
    analyticsSheet.getRange(1, ANALYTICS_CHART_COLUMN).setValue('Нет данных для построения графика.');
    return;
  }

  const dataRange = analyticsSheet.getRange(1, 1, dataRowsCount + 1, ANALYTICS_HEADERS.length);

  const chart = analyticsSheet.newChart()
    .setChartType(Charts.ChartType.BUBBLE)
    .addRange(dataRange)
    .setPosition(1, ANALYTICS_CHART_COLUMN, 0, 0)
    .setOption('title', 'Уходимость / Покрытие запасом / Остаток')
    .setOption('hAxis', { title: 'Уходимость' })
    .setOption('vAxis', { title: 'Покрытие запасом (дни)' })
    .setOption('bubble', {
      textStyle: { fontSize: 9 }
    })
    .setOption('sizeAxis', { minSize: 4, maxSize: 30 })
    .setOption('legend', { position: 'right' })
    .build();

  analyticsSheet.insertChart(chart);
}
