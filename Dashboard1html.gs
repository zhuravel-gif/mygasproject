function showDashboard1Html() {
  const html = HtmlService.createHtmlOutputFromFile('Dashboard1Window')
    .setWidth(1780)
    .setHeight(1000);

  SpreadsheetApp.getUi().showModalDialog(html, 'Dashboard1 · HTML');
}

/**
 * Данные для HTML-дашборда.
 * Источник только report.
 */
function getDashboard1HtmlData() {
  const reportSheet = getRequiredSheet_('report');
  const reportData = dashboardHtmlGetSheetDataWithHeaders_(reportSheet);

  if (!reportData.headers.length) {
    throw new Error('Лист report пустой или не содержит заголовков.');
  }

  const reportHeaderMap = dashboardHtmlBuildHeaderMap_(reportData.headers);
  dashboardHtmlValidateRequiredReportHeaders_(reportHeaderMap);

  const rows = dashboardHtmlBuildRows_(reportData.rows, reportHeaderMap);
  const filters = dashboardHtmlBuildFilterValues_(rows);
  const kpis = dashboardHtmlBuildKpis_(rows);

  return {
    generatedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm:ss'),
    lookbackDays: DASHBOARD_LOOKBACK_DAYS,
    rows: rows,
    filters: filters,
    kpis: kpis
  };
}

function saveDashboard1CurrentView(payload) {
  return dashboardHtmlSaveView_(payload, false);
}

function saveDashboard1FullView(payload) {
  return dashboardHtmlSaveView_(payload, true);
}

function dashboardHtmlSaveView_(payload, saveAllRows) {
  payload = payload || {};
  const filters = payload.filters || {};
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rows = dashboardHtmlGetFilteredRowsFromReport_(filters, saveAllRows);
  const kpis = dashboardHtmlBuildKpis_(rows);

  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HH-mm-ss');
  const sheetName = dashboardHtmlBuildExportSheetName_(saveAllRows ? 'Dashboard1_full_' : 'Dashboard1_view_', timestamp, ss);
  const sheet = ss.insertSheet(sheetName);

  const lines = [
    ['Dashboard1 HTML', saveAllRows ? 'Полный отчёт без фильтров' : 'Текущий вид'],
    ['Дата выгрузки', Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm:ss')],
    ['Категория', saveAllRows ? 'Все' : dashboardHtmlExportValueOrAll_(filters.cat)],
    ['Бренд', saveAllRows ? 'Все' : dashboardHtmlExportValueOrAll_(filters.brandinfo)],
    ['Товарная группа 1', saveAllRows ? 'Все' : dashboardHtmlExportValueOrAll_(filters.tg1)],
    ['Товарная группа 2', saveAllRows ? 'Все' : dashboardHtmlExportValueOrAll_(filters.tg2)],
    ['Товарная группа 3', saveAllRows ? 'Все' : dashboardHtmlExportValueOrAll_(filters.tg3)],
    ['Только запас < 30', saveAllRows ? 'Нет' : dashboardHtmlExportValueOrAll_(filters.zapas30)],
    ['Поиск', saveAllRows ? 'Нет' : dashboardHtmlExportValueOrAll_(filters.search)],
    ['Строк в выгрузке', rows.length],
    ['SKU с запасом < 30 дней', kpis.lt30 || 0],
    ['Топ бренды по оборачиваемости', dashboardHtmlTurnoverSummaryText_(kpis.brandTurnoverRows)],
    ['Топ категории внутри брендов', dashboardHtmlTurnoverSummaryText_(kpis.categoryTurnoverRows)]
  ];

  const headers = dashboardHtmlExportHeaders_();
  const values = rows.map(function(r) {
    return [
      r.brandinfo || '',
      r.tg1 || '',
      r.tg2 || '',
      r.tg3 || '',
      r.nom || '',
      r.art1C || '',
      r.artwb || '',
      r.cat || '',
      dashboardHtmlToNumber_(r.order),
      dashboardHtmlToNumber_(r.inwork),
      dashboardHtmlToNumber_(r.rawstock),
      dashboardHtmlToNumber_(r.stock),
      dashboardHtmlToNumber_(r.reserved),
      dashboardHtmlToNumber_(r.shipped),
      dashboardHtmlToNumber_(r.fbostock),
      dashboardHtmlToNumber_(r.ordersFBO),
      dashboardHtmlToNumber_(r.ordersFBS),
      dashboardHtmlToNumber_(r.orderssum),
      dashboardHtmlToNumber_(r.sumstock),
      r.dayorders === null || r.dayorders === '' ? '' : Number(r.dayorders),
      r.zapas === null || r.zapas === '' ? '' : Number(r.zapas)
    ];
  });

  sheet.getRange(1, 1, lines.length, 2).setValues(lines);
  sheet.getRange(lines.length + 2, 1, 1, headers.length).setValues([headers]);

  if (values.length) {
    sheet.getRange(lines.length + 3, 1, values.length, headers.length).setValues(values);
  }

  dashboardHtmlFormatExportSheet_(sheet, lines.length + 2, headers.length, values.length);

  return {
    ok: true,
    sheetName: sheetName,
    rows: values.length,
    message: 'Лист создан: ' + sheetName + '. Строк: ' + values.length + '.'
  };
}

function dashboardHtmlExportHeaders_() {
  return [
    'Бренд',
    'Товарная группа 1',
    'Товарная группа 2',
    'Товарная группа 3',
    'Наименование',
    'Артикул',
    'Артикул WB',
    'Категория',
    'Заказано поставщику',
    'В производстве',
    'Остаток сырья',
    'Готовая продукция',
    'В резерве',
    'Отгружено на РВБ',
    'ФБО остаток',
    'Заказы FBO',
    'Заказы FBS',
    'Заказы всего',
    'Суммарный остаток',
    'Средние заказы/день',
    'Запас, дней'
  ];
}

function dashboardHtmlFormatExportSheet_(sheet, headerRow, totalCols, dataRowsCount) {
  const lastRow = headerRow + Math.max(dataRowsCount, 1);

  sheet.setFrozenRows(headerRow);
  sheet.setFrozenColumns(8);

  const metaRange = sheet.getRange(1, 1, headerRow - 2, 2);
  metaRange.setFontSize(10).setVerticalAlignment('middle');
  sheet.getRange(1, 1, 1, 2).setFontWeight('bold').setFontSize(12).setBackground('#dce6f1');
  sheet.getRange(1, 1, headerRow - 2, 1).setFontWeight('bold').setBackground('#f3f6fb');

  const headerRange = sheet.getRange(headerRow, 1, 1, totalCols);
  headerRange
    .setFontWeight('bold')
    .setWrap(true)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setBackground('#1f4e78')
    .setFontColor('#ffffff');

  if (dataRowsCount > 0) {
    const tableRange = sheet.getRange(headerRow, 1, dataRowsCount + 1, totalCols);
    tableRange.createFilter();

    sheet.getRange(headerRow + 1, 9, dataRowsCount, 11).setHorizontalAlignment('right');
    sheet.getRange(headerRow + 1, 9, dataRowsCount, 10).setNumberFormat('#,##0');
    sheet.getRange(headerRow + 1, 19, dataRowsCount, 1).setNumberFormat('#,##0');
    sheet.getRange(headerRow + 1, 20, dataRowsCount, 2).setNumberFormat('#,##0.00');

    sheet.getRange(headerRow + 1, 1, dataRowsCount, totalCols).applyRowBanding(SpreadsheetApp.BandingTheme.BLUE, true, false);

    const zapasRange = sheet.getRange(headerRow + 1, 21, dataRowsCount, 1);
    const rules = sheet.getConditionalFormatRules().concat([
      SpreadsheetApp.newConditionalFormatRule()
        .whenNumberLessThan(7)
        .setBackground('#fde7e7')
        .setRanges([zapasRange])
        .build(),
      SpreadsheetApp.newConditionalFormatRule()
        .whenNumberBetween(7, 29.9999)
        .setBackground('#fff4db')
        .setRanges([zapasRange])
        .build(),
      SpreadsheetApp.newConditionalFormatRule()
        .whenNumberGreaterThanOrEqualTo(30)
        .setBackground('#e8f5e9')
        .setRanges([zapasRange])
        .build()
    ]);
    sheet.setConditionalFormatRules(rules);
  }

  const widths = [140, 150, 150, 150, 280, 110, 110, 140, 92, 92, 92, 92, 92, 92, 92, 88, 88, 88, 92, 98, 88];
  widths.forEach(function(width, index) {
    sheet.setColumnWidth(index + 1, width);
  });
  sheet.autoResizeRows(1, lastRow);
}

function dashboardHtmlBuildExportSheetName_(prefix, timestamp, ss) {
  let name = (prefix + timestamp).slice(0, 99);
  let suffix = 1;
  while (ss.getSheetByName(name)) {
    const base = (prefix + timestamp).slice(0, 90);
    name = base + '_' + suffix;
    suffix += 1;
  }
  return name;
}

function dashboardHtmlExportValueOrAll_(value) {
  return value === null || value === undefined || value === '' ? 'Все' : String(value);
}

function dashboardHtmlGetSheetDataWithHeaders_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow < 1 || lastCol < 1) {
    return { headers: [], rows: [] };
  }

  const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  return {
    headers: values[0].map(function(v) { return String(v).trim(); }),
    rows: values.slice(1)
  };
}

function dashboardHtmlBuildHeaderMap_(headers) {
  const map = {};
  headers.forEach(function(header, index) {
    map[header] = index;
  });
  return map;
}

function dashboardHtmlValidateRequiredReportHeaders_(map) {
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
    'zapas',
    'trend14d'
  ];

  required.forEach(function(name) {
    if (map[name] === undefined) {
      throw new Error('В report не найден обязательный столбец: ' + name);
    }
  });
}

function dashboardHtmlBuildRows_(reportRows, reportHeaderMap) {
  const rows = reportRows.map(function(reportRow, idx) {
    const zapas = reportRow[reportHeaderMap['zapas']];
    const zapasNum = dashboardHtmlToNumberOrNull_(zapas);

    return {
      id: idx + 1,
      brandinfo: reportRow[reportHeaderMap['Бренд']],
      tg1: reportRow[reportHeaderMap['Товарная группа 1']],
      tg2: reportRow[reportHeaderMap['Товарная группа 2']],
      tg3: reportRow[reportHeaderMap['Товарная группа 3']],
      nom: reportRow[reportHeaderMap['Наименование']],
      art1C: reportRow[reportHeaderMap['Артикул']],
      artwb: reportRow[reportHeaderMap['Артикул ВБ']],
      cat: reportRow[reportHeaderMap['Категория товаров']],
      order: dashboardHtmlToNumber_(reportRow[reportHeaderMap['Заказано поставщику']]),
      inwork: dashboardHtmlToNumber_(reportRow[reportHeaderMap['В производстве']]),
      rawstock: dashboardHtmlToNumber_(reportRow[reportHeaderMap['Остаток сырья в шт']]),
      stock: dashboardHtmlToNumber_(reportRow[reportHeaderMap['Готовая продукция на складе']]),
      reserved: dashboardHtmlToNumber_(reportRow[reportHeaderMap['В резерве']]),
      shipped: dashboardHtmlToNumber_(reportRow[reportHeaderMap['Отгружено на РВБ']]),
      fbostock: dashboardHtmlToNumber_(reportRow[reportHeaderMap['ФБО остаток']]),
      ordersFBO: dashboardHtmlToNumber_(reportRow[reportHeaderMap['ordersFBO']]),
      ordersFBS: dashboardHtmlToNumber_(reportRow[reportHeaderMap['ordersFBS']]),
      orderssum: dashboardHtmlToNumber_(reportRow[reportHeaderMap['orderssum']]),
      sumstock: dashboardHtmlToNumber_(reportRow[reportHeaderMap['sumstock']]),
      dayorders: dashboardHtmlToNumberOrNull_(reportRow[reportHeaderMap['dayorders']]),
      zapas: zapasNum,
      zapasFlag: zapasNum !== null && zapasNum < 30 ? 'Да' : 'Нет',
      trend14d: dashboardHtmlParseTrend14d_(reportRow[reportHeaderMap['trend14d']])
    };
  });

  rows.sort(function(a, b) {
    return dashboardHtmlCompare_(a.brandinfo, b.brandinfo) ||
      dashboardHtmlCompare_(a.tg1, b.tg1) ||
      dashboardHtmlCompare_(a.tg2, b.tg2) ||
      dashboardHtmlCompare_(a.tg3, b.tg3) ||
      dashboardHtmlCompare_(a.nom, b.nom);
  });

  return rows;
}

function dashboardHtmlBuildFilterValues_(rows) {
  function uniqueSorted(key) {
    const set = {};
    rows.forEach(function(row) {
      const value = String(row[key] || '').trim();
      if (value) set[value] = true;
    });
    return Object.keys(set).sort(function(a, b) {
      return a.localeCompare(b, 'ru');
    });
  }

  return {
    cat: uniqueSorted('cat'),
    brandinfo: uniqueSorted('brandinfo'),
    tg1: uniqueSorted('tg1'),
    tg2: uniqueSorted('tg2'),
    tg3: uniqueSorted('tg3')
  };
}

function dashboardHtmlBuildKpis_(rows) {
  const lt30 = rows.filter(function(r) { return r.zapas !== null && r.zapas < 30; }).length;

  return {
    lt30: lt30,
    brandTurnoverRows: dashboardHtmlBuildTurnoverRanking_(rows, ['brandinfo'], 5),
    categoryTurnoverRows: dashboardHtmlBuildTurnoverRanking_(rows, ['brandinfo', 'cat'], 7)
  };
}

function dashboardHtmlBuildTurnoverRanking_(rows, keys, limit) {
  const groups = {};

  rows.forEach(function(row) {
    const keyValues = keys.map(function(key) {
      return String(row[key] || '').trim();
    });

    if (keyValues.some(function(value) { return !value; })) {
      return;
    }

    const groupKey = keyValues.join('¦');
    groups[groupKey] = groups[groupKey] || {
      brandinfo: keyValues[0] || '',
      cat: keyValues[1] || '',
      skuCount: 0,
      sumstock: 0,
      dayorders: 0
    };

    groups[groupKey].skuCount += 1;
    groups[groupKey].sumstock += dashboardHtmlToNumber_(row.sumstock);
    groups[groupKey].dayorders += dashboardHtmlToNumber_(row.dayorders);
  });

  return Object.keys(groups)
    .map(function(groupKey) {
      const item = groups[groupKey];
      if (item.dayorders <= 0) {
        return null;
      }

      return {
        name: item.cat ? (item.brandinfo + ' → ' + item.cat) : item.brandinfo,
        brandinfo: item.brandinfo,
        cat: item.cat,
        skuCount: item.skuCount,
        days: item.sumstock / item.dayorders,
        sumstock: item.sumstock,
        dayorders: item.dayorders
      };
    })
    .filter(function(item) { return item !== null; })
    .sort(function(a, b) {
      return a.days - b.days || dashboardHtmlCompare_(a.name, b.name);
    })
    .slice(0, limit);
}

function dashboardHtmlParseTrend14d_(value) {
  const fallback = new Array(DASHBOARD_LOOKBACK_DAYS).fill(0);

  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const series = String(value).split(',').map(function(item) {
    const num = Number(item);
    return isNaN(num) ? 0 : num;
  });

  while (series.length < DASHBOARD_LOOKBACK_DAYS) {
    series.unshift(0);
  }

  return series.slice(-DASHBOARD_LOOKBACK_DAYS);
}

function dashboardHtmlGetFilteredRowsFromReport_(filters, saveAllRows) {
  const reportSheet = getRequiredSheet_('report');
  const reportData = dashboardHtmlGetSheetDataWithHeaders_(reportSheet);

  if (!reportData.headers.length) {
    return [];
  }

  const reportHeaderMap = dashboardHtmlBuildHeaderMap_(reportData.headers);
  dashboardHtmlValidateRequiredReportHeaders_(reportHeaderMap);
  const rows = dashboardHtmlBuildRows_(reportData.rows, reportHeaderMap);

  if (saveAllRows) {
    return rows;
  }

  return dashboardHtmlApplyFilters_(rows, filters || {});
}

function dashboardHtmlApplyFilters_(rows, filters) {
  const cat = dashboardHtmlNormalizeKey_(filters.cat);
  const brand = dashboardHtmlNormalizeKey_(filters.brandinfo);
  const tg1 = dashboardHtmlNormalizeKey_(filters.tg1);
  const tg2 = dashboardHtmlNormalizeKey_(filters.tg2);
  const tg3 = dashboardHtmlNormalizeKey_(filters.tg3);
  const zapas30 = dashboardHtmlNormalizeKey_(filters.zapas30);
  const search = dashboardHtmlNormalizeKey_(filters.search).toLowerCase();

  return rows.filter(function(r) {
    if (cat && r.cat !== cat) return false;
    if (brand && r.brandinfo !== brand) return false;
    if (tg1 && r.tg1 !== tg1) return false;
    if (tg2 && r.tg2 !== tg2) return false;
    if (tg3 && r.tg3 !== tg3) return false;
    if (zapas30 && r.zapasFlag !== zapas30) return false;

    if (search) {
      const hay = [
        r.nom, r.art1C, r.artwb, r.brandinfo, r.tg1, r.tg2, r.tg3, r.cat
      ].join(' ').toLowerCase();

      if (hay.indexOf(search) === -1) {
        return false;
      }
    }

    return true;
  });
}

function dashboardHtmlTurnoverSummaryText_(items) {
  if (!items || !items.length) {
    return '—';
  }

  return items.slice(0, 3).map(function(item) {
    return item.name + ' · ' + dashboardHtmlFormatNumber_(item.days, 1) + ' дн.';
  }).join(' | ');
}

function dashboardHtmlFormatNumber_(value, digits) {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  const num = Number(value);
  if (isNaN(num)) {
    return '—';
  }

  return num.toFixed(digits).replace('.', ',');
}

function dashboardHtmlNormalizeKey_(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function dashboardHtmlNormalizeNumberLike_(value) {
  if (value === null || value === undefined || value === '') return '';
  const num = Number(value);
  if (!isNaN(num)) return String(num);
  return String(value).trim();
}

function dashboardHtmlToNumber_(value) {
  const num = Number(value);
  return isNaN(num) ? 0 : num;
}

function dashboardHtmlToNumberOrNull_(value) {
  if (value === '' || value === null || value === undefined) return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
}

function dashboardHtmlCompare_(a, b) {
  return String(a || '').localeCompare(String(b || ''), 'ru');
}
