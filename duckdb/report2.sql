COPY (
WITH
  info_filtered AS (
    SELECT
      CAST(trim(CAST("Артикул ВБ" AS VARCHAR)) AS VARCHAR) AS nmid,
      CAST(trim(CAST("Артикул ВБ" AS VARCHAR)) AS VARCHAR) AS artwb,
      CAST("Наименование" AS VARCHAR) AS nom,
      CAST("Бренд" AS VARCHAR) AS brandinfo
    FROM info_src
    WHERE trim(CAST("Артикул ВБ" AS VARCHAR)) <> ''
      AND trim(CAST("Артикул ВБ" AS VARCHAR)) <> '0'
  ),

  orders_filtered AS (
    SELECT
      trim(CAST(nmid AS VARCHAR)) AS nmid,
      COALESCE(
        TRY_CAST(date AS DATE),
        CAST(TRY_CAST(date AS TIMESTAMP) AS DATE)
      ) AS order_date
    FROM orders_src
    WHERE COALESCE(TRY_CAST(iscancel AS INTEGER), 1) = 0
      AND trim(CAST(nmid AS VARCHAR)) <> ''
      AND trim(CAST(nmid AS VARCHAR)) <> '0'
      AND COALESCE(
        TRY_CAST(date AS DATE),
        CAST(TRY_CAST(date AS TIMESTAMP) AS DATE)
      ) BETWEEN current_date - INTERVAL 364 DAY AND current_date
  ),

  daily_orders AS (
    SELECT nmid, order_date, COUNT(*) AS orders_count
    FROM orders_filtered
    GROUP BY nmid, order_date
  ),

  stocks_filtered AS (
    SELECT
      trim(CAST(nmid AS VARCHAR)) AS nmid,
      COALESCE(
        TRY_CAST(lastchangedate AS DATE),
        CAST(TRY_CAST(lastchangedate AS TIMESTAMP) AS DATE)
      ) AS stock_date,
      lower(trim(CAST(tip AS VARCHAR))) AS tip,
      COALESCE(TRY_CAST(quantity AS DOUBLE), 0) AS quantity
    FROM stocks_src
    WHERE COALESCE(
        TRY_CAST(lastchangedate AS DATE),
        CAST(TRY_CAST(lastchangedate AS TIMESTAMP) AS DATE)
      ) BETWEEN current_date - INTERVAL 364 DAY AND current_date
  ),

  daily_stock AS (
    SELECT
      nmid,
      stock_date,
      SUM(CASE WHEN tip = 'fbo' THEN quantity ELSE 0 END) AS stock_fbo,
      SUM(CASE WHEN tip = 'fbs' THEN quantity ELSE 0 END) AS stock_fbs
    FROM stocks_filtered
    GROUP BY nmid, stock_date
  ),

  sales_filtered AS (
    SELECT
      trim(CAST(nmid AS VARCHAR)) AS nmid,
      COALESCE(
        TRY_CAST(date AS DATE),
        CAST(TRY_CAST(date AS TIMESTAMP) AS DATE)
      ) AS sale_date,
      COALESCE(TRY_CAST(forpay AS DOUBLE), 0) AS forpay,
      COALESCE(TRY_CAST(spp AS DOUBLE), 0) AS spp,
      lk
    FROM sales_src
    WHERE COALESCE(
        TRY_CAST(date AS DATE),
        CAST(TRY_CAST(date AS TIMESTAMP) AS DATE)
      ) BETWEEN current_date - INTERVAL 364 DAY AND current_date
  ),

  daily_sales AS (
    SELECT
      nmid,
      sale_date,
      COUNT(*) AS sales_count,
      SUM(forpay) AS sales_amount,
      SUM(spp) AS spp_sum
    FROM sales_filtered
    GROUP BY nmid, sale_date
  ),

  abc_filtered AS (
    SELECT
      trim(CAST(nm_id AS VARCHAR)) AS nmid,
      COALESCE(
        TRY_CAST(date AS DATE),
        CAST(TRY_CAST(date AS TIMESTAMP) AS DATE)
      ) AS marga_date,
      COALESCE(TRY_CAST(marga AS DOUBLE), 0) AS marga
    FROM abc_src
    WHERE COALESCE(
        TRY_CAST(date AS DATE),
        CAST(TRY_CAST(date AS TIMESTAMP) AS DATE)
      ) BETWEEN current_date - INTERVAL 364 DAY AND current_date
  ),

  daily_marga AS (
    SELECT
      nmid,
      marga_date,
      SUM(marga) AS marga
    FROM abc_filtered
    GROUP BY nmid, marga_date
  ),

  adv_filtered AS (
    SELECT
      trim(CAST(nmid AS VARCHAR)) AS nmid,
      COALESCE(
        TRY_CAST(operation_date AS DATE),
        CAST(TRY_CAST(operation_date AS TIMESTAMP) AS DATE)
      ) AS adv_date,
      COALESCE(TRY_CAST(views AS DOUBLE), 0) AS views,
      COALESCE(TRY_CAST(clicks AS DOUBLE), 0) AS clicks,
      COALESCE(TRY_CAST(to_cart AS DOUBLE), 0) AS to_cart,
      COALESCE(TRY_CAST(orders AS DOUBLE), 0) AS adv_orders,
      COALESCE(TRY_CAST(price AS DOUBLE), 0) AS adv_price,
      COALESCE(TRY_CAST(cpc AS DOUBLE), 0) AS adv_cpc,
      COALESCE(TRY_CAST(sum_price AS DOUBLE), 0) AS adv_sum_price
    FROM adv_src
    WHERE COALESCE(
        TRY_CAST(operation_date AS DATE),
        CAST(TRY_CAST(operation_date AS TIMESTAMP) AS DATE)
      ) BETWEEN current_date - INTERVAL 364 DAY AND current_date
  ),

  daily_adv AS (
    SELECT
      nmid,
      adv_date,
      SUM(views) AS views,
      SUM(clicks) AS clicks,
      SUM(to_cart) AS to_cart,
      SUM(adv_orders) AS adv_orders,
      SUM(adv_price) AS adv_price,
      SUM(adv_cpc) AS adv_cpc,
      SUM(adv_sum_price) AS adv_sum_price,
      SUM(adv_price) AS adv_cost
    FROM adv_filtered
    GROUP BY nmid, adv_date
  ),

  all_nmids AS (
    SELECT nmid FROM info_filtered
    UNION SELECT DISTINCT nmid FROM daily_orders
    UNION SELECT DISTINCT nmid FROM daily_stock
    UNION SELECT DISTINCT nmid FROM daily_sales
    UNION SELECT DISTINCT nmid FROM daily_marga
    UNION SELECT DISTINCT nmid FROM daily_adv
  ),

  days AS (
    SELECT CAST(gs AS DATE) AS day_key
    FROM generate_series(
      current_date - INTERVAL 364 DAY,
      current_date,
      INTERVAL 1 DAY
    ) AS t(gs)
  )

SELECT
  d.day_key AS date,
  n.nmid,
  COALESCE(i.artwb, n.nmid) AS artwb,
  COALESCE(i.nom, '') AS nom,
  COALESCE(i.brandinfo, '') AS brandinfo,
  COALESCE(st.stock_fbo, 0) AS "fboStock",
  COALESCE(st.stock_fbs, 0) AS "fbsStock",
  COALESCE(st.stock_fbo, 0) + COALESCE(st.stock_fbs, 0) AS "sumStock",
  COALESCE(o.orders_count, 0) AS "ordersCount",
  COALESCE(s.sales_count, 0) AS "salesCount",
  COALESCE(s.sales_amount, 0) AS "salesSum",
  COALESCE(s.spp_sum, 0) AS "sppSum",
  COALESCE(m.marga, 0) AS margin,
  COALESCE(a.views, 0) AS views,
  COALESCE(a.clicks, 0) AS clicks,
  COALESCE(a.to_cart, 0) AS to_cart,
  COALESCE(a.adv_orders, 0) AS "advOrders",
  COALESCE(a.adv_price, 0) AS "advPrice",
  COALESCE(a.adv_cpc, 0) AS "advCpc",
  CASE
    WHEN COALESCE(s.sales_amount, 0) > 0 THEN COALESCE(a.adv_cost, 0) / s.sales_amount
    ELSE NULL
  END AS drr
FROM all_nmids n
CROSS JOIN days d
LEFT JOIN info_filtered i
  ON i.nmid = n.nmid
LEFT JOIN daily_stock st
  ON st.nmid = n.nmid AND st.stock_date = d.day_key
LEFT JOIN daily_orders o
  ON o.nmid = n.nmid AND o.order_date = d.day_key
LEFT JOIN daily_sales s
  ON s.nmid = n.nmid AND s.sale_date = d.day_key
LEFT JOIN daily_marga m
  ON m.nmid = n.nmid AND m.marga_date = d.day_key
LEFT JOIN daily_adv a
  ON a.nmid = n.nmid AND a.adv_date = d.day_key
ORDER BY n.nmid, d.day_key
) TO '__REPORT2_CSV_PATH__' (HEADER, DELIMITER ',');
