function dashboard2CreateTemplate_(e) {
  const template = HtmlService.createTemplateFromFile('Dashboard2Window');
  template.activePage = 'dashboard2';
  template.dashboard1Url = dashboard1GetWebAppUrl_();
  template.dashboard2Url = dashboard2GetWebAppUrl_();
  return template;
}

function getDashboard2HtmlData() {
  const reportSheet = getRequiredSheet_('report');
  const reportData = dashboard2GetSheetDataWithHeaders_(reportSheet);

  if (!reportData.headers.length) {
    throw new Error('Лист report пустой или не содержит заголовков.');
  }

  const reportHeaderMap = dashboard2BuildHeaderMap_(reportData.headers);
  dashboard2ValidateRequiredReportHeaders_(reportHeaderMap);

  const rows = dashboard2BuildRows_(reportData.rows, reportHeaderMap);
  const filters = dashboard2BuildFilterValues_(rows);
  const summary14 = dashboard2BuildSummaryByMode_(rows, '14');
  const summary30 = dashboard2BuildSummaryByMode_(rows, '30');
  const groups14 = dashboard2BuildGroupSummary_(rows, '14');
  const groups30 = dashboard2BuildGroupSummary_(rows, '30');

  return {
    generatedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm:ss'),
    rows: rows,
    filters: filters,
    summary14: summary14,
    summary30: summary30,
    groups14: groups14,
    groups30: groups30
  };
}

function dashboard2GetSheetDataWithHeaders_(sheet) {
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

function dashboard2BuildHeaderMap_(headers) {
  const map = {};
  headers.forEach(function(header, index) {
    map[header] = index;
  });
  return map;
}

function dashboard2ValidateRequiredReportHeaders_(map) {
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

function dashboard2BuildRows_(reportRows, reportHeaderMap) {
  const trend14Index = reportHeaderMap.trend14d;
  const trend30Index = reportHeaderMap.trend30d;

  const rows = reportRows.map(function(reportRow, idx) {
    const dayorders14Num = dashboard2ToNumberOrNull_(reportRow[reportHeaderMap.dayorders]);
    const dayorders30Num = dashboard2ToNumberOrNull_(reportRow[reportHeaderMap.dayorders30]);
    const sumstockNum = dashboard2ToNumber_(reportRow[reportHeaderMap.sumstock]);
    const zapas14Num = dashboard2ToNumberOrNull_(reportRow[reportHeaderMap.zapas]);
    const zapas30Num = dashboard2ToNumberOrNull_(reportRow[reportHeaderMap.zapas30]);

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

      order: dashboard2ToNumber_(reportRow[reportHeaderMap['Заказано поставщику']]),
      inwork: dashboard2ToNumber_(reportRow[reportHeaderMap['В производстве']]),
      rawstock: dashboard2ToNumber_(reportRow[reportHeaderMap['Остаток сырья в шт']]),
      stock: dashboard2ToNumber_(reportRow[reportHeaderMap['Готовая продукция на складе']]),
      reserved: dashboard2ToNumber_(reportRow[reportHeaderMap['В резерве']]),
      shipped: dashboard2ToNumber_(reportRow[reportHeaderMap['Отгружено на РВБ']]),
      fbostock: dashboard2ToNumber_(reportRow[reportHeaderMap['ФБО остаток']]),

      ordersFBO14: dashboard2ToNumber_(reportRow[reportHeaderMap.ordersFBO]),
      ordersFBS14: dashboard2ToNumber_(reportRow[reportHeaderMap.ordersFBS]),
      orderssum14: dashboard2ToNumber_(reportRow[reportHeaderMap.orderssum]),

      ordersFBO30: dashboard2ToNumber_(reportRow[reportHeaderMap.ordersFBO30]),
      ordersFBS30: dashboard2ToNumber_(reportRow[reportHeaderMap.ordersFBS30]),
      orderssum30: dashboard2ToNumber_(reportRow[reportHeaderMap.orderssum30]),

      sumstock: sumstockNum,
      dayorders14: dayorders14Num,
      dayorders30: dayorders30Num,
      zapas14: zapas14Num,
      zapas30: zapas30Num,

      trend14d: dashboard2ParseTrendSeries_(trend14Index !== undefined ? reportRow[trend14Index] : '', 14),
      trend30d: dashboard2ParseTrendSeries_(trend30Index !== undefined ? reportRow[trend30Index] : '', 30),

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
    return dashboard2Compare_(a.brandinfo, b.brandinfo) ||
      dashboard2Compare_(a.tg1, b.tg1) ||
      dashboard2Compare_(a.tg2, b.tg2) ||
      dashboard2Compare_(a.tg3, b.tg3) ||
      dashboard2Compare_(a.nom, b.nom);
  });

  return rows;
}

function dashboard2ParseTrendSeries_(value, expectedLength) {
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

function dashboard2BuildFilterValues_(rows) {
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

function dashboard2BuildSummaryByMode_(rows, mode) {
  const is30 = String(mode) === '30';

  const summary = {
    totalSku: rows.length,
    turnoverSku: 0,
    sumstock: 0,
    totalDayorders: 0,
    turnover: null,
    lowStockSku: 0,
    riskSku: 0,
    supplyNeedSku: 0
  };

  rows.forEach(function(row) {
    const dayorders = is30 ? row.dayorders30 : row.dayorders14;
    const zapas = is30 ? row.zapas30 : row.zapas14;

    summary.sumstock += dashboard2ToNumber_(row.sumstock);

    if (dayorders !== null && dayorders > 0) {
      summary.totalDayorders += dayorders;
      summary.turnoverSku += 1;
    }

    if (zapas !== null && zapas < 30) {
      summary.lowStockSku += 1;
    }

    if (zapas !== null && zapas < 7) {
      summary.riskSku += 1;
    }

    if (dashboard2ToNumber_(row.order) + dashboard2ToNumber_(row.inwork) > 0) {
      summary.supplyNeedSku += 1;
    }
  });

  summary.turnover = summary.totalDayorders > 0
    ? summary.sumstock / summary.totalDayorders
    : null;

  return summary;
}

function dashboard2BuildGroupSummary_(rows, mode) {
  const is30 = String(mode) === '30';
  const groupMap = {};

  rows.forEach(function(row) {
    const key = String(row.brandinfo || 'Без бренда');
    if (!groupMap[key]) {
      groupMap[key] = {
        brandinfo: key,
        totalSku: 0,
        sumstock: 0,
        totalDayorders: 0,
        turnover: null,
        riskSku: 0,
        lowStockSku: 0,
        orderssum: 0
      };
    }

    const dayorders = is30 ? row.dayorders30 : row.dayorders14;
    const zapas = is30 ? row.zapas30 : row.zapas14;
    const orderssum = is30 ? row.orderssum30 : row.orderssum14;

    groupMap[key].totalSku += 1;
    groupMap[key].sumstock += dashboard2ToNumber_(row.sumstock);
    groupMap[key].orderssum += dashboard2ToNumber_(orderssum);

    if (dayorders !== null && dayorders > 0) {
      groupMap[key].totalDayorders += dashboard2ToNumber_(dayorders);
    }

    if (zapas !== null && zapas < 30) {
      groupMap[key].lowStockSku += 1;
    }

    if (zapas !== null && zapas < 7) {
      groupMap[key].riskSku += 1;
    }
  });

  Object.keys(groupMap).forEach(function(key) {
    const item = groupMap[key];
    item.turnover = item.totalDayorders > 0 ? item.sumstock / item.totalDayorders : null;
  });

  return Object.keys(groupMap).sort(function(a, b) {
    return a.localeCompare(b, 'ru');
  }).map(function(key) {
    return groupMap[key];
  });
}

function dashboard2ToNumber_(value) {
  const num = Number(value);
  return isNaN(num) ? 0 : num;
}

function dashboard2ToNumberOrNull_(value) {
  if (value === '' || value === null || value === undefined) return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
}

function dashboard2Compare_(a, b) {
  return String(a || '').localeCompare(String(b || ''), 'ru');
}