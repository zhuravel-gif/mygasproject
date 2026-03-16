function doGet(e) {
  // Determine which dashboard page is requested. Default to dashboard1.
  const page = e && e.parameter && e.parameter.page ? String(e.parameter.page).toLowerCase() : 'dashboard1';
  // Choose the HTML file to load: Dashboard3 uses its own template; all others use Dashboard1Window.
  const templateFile = page === 'dashboard3' ? 'Dashboard3Window' : 'Dashboard1Window';
  const template = HtmlService.createTemplateFromFile(templateFile);
  // activePage is used only by Dashboard1Window to highlight the tab; safe for other templates.
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
  const summary14 = dashboardHtmlBuildSummaryByMode_(rows, '14');
  const summary30 = dashboardHtmlBuildSummaryByMode_(rows, '30');

  return {
    generatedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm:ss'),
    rows: rows,
    filters: filters,
    summary14: summary14,
    summary30: summary30
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
    'ordersFBO30',
    'ordersFBS30',
    'orderssum30',
    'sumstock',
    'dayorders',
    'dayorders30',
    'zapas',
    'zapas30',
    'trend14d',
    'trend30d'
  ];

  required.forEach(function(name) {
    if (map[name] === undefined) {
      throw new Error('В report не найден обязательный столбец: ' + name);
    }
  });
}

function dashboardHtmlBuildRows_(reportRows, reportHeaderMap) {
  const trend14Index = reportHeaderMap.trend14d;
  const trend30Index = reportHeaderMap.trend30d;

  const rows = reportRows.map(function(reportRow, idx) {
    const dayorders14Num = dashboardHtmlToNumberOrNull_(reportRow[reportHeaderMap.dayorders]);
    const dayorders30Num = dashboardHtmlToNumberOrNull_(reportRow[reportHeaderMap.dayorders30]);
    const sumstockNum = dashboardHtmlToNumber_(reportRow[reportHeaderMap.sumstock]);
    const zapas14Num = dashboardHtmlToNumberOrNull_(reportRow[reportHeaderMap.zapas]);
    const zapas30Num = dashboardHtmlToNumberOrNull_(reportRow[reportHeaderMap.zapas30]);
    const trend14d = dashboardHtmlParseTrendSeries_(trend14Index !== undefined ? reportRow[trend14Index] : '', 14);
    const trend30d = dashboardHtmlParseTrendSeries_(trend30Index !== undefined ? reportRow[trend30Index] : '', 30);

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

      ordersFBO14: dashboardHtmlToNumber_(reportRow[reportHeaderMap.ordersFBO]),
      ordersFBS14: dashboardHtmlToNumber_(reportRow[reportHeaderMap.ordersFBS]),
      orderssum14: dashboardHtmlToNumber_(reportRow[reportHeaderMap.orderssum]),

      ordersFBO30: dashboardHtmlToNumber_(reportRow[reportHeaderMap.ordersFBO30]),
      ordersFBS30: dashboardHtmlToNumber_(reportRow[reportHeaderMap.ordersFBS30]),
      orderssum30: dashboardHtmlToNumber_(reportRow[reportHeaderMap.orderssum30]),

      sumstock: sumstockNum,
      dayorders14: dayorders14Num,
      dayorders30: dayorders30Num,
      zapas14: zapas14Num,
      zapas30: zapas30Num,
      trend14d: trend14d,
      trend30d: trend30d,

      zapasFlag14: zapas14Num !== null && zapas14Num < 30 ? 'Да' : 'Нет',
      zapasFlag30: zapas30Num !== null && zapas30Num < 30 ? 'Да' : 'Нет'
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

function dashboardHtmlParseTrendSeries_(value, expectedLength) {
  if (!value) {
    return new Array(expectedLength).fill(0);
  }

  const raw = String(value).split(',');
  const result = raw.slice(0, expectedLength).map(function(item) {
    const num = Number(item);
    return isNaN(num) ? 0 : num;
  });

  while (result.length < expectedLength) {
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

function dashboardHtmlBuildSummaryByMode_(rows, mode) {
  const is30 = String(mode) === '30';

  const summary = {
    totalSku: rows.length,
    turnoverSku: 0,
    sumstock: 0,
    totalDayorders: 0,
    turnover: null,
    lowStockSku: 0
  };

  rows.forEach(function(row) {
    const dayorders = is30 ? row.dayorders30 : row.dayorders14;
    const zapas = is30 ? row.zapas30 : row.zapas14;

    summary.sumstock += dashboardHtmlToNumber_(row.sumstock);

    if (dayorders !== null && dayorders > 0) {
      summary.totalDayorders += dayorders;
      summary.turnoverSku += 1;
    }

    if (zapas !== null && zapas < 30) {
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