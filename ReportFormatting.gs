/**
 * Применение визуального оформления к листу отчета.
 */
function formatReportSheet(sheetReport, rowsCount, colsCount) {
  const headerRange = sheetReport.getRange(1, 1, 1, colsCount);

  headerRange
    .setFontWeight('bold')
    .setFontColor('#ffffff')
    .setBackground('#1f4e78')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(true);

  sheetReport.setFrozenRows(1);
  sheetReport.autoResizeColumns(1, colsCount);

  if (rowsCount > 1) {
    const dataRange = sheetReport.getRange(2, 1, rowsCount - 1, colsCount);
    dataRange.setVerticalAlignment('middle');

    sheetReport.getRange(2, REPORT_COLUMNS.turnover, rowsCount - 1, 1).setNumberFormat('0.00');
    sheetReport.getRange(2, REPORT_COLUMNS.articleWb, rowsCount - 1, 1).setNumberFormat('0');

    const banding = dataRange.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY);
    banding.setHeaderRowColor('#1f4e78');

    applyGroupBanding(sheetReport, rowsCount, colsCount);
    applyRiskConditionalFormatting(sheetReport, rowsCount);
  }

  sheetReport.getRange(1, 1, rowsCount, colsCount).createFilter();
}

/**
 * Добавляет условное форматирование для риск-зон по метрикам покрытия.
 */
function applyRiskConditionalFormatting(sheetReport, rowsCount) {
  if (rowsCount <= 1) {
    return;
  }

  const colsCount = sheetReport.getLastColumn();
  const headers = sheetReport.getRange(1, 1, 1, colsCount).getValues()[0];

  const riskThresholds = {
    'Уходимость': { critical: 0.5, warning: 1.5 },
    'Покрытие (дни)': { critical: 14, warning: 30 }
  };

  const colors = {
    critical: '#f4c7c3',
    warning: '#fff2cc',
    safe: '#d9ead3'
  };

  const rules = sheetReport.getConditionalFormatRules();

  Object.keys(riskThresholds).forEach((headerName) => {
    const colIndex = headers.indexOf(headerName) + 1;
    if (colIndex <= 0) {
      return;
    }

    const targetRange = sheetReport.getRange(2, colIndex, rowsCount - 1, 1);
    const colLetter = columnToLetter(colIndex);
    const baseCell = `${colLetter}2`;
    const threshold = riskThresholds[headerName];

    rules.push(
      SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied(`=AND(ISNUMBER(${baseCell}),${baseCell}<=${threshold.critical})`)
        .setBackground(colors.critical)
        .setRanges([targetRange])
        .build(),
      SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied(`=AND(ISNUMBER(${baseCell}),${baseCell}>${threshold.critical},${baseCell}<=${threshold.warning})`)
        .setBackground(colors.warning)
        .setRanges([targetRange])
        .build(),
      SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied(`=AND(ISNUMBER(${baseCell}),${baseCell}>${threshold.warning})`)
        .setBackground(colors.safe)
        .setRanges([targetRange])
        .build()
    );
  });

  const fboCol = headers.indexOf('ФБО остаток') + 1;
  const stockCol = headers.indexOf('Готовая продукция на складе') + 1;
  const ordersCol = headers.indexOf('Сумма заказов') + 1;

  if (fboCol > 0 && stockCol > 0 && ordersCol > 0) {
    const dataRange = sheetReport.getRange(2, 1, rowsCount - 1, colsCount);
    const formula = `=AND($${columnToLetter(fboCol)}2+$${columnToLetter(stockCol)}2=0,$${columnToLetter(ordersCol)}2>0)`;

    rules.push(
      SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied(formula)
        .setBackground('#fce5cd')
        .setRanges([dataRange])
        .build()
    );
  }

  sheetReport.setConditionalFormatRules(rules);
}

/**
 * Перевод индекса колонки в буквенное представление (A, B, ..., AA, AB...).
 */
function columnToLetter(columnNumber) {
  let temp = columnNumber;
  let letter = '';

  while (temp > 0) {
    const mod = (temp - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    temp = Math.floor((temp - mod) / 26);
  }

  return letter;
}

/**
 * Добавляет мягкую подложку для визуального разделения аналитических групп.
 */
function applyGroupBanding(sheetReport, rowsCount, colsCount) {
  const groupValues = sheetReport
    .getRange(2, REPORT_COLUMNS.groupAn, rowsCount - 1, 1)
    .getValues()
    .map((row) => String(row[0]));

  let isAltColor = false;
  let previousGroup = groupValues[0];

  const backgrounds = groupValues.map((row) => {
    const currentGroup = row;

    if (currentGroup !== previousGroup) {
      isAltColor = !isAltColor;
      previousGroup = currentGroup;
    }

    const color = isAltColor ? '#f8fbff' : null;
    return new Array(colsCount).fill(color);
  });

  sheetReport.getRange(2, 1, rowsCount - 1, colsCount).setBackgrounds(backgrounds);
}
