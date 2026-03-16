function getDashboard3HtmlData() {
  const sheet = getRequiredSheet_('report2');
  const data = dashboardHtmlGetSheetDataWithHeaders_(sheet);

  if (!data.headers.length) {
    throw new Error('Лист report2 пустой или не содержит заголовков.');
  }

  const map = dashboardHtmlBuildHeaderMap_(data.headers);
  const required = [
    'date',
    'nmid',
    'stock_fbo',
    'stock_fbs',
    'sumstockfbofbs',
    'orders_count',
    'sales_count',
    'sales_amount',
    'spp_sum',
    'marga',
    'views',
    'clicks',
    'to_cart',
    'adv_orders',
    'adv_price',
    'adv_cost',
    'drr'
  ];

  required.forEach(function(name) {
    if (map[name] === undefined) {
      throw new Error('В report2 не найден обязательный столбец: ' + name);
    }
  });

  function toNum(value) {
    if (value === '' || value === null || value === undefined) return 0;
    const num = Number(value);
    return isNaN(num) ? 0 : num;
  }

  const itemsMap = {};
  const rows = data.rows.map(function(row) {
    const nmid = String(row[map.nmid] || '').trim();
    if (nmid && !itemsMap[nmid]) {
      itemsMap[nmid] = {
        nmid: nmid,
        label: nmid
      };
    }

    return {
      date: row[map.date],
      nmid: nmid,
      stock_fbo: toNum(row[map.stock_fbo]),
      stock_fbs: toNum(row[map.stock_fbs]),
      sumstockfbofbs: toNum(row[map.sumstockfbofbs]),
      orders_count: toNum(row[map.orders_count]),
      sales_count: toNum(row[map.sales_count]),
      sales_amount: toNum(row[map.sales_amount]),
      spp_sum: toNum(row[map.spp_sum]),
      marga: toNum(row[map.marga]),
      views: toNum(row[map.views]),
      clicks: toNum(row[map.clicks]),
      to_cart: toNum(row[map.to_cart]),
      adv_orders: toNum(row[map.adv_orders]),
      adv_price: toNum(row[map.adv_price]),
      adv_cost: toNum(row[map.adv_cost]),
      drr: toNum(row[map.drr])
    };
  });

  return {
    generatedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm:ss'),
    items: Object.keys(itemsMap).sort().map(function(key) { return itemsMap[key]; }),
    rows: rows
  };
}
