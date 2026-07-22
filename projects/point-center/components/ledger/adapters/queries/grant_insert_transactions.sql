-- 批量發點交易(grant,+):與點數入帳同 tx。來源唯一鍵 + ON CONFLICT DO NOTHING
-- 擋重複留痕,與 customer_points 同進退。
INSERT INTO point_transactions
    (transaction_id, shop_id, customer_id, transaction_type, amount_change, author, source_id)
SELECT batch.transaction_id, $1, batch.customer_id, 'grant', $2, $3, $4
FROM UNNEST($5::uuid[], $6::uuid[]) AS batch(transaction_id, customer_id)
ON CONFLICT (shop_id, customer_id, author, source_id, transaction_type) DO NOTHING
