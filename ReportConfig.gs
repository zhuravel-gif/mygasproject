const XLSX_SOURCE_FILE_ID = '';
const XLSX_SOURCE_FOLDER_ID = '1xdR6UTj8kpiuu3YqdDbty2tZTl8jM9e7';

const REPORT_SHEET_NAME = 'Отчет';
const SPARKLINE_DAYS_WINDOW = 14;

const REPORT_HEADERS = [
  'Группа аналитического учёта', 'Категория товаров', 'Товарная группа 1',
  'Номенклатура', 'Артикул', 'Артикул ВБ', 'Объём тары', 'Количество лаков в наборе',
  'Заказано поставщику', 'В производстве', 'Остаток сырья в шт', 'Готовая продукция на складе',
  'В резерве', 'Отгружено на РВБ', 'ФБО остаток',
  'Заказы ФБО', 'Заказы ФБС', 'Сумма заказов', 'Уходимость', 'Прогноз OOS (дата)', 'Динамика 14 дней'
];

const REPORT_COLUMNS = {
  groupAn: 1,
  category: 2,
  productGroup1: 3,
  nomenclature: 4,
  article: 5,
  articleWb: 6,
  ordersFbo: 16,
  ordersFbs: 17,
  ordersTotal: 18,
  turnover: 19,
  oosDate: 20,
  sparkline: 21
};

const STRICT_ORDERS_SCHEMA = {
  date: { col: 1, header: 'date' },
  nmid: { col: 12, header: 'nmid' },
  brand: { col: 15, header: 'brand' },
  iscancel: { col: 16, header: 'iscancel' },
  warehousetype: { col: 31, header: 'warehousetype' }
};

const STRICT_1C_SCHEMA = {
  nom: { col: 1, header: 'Номенклатура' },
  art: { col: 2, header: 'Артикул' },
  artWb: { col: 3, header: 'Артикул ВБ' },
  cat: { col: 4, header: 'Категория товаров' },
  vol: { col: 5, header: 'Объём тары' },
  group2: { col: 6, header: 'Товарная группа 2' },
  count: { col: 10, header: 'Количество лаков в наборе' },
  group1: { col: 12, header: 'Товарная группа 1' },
  ordered: { col: 13, header: 'Заказано товара' },
  inProd: { col: 14, header: 'В производстве товара' },
  raw: { col: 15, header: 'Остаток в сырье' },
  ready: { col: 16, header: 'Готовая продукция на складе' },
  reserve: { col: 17, header: 'Товар в резерве' },
  sentRvb: { col: 18, header: 'Отгруженный товар на маркетплейс' },
  fboRest: { col: 19, header: 'Остаток на складе маркетплейс' }
};
