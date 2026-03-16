COPY (
WITH
  -- load info: used for the list of all articles (nmids). It must be
  -- created externally by build_report2.py before executing this SQL.
  info_src AS (
    SELECT * FROM info_src
  ),

  -- load stocks raw data; this view should be created in build_report2.py
  stocks_src AS (
    SELECT * FROM stocks_src
  ),

  -- load sales raw data
  sales_src AS (
    SELECT * FROM sales_src
  ),

  -- load abc_date raw data
  abc_src AS (
    SELECT * FROM abc_src
  ),

  -- load advertising statistics raw data
  adv_src AS (
    SELECT * FROM adv_src
  ),

  -- load orders for order counts; reuse existing orders_src defined in build_report2.py
  orders_src AS (
    SELECT * FROM orders_src
  ),

  -- Filter orders: only non‑cancelled orders and last 365 days
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
      AND order_date BETWEEN current_date - INTERVAL 364 DAY AND current_date
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
      TRY_CAST(quantity AS DOUBLE) AS quantity
    FROM stocks_src
    WHERE stock_date BETWEEN current_date - INTERVAL 364 DAY AND current_date
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
      TRY_CAST(forpay AS DOUBLE) AS forpay,
      TRY_CAST(spp AS DOUBLE) AS spp,
      lk
    FROM sales_src
    WHERE sale_date BETWEEN current_date - INTERVAL 364 DAY AND current_date
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
      TRY_CAST(marga AS DOUBLE) AS marga
    FROM abc_src
    WHERE marga_date BETWEEN current_date - INTERVAL 364 DAY AND current_date
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
      TRY_CAST(views AS DOUBLE) AS views,
      TRY_CAST(clicks AS DOUBLE) AS clicks,
      TRY_CAST(to_cart AS DOUBLE) AS to_cart,
      TRY_CAST(orders AS DOUBLE) AS adv_orders,
      TRY_CAST(price AS DOUBLE) AS price,
      TRY_CAST(cpc AS DOUBLE) AS cpc
    FROM adv_src
    WHERE adv_date BETWEEN current_date - INTERVAL 364 DAY AND current_date
  ),

  daily_adv AS (
    SELECT
      nmid,
      adv_date,
      SUM(views) AS views,
      SUM(clicks) AS clicks,
      SUM(to_cart) AS to_cart,
      SUM(adv_orders) AS adv_orders,
      SUM(price) AS adv_price,
      SUM(cpc * clicks) AS adv_cost
    FROM adv_filtered
    GROUP BY nmid, adv_date
  ),

  all_nmids AS (
    SELECT artwb AS nmid FROM info_src
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
  ),

  final AS (
    SELECT
      n.nmid,
      d.day_key AS date,
      COALESCE(st.stock_fbo, 0) AS stock_fbo,
      COALESCE(st.stock_fbs, 0) AS stock_fbs,
      COALESCE(st.stock_fbo, 0) + COALESCE(st.stock_fbs, 0) AS sumstockfbofbs,
      COALESCE(o.orders_count, 0) AS orders_count,
      COALESCE(s.sales_count, 0) AS sales_count,
      COALESCE(s.sales_amount, 0) AS sales_amount,
      COALESCE(s.spp_sum, 0) AS spp_sum,
      COALESCE(m.marga, 0) AS marga,
      COALESCE(a.views, 0) AS views,
      COALESCE(a.clicks, 0) AS clicks,
      COALESCE(a.to_cart, 0) AS to_cart,
      COALESCE(a.adv_orders, 0) AS adv_orders,
      COALESCE(a.adv_price, 0) AS adv_price,
      COALESCE(a.adv_cost, 0) AS adv_cost,
      CASE
        WHEN COALESCE(s.sales_amount, 0) > 0
          THEN COALESCE(a.adv_cost, 0) / s.sales_amount
        ELSE NULL
      END AS drr
    FROM all_nmids n
    CROSS JOIN days d
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
  )

SELECT
  date,
  nmid,
  stock_fbo,
  stock_fbs,
  sumstockfbofbs,
  orders_count,
  sales_count,
  sales_amount,
  spp_sum,
  marga,
  views,
  clicks,
  to_cart,
  adv_orders,
  adv_price,
  adv_cost,
  drr
FROM final
ORDER BY nmid, date
) TO '__REPORT2_CSV_PATH__' (HEADER, DELIMITER ',');