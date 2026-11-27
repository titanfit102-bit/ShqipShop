-- Synthetic portability proof for the pinned Medusa schema. One statement,
-- one PostgreSQL snapshot. Export only the fields listed here.
WITH fixture AS (
  SELECT o.id, o.version, o.currency_code,
         s.totals -> 'raw_current_order_total' ->> 'value' AS total
  FROM "order" o
  JOIN order_summary s ON s.order_id = o.id AND s.version = o.version
  WHERE o.id = :'order_id' AND o.deleted_at IS NULL AND s.deleted_at IS NULL
),
lines AS (
  SELECT i.item_id AS id, i.quantity::text AS quantity, COALESCE(i.unit_price, l.unit_price)::text AS unit_amount,
         l.product_id, l.variant_id
  FROM fixture o
  JOIN order_item i ON i.order_id = o.id AND i.version = o.version
  JOIN order_line_item l ON l.id = i.item_id
  WHERE i.deleted_at IS NULL AND l.deleted_at IS NULL
),
stock AS (
  SELECT DISTINCT v.product_id, v.id AS variant_id, link.inventory_item_id,
         level.id AS inventory_level_id, level.location_id,
         level.stocked_quantity::text AS stocked_quantity,
         level.reserved_quantity::text AS reserved_quantity
  FROM lines l
  JOIN product_variant v ON v.id = l.variant_id AND v.product_id = l.product_id
  JOIN product_variant_inventory_item link ON link.variant_id = v.id
  JOIN inventory_level level ON level.inventory_item_id = link.inventory_item_id
  WHERE v.deleted_at IS NULL AND link.deleted_at IS NULL AND level.deleted_at IS NULL
),
payments AS (
  SELECT c.id AS collection_id, p.id, p.provider_id, p.currency_code,
         c.amount::text AS collection_amount, p.amount::text AS amount,
         COALESCE((SELECT sum(x.amount) FROM capture x WHERE x.payment_id = p.id AND x.deleted_at IS NULL), 0)::text AS captured_amount,
         COALESCE((SELECT sum(x.amount) FROM refund x WHERE x.payment_id = p.id AND x.deleted_at IS NULL), 0)::text AS refunded_amount
  FROM fixture o
  JOIN order_payment_collection link ON link.order_id = o.id
  JOIN payment_collection c ON c.id = link.payment_collection_id
  JOIN payment p ON p.payment_collection_id = c.id
  WHERE link.deleted_at IS NULL AND c.deleted_at IS NULL AND p.deleted_at IS NULL
)
SELECT jsonb_build_object(
  'schema_version', 1, 'merchant', 'merchant_a_ci',
  'order', jsonb_build_object('id', o.id, 'currency_code', o.currency_code, 'total', o.total),
  'lines', COALESCE((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.id) FROM lines l), '[]'),
  'stock', COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.variant_id, s.inventory_level_id) FROM stock s), '[]'),
  'payments', COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id) FROM payments p), '[]')
)
FROM fixture o;
