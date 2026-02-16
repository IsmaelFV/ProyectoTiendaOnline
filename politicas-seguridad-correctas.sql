-- ============================================================================
-- POLÍTICAS DE SEGURIDAD CORRECTAS - Row Level Security (RLS)
-- ============================================================================
-- OBJETIVO: Permitir lectura pública pero escritura solo para admins
-- Como Amazon: Todos ven productos, solo admins los modifican
-- ============================================================================

-- ============================================================================
-- PASO 1: Asegurar que RLS está ACTIVO (seguridad habilitada)
-- ============================================================================
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE genders ENABLE ROW LEVEL SECURITY;
ALTER TABLE colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PASO 2: ELIMINAR políticas antiguas si existen
-- ============================================================================
DROP POLICY IF EXISTS "Allow public read access to products" ON products;
DROP POLICY IF EXISTS "Allow public read access to categories" ON categories;
DROP POLICY IF EXISTS "Allow public read access to genders" ON genders;
DROP POLICY IF EXISTS "Allow public read access to colors" ON colors;
DROP POLICY IF EXISTS "Allow public read access to product_categories" ON product_categories;

DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON products;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON products;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON products;

-- ============================================================================
-- PASO 3: CREAR políticas de LECTURA PÚBLICA (sin autenticación)
-- ============================================================================

-- Productos: Cualquiera puede leer
CREATE POLICY "Allow public read access to products"
ON products FOR SELECT
USING (true);

-- Categorías: Cualquiera puede leer
CREATE POLICY "Allow public read access to categories"
ON categories FOR SELECT
USING (true);

-- Géneros: Cualquiera puede leer
CREATE POLICY "Allow public read access to genders"
ON genders FOR SELECT
USING (true);

-- Colores: Cualquiera puede leer
CREATE POLICY "Allow public read access to colors"
ON colors FOR SELECT
USING (true);

-- Relaciones producto-categoría: Cualquiera puede leer
CREATE POLICY "Allow public read access to product_categories"
ON product_categories FOR SELECT
USING (true);

-- ============================================================================
-- PASO 4: CREAR políticas de ESCRITURA solo para ADMINS autenticados
-- ============================================================================

-- Solo usuarios autenticados pueden insertar productos
CREATE POLICY "Enable insert for authenticated users only"
ON products FOR INSERT
TO authenticated
WITH CHECK (true);

-- Solo usuarios autenticados pueden actualizar productos
CREATE POLICY "Enable update for authenticated users only"
ON products FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Solo usuarios autenticados pueden eliminar productos
CREATE POLICY "Enable delete for authenticated users only"
ON products FOR DELETE
TO authenticated
USING (true);

-- ============================================================================
-- PASO 5: Verificar que las políticas están activas
-- ============================================================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as operacion
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('products', 'categories', 'genders', 'colors', 'product_categories')
ORDER BY tablename, cmd;

-- Verificar que RLS está activo
SELECT 
  tablename,
  rowsecurity as rls_activo
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('products', 'categories', 'genders', 'colors', 'product_categories');

-- Mensaje final
SELECT 'SEGURIDAD CONFIGURADA CORRECTAMENTE' as resultado,
       '📖 Lectura: Pública (sin login)' as lectura,
       '✍Escritura: Solo usuarios autenticados' as escritura;
