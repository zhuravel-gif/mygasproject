function hasNonEmptyHeaders(headersRow) {
  return headersRow.some((cell) => String(cell).trim() !== '');
}

function normalizeTextValue_(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ');
}

function normalizeKey_(value) {
  if (value === null || value === undefined) return '';

  const raw = String(value).trim();
  if (!raw) return '';

  const compact = raw.replace(/\s+/g, '').replace(',', '.');

  if (/^\d+(?:\.0+)?$/.test(compact)) {
    return String(Number(compact));
  }

  return raw;
}

function normalizeDateKey(value, timezone) {
  if (!value) return null;

  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return Utilities.formatDate(value, timezone, 'yyyy-MM-dd');
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const parsedDate = new Date(trimmed);
    if (!isNaN(parsedDate.getTime())) {
      return Utilities.formatDate(parsedDate, timezone, 'yyyy-MM-dd');
    }
  }

  return null;
}

function toNumberValue_(value) {
  const parsed = Number(value);
  return isNaN(parsed) ? 0 : parsed;
}

function isCancelledOrder_(value) {
  if (value === true) return true;
  const normalized = normalizeTextValue_(value);
  return normalized === '1' || normalized === 'true' || normalized === 'да';
}

function validateStrictHeaders_(headers, schema, sheetLabel) {
  Object.keys(schema).forEach((field) => {
    const descriptor = schema[field];
    const actual = String(headers[descriptor.col - 1] || '').trim();
    const expected = descriptor.header;

    if (normalizeTextValue_(actual) !== normalizeTextValue_(expected)) {
      throw new Error(
        `Лист "${sheetLabel}", колонка ${columnToLetter(descriptor.col)}: ожидался заголовок "${expected}", найден "${actual || '(пусто)'}".`
      );
    }
  });
}

function getRolling14DateKeys_(timezone) {
  const result = [];
  const now = new Date();

  for (let i = SPARKLINE_DAYS_WINDOW - 1; i >= 0; i -= 1) {
    const point = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    result.push(Utilities.formatDate(point, timezone, 'yyyy-MM-dd'));
  }

  return result;
}

function aggregateOrders(ordersData, timezone) {
  const headers = ordersData[0];
  validateStrictHeaders_(headers, STRICT_ORDERS_SCHEMA, 'orders');

  const idxOrders = {
    date: STRICT_ORDERS_SCHEMA.date.col - 1,
    nmid: STRICT_ORDERS_SCHEMA.nmid.col - 1,
    iscancel: STRICT_ORDERS_SCHEMA.iscancel.col - 1,
    warehousetype: STRICT_ORDERS_SCHEMA.warehousetype.col - 1
  };

  const dateKeys = getRolling14DateKeys_(timezone);
  const datePos = dateKeys.reduce((acc, key, index) => {
    acc.set(key, index);
    return acc;
  }, new Map());

  const ordersMap = new Map();

  for (let i = 1; i < ordersData.length; i += 1) {
    const row = ordersData[i];
    const nmid = normalizeKey_(row[idxOrders.nmid]);
    if (!nmid) continue;
    if (isCancelledOrder_(row[idxOrders.iscancel])) continue;

    const dateKey = normalizeDateKey(row[idxOrders.date], timezone);
    if (!dateKey || !datePos.has(dateKey)) continue;

    if (!ordersMap.has(nmid)) {
      ordersMap.set(nmid, { fbo: 0, fbs: 0, trend: new Array(SPARKLINE_DAYS_WINDOW).fill(0) });
    }

    const currentData = ordersMap.get(nmid);
    const warehouse = normalizeTextValue_(row[idxOrders.warehousetype]);

    if (warehouse === 'склад wb' || warehouse === 'склад wildberries') {
      currentData.fbo += 1;
    } else if (warehouse === 'склад продавца') {
      currentData.fbs += 1;
    }

    currentData.trend[datePos.get(dateKey)] += 1;
  }

  return {
    ordersMap,
    daysCount: SPARKLINE_DAYS_WINDOW
  };
}

function buildSparklineFormula_(trendValues) {
  const values = trendValues.map((value) => Number(value) || 0).join(';');
  return `=SPARKLINE({${values}};{"charttype","column";"color","#1f4e78"})`;
}

function buildReportRows(c1Data, ordersMap, daysCount) {
  const c1Headers = c1Data[0];
  validateStrictHeaders_(c1Headers, STRICT_1C_SCHEMA, '1C');

  const idxC1 = {
    nom: STRICT_1C_SCHEMA.nom.col - 1,
    art: STRICT_1C_SCHEMA.art.col - 1,
    artWb: STRICT_1C_SCHEMA.artWb.col - 1,
    cat: STRICT_1C_SCHEMA.cat.col - 1,
    vol: STRICT_1C_SCHEMA.vol.col - 1,
    group2: STRICT_1C_SCHEMA.group2.col - 1,
    count: STRICT_1C_SCHEMA.count.col - 1,
    group1: STRICT_1C_SCHEMA.group1.col - 1,
    ordered: STRICT_1C_SCHEMA.ordered.col - 1,
    inProd: STRICT_1C_SCHEMA.inProd.col - 1,
    raw: STRICT_1C_SCHEMA.raw.col - 1,
    ready: STRICT_1C_SCHEMA.ready.col - 1,
    reserve: STRICT_1C_SCHEMA.reserve.col - 1,
    sentRvb: STRICT_1C_SCHEMA.sentRvb.col - 1,
    fboRest: STRICT_1C_SCHEMA.fboRest.col - 1
  };

  const reportData = [];
  const processedKeys = new Set();

  for (let i = 1; i < c1Data.length; i += 1) {
    const row = c1Data[i];
    const nom = String(row[idxC1.nom] || '').trim();
    const artWb = normalizeKey_(row[idxC1.artWb]);
    const uniqueRowKey = [nom, artWb].join('|');

    if (!nom) continue;
    if (processedKeys.has(uniqueRowKey)) continue;
    processedKeys.add(uniqueRowKey);

    const orderStats = ordersMap.get(artWb) || { fbo: 0, fbs: 0, trend: new Array(SPARKLINE_DAYS_WINDOW).fill(0) };
    const totalOrders = orderStats.fbo + orderStats.fbs;
    const avgDailySales = Number((totalOrders / daysCount).toFixed(2));
    const fboRest = toNumberValue_(row[idxC1.fboRest]);
    const coverageDays = avgDailySales > 0 ? fboRest / avgDailySales : 0;
    const oosDate = avgDailySales > 0
      ? new Date(Date.now() + Math.round(coverageDays) * 24 * 60 * 60 * 1000)
      : '';

    reportData.push([
      row[idxC1.group2],
      row[idxC1.cat],
      row[idxC1.group1],
      nom,
      row[idxC1.art],
      artWb || row[idxC1.artWb],
      row[idxC1.vol],
      row[idxC1.count],
      row[idxC1.ordered],
      row[idxC1.inProd],
      row[idxC1.raw],
      row[idxC1.ready],
      row[idxC1.reserve],
      row[idxC1.sentRvb],
      row[idxC1.fboRest],
      orderStats.fbo,
      orderStats.fbs,
      totalOrders,
      avgDailySales,
      oosDate,
      buildSparklineFormula_(orderStats.trend)
    ]);
  }

  reportData.sort((a, b) => {
    if (a[0] !== b[0]) return String(a[0]).localeCompare(String(b[0]));
    if (a[1] !== b[1]) return String(a[1]).localeCompare(String(b[1]));
    return String(a[2]).localeCompare(String(b[2]));
  });

  return reportData;
}
