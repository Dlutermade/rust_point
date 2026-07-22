-- 批量入帳:一列一批客戶點數。逐列變動的只有 (customer_point_id, customer_id),
-- 以平行陣列經 UNNEST 展開;其餘欄位整批常數。永久點的 expires 由 COALESCE
-- 收成 'infinity'。來源唯一鍵 + ON CONFLICT DO NOTHING 兜底防重複。
INSERT INTO customer_points
    (customer_point_id, shop_id, customer_id, original_amount, remaining_amount,
     effective_at, expires_at, issuance_id, author, source_id)
SELECT batch.point_id, $1, batch.customer_id, $2, $2,
       $3, COALESCE($4, 'infinity'::timestamptz), $5, $6, $7
FROM UNNEST($8::uuid[], $9::uuid[]) AS batch(point_id, customer_id)
ON CONFLICT (shop_id, author, source_id, customer_id) DO NOTHING
