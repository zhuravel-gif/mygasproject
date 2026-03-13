function doGet(e) {
  const template = HtmlService.createTemplateFromFile('Dashboard1Window');
  template.activePage = dashboardHtmlResolvePage_(e);

  return template
    .evaluate()
    .setTitle('Dashboards')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function showDashboard1Html() {
  return dashboard1GetWebAppUrl_();
}

function dashboard1GetWebAppUrl_() {
  return PropertiesService.getScriptProperties().getProperty('DASHBOARD1_WEBAPP_URL') || '';
}

function dashboardHtmlResolvePage_(e) {
  const page = e && e.parameter && e.parameter.page ? String(e.parameter.page).toLowerCase() : 'dashboard1';
  const allowed = {
    dashboard1: true,
    dashboard2: true,
    dashboard3: true
  };
  return allowed[page] ? page : 'dashboard1';
}

/**
 * Данные для HTML/WebApp-дашборда.
 * Источник только report — без прямых расчётов по orders.
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
  const summary = dashboardHtmlBuildSummary_(rows);

  return {
    generatedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm:ss'),
    lookbackDays: DASHBOARD_LOOKBACK_DAYS,
    rows: rows,
    filters: filters,
    summary: summary
  };
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
    'zapas'
  ];

  required.forEach(function(name) {
    if (map[name] === undefined) {
      throw new Error('В report не найден обязательный столбец: ' + name);
    }
  });
}

function dashboardHtmlBuildRows_(reportRows, reportHeaderMap) {
  const trendIndex = reportHeaderMap.trend14d;

  const rows = reportRows.map(function(reportRow, idx) {
    const dayordersNum = dashboardHtmlToNumberOrNull_(reportRow[reportHeaderMap.dayorders]);
    const sumstockNum = dashboardHtmlToNumber_(reportRow[reportHeaderMap.sumstock]);
    const zapasNum = dashboardHtmlToNumberOrNull_(reportRow[reportHeaderMap.zapas]);
    const trend14d = dashboardHtmlParseTrend14d_(trendIndex !== undefined ? reportRow[trendIndex] : '');

    const row = {
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
      ordersFBO: dashboardHtmlToNumber_(reportRow[reportHeaderMap.ordersFBO]),
      ordersFBS: dashboardHtmlToNumber_(reportRow[reportHeaderMap.ordersFBS]),
      orderssum: dashboardHtmlToNumber_(reportRow[reportHeaderMap.orderssum]),
      sumstock: sumstockNum,
      dayorders: dayordersNum,
      zapas: zapasNum,
      zapasFlag: zapasNum !== null && zapasNum < 30 ? 'Да' : 'Нет',
      trend14d: trend14d,
      hasTurnover: dayordersNum !== null && dayordersNum > 0,
      turnoverBaseStock: sumstockNum,
      turnoverBaseDemand: dayordersNum !== null && dayordersNum > 0 ? dayordersNum : 0
    };

    row.searchText = [
      row.nom,
      row.art1C,
      row.artwb,
      row.brandinfo,
      row.tg1,
      row.tg2,
      row.tg3,
      row.cat
    ].join(' ').toLowerCase();

    return row;
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

function dashboardHtmlParseTrend14d_(value) {
  if (!value) {
    return new Array(DASHBOARD_LOOKBACK_DAYS).fill(0);
  }

  const raw = String(value).split(',');
  const result = raw.slice(0, DASHBOARD_LOOKBACK_DAYS).map(function(item) {
    const num = Number(item);
    return isNaN(num) ? 0 : num;
  });

  while (result.length < DASHBOARD_LOOKBACK_DAYS) {
    result.push(0);
  }

  return result;
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

function dashboardHtmlBuildSummary_(rows) {
  return dashboardHtmlSummarizeRows_(rows);
}

function dashboardHtmlSummarizeRows_(rows) {
  const summary = {
    totalSku: rows.length,
    turnoverSku: 0,
    sumstock: 0,
    totalDayorders: 0,
    turnover: null,
    lowStockSku: 0
  };

  rows.forEach(function(row) {
    summary.sumstock += dashboardHtmlToNumber_(row.sumstock);

    if (row.dayorders !== null && row.dayorders > 0) {
      summary.totalDayorders += row.dayorders;
      summary.turnoverSku += 1;
    }

    if (row.zapas !== null && row.zapas < 30) {
      summary.lowStockSku += 1;
    }
  });

  summary.turnover = summary.totalDayorders > 0
    ? summary.sumstock / summary.totalDayorders
    : null;

  return summary;
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
