/**
 * Проверка, что строка заголовков содержит хотя бы одно непустое значение.
 */
function hasNonEmptyHeaders(headersRow) {
  return headersRow.some((cell) => String(cell).trim() !== '');
}

/**
 * Нормализация текстовых значений для сравнения.
 */
function normalizeTextValue_(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/["'`.,;:!?()[\]{}\-_/]+/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Нормализация ключей для сопоставления nmid / Артикул ВБ.
 */
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
 * Карта нормализованных заголовков -> индекс.
 */
function buildNormalizedHeaderMap_(headers) {
  return headers.reduce((acc, header, idx) => {
    acc.set(normalizeTextValue_(header), idx);
    return acc;
  }, new Map());
}

/**
 * Поиск индекса колонки по одному или нескольким алиасам.
 */
function findHeaderIndex_(headers, aliases, sheetLabel) {
  const aliasList = Array.isArray(aliases) ? aliases : [aliases];
  const normalizedHeaderMap = buildNormalizedHeaderMap_(headers);

  for (let i = 0; i < aliasList.length; i += 1) {
    const exact = normalizedHeaderMap.get(normalizeTextValue_(aliasList[i]));
    if (exact !== undefined) {
      return exact;
    }
  }

  const normalizedAliases = aliasList.map((alias) => normalizeTextValue_(alias));
  const matches = [];

  normalizedHeaderMap.forEach((index, header) => {
    const matched = normalizedAliases.some((alias) => {
      return header === alias || header.indexOf(alias) !== -1 || alias.indexOf(header) !== -1;
    });

    if (matched) {
      matches.push(index);
    }
  });

  const uniqueMatches = Array.from(new Set(matches));

  if (uniqueMatches.length === 1) {
    return uniqueMatches[0];
  }

  if (uniqueMatches.length > 1) {
    throw new Error(`Колонка "${aliasList[0]}" на листе "${sheetLabel}" найдена неоднозначно.`);
  }

  throw new Error(`Колонка "${aliasList[0]}" не найдена на листе "${sheetLabel}".`);
}

/**
 * Приведение значения к числу.
 */
function toNumberValue_(value) {
  const parsed = Number(value);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Проверка признака отмены заказа.
 */
function isCancelledOrder_(value) {
  if (value === true) return true;

  const normalized = normalizeTextValue_(value);
  return normalized === '1' || normalized === 'true' || normalized === 'да';
}

/**
 * Сбор статистики заказов из листа orders.
 */
function aggregateOrders(ordersData, timezone) {
  const ordersHeaders = ordersData[0];
  const idxOrders = {
    nmid: findHeaderIndex_(ordersHeaders, ['nmid', 'артикул wb', 'артикул вб'], 'orders'),
    iscancel: findHeaderIndex_(ordersHeaders, ['iscancel', 'is cancel', 'cancel'], 'orders'),
    warehousetype: findHeaderIndex_(ordersHeaders, ['warehousetype', 'warehouse type', 'тип склада'], 'orders'),
    date: findHeaderIndex_(ordersHeaders, ['date', 'order date', 'дата'], 'orders')
  };

  const ordersMap = new Map();
  const uniqueDates = new Set();

  for (let i = 1; i < ordersData.length; i += 1) {
    const row = ordersData[i];
    const nmid = normalizeKey_(row[idxOrders.nmid]);

    if (!nmid) continue;
    if (isCancelledOrder_(row[idxOrders.iscancel])) continue;

    const dateKey = normalizeDateKey(row[idxOrders.date], timezone);
    if (dateKey) {
      uniqueDates.add(dateKey);
    }

    if (!ordersMap.has(nmid)) {
      ordersMap.set(nmid, { fbo: 0, fbs: 0 });
    }

    const warehouse = normalizeTextValue_(row[idxOrders.warehousetype]);
    const currentData = ordersMap.get(nmid);

    if (warehouse === 'склад wb' || warehouse === 'склад wildberries') {
      currentData.fbo += 1;
    } else if (warehouse === 'склад продавца') {
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
  const idxC1 = {
    nom: findHeaderIndex_(c1Headers, ['Номенклатура.Наименование', 'Номенклатура', 'Наименование'], '1C'),
    art: findHeaderIndex_(c1Headers, ['Артикул', 'Артикул поставщика'], '1C'),
    artWb: findHeaderIndex_(c1Headers, ['Артикул ВБ', 'Артикул WB', 'nmID', 'nmid'], '1C'),
    cat: findHeaderIndex_(c1Headers, ['Категория товаров', 'Категория'], '1C'),
    vol: findHeaderIndex_(c1Headers, ['Объём тары', 'Объем тары'], '1C'),
    count: findHeaderIndex_(c1Headers, ['Количество лаков в наборе', 'Количество в наборе'], '1C'),
    ordered: findHeaderIndex_(c1Headers, ['Заказано поставщику', 'Заказано'], '1C'),
    inProd: findHeaderIndex_(c1Headers, ['В производстве', 'Производство'], '1C'),
    raw: findHeaderIndex_(c1Headers, ['Остаток сырья в шт', 'Остаток сырья'], '1C'),
    ready: findHeaderIndex_(c1Headers, ['Готовая продукция на складе', 'Готовая продукция'], '1C'),
    reserve: findHeaderIndex_(c1Headers, ['В резерве', 'Резерв'], '1C'),
    sentRvb: findHeaderIndex_(c1Headers, ['Отгружено на РВБ', 'Отгружено'], '1C'),
    fboRest: findHeaderIndex_(c1Headers, ['ФБО остаток', 'Остаток ФБО'], '1C'),
    groupAn: findHeaderIndex_(c1Headers, ['Группа аналитического учёта', 'Группа аналитического учета', 'Группа аналитики'], '1C'),
    group1: findHeaderIndex_(c1Headers, ['Товарная группа 1', 'Товарная группа'], '1C')
  };

  const reportData = [];
  const processedKeys = new Set();
  const divisorDays = daysCount > 0 ? daysCount : 14;

  for (let i = 1; i < c1Data.length; i += 1) {
    const row = c1Data[i];
    const nom = String(row[idxC1.nom] || '').trim();
    const artWb = normalizeKey_(row[idxC1.artWb]);
    const uniqueRowKey = [nom, artWb].join('|');

    if (!nom) continue;
    if (processedKeys.has(uniqueRowKey)) continue;
    processedKeys.add(uniqueRowKey);

    const orderStats = ordersMap.get(artWb) || { fbo: 0, fbs: 0 };
    const totalOrders = orderStats.fbo + orderStats.fbs;
    const avgDailySales = Number((totalOrders / divisorDays).toFixed(2));
    const fboRest = toNumberValue_(row[idxC1.fboRest]);
    const coverageDays = avgDailySales > 0 ? fboRest / avgDailySales : 0;
    const oosDate = avgDailySales > 0
      ? new Date(Date.now() + Math.round(coverageDays) * 24 * 60 * 60 * 1000)
      : '';

    reportData.push([
      row[idxC1.groupAn],
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
      oosDate
    ]);
  }

  reportData.sort((a, b) => {
    if (a[0] !== b[0]) return String(a[0]).localeCompare(String(b[0]));
    if (a[1] !== b[1]) return String(a[1]).localeCompare(String(b[1]));
    return String(a[2]).localeCompare(String(b[2]));
  });

  return reportData;
}
