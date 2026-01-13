-- ============================================================================
-- SOLUCIÓN: Habilitar acceso público de lectura a los productos
-- ============================================================================
-- PROBLEMA: Row Level Security (RLS) puede estar bloqueando el acceso
-- SOLUCIÓN: Desactivar RLS o crear policies que permitan lectura pública
-- ============================================================================

-- Opción 1: Desactivar RLS temporalmente (SOLO para desarrollo/pruebas)
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE genders DISABLE ROW LEVEL SECURITY;
ALTER TABLE colors DISABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories DISABLE ROW LEVEL SECURITY;

-- Verificar el estado de RLS
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('products', 'categories', 'genders', 'colors', 'product_categories');

-- Mensaje de confirmación
SELECT '✅ RLS desactivado. Ahora los productos deberían ser visibles públicamente.' as status;
