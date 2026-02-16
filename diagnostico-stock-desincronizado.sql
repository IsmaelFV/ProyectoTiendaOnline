-- ============================================================================
-- DIAGNÓSTICO: Ver pedidos reembolsados y su impacto en stock
-- ============================================================================
-- Ejecutar ANTES del fix para entender qué pasó
-- ============================================================================

-- 1. Pedidos reembolsados/cancelados recientes
SELECT 
  o.id,
  o.order_number,
  o.status,
  o.payment_status,
  o.total,
  o.created_at,
  o.updated_at,
  o.admin_notes
FROM orders o
WHERE o.status IN ('refunded', 'cancelled')
ORDER BY o.updated_at DESC
LIMIT 10;

-- 2. Items de pedidos reembolsados (qué tallas se compraron)
SELECT 
  o.order_number,
  o.status,
  oi.product_name,
  oi.size,
  oi.quantity,
  oi.product_id,
  p.stock AS stock_actual,
  p.stock_by_size AS stock_por_talla
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
JOIN products p ON p.id = oi.product_id
WHERE o.status IN ('refunded', 'cancelled')
ORDER BY o.updated_at DESC;

-- 3. Productos con stock_by_size que tiene alguna talla en 0 pero stock total > 0
SELECT 
  id,
  name,
  stock,
  stock_by_size
FROM products
WHERE stock > 0
  AND stock_by_size IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM jsonb_each_text(stock_by_size) 
    WHERE value::INTEGER <= 0
  )
ORDER BY name;
