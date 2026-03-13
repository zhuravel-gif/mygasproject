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
    COALESCE(
      TRY_CAST(date AS DATE),
      CAST(TRY_CAST(date AS TIMESTAMP) AS DATE)
    ) AS order_date
  FROM orders_src
  WHERE COALESCE(TRY_CAST(iscancel AS INTEGER), 1) = 0
    AND trim(CAST(nmid AS VARCHAR)) <> ''
    AND trim(CAST(nmid AS VARCHAR)) <> '0'
),

orders_last30 AS (
  SELECT *
  FROM orders_filtered
  WHERE order_date IS NOT NULL
    AND order_date BETWEEN current_date - INTERVAL 29 DAY AND current_date
),

daily_counts_30 AS (
  SELECT
    nmid,
    order_date,
    COUNT(*) AS orderssum_day,
    SUM(CASE WHEN warehousetype = 'склад wb' THEN 1 ELSE 0 END) AS ordersFBO_day,
    SUM(CASE WHEN warehousetype = 'склад продавца' THEN 1 ELSE 0 END) AS ordersFBS_day
  FROM orders_last30
  GROUP BY nmid, order_date
),

stats_14 AS (
  SELECT
    nmid,
    SUM(ordersFBO_day) AS ordersFBO14,
    SUM(ordersFBS_day) AS ordersFBS14,
    SUM(orderssum_day) AS orderssum14,
    COUNT(*) AS activeDays14,
    SUM(orderssum_day) AS total14
  FROM daily_counts_30
  WHERE order_date BETWEEN current_date - INTERVAL 13 DAY AND current_date
  GROUP BY nmid
),

stats_30 AS (
  SELECT
    nmid,
    SUM(ordersFBO_day) AS ordersFBO30,
    SUM(ordersFBS_day) AS ordersFBS30,
    SUM(orderssum_day) AS orderssum30,
    COUNT(*) AS activeDays30,
    SUM(orderssum_day) AS total30
  FROM daily_counts_30
  GROUP BY nmid
),

all_nmids AS (
  SELECT artwb AS nmid FROM info_filtered
  UNION
  SELECT DISTINCT nmid FROM daily_counts_30
),

days_14 AS (
  SELECT CAST(gs AS DATE) AS day_key
  FROM generate_series(
    current_date - INTERVAL 13 DAY,
    current_date,
    INTERVAL 1 DAY
  ) AS t(gs)
),

days_30 AS (
  SELECT CAST(gs AS DATE) AS day_key
  FROM generate_series(
    current_date - INTERVAL 29 DAY,
    current_date,
    INTERVAL 1 DAY
  ) AS t(gs)
),

trend14 AS (
  SELECT
    n.nmid,
    string_agg(
      CAST(COALESCE(d.orderssum_day, 0) AS VARCHAR),
      ',' ORDER BY x.day_key
    ) AS trend14d
  FROM all_nmids n
  CROSS JOIN days_14 x
  LEFT JOIN daily_counts_30 d
    ON d.nmid = n.nmid
   AND d.order_date = x.day_key
  GROUP BY n.nmid
),

trend30 AS (
  SELECT
    n.nmid,
    string_agg(
      CAST(COALESCE(d.orderssum_day, 0) AS VARCHAR),
      ',' ORDER BY x.day_key
    ) AS trend30d
  FROM all_nmids n
  CROSS JOIN days_30 x
  LEFT JOIN daily_counts_30 d
    ON d.nmid = n.nmid
   AND d.order_date = x.day_key
  GROUP BY n.nmid
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

  COALESCE(s14.ordersFBO14, 0) AS ordersFBO,
  COALESCE(s14.ordersFBS14, 0) AS ordersFBS,
  COALESCE(s14.orderssum14, 0) AS orderssum,

  COALESCE(s30.ordersFBO30, 0) AS ordersFBO30,
  COALESCE(s30.ordersFBS30, 0) AS ordersFBS30,
  COALESCE(s30.orderssum30, 0) AS orderssum30,

  (
    i."Готовая продукция на складе" +
    i."В резерве" +
    i."Отгружено на РВБ" +
    i."ФБО остаток"
  ) AS sumstock,

  CASE
    WHEN COALESCE(s14.activeDays14, 0) > 0
      THEN ROUND(s14.total14 * 1.0 / s14.activeDays14, 6)
    ELSE NULL
  END AS dayorders,

  CASE
    WHEN COALESCE(s30.activeDays30, 0) > 0
      THEN ROUND(s30.total30 * 1.0 / s30.activeDays30, 6)
    ELSE NULL
  END AS dayorders30,

  CASE
    WHEN COALESCE(s14.activeDays14, 0) > 0
      AND s14.total14 > 0
      THEN ROUND(
        (
          i."Готовая продукция на складе" +
          i."В резерве" +
          i."Отгружено на РВБ" +
          i."ФБО остаток"
        ) / (s14.total14 * 1.0 / s14.activeDays14),
        6
      )
    ELSE NULL
  END AS zapas,

  CASE
    WHEN COALESCE(s30.activeDays30, 0) > 0
      AND s30.total30 > 0
      THEN ROUND(
        (
          i."Готовая продукция на складе" +
          i."В резерве" +
          i."Отгружено на РВБ" +
          i."ФБО остаток"
        ) / (s30.total30 * 1.0 / s30.activeDays30),
        6
      )
    ELSE NULL
  END AS zapas30,

  COALESCE(t14.trend14d, '0,0,0,0,0,0,0,0,0,0,0,0,0,0') AS trend14d,
  COALESCE(t30.trend30d, '0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0') AS trend30d

FROM info_filtered i
LEFT JOIN stats_14 s14
  ON s14.nmid = i.artwb
LEFT JOIN stats_30 s30
  ON s30.nmid = i.artwb
LEFT JOIN trend14 t14
  ON t14.nmid = i.artwb
LEFT JOIN trend30 t30
  ON t30.nmid = i.artwb
) TO '__REPORT_CSV_PATH__' (HEADER, DELIMITER ',');