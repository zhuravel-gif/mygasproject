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
    sheetReport.getRange(2, REPORT_COLUMNS.oosDate, rowsCount - 1, 1).setNumberFormat('dd.mm.yyyy');

    applyGroupBanding(sheetReport, rowsCount, colsCount);
    applyOosConditionalFormatting(sheetReport, rowsCount);
    applyRiskConditionalFormatting(sheetReport, rowsCount);
  }

  const existingFilter = sheetReport.getFilter();
  if (existingFilter) {
    existingFilter.remove();
  }

  sheetReport.getRange(1, 1, rowsCount, colsCount).createFilter();
}

/**
 * Добавляет условную подсветку для прогноза OOS: до 7 дней — красный, до 14 дней — желтый.
 */
function applyOosConditionalFormatting(sheetReport, rowsCount) {
  const oosRange = sheetReport.getRange(2, REPORT_COLUMNS.oosDate, rowsCount - 1, 1);

  const redRule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=AND($T2<>"",$T2>=TODAY(),$T2<=TODAY()+7)')
    .setBackground('#f4cccc')
    .setRanges([oosRange])
    .build();

  const yellowRule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=AND($T2<>"",$T2>TODAY()+7,$T2<=TODAY()+14)')
    .setBackground('#fff2cc')
    .setRanges([oosRange])
    .build();

  const otherRules = sheetReport.getConditionalFormatRules().filter((rule) => {
    return !rule.getRanges().some((range) => range.getColumn() === REPORT_COLUMNS.oosDate);
  });

  sheetReport.setConditionalFormatRules(otherRules.concat([redRule, yellowRule]));
}

/**
 * Добавляет условное форматирование для риск-зон.
 */
function applyRiskConditionalFormatting(sheetReport, rowsCount) {
  if (rowsCount <= 1) {
    return;
  }

  const colsCount = sheetReport.getLastColumn();
  const headers = sheetReport.getRange(1, 1, 1, colsCount).getValues()[0];
  const turnoverCol = headers.indexOf('Уходимость') + 1;
  const fboCol = headers.indexOf('ФБО остаток') + 1;
  const stockCol = headers.indexOf('Готовая продукция на складе') + 1;
  const ordersCol = headers.indexOf('Сумма заказов') + 1;

  const rules = sheetReport.getConditionalFormatRules().filter((rule) => {
    return !rule.getRanges().some((range) => {
      const column = range.getColumn();
      return column === turnoverCol || column === ordersCol || column === 1;
    });
  });

  if (turnoverCol > 0) {
    const targetRange = sheetReport.getRange(2, turnoverCol, rowsCount - 1, 1);
    const colLetter = columnToLetter(turnoverCol);

    rules.push(
      SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied(`=AND(ISNUMBER($${colLetter}2),$${colLetter}2<=0.5)`)
        .setBackground('#f4c7c3')
        .setRanges([targetRange])
        .build(),
      SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied(`=AND(ISNUMBER($${colLetter}2),$${colLetter}2>0.5,$${colLetter}2<=1.5)`)
        .setBackground('#fff2cc')
        .setRanges([targetRange])
        .build(),
      SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied(`=AND(ISNUMBER($${colLetter}2),$${colLetter}2>1.5)`)
        .setBackground('#d9ead3')
        .setRanges([targetRange])
        .build()
    );
  }

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
  if (rowsCount <= 1) {
    return;
  }

  const groupValues = sheetReport
    .getRange(2, REPORT_COLUMNS.groupAn, rowsCount - 1, 1)
    .getValues()
    .map((row) => String(row[0] || ''));

  let isAltColor = false;
  let previousGroup = groupValues[0];

  const backgrounds = groupValues.map((groupValue) => {
    if (groupValue !== previousGroup) {
      isAltColor = !isAltColor;
      previousGroup = groupValue;
    }

    const color = isAltColor ? '#f8fbff' : '#ffffff';
    return new Array(colsCount).fill(color);
  });

  sheetReport.getRange(2, 1, rowsCount - 1, colsCount).setBackgrounds(backgrounds);
}
