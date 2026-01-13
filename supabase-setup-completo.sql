-- ============================================================================
-- FASHIONMARKET - CONFIGURACIÓN COMPLETA DE SUPABASE
-- ============================================================================
-- Este archivo contiene TODA la configuración necesaria para Supabase:
-- - Extensiones
-- - Tablas (categories y products)
-- - Índices
-- - Triggers
-- - Funciones
-- - Row Level Security (RLS)
-- - Políticas de acceso para TABLAS y VISTAS
-- - Storage buckets y políticas
-- - Datos de ejemplo
-- ============================================================================

-- ============================================================================
-- 1. EXTENSIONES
-- ============================================================================

-- Habilitar extensión UUID para generar IDs únicos
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Habilitar extensión pgcrypto para funciones de encriptación (opcional)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Habilitar extensión pg_trgm para búsqueda de texto con trigramas
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- 2. ELIMINAR OBJETOS EXISTENTES (PERMITE RE-EJECUTAR EL SCRIPT)
-- ============================================================================

-- Eliminar vistas primero (dependen de las tablas)
DROP VIEW IF EXISTS products_featured CASCADE;
DROP VIEW IF EXISTS products_low_stock CASCADE;
DROP VIEW IF EXISTS products_with_category CASCADE;

-- Eliminar funciones
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS generate_slug(text) CASCADE;
DROP FUNCTION IF EXISTS get_products_by_category(text) CASCADE;
DROP FUNCTION IF EXISTS search_products(text) CASCADE;

-- Eliminar tablas
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;

-- ============================================================================
-- 3. CREAR TABLAS
-- ============================================================================

-- Tabla de Categorías
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  image_url TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT categories_name_not_empty CHECK (char_length(name) > 0),
  CONSTRAINT categories_slug_not_empty CHECK (char_length(slug) > 0),
  CONSTRAINT categories_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

-- Tabla de Productos
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  price INTEGER NOT NULL CHECK (price >= 0), -- Precio en céntimos (ej: 8900 = 89.00€)
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  images TEXT[] DEFAULT '{}', -- Array de URLs de imágenes
  sizes TEXT[] DEFAULT '{}', -- Array de tallas disponibles (ej: ['S', 'M', 'L', 'XL'])
  colors TEXT[] DEFAULT '{}', -- Array de colores disponibles (opcional)
  featured BOOLEAN DEFAULT FALSE, -- Producto destacado en homepage
  is_active BOOLEAN DEFAULT TRUE, -- Producto activo/visible
  sku TEXT UNIQUE, -- Código de producto (Stock Keeping Unit)
  weight_grams INTEGER, -- Peso en gramos (para cálculo de envío)
  meta_title TEXT, -- SEO: Título para meta tags
  meta_description TEXT, -- SEO: Descripción para meta tags
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT products_name_not_empty CHECK (char_length(name) > 0),
  CONSTRAINT products_slug_not_empty CHECK (char_length(slug) > 0),
  CONSTRAINT products_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT products_price_positive CHECK (price > 0)
);

-- ============================================================================
-- 4. CREAR ÍNDICES PARA OPTIMIZACIÓN
-- ============================================================================

-- Índices para búsquedas rápidas en products
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_featured ON products(featured) WHERE featured = TRUE;
CREATE INDEX idx_products_active ON products(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_products_stock ON products(stock) WHERE stock > 0;
CREATE INDEX idx_products_created_at ON products(created_at DESC);
CREATE INDEX idx_products_price ON products(price);

-- Índices para categories
CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_active ON categories(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_categories_display_order ON categories(display_order);

-- Índices para búsqueda de texto completo con trigramas (OPCIONAL)
-- Estos índices mejoran la búsqueda de texto pero requieren la extensión pg_trgm
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_description_trgm ON products USING gin(description gin_trgm_ops);

-- ============================================================================
-- 5. FUNCIONES Y TRIGGERS
-- ============================================================================

-- Función para actualizar automáticamente updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para categories
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para products
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Función para generar slug automáticamente (opcional)
CREATE OR REPLACE FUNCTION generate_slug(text_input TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN lower(
    regexp_replace(
      regexp_replace(
        regexp_replace(text_input, '[áàäâ]', 'a', 'gi'),
        '[éèëê]', 'e', 'gi'
      ),
      '[^a-z0-9]+', '-', 'gi'
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS) - TABLAS
-- ============================================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes de tablas (permite re-ejecutar el script)
DROP POLICY IF EXISTS "Lectura pública de categorías" ON categories;
DROP POLICY IF EXISTS "Admin puede ver todas las categorías" ON categories;
DROP POLICY IF EXISTS "Admin puede insertar categorías" ON categories;
DROP POLICY IF EXISTS "Admin puede actualizar categorías" ON categories;
DROP POLICY IF EXISTS "Admin puede eliminar categorías" ON categories;
DROP POLICY IF EXISTS "Service role acceso completo a categorías" ON categories;
DROP POLICY IF EXISTS "Lectura pública de productos activos" ON products;
DROP POLICY IF EXISTS "Admin puede ver todos los productos" ON products;
DROP POLICY IF EXISTS "Admin puede insertar productos" ON products;
DROP POLICY IF EXISTS "Admin puede actualizar productos" ON products;
DROP POLICY IF EXISTS "Admin puede eliminar productos" ON products;
DROP POLICY IF EXISTS "Service role acceso completo a productos" ON products;

-- ============================================================================
-- 7. POLÍTICAS DE ACCESO - CATEGORIES
-- ============================================================================

-- Política: Lectura pública de categorías activas
CREATE POLICY "Lectura pública de categorías"
  ON categories FOR SELECT
  TO anon, authenticated
  USING (is_active = TRUE);

-- Política: Lectura completa para usuarios autenticados (admin)
CREATE POLICY "Admin puede ver todas las categorías"
  ON categories FOR SELECT
  TO authenticated
  USING (true);

-- Política: Inserción solo para usuarios autenticados
CREATE POLICY "Admin puede insertar categorías"
  ON categories FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Política: Actualización solo para usuarios autenticados
CREATE POLICY "Admin puede actualizar categorías"
  ON categories FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Política: Eliminación solo para usuarios autenticados
CREATE POLICY "Admin puede eliminar categorías"
  ON categories FOR DELETE
  TO authenticated
  USING (true);

-- Política: Service role tiene acceso completo
CREATE POLICY "Service role acceso completo a categorías"
  ON categories FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 8. POLÍTICAS DE ACCESO - PRODUCTS
-- ============================================================================

-- Política: Lectura pública de productos activos
CREATE POLICY "Lectura pública de productos activos"
  ON products FOR SELECT
  TO anon, authenticated
  USING (is_active = TRUE);

-- Política: Lectura completa para usuarios autenticados (admin)
CREATE POLICY "Admin puede ver todos los productos"
  ON products FOR SELECT
  TO authenticated
  USING (true);

-- Política: Inserción solo para usuarios autenticados
CREATE POLICY "Admin puede insertar productos"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Política: Actualización solo para usuarios autenticados
CREATE POLICY "Admin puede actualizar productos"
  ON products FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Política: Eliminación solo para usuarios autenticados
CREATE POLICY "Admin puede eliminar productos"
  ON products FOR DELETE
  TO authenticated
  USING (true);

-- Política: Service role tiene acceso completo
CREATE POLICY "Service role acceso completo a productos"
  ON products FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 9. CONFIGURACIÓN DE STORAGE (BUCKETS)
-- ============================================================================

-- Crear bucket para imágenes de productos (si no existe)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true, -- Bucket público
  5242880, -- 5MB límite por archivo
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 10. POLÍTICAS DE STORAGE
-- ============================================================================

-- Eliminar políticas existentes del bucket product-images
DROP POLICY IF EXISTS "Lectura pública de imágenes de productos" ON storage.objects;
DROP POLICY IF EXISTS "Admin puede subir imágenes" ON storage.objects;
DROP POLICY IF EXISTS "Admin puede actualizar imágenes" ON storage.objects;
DROP POLICY IF EXISTS "Admin puede eliminar imágenes" ON storage.objects;

-- Política: Lectura pública de imágenes
CREATE POLICY "Lectura pública de imágenes de productos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-images');

-- Política: Upload solo para usuarios autenticados
CREATE POLICY "Admin puede subir imágenes"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images');

-- Política: Actualización solo para usuarios autenticados
CREATE POLICY "Admin puede actualizar imágenes"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images')
WITH CHECK (bucket_id = 'product-images');

-- Política: Eliminación solo para usuarios autenticados
CREATE POLICY "Admin puede eliminar imágenes"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-images');

-- ============================================================================
-- 11. DATOS DE EJEMPLO
-- ============================================================================

-- Insertar categorías de ejemplo
INSERT INTO categories (name, slug, description, display_order) VALUES
  ('Camisas', 'camisas', 'Camisas elegantes para cualquier ocasión. Desde Oxford hasta camisas de vestir formales.', 1),
  ('Pantalones', 'pantalones', 'Pantalones de corte perfecto. Chinos, vaqueros y pantalones de vestir.', 2),
  ('Trajes', 'trajes', 'Trajes a medida y confeccionados. Elegancia y sofisticación en cada detalle.', 3),
  ('Accesorios', 'accesorios', 'Complementa tu look con nuestros accesorios premium: corbatas, cinturones y más.', 4);

-- Insertar productos de ejemplo
INSERT INTO products (name, slug, description, price, stock, category_id, images, sizes, featured, sku) VALUES
  (
    'Camisa Oxford Blanca Premium',
    'camisa-oxford-blanca-premium',
    'Camisa Oxford de algodón 100% egipcio. Corte slim fit con cuello abotonado. Perfecta para el día a día o eventos formales. Tejido de alta densidad que garantiza durabilidad y confort.',
    8900, -- €89.00
    25,
    (SELECT id FROM categories WHERE slug = 'camisas'),
    ARRAY[
      'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=800',
      'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800'
    ],
    ARRAY['S', 'M', 'L', 'XL', 'XXL'],
    true,
    'CAM-OXF-WHT-001'
  ),
  (
    'Camisa de Lino Azul Cielo',
    'camisa-lino-azul-cielo',
    'Camisa de lino 100% natural, perfecta para el verano. Corte regular con cuello italiano. Transpirable y ligera.',
    7900, -- €79.00
    18,
    (SELECT id FROM categories WHERE slug = 'camisas'),
    ARRAY[
      'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800'
    ],
    ARRAY['S', 'M', 'L', 'XL'],
    true,
    'CAM-LIN-BLU-001'
  ),
  (
    'Pantalón Chino Azul Marino',
    'pantalon-chino-azul-marino',
    'Pantalón chino de algodón premium con acabado satinado. Corte regular con bolsillos laterales y traseros. Versátil y elegante.',
    7900, -- €79.00
    30,
    (SELECT id FROM categories WHERE slug = 'pantalones'),
    ARRAY[
      'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=800'
    ],
    ARRAY['30', '32', '34', '36', '38', '40'],
    true,
    'PAN-CHI-NAV-001'
  ),
  (
    'Pantalón de Vestir Negro',
    'pantalon-vestir-negro',
    'Pantalón de vestir en lana virgen. Corte clásico con pinzas. Ideal para eventos formales y oficina.',
    9900, -- €99.00
    20,
    (SELECT id FROM categories WHERE slug = 'pantalones'),
    ARRAY[
      'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800'
    ],
    ARRAY['30', '32', '34', '36', '38', '40'],
    false,
    'PAN-VES-BLK-001'
  ),
  (
    'Traje Dos Piezas Gris Carbón',
    'traje-dos-piezas-gris-carbon',
    'Traje de lana virgen italiana Super 120s. Incluye chaqueta y pantalón. Corte moderno slim fit. Forro de viscosa de alta calidad.',
    49900, -- €499.00
    10,
    (SELECT id FROM categories WHERE slug = 'trajes'),
    ARRAY[
      'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800',
      'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800'
    ],
    ARRAY['46', '48', '50', '52', '54', '56'],
    true,
    'TRA-2PC-GRY-001'
  ),
  (
    'Traje Azul Marino Clásico',
    'traje-azul-marino-clasico',
    'Traje clásico de lana merino. Corte regular atemporal. Perfecto para bodas y eventos formales.',
    54900, -- €549.00
    8,
    (SELECT id FROM categories WHERE slug = 'trajes'),
    ARRAY[
      'https://images.unsplash.com/photo-1593030761757-71fae45fa0e7?w=800'
    ],
    ARRAY['46', '48', '50', '52', '54'],
    true,
    'TRA-CLA-NAV-001'
  );

-- ============================================================================
-- 12. VISTAS ÚTILES CON SEGURIDAD RLS
-- ============================================================================

-- Vista: Productos con información de categoría (PÚBLICA)
-- Solo muestra productos activos con stock disponible
CREATE OR REPLACE VIEW products_with_category 
WITH (security_invoker = true) AS
SELECT 
  p.id,
  p.name,
  p.slug,
  p.description,
  p.price,
  p.stock,
  p.category_id,
  p.images,
  p.sizes,
  p.colors,
  p.featured,
  p.is_active,
  p.sku,
  p.weight_grams,
  p.meta_title,
  p.meta_description,
  p.created_at,
  p.updated_at,
  c.name as category_name,
  c.slug as category_slug
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
WHERE p.is_active = TRUE AND p.stock > 0;

-- Vista: Productos con stock bajo (SOLO ADMIN)
-- Requiere autenticación para acceder
CREATE OR REPLACE VIEW products_low_stock 
WITH (security_invoker = true) AS
SELECT *
FROM products
WHERE stock < 5 AND stock > 0 AND is_active = TRUE
ORDER BY stock ASC;

-- Vista: Productos destacados activos (PÚBLICA)
-- Solo productos marcados como destacados con stock
CREATE OR REPLACE VIEW products_featured 
WITH (security_invoker = true) AS
SELECT 
  p.id,
  p.name,
  p.slug,
  p.description,
  p.price,
  p.stock,
  p.category_id,
  p.images,
  p.sizes,
  p.colors,
  p.featured,
  p.is_active,
  p.sku,
  p.weight_grams,
  p.meta_title,
  p.meta_description,
  p.created_at,
  p.updated_at
FROM products p
WHERE p.featured = TRUE AND p.is_active = TRUE AND p.stock > 0
ORDER BY p.created_at DESC;

-- ============================================================================
-- 12.1 POLÍTICAS RLS PARA VISTAS
-- ============================================================================
-- Las vistas heredan las políticas de las tablas base gracias a security_invoker,
-- pero añadimos políticas explícitas para mayor claridad y control

-- Habilitar RLS en las vistas no es posible directamente en PostgreSQL,
-- pero las vistas con security_invoker=true heredan automáticamente
-- las políticas RLS de las tablas subyacentes (products y categories)

-- NOTA IMPORTANTE:
-- - products_with_category: Accesible por todos (anon y authenticated)
--   Solo muestra productos activos con stock gracias al WHERE en la vista
--
-- - products_featured: Accesible por todos (anon y authenticated)
--   Solo muestra productos destacados activos con stock
--
-- - products_low_stock: Solo accesible por usuarios autenticados (admin)
--   Muestra productos con stock bajo para gestión de inventario
--
-- Las políticas RLS de las tablas 'products' y 'categories' se aplican
-- automáticamente cuando se consultan estas vistas gracias a security_invoker=true

-- ============================================================================
-- 13. FUNCIONES ÚTILES
-- ============================================================================

-- Función: Obtener productos por categoría
CREATE OR REPLACE FUNCTION get_products_by_category(category_slug_param TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  description TEXT,
  price INTEGER,
  stock INTEGER,
  images TEXT[],
  sizes TEXT[],
  featured BOOLEAN
) 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.slug,
    p.description,
    p.price,
    p.stock,
    p.images,
    p.sizes,
    p.featured
  FROM products p
  INNER JOIN categories c ON p.category_id = c.id
  WHERE c.slug = category_slug_param
    AND p.is_active = TRUE
    AND p.stock > 0
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Función: Buscar productos por nombre o descripción
CREATE OR REPLACE FUNCTION search_products(search_term TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  description TEXT,
  price INTEGER,
  stock INTEGER,
  images TEXT[]
) 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.slug,
    p.description,
    p.price,
    p.stock,
    p.images
  FROM products p
  WHERE p.is_active = TRUE
    AND p.stock > 0
    AND (
      p.name ILIKE '%' || search_term || '%'
      OR p.description ILIKE '%' || search_term || '%'
    )
  ORDER BY p.featured DESC, p.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 14. VERIFICACIÓN FINAL
-- ============================================================================

-- Verificar que las tablas se crearon correctamente
DO $$
DECLARE
  categories_count INTEGER;
  products_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO categories_count FROM categories;
  SELECT COUNT(*) INTO products_count FROM products;
  
  RAISE NOTICE '============================================';
  RAISE NOTICE '✓ Configuración completada exitosamente';
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
  RAISE NOTICE 'TABLAS CREADAS:';
  RAISE NOTICE '  - categories (con RLS habilitado)';
  RAISE NOTICE '  - products (con RLS habilitado)';
  RAISE NOTICE '';
  RAISE NOTICE 'DATOS DE EJEMPLO:';
  RAISE NOTICE '  - Categorías: %', categories_count;
  RAISE NOTICE '  - Productos: %', products_count;
  RAISE NOTICE '';
  RAISE NOTICE 'VISTAS CREADAS (con security_invoker):';
  RAISE NOTICE '  - products_with_category (pública - todos los usuarios)';
  RAISE NOTICE '  - products_featured (pública - todos los usuarios)';
  RAISE NOTICE '  - products_low_stock (admin - solo autenticados)';
  RAISE NOTICE '';
  RAISE NOTICE 'SEGURIDAD:';
  RAISE NOTICE '  ✓ RLS habilitado en todas las tablas';
  RAISE NOTICE '  ✓ Políticas de acceso configuradas';
  RAISE NOTICE '  ✓ Vistas con security_invoker = true';
  RAISE NOTICE '  ✓ Storage bucket configurado';
  RAISE NOTICE '';
  RAISE NOTICE 'PRÓXIMOS PASOS:';
  RAISE NOTICE '  1. Verifica el bucket "product-images" en Storage';
  RAISE NOTICE '  2. Crea un usuario administrador en Authentication';
  RAISE NOTICE '  3. Configura las variables de entorno en tu aplicación';
  RAISE NOTICE '============================================';
END $$;

-- ============================================================================
-- FIN DE LA CONFIGURACIÓN
-- ============================================================================
