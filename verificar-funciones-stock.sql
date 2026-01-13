-- ============================================================================
-- SCRIPT DE VERIFICACIÓN: Comprobar funciones de stock
-- ============================================================================
-- Ejecuta este script en Supabase SQL Editor para verificar si las funciones
-- de gestión de stock están instaladas correctamente
-- ============================================================================

-- 1. Verificar si la función decrement_stock existe
SELECT 
  proname AS function_name,
  prosrc AS function_body
FROM pg_proc 
WHERE proname = 'decrement_stock';

-- Si devuelve filas, la función existe ✅
-- Si no devuelve nada, necesitas ejecutar sql-decrement-stock.sql ❌

-- 2. Verificar si la función increment_stock existe
SELECT 
  proname AS function_name,
  prosrc AS function_body
FROM pg_proc 
WHERE proname = 'increment_stock';

-- Si devuelve filas, la función existe ✅
-- Si no devuelve nada, necesitas ejecutar sql-increment-stock.sql ❌

-- 3. Probar decrement_stock manualmente (PRUEBA)
-- NOTA: Reemplaza el UUID con un ID de producto real de tu base de datos
-- SELECT decrement_stock('tu-product-id-aqui'::uuid, 1);

-- 4. Ver el stock actual de todos los productos
SELECT 
  id,
  name,
  stock,
  price / 100 as price_euros
FROM products
ORDER BY name;
