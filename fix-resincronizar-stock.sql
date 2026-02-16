-- ============================================================================
-- FIX: Resincronizar stock total desde stock_by_size
-- ============================================================================
-- PROBLEMA: Reembolsos anteriores restauraron solo el campo `stock` (total)
--           pero NO el campo `stock_by_size` (por talla), causando que:
--           - El total muestre un número (ej: 32)
--           - Las tallas muestren otro número diferente (ej: 34)
--           - Algunas tallas tengan 0 cuando deberían tener stock
--
-- SOLUCIÓN: Recalcular `stock` como la suma de todos los valores de stock_by_size
-- ============================================================================

-- 1. VER el estado actual de los productos desincronizados (DIAGNÓSTICO)
SELECT 
  id,
  name,
  stock AS stock_total_actual,
  stock_by_size,
  COALESCE(
    (SELECT SUM(value::INTEGER) 
     FROM jsonb_each_text(stock_by_size)
     WHERE stock_by_size IS NOT NULL AND stock_by_size != '{}'::jsonb
    ), 0
  ) AS suma_tallas,
  CASE 
    WHEN stock != COALESCE(
      (SELECT SUM(value::INTEGER) 
       FROM jsonb_each_text(stock_by_size)
       WHERE stock_by_size IS NOT NULL AND stock_by_size != '{}'::jsonb
      ), 0)
    THEN '⚠️ DESINCRONIZADO'
    ELSE '✅ OK'
  END AS estado
FROM products
WHERE is_active = true
ORDER BY name;

-- 2. CORREGIR: Recalcular stock total = suma de stock_by_size
UPDATE products
SET 
  stock = COALESCE(
    (SELECT SUM(value::INTEGER) 
     FROM jsonb_each_text(stock_by_size)
    ), 0
  ),
  updated_at = NOW()
WHERE stock_by_size IS NOT NULL 
  AND stock_by_size != '{}'::jsonb;

-- 3. VERIFICAR después de la corrección
SELECT 
  name,
  stock AS stock_total,
  stock_by_size,
  COALESCE(
    (SELECT SUM(value::INTEGER) 
     FROM jsonb_each_text(stock_by_size)
    ), 0
  ) AS suma_tallas
FROM products
WHERE is_active = true
ORDER BY name;
