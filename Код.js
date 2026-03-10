/**
 * Создание меню при открытии таблицы
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Отчетность ВБ')
    .addItem('Создать отчет', 'generateWbReport')
    .addToUi();
}

/**
 * Основная функция генерации отчета
 */
function generateWbReport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetOrders = ss.getSheetByName('orders');
  const sheet1C = ss.getSheetByName('1C');
  
  if (!sheetOrders || !sheet1C) {
    SpreadsheetApp.getUi().alert('Ошибка: Не найден лист "orders" или "1C".');
    return;
  }

  // Создаем или очищаем лист отчета
  let sheetReport = ss.getSheetByName('Отчет');
  if (!sheetReport) {
    sheetReport = ss.insertSheet('Отчет');
  } else {
    sheetReport.clear();
  }

  // 1. Получение данных
  const ordersData = sheetOrders.getDataRange().getValues();
  const c1Data = sheet1C.getDataRange().getValues();

  const hasNonEmptyHeaders = (headersRow) => {
    return headersRow.some((cell) => String(cell).trim() !== '');
  };

  if (ordersData.length < 1) {
    SpreadsheetApp.getUi().alert('Ошибка: Лист "orders" не содержит даже строку заголовков.');
    return;
  }

  if (c1Data.length < 1) {
    SpreadsheetApp.getUi().alert('Ошибка: Лист "1C" не содержит даже строку заголовков.');
    return;
  }

  if (!Array.isArray(ordersData[0]) || ordersData[0].length === 0) {
    SpreadsheetApp.getUi().alert('Ошибка: Заголовок на листе "orders" некорректен или пуст.');
    return;
  }

  if (!Array.isArray(c1Data[0]) || c1Data[0].length === 0) {
    SpreadsheetApp.getUi().alert('Ошибка: Заголовок на листе "1C" некорректен или пуст.');
    return;
  }

  if (!hasNonEmptyHeaders(ordersData[0])) {
    SpreadsheetApp.getUi().alert('Ошибка: На листе "orders" строка заголовков заполнена пустыми значениями.');
    return;
  }

  if (!hasNonEmptyHeaders(c1Data[0])) {
    SpreadsheetApp.getUi().alert('Ошибка: На листе "1C" строка заголовков заполнена пустыми значениями.');
    return;
  }

  const reportHeaders = [
    'Группа аналитического учёта', 'Категория товаров', 'Товарная группа 1',
    'Номенклатура', 'Артикул', 'Артикул ВБ', 'Объём тары', 'Количество лаков в наборе',
    'Заказано поставщику', 'В производстве', 'Остаток сырья в шт', 'Готовая продукция на складе',
    'В резерве', 'Отгружено на РВБ', 'ФБО остаток',
    'Заказы ФБО', 'Заказы ФБС', 'Сумма заказов', 'Уходимость'
  ];

  if (ordersData.length === 1 || c1Data.length === 1) {
    sheetReport.getRange(1, 1, 1, reportHeaders.length).setValues([reportHeaders]);
    sheetReport.getRange(1, 1, 1, reportHeaders.length).setFontWeight('bold').setBackground('#f3f3f3');
    sheetReport.autoResizeColumns(1, reportHeaders.length);
    SpreadsheetApp.getUi().alert('Данные после заголовков отсутствуют на одном или обоих исходных листах. Сформирован отчет только с заголовком.');
    return;
  }

  // 2. Индексация заголовков для динамического поиска колонок
  const ordersHeaders = ordersData[0];
  const c1Headers = c1Data[0];

  const idxOrders = {
    nmid: ordersHeaders.indexOf('nmid'),
    iscancel: ordersHeaders.indexOf('iscancel'),
    warehousetype: ordersHeaders.indexOf('warehousetype'),
    date: ordersHeaders.indexOf('date')
  };

  // Проверка критических полей в orders
  if (Object.values(idxOrders).includes(-1)) {
    SpreadsheetApp.getUi().alert('Ошибка: В листе "orders" отсутствуют обязательные колонки (nmid, iscancel, warehousetype, date).');
    return;
  }

  // 3. Агрегация данных из orders (Сложность O(N))
  const ordersMap = new Map();
  const uniqueDates = new Set();

  for (let i = 1; i < ordersData.length; i++) {
    const row = ordersData[i];
    const nmid = row[idxOrders.nmid];
    const iscancel = row[idxOrders.iscancel];
    const warehouse = row[idxOrders.warehousetype];
    const dateVal = row[idxOrders.date];

    if (iscancel != 0) continue; // Фильтр отмен

    // Собираем уникальные даты (приводим к строке YYYY-MM-DD для уникальности)
    if (dateVal instanceof Date) {
      uniqueDates.add(dateVal.toISOString().split('T')[0]);
    } else if (dateVal) {
      uniqueDates.add(String(dateVal).split(' ')[0]);
    }

    if (!ordersMap.has(nmid)) {
      ordersMap.set(nmid, { fbo: 0, fbs: 0 });
    }

    const currentData = ordersMap.get(nmid);
    if (warehouse === 'Склад WB') {
      currentData.fbo += 1; // Предполагаем 1 заказ = 1 строка
    } else if (warehouse === 'Склад продавца') {
      currentData.fbs += 1;
    }
  }

  const daysCount = uniqueDates.size || 14; // Защита от деления на 0, по умолчанию 14

  // 4. Поиск индексов колонок в 1С
  const getCol = (name) => {
    const idx = c1Headers.indexOf(name);
    if (idx === -1) throw new Error(`Колонка "${name}" не найдена на листе 1С.`);
    return idx;
  };

  let idxC1;
  try {
    idxC1 = {
      nom: getCol('Номенклатура.Наименование'),
      art: getCol('Артикул'),
      artWb: getCol('Артикул ВБ'),
      cat: getCol('Категория товаров'),
      vol: getCol('Объём тары'),
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
  } catch (e) {
    SpreadsheetApp.getUi().alert('Ошибка структуры 1С: ' + e.message);
    return;
  }

  // 5. Формирование массива отчета
  const reportData = [];
  const processedNom = new Set(); // Для проверки уникальности

  for (let i = 1; i < c1Data.length; i++) {
    const row = c1Data[i];
    const nom = row[idxC1.nom];
    
    if (!nom || processedNom.has(nom)) continue; // Пропуск пустых и дублей
    processedNom.add(nom);

    const artWb = row[idxC1.artWb];
    const orderStats = ordersMap.get(artWb) || { fbo: 0, fbs: 0 };
    
    const fboOrders = orderStats.fbo;
    const fbsOrders = orderStats.fbs;
    const totalOrders = fboOrders + fbsOrders;
    const turnover = totalOrders / daysCount;

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
      fboOrders,
      fbsOrders,
      totalOrders,
      parseFloat(turnover.toFixed(2))
    ]);
  }

  // 6. Сортировка (Иерархия: Группа АУ -> Категория -> Группа 1)
  reportData.sort((a, b) => {
    if (a[0] !== b[0]) return String(a[0]).localeCompare(String(b[0]));
    if (a[1] !== b[1]) return String(a[1]).localeCompare(String(b[1]));
    return String(a[2]).localeCompare(String(b[2]));
  });

  // 7. Вывод на лист
  const finalOutput = [reportHeaders].concat(reportData);
  sheetReport.getRange(1, 1, finalOutput.length, finalOutput[0].length).setValues(finalOutput);
  
  // Оформление
  sheetReport.getRange(1, 1, 1, finalOutput[0].length).setFontWeight('bold').setBackground('#f3f3f3');
  sheetReport.autoResizeColumns(1, finalOutput[0].length);

  SpreadsheetApp.getUi().alert(`Отчет успешно сформирован на листе "Отчет". Обработано уникальных номенклатур: ${reportData.length}. Дней для уходимости: ${daysCount}.`);
}
