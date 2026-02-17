-- ============================================================================
-- DIAGNÓSTICO: Ver stock EXACTO del producto "asa" y de todos los productos
-- ============================================================================
-- EJECUTAR EN: Supabase → SQL Editor
-- ============================================================================

-- 1. VER STOCK EXACTO del producto "asa" (el que da error)
SELECT 
  name,
  stock AS stock_total,
  stock_by_size,
  (SELECT string_agg(key || ': ' || value, ', ') 
   FROM jsonb_each_text(stock_by_size)) AS desglose_tallas
FROM products
WHERE name ILIKE '%asa%';

-- 2. VER TODOS los productos con stock por talla (para detectar desincronización)
SELECT 
  name,
  stock AS stock_total_campo,
  COALESCE(
    (SELECT SUM(value::INTEGER) FROM jsonb_each_text(stock_by_size)), 0
  ) AS suma_real_tallas,
  stock_by_size,
  CASE 
    WHEN stock != COALESCE(
      (SELECT SUM(value::INTEGER) FROM jsonb_each_text(stock_by_size)), 0)
    THEN '⚠️ DESINCRONIZADO'
    ELSE '✅ OK'
  END AS estado
FROM products
WHERE is_active = true
ORDER BY name;

-- 3. VER si hay reservaciones activas (del sistema viejo que ya quitamos)
SELECT COUNT(*) AS reservaciones_activas 
FROM stock_reservations 
WHERE status = 'active' AND expires_at > NOW();

-- 4. Si hay reservaciones activas, CANCELARLAS TODAS (ya no se usan)
-- DESCOMENTA LA SIGUIENTE LÍNEA PARA EJECUTAR:
-- UPDATE stock_reservations SET status = 'cancelled' WHERE status = 'active';
