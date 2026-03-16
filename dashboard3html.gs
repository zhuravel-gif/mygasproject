/**
 * Возвращает данные для дашборда 3 в формате, удобном для HTML/web app.
 *
 * Источник данных — лист report2, который генерируется скриптом build_report2.
 * Каждая строка в report2 должна содержать, как минимум, следующие колонки:
 *   date, nmid, artwb, nom, brandinfo, fboStock, fbsStock, sumStock,
 *   ordersCount, salesCount, salesSum, sppSum, margin, views, clicks,
 *   to_cart, advOrders, advPrice, advCpc, drr.
 *
 * Функция возвращает объект вида:
 *   {
 *     generatedAt: 'DD.MM.YYYY HH:mm:ss',
 *     items: [ { nmid, artwb, name, brand } ],
 *     rows: [ { date, nmid, fboStock, fbsStock, sumStock, ordersCount,
 *               salesCount, salesSum, sppSum, margin, views, clicks,
 *               to_cart, advOrders, advPrice, advCpc, drr } ]
 *   }
 */
function getDashboard3HtmlData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getRequiredSheet_('report2');

  var data = dashboardHtmlGetSheetDataWithHeaders_(sheet);
  if (!data.headers.length) {
    throw new Error('Лист report2 пустой или не содержит заголовков.');
  }

  var headerMap = dashboardHtmlBuildHeaderMap_(data.headers);

  // Список обязательных колонок для report2. Если какой‑то нет, бросаем ошибку.
  var required = [
    'date',
    'nmid',
    'artwb',
    'nom',
    'brandinfo',
    'fboStock',
    'fbsStock',
    'sumStock',
    'ordersCount',
    'salesCount',
    'salesSum',
    'sppSum',
    'margin',
    'views',
    'clicks',
    'to_cart',
    'advOrders',
    'advPrice',
    'advCpc',
    'drr'
  ];

  required.forEach(function(name) {
    if (headerMap[name] === undefined) {
      throw new Error('В report2 не найден обязательный столбец: ' + name);
    }
  });

  var rows = [];
  var itemsMap = {};

  data.rows.forEach(function(row) {
    var nmid = row[headerMap.nmid];
    if (!nmid) {
      return;
    }

    // Собираем метаданные товара (номенклатуры) один раз.
    if (!itemsMap[nmid]) {
      itemsMap[nmid] = {
        nmid: nmid,
        artwb: row[headerMap.artwb],
        name: row[headerMap.nom],
        brand: row[headerMap.brandinfo]
      };
    }

    // Преобразует значение в число. Пустые и нечисловые — в 0.
    function toNumber(value) {
      if (value === '' || value === null || value === undefined) return 0;
      var num = Number(value);
      return isNaN(num) ? 0 : num;
    }

    rows.push({
      date: row[headerMap.date],
      nmid: nmid,
      fboStock: toNumber(row[headerMap.fboStock]),
      fbsStock: toNumber(row[headerMap.fbsStock]),
      sumStock: toNumber(row[headerMap.sumStock]),
      ordersCount: toNumber(row[headerMap.ordersCount]),
      salesCount: toNumber(row[headerMap.salesCount]),
      salesSum: toNumber(row[headerMap.salesSum]),
      sppSum: toNumber(row[headerMap.sppSum]),
      margin: toNumber(row[headerMap.margin]),
      views: toNumber(row[headerMap.views]),
      clicks: toNumber(row[headerMap.clicks]),
      to_cart: toNumber(row[headerMap.to_cart]),
      advOrders: toNumber(row[headerMap.advOrders]),
      advPrice: toNumber(row[headerMap.advPrice]),
      advCpc: toNumber(row[headerMap.advCpc]),
      drr: toNumber(row[headerMap.drr])
    });
  });

  return {
    generatedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm:ss'),
    items: Object.keys(itemsMap).map(function(key) { return itemsMap[key]; }),
    rows: rows
  };
}