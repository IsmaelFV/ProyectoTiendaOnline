-- ============================================================================
-- SETUP COMPLETO: Navegación Tipo H&M
-- ============================================================================
-- Este archivo contiene TODO lo necesario para que funcione la navegación
-- Copia y pega TODO en Supabase SQL Editor y ejecuta
-- ============================================================================

-- ============================================================================
-- PASO 1: Crear tabla genders (si no existe)
-- ============================================================================

CREATE TABLE IF NOT EXISTS genders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_genders_slug ON genders(slug);
CREATE INDEX IF NOT EXISTS idx_genders_active ON genders(is_active);

-- Insertar géneros
INSERT INTO genders (name, slug, display_order) VALUES
  ('Mujer', 'mujer', 1),
  ('Hombre', 'hombre', 2),
  ('Unisex', 'unisex', 3)
ON CONFLICT (slug) DO NOTHING;

-- Habilitar RLS
ALTER TABLE genders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view genders" ON genders;
CREATE POLICY "Public can view genders"
  ON genders FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Service role can manage genders" ON genders;
CREATE POLICY "Service role can manage genders"
  ON genders FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- PASO 2: Actualizar tabla categories con nuevas columnas
-- ============================================================================

-- Agregar columnas necesarias para jerarquía H&M
ALTER TABLE categories 
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS gender_id UUID REFERENCES genders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS category_type TEXT DEFAULT 'main',
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_gender ON categories(gender_id);
CREATE INDEX IF NOT EXISTS idx_categories_level ON categories(level);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active);

-- ============================================================================
-- PASO 2.5: Actualizar tabla products con gender_id
-- ============================================================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS gender_id UUID REFERENCES genders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_new BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_on_sale BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sale_price INTEGER,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_products_gender ON products(gender_id);
CREATE INDEX IF NOT EXISTS idx_products_is_new ON products(is_new);
CREATE INDEX IF NOT EXISTS idx_products_is_on_sale ON products(is_on_sale);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);

-- ============================================================================
-- PASO 2.6: Crear tabla product_categories (muchos a muchos)
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_categories (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_product_categories_product ON product_categories(product_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_category ON product_categories(category_id);

-- RLS para product_categories
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view product_categories" ON product_categories;
CREATE POLICY "Public can view product_categories"
  ON product_categories FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Service role can manage product_categories" ON product_categories;
CREATE POLICY "Service role can manage product_categories"
  ON product_categories FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- PASO 3: Limpiar categorías viejas y crear nuevas (Tipo H&M)
-- ============================================================================

-- Limpiar categorías existentes
TRUNCATE categories CASCADE;

-- Variables para IDs
DO $$
DECLARE
  mujer_id UUID;
  hombre_id UUID;
  
  -- IDs de categorías principales
  cat_ropa_mujer UUID;
  cat_ropa_hombre UUID;
  cat_accesorios_mujer UUID;
  cat_accesorios_hombre UUID;
  cat_zapatos_mujer UUID;
  cat_zapatos_hombre UUID;
  cat_sport_mujer UUID;
  cat_sport_hombre UUID;
BEGIN
  -- Obtener IDs de géneros
  SELECT id INTO mujer_id FROM genders WHERE slug = 'mujer';
  SELECT id INTO hombre_id FROM genders WHERE slug = 'hombre';

  -- ============================================================================
  -- MUJER - Categorías Principales (Nivel 1)
  -- ============================================================================
  
  INSERT INTO categories (name, slug, gender_id, level, category_type, display_order, description) VALUES
    ('Rebajas Mujer', 'rebajas-mujer', mujer_id, 1, 'featured', 1, 'Descuentos y ofertas especiales'),
    ('Novedades Mujer', 'novedades-mujer', mujer_id, 1, 'featured', 2, 'Lo último en moda femenina');

  -- ROPA MUJER
  INSERT INTO categories (name, slug, gender_id, level, category_type, display_order, description)
  VALUES ('Ropa Mujer', 'ropa-mujer', mujer_id, 1, 'main', 3, 'Toda la ropa de mujer')
  RETURNING id INTO cat_ropa_mujer;
  
  INSERT INTO categories (name, slug, parent_id, gender_id, level, category_type, display_order) VALUES
    ('Camisetas y Tops', 'camisetas-tops-mujer', cat_ropa_mujer, mujer_id, 2, 'subcategory', 1),
    ('Vestidos', 'vestidos', cat_ropa_mujer, mujer_id, 2, 'subcategory', 2),
    ('Pantalones', 'pantalones-mujer', cat_ropa_mujer, mujer_id, 2, 'subcategory', 3),
    ('Jeans', 'jeans-mujer', cat_ropa_mujer, mujer_id, 2, 'subcategory', 4),
    ('Faldas', 'faldas', cat_ropa_mujer, mujer_id, 2, 'subcategory', 5),
    ('Abrigos', 'abrigos-mujer', cat_ropa_mujer, mujer_id, 2, 'subcategory', 6),
    ('Chaquetas', 'chaquetas-mujer', cat_ropa_mujer, mujer_id, 2, 'subcategory', 7),
    ('Sudaderas', 'sudaderas-mujer', cat_ropa_mujer, mujer_id, 2, 'subcategory', 8);
  
  -- ACCESORIOS MUJER
  INSERT INTO categories (name, slug, gender_id, level, category_type, display_order, description)
  VALUES ('Accesorios Mujer', 'accesorios-mujer', mujer_id, 1, 'main', 4, 'Complementos')
  RETURNING id INTO cat_accesorios_mujer;
  
  INSERT INTO categories (name, slug, parent_id, gender_id, level, category_type, display_order) VALUES
    ('Bolsos', 'bolsos', cat_accesorios_mujer, mujer_id, 2, 'subcategory', 1),
    ('Joyas', 'joyas', cat_accesorios_mujer, mujer_id, 2, 'subcategory', 2),
    ('Cinturones', 'cinturones-mujer', cat_accesorios_mujer, mujer_id, 2, 'subcategory', 3),
    ('Bufandas', 'bufandas-mujer', cat_accesorios_mujer, mujer_id, 2, 'subcategory', 4);
  
  -- ZAPATOS MUJER
  INSERT INTO categories (name, slug, gender_id, level, category_type, display_order, description)
  VALUES ('Zapatos Mujer', 'zapatos-mujer', mujer_id, 1, 'main', 5, 'Calzado')
  RETURNING id INTO cat_zapatos_mujer;
  
  INSERT INTO categories (name, slug, parent_id, gender_id, level, category_type, display_order) VALUES
    ('Tacones', 'tacones', cat_zapatos_mujer, mujer_id, 2, 'subcategory', 1),
    ('Botas', 'botas-mujer', cat_zapatos_mujer, mujer_id, 2, 'subcategory', 2),
    ('Zapatillas', 'zapatillas-mujer', cat_zapatos_mujer, mujer_id, 2, 'subcategory', 3),
    ('Sandalias', 'sandalias-mujer', cat_zapatos_mujer, mujer_id, 2, 'subcategory', 4);

  -- SPORT MUJER
  INSERT INTO categories (name, slug, gender_id, level, category_type, display_order, description)
  VALUES ('Sport Mujer', 'sport-mujer', mujer_id, 1, 'main', 6, 'Ropa deportiva')
  RETURNING id INTO cat_sport_mujer;
  
  INSERT INTO categories (name, slug, parent_id, gender_id, level, category_type, display_order) VALUES
    ('Tops Deportivos', 'tops-deportivos-mujer', cat_sport_mujer, mujer_id, 2, 'subcategory', 1),
    ('Leggings', 'leggings', cat_sport_mujer, mujer_id, 2, 'subcategory', 2),
    ('Chaquetas Deportivas', 'chaquetas-deportivas-mujer', cat_sport_mujer, mujer_id, 2, 'subcategory', 3);

  -- ============================================================================
  -- HOMBRE - Categorías Principales (Nivel 1)
  -- ============================================================================
  
  INSERT INTO categories (name, slug, gender_id, level, category_type, display_order, description) VALUES
    ('Rebajas Hombre', 'rebajas-hombre', hombre_id, 1, 'featured', 1, 'Descuentos y ofertas especiales'),
    ('Novedades Hombre', 'novedades-hombre', hombre_id, 1, 'featured', 2, 'Lo último en moda masculina');

  -- ROPA HOMBRE
  INSERT INTO categories (name, slug, gender_id, level, category_type, display_order, description)
  VALUES ('Ropa Hombre', 'ropa-hombre', hombre_id, 1, 'main', 3, 'Toda la ropa de hombre')
  RETURNING id INTO cat_ropa_hombre;
  
  INSERT INTO categories (name, slug, parent_id, gender_id, level, category_type, display_order) VALUES
    ('Camisetas', 'camisetas-hombre', cat_ropa_hombre, hombre_id, 2, 'subcategory', 1),
    ('Camisas', 'camisas-hombre', cat_ropa_hombre, hombre_id, 2, 'subcategory', 2),
    ('Pantalones', 'pantalones-hombre', cat_ropa_hombre, hombre_id, 2, 'subcategory', 3),
    ('Jeans', 'jeans-hombre', cat_ropa_hombre, hombre_id, 2, 'subcategory', 4),
    ('Sudaderas', 'sudaderas-hombre', cat_ropa_hombre, hombre_id, 2, 'subcategory', 5),
    ('Abrigos', 'abrigos-hombre', cat_ropa_hombre, hombre_id, 2, 'subcategory', 6),
    ('Chaquetas', 'chaquetas-hombre', cat_ropa_hombre, hombre_id, 2, 'subcategory', 7),
    ('Trajes', 'trajes-hombre', cat_ropa_hombre, hombre_id, 2, 'subcategory', 8);
  
  -- ACCESORIOS HOMBRE
  INSERT INTO categories (name, slug, gender_id, level, category_type, display_order, description)
  VALUES ('Accesorios Hombre', 'accesorios-hombre', hombre_id, 1, 'main', 4, 'Complementos')
  RETURNING id INTO cat_accesorios_hombre;
  
  INSERT INTO categories (name, slug, parent_id, gender_id, level, category_type, display_order) VALUES
    ('Relojes', 'relojes-hombre', cat_accesorios_hombre, hombre_id, 2, 'subcategory', 1),
    ('Cinturones', 'cinturones-hombre', cat_accesorios_hombre, hombre_id, 2, 'subcategory', 2),
    ('Gorras', 'gorras-hombre', cat_accesorios_hombre, hombre_id, 2, 'subcategory', 3),
    ('Bufandas', 'bufandas-hombre', cat_accesorios_hombre, hombre_id, 2, 'subcategory', 4);
  
  -- ZAPATOS HOMBRE
  INSERT INTO categories (name, slug, gender_id, level, category_type, display_order, description)
  VALUES ('Zapatos Hombre', 'zapatos-hombre', hombre_id, 1, 'main', 5, 'Calzado')
  RETURNING id INTO cat_zapatos_hombre;
  
  INSERT INTO categories (name, slug, parent_id, gender_id, level, category_type, display_order) VALUES
    ('Zapatos Formales', 'zapatos-formales', cat_zapatos_hombre, hombre_id, 2, 'subcategory', 1),
    ('Deportivas', 'deportivas-hombre', cat_zapatos_hombre, hombre_id, 2, 'subcategory', 2),
    ('Botas', 'botas-hombre', cat_zapatos_hombre, hombre_id, 2, 'subcategory', 3),
    ('Casuales', 'casuales-hombre', cat_zapatos_hombre, hombre_id, 2, 'subcategory', 4);

  -- SPORT HOMBRE
  INSERT INTO categories (name, slug, gender_id, level, category_type, display_order, description)
  VALUES ('Sport Hombre', 'sport-hombre', hombre_id, 1, 'main', 6, 'Ropa deportiva')
  RETURNING id INTO cat_sport_hombre;
  
  INSERT INTO categories (name, slug, parent_id, gender_id, level, category_type, display_order) VALUES
    ('Camisetas Deportivas', 'camisetas-deportivas-hombre', cat_sport_hombre, hombre_id, 2, 'subcategory', 1),
    ('Pantalones Deportivos', 'pantalones-deportivos-hombre', cat_sport_hombre, hombre_id, 2, 'subcategory', 2),
    ('Chaquetas Deportivas', 'chaquetas-deportivas-hombre', cat_sport_hombre, hombre_id, 2, 'subcategory', 3);

END $$;

-- ============================================================================
-- VERIFICACIÓN: Comprobar que todo se creó correctamente
-- ============================================================================

-- Ver resumen de categorías por género y nivel
SELECT 
  g.name as genero,
  c.level as nivel,
  COUNT(*) as cantidad
FROM categories c
JOIN genders g ON c.gender_id = g.id
GROUP BY g.name, c.level
ORDER BY g.name, c.level;

-- Ver estructura completa de mujer
SELECT 
  CASE 
    WHEN level = 1 THEN name
    WHEN level = 2 THEN '  ↳ ' || name
  END as categoria,
  level,
  display_order
FROM categories
WHERE gender_id = (SELECT id FROM genders WHERE slug = 'mujer')
ORDER BY display_order, level;

-- ============================================================================
-- ✅ Si ves categorías en el resultado, TODO ESTÁ LISTO!
-- ============================================================================
