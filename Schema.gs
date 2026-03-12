/**
 * Общие схемы листов проекта.
 */

/* =========================
 * INFO schema
 * ========================= */

const INFO_SCHEMA = [
  { sourceHeader: 'Номенклатура.Наименование', infoHeader: 'Наименование', varName: 'nom' },
  { sourceHeader: 'Артикул', infoHeader: 'Артикул', varName: 'art1C' },
  { sourceHeader: 'Артикул ВБ', infoHeader: 'Артикул ВБ', varName: 'artwb' },
  { sourceHeader: 'Категория товаров', infoHeader: 'Категория товаров', varName: 'cat' },
  { sourceHeader: 'Объем тары', infoHeader: 'Объем тары', varName: 'volume' },
  { sourceHeader: 'Номенклатура.Товарная группа 2 (Общие)', infoHeader: 'Товарная группа 2', varName: 'tg2' },
  { sourceHeader: 'Номенклатура.Товарная группа 3 (Общие)', infoHeader: 'Товарная группа 3', varName: 'tg3' },
  { sourceHeader: 'Номенклатура.Основное сырье (Общие)', infoHeader: 'Основное сырье', varName: 'raw' },
  { sourceHeader: 'Номенклатура.Тара (флакон) (Общие)', infoHeader: 'Тара', varName: 'bottle' },
  { sourceHeader: 'Номенклатура.Количество лаков в наборе (Общие)', infoHeader: 'Количество лаков в наборе', varName: 'numpack' },
  { sourceHeader: 'Номенклатура.Артикул МП', infoHeader: 'Артикул МП', varName: 'artmp' },
  { sourceHeader: 'Номенклатура.Группа аналитического учета', infoHeader: 'Бренд', varName: 'brandinfo' },
  { sourceHeader: 'Номенклатура.Вес (числитель)', infoHeader: 'Вес', varName: 'weight' },
  { sourceHeader: 'Номенклатура.Это набор (RockNail)', infoHeader: 'Это набор', varName: 'isSet' },
  { sourceHeader: 'Номенклатура.Товарная группа 1 (Общие)', infoHeader: 'Товарная группа 1', varName: 'tg1' },
  { sourceHeader: 'Заказано поставщику', infoHeader: 'Заказано поставщику', varName: 'order' },
  { sourceHeader: 'В производстве', infoHeader: 'В производстве', varName: 'inwork' },
  { sourceHeader: 'Остаток сырья в шт', infoHeader: 'Остаток сырья в шт', varName: 'rawstock' },
  { sourceHeader: 'Готовая продукция на складе', infoHeader: 'Готовая продукция на складе', varName: 'stock' },
  { sourceHeader: 'В резерве', infoHeader: 'В резерве', varName: 'reserved' },
  { sourceHeader: 'Отгружено на РВБ', infoHeader: 'Отгружено на РВБ', varName: 'shipped' },
  { sourceHeader: 'ФБО остаток', infoHeader: 'ФБО остаток', varName: 'fbostock' },
  { sourceHeader: 'Заказов в день (Уходимость ФБО+ФБС/количество дней)', infoHeader: 'Заказы 0', varName: '' },
  { sourceHeader: 'Заказы ФБО', infoHeader: 'Заказы 1', varName: '' },
  { sourceHeader: 'Заказы ФБС', infoHeader: 'Заказы 2', varName: '' },
  { sourceHeader: 'Сумма заказов ФБОФБС', infoHeader: 'Заказы 3', varName: '' },
  { sourceHeader: 'Расход по новому складу', infoHeader: 'Расход по новому складу', varName: 'newWarehouseUsage' }
];

const INFO_COLUMNS = INFO_SCHEMA.reduce(function(acc, col, index) {
  if (col.varName) {
    acc[col.varName] = {
      index: index,
      colNumber: index + 1,
      sourceHeader: col.sourceHeader,
      infoHeader: col.infoHeader,
      varName: col.varName
    };
  }
  return acc;
}, {});

const INFO_HEADERS = INFO_SCHEMA.map(function(col) {
  return col.infoHeader;
});

/* =========================
 * ORDERS schema
 * ========================= */

const ORDERS_HEADERS = [
  'date',
  'lastchangedate',
  'supplierarticle',
  'techsize',
  'totalprice',
  'discountpercent',
  'warehousename',
  'incomeid',
  'odid',
  'nmid',
  'subject',
  'category',
  'brand',
  'iscancel',
  'cancel_dt',
  'gnumber',
  'srid',
  'dateupdate',
  'lk',
  'ordertype',
  'spp',
  'finishedprice',
  'pricewithdisc',
  'country',
  'region',
  'warehousetype'
];

const ORDERS_COLUMNS = ORDERS_HEADERS.reduce(function(acc, header, index) {
  acc[header] = {
    index: index,
    colNumber: index + 1,
    header: header
  };
  return acc;
}, {});