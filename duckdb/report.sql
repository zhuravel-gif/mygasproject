COPY (
WITH info_filtered AS (
  SELECT
    CAST(trim(CAST("Артикул ВБ" AS VARCHAR)) AS VARCHAR) AS artwb,
    "Наименование",
    "Артикул",
    "Категория товаров",
    "Объем тары",
    "Товарная группа 2",
    "Товарная группа 3",
    "Основное сырье",
    "Тара",
    "Количество лаков в наборе",
    "Артикул МП",
    "Бренд",
    "Вес",
    "Это набор",
    "Товарная группа 1",
    COALESCE(TRY_CAST("Заказано поставщику" AS DOUBLE), 0) AS "Заказано поставщику",
    COALESCE(TRY_CAST("В производстве" AS DOUBLE), 0) AS "В производстве",
    COALESCE(TRY_CAST("Остаток сырья в шт" AS DOUBLE), 0) AS "Остаток сырья в шт",
    COALESCE(TRY_CAST("Готовая продукция на складе" AS DOUBLE), 0) AS "Готовая продукция на складе",
    COALESCE(TRY_CAST("В резерве" AS DOUBLE), 0) AS "В резерве",
    COALESCE(TRY_CAST("Отгружено на РВБ" AS DOUBLE), 0) AS "Отгружено на РВБ",
    COALESCE(TRY_CAST("ФБО остаток" AS DOUBLE), 0) AS "ФБО остаток",
    COALESCE(TRY_CAST("Расход по новому складу" AS DOUBLE), 0) AS "Расход по новому складу"
  FROM info_src
  WHERE trim(CAST("Артикул ВБ" AS VARCHAR)) <> ''
    AND trim(CAST("Артикул ВБ" AS VARCHAR)) <> '0'
),

orders_filtered AS (
  SELECT
    trim(CAST(nmid AS VARCHAR)) AS nmid,
    lower(trim(CAST(warehousetype AS VARCHAR))) AS warehousetype,
    TRY_CAST(date AS DATE) AS order_date
  FROM orders_src
  WHERE COALESCE(TRY_CAST(iscancel AS INTEGER), 1) = 0
    AND trim(CAST(nmid AS VARCHAR)) <> ''
    AND trim(CAST(nmid AS VARCHAR)) <> '0'
),

orders_stats AS (
  SELECT
    nmid,
    SUM(CASE WHEN warehousetype = 'склад wb' THEN 1 ELSE 0 END) AS ordersFBO,
    SUM(CASE WHEN warehousetype = 'склад продавца' THEN 1 ELSE 0 END) AS ordersFBS,
    COUNT(*) AS orderssum,
    COUNT(DISTINCT CASE
      WHEN order_date >= current_date - INTERVAL 13 DAY THEN order_date
      ELSE NULL
    END) AS activeDays,
    SUM(CASE
      WHEN order_date >= current_date - INTERVAL 13 DAY THEN 1
      ELSE 0
    END) AS total14
  FROM orders_filtered
  GROUP BY nmid
)

SELECT
  i."Наименование",
  i."Артикул",
  i.artwb AS "Артикул ВБ",
  i."Категория товаров",
  i."Объем тары",
  i."Товарная группа 2",
  i."Товарная группа 3",
  i."Основное сырье",
  i."Тара",
  i."Количество лаков в наборе",
  i."Артикул МП",
  i."Бренд",
  i."Вес",
  i."Это набор",
  i."Товарная группа 1",
  i."Заказано поставщику",
  i."В производстве",
  i."Остаток сырья в шт",
  i."Готовая продукция на складе",
  i."В резерве",
  i."Отгружено на РВБ",
  i."ФБО остаток",
  i."Расход по новому складу",
  COALESCE(o.ordersFBO, 0) AS ordersFBO,
  COALESCE(o.ordersFBS, 0) AS ordersFBS,
  COALESCE(o.orderssum, 0) AS orderssum,
  (
    i."Готовая продукция на складе" +
    i."В резерве" +
    i."Отгружено на РВБ" +
    i."ФБО остаток"
  ) AS sumstock,
  CASE
    WHEN COALESCE(o.activeDays, 0) > 0
      THEN ROUND(o.total14 * 1.0 / o.activeDays, 6)
    ELSE NULL
  END AS dayorders,
  CASE
    WHEN COALESCE(o.activeDays, 0) > 0
      AND o.total14 > 0
      THEN ROUND(
        (
          i."Готовая продукция на складе" +
          i."В резерве" +
          i."Отгружено на РВБ" +
          i."ФБО остаток"
        ) / (o.total14 * 1.0 / o.activeDays),
        6
      )
    ELSE NULL
  END AS zapas
FROM info_filtered i
LEFT JOIN orders_stats o
  ON o.nmid = i.artwb
) TO '__REPORT_CSV_PATH__' (HEADER, DELIMITER ',');