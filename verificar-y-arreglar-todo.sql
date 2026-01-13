-- ============================================================================
-- SCRIPT COMPLETO: Verificar y Arreglar Acceso a Productos
-- ============================================================================

-- PASO 1: Verificar que existen productos
SELECT COUNT(*) as total_productos FROM products;

-- PASO 2: Verificar productos destacados
SELECT 
  id, 
  name, 
  featured,
  gender_id,
  category_id
FROM products 
WHERE featured = true;

-- PASO 3: Verificar estado de RLS (Row Level Security)
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_activo
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('products', 'categories', 'genders', 'colors', 'product_categories');

-- PASO 4: Ver políticas RLS existentes
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('products', 'categories', 'genders', 'colors', 'product_categories');

-- ============================================================================
-- SOLUCIÓN: Desactivar RLS para permitir acceso público de LECTURA
-- ============================================================================

-- Desactivar RLS en todas las tablas
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE genders DISABLE ROW LEVEL SECURITY;
ALTER TABLE colors DISABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories DISABLE ROW LEVEL SECURITY;

-- Verificar que RLS está desactivado
SELECT 
  tablename,
  rowsecurity as rls_activo
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('products', 'categories', 'genders', 'colors', 'product_categories');

-- Mensaje final
SELECT '✅ RLS desactivado. Los productos ahora son públicamente accesibles.' as resultado;
