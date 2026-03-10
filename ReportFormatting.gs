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
    sheetReport.getRange(2, REPORT_COLUMNS.oosDate, rowsCount - 1, 1).setNumberFormat('dd.mm.yyyy');

    applyOosConditionalFormatting(sheetReport, rowsCount);

    const banding = dataRange.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY);
    banding.setHeaderRowColor('#1f4e78');

    applyGroupBanding(sheetReport, rowsCount, colsCount);
  }

  sheetReport.getRange(1, 1, rowsCount, colsCount).createFilter();
}


/**
 * Добавляет условную подсветку для прогноза OOS: до 7 дней — красный, до 14 дней — желтый.
 */
function applyOosConditionalFormatting(sheetReport, rowsCount) {
  const oosRange = sheetReport.getRange(2, REPORT_COLUMNS.oosDate, rowsCount - 1, 1);
  const existingRules = sheetReport.getConditionalFormatRules().filter((rule) => {
    return !rule.getRanges().some((range) => range.getColumn() === REPORT_COLUMNS.oosDate);
  });

  const redRule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied(`=AND($T2<>"",$T2>=TODAY(),$T2<=TODAY()+7)`)
    .setBackground('#f4cccc')
    .setRanges([oosRange])
    .build();

  const yellowRule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied(`=AND($T2<>"",$T2>TODAY()+7,$T2<=TODAY()+14)`)
    .setBackground('#fff2cc')
    .setRanges([oosRange])
    .build();

  sheetReport.setConditionalFormatRules(existingRules.concat([redRule, yellowRule]));
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
