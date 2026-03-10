/**
 * Проверка, что строка заголовков содержит хотя бы одно непустое значение.
 */
function hasNonEmptyHeaders(headersRow) {
  return headersRow.some((cell) => String(cell).trim() !== '');
}

/**
 * Нормализация даты в ключ yyyy-MM-dd.
 */
function normalizeDateKey(value, timezone) {
  if (!value) return null;

  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return Utilities.formatDate(value, timezone, 'yyyy-MM-dd');
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
      const year = Number(dateOnlyMatch[1]);
      const month = Number(dateOnlyMatch[2]);
      const day = Number(dateOnlyMatch[3]);
      const utcDate = new Date(Date.UTC(year, month - 1, day));

      if (
        utcDate.getUTCFullYear() === year &&
        utcDate.getUTCMonth() === month - 1 &&
        utcDate.getUTCDate() === day
      ) {
        return `${dateOnlyMatch[1]}-${dateOnlyMatch[2]}-${dateOnlyMatch[3]}`;
      }
    }

    const parsedDate = new Date(trimmed);
    if (!isNaN(parsedDate.getTime())) {
      return Utilities.formatDate(parsedDate, timezone, 'yyyy-MM-dd');
    }
  }

  return null;
}

/**
 * Сбор статистики заказов из листа orders.
 */
function aggregateOrders(ordersData, timezone) {
  const ordersHeaders = ordersData[0];
  const idxOrders = {
    nmid: ordersHeaders.indexOf('nmid'),
    iscancel: ordersHeaders.indexOf('iscancel'),
    warehousetype: ordersHeaders.indexOf('warehousetype'),
    date: ordersHeaders.indexOf('date')
  };

  if (Object.values(idxOrders).includes(-1)) {
    throw new Error('В листе "orders" отсутствуют обязательные колонки (nmid, iscancel, warehousetype, date).');
  }

  const ordersMap = new Map();
  const uniqueDates = new Set();

  for (let i = 1; i < ordersData.length; i++) {
    const row = ordersData[i];
    const nmid = row[idxOrders.nmid];

    if (row[idxOrders.iscancel] != 0) continue;

    const dateKey = normalizeDateKey(row[idxOrders.date], timezone);
    if (dateKey) uniqueDates.add(dateKey);

    if (!ordersMap.has(nmid)) {
      ordersMap.set(nmid, { fbo: 0, fbs: 0 });
    }

    const currentData = ordersMap.get(nmid);
    const warehouse = row[idxOrders.warehousetype];

    if (warehouse === 'Склад WB') {
      currentData.fbo += 1;
    } else if (warehouse === 'Склад продавца') {
      currentData.fbs += 1;
    }
  }

  return {
    ordersMap,
    daysCount: uniqueDates.size || 14
  };
}

/**
 * Формирование строк отчета из данных 1С и агрегатов orders.
 */
function buildReportRows(c1Data, ordersMap, daysCount) {
  const c1Headers = c1Data[0];
  const normalizeHeader = (value) => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ');

  const normalizedHeaderMap = c1Headers.reduce((acc, header, idx) => {
    acc.set(normalizeHeader(header), idx);
    return acc;
  }, new Map());

  const getCol = (nameOrAliases) => {
    const aliases = Array.isArray(nameOrAliases) ? nameOrAliases : [nameOrAliases];

    for (let i = 0; i < aliases.length; i++) {
      const idx = normalizedHeaderMap.get(normalizeHeader(aliases[i]));
      if (idx !== undefined) return idx;
    }

    throw new Error(`Колонка "${aliases[0]}" не найдена на листе 1С.`);
  };

  const idxC1 = {
    nom: getCol('Номенклатура.Наименование'),
    art: getCol('Артикул'),
    artWb: getCol('Артикул ВБ'),
    cat: getCol('Категория товаров'),
    vol: getCol(['Объём тары', 'Объем тары']),
    count: getCol('Количество лаков в наборе'),
    ordered: getCol('Заказано поставщику'),
    inProd: getCol('В производстве'),
    raw: getCol('Остаток сырья в шт'),
    ready: getCol('Готовая продукция на складе'),
    reserve: getCol('В резерве'),
    sentRvb: getCol('Отгружено на РВБ'),
    fboRest: getCol('ФБО остаток'),
    groupAn: getCol('Группа аналитического учёта'),
    group1: getCol('Товарная группа 1')
  };

  const reportData = [];
  const processedNom = new Set();

  for (let i = 1; i < c1Data.length; i++) {
    const row = c1Data[i];
    const nom = row[idxC1.nom];

    if (!nom || processedNom.has(nom)) continue;
    processedNom.add(nom);

    const artWb = row[idxC1.artWb];
    const orderStats = ordersMap.get(artWb) || { fbo: 0, fbs: 0 };
    const totalOrders = orderStats.fbo + orderStats.fbs;

    reportData.push([
      row[idxC1.groupAn],
      row[idxC1.cat],
      row[idxC1.group1],
      nom,
      row[idxC1.art],
      artWb,
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
      parseFloat((totalOrders / daysCount).toFixed(2))
    ]);
  }

  reportData.sort((a, b) => {
    if (a[0] !== b[0]) return String(a[0]).localeCompare(String(b[0]));
    if (a[1] !== b[1]) return String(a[1]).localeCompare(String(b[1]));
    return String(a[2]).localeCompare(String(b[2]));
  });

  return reportData;
}
