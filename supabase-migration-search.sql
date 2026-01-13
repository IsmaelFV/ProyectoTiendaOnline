-- ============================================================================
-- MIGRACIÓN: Sistema de Búsqueda y Filtrado Avanzado
-- ============================================================================
-- FECHA: 13 de enero de 2026
-- PROPÓSITO: Ampliar el modelo de datos para soportar búsqueda profesional,
--            filtros avanzados y categorización jerárquica
-- ============================================================================

-- ============================================================================
-- TABLA: genders (Géneros)
-- ============================================================================
CREATE TABLE IF NOT EXISTS genders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE, -- 'Hombre', 'Mujer', 'Unisex'
  slug TEXT NOT NULL UNIQUE, -- 'hombre', 'mujer', 'unisex'
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_genders_slug ON genders(slug);
CREATE INDEX IF NOT EXISTS idx_genders_active ON genders(is_active);

COMMENT ON TABLE genders IS 'Géneros de productos para navegación principal y filtrado';

-- Poblar datos iniciales
INSERT INTO genders (name, slug, display_order) VALUES
  ('Mujer', 'mujer', 1),
  ('Hombre', 'hombre', 2),
  ('Unisex', 'unisex', 3)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- TABLA: colors (Colores)
-- ============================================================================
CREATE TABLE IF NOT EXISTS colors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE, -- 'Negro', 'Azul Marino', 'Rojo'
  slug TEXT NOT NULL UNIQUE, -- 'negro', 'azul-marino', 'rojo'
  hex_code TEXT NOT NULL, -- '#000000', '#001f3f', '#ff0000'
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_colors_slug ON colors(slug);
CREATE INDEX IF NOT EXISTS idx_colors_active ON colors(is_active);

COMMENT ON TABLE colors IS 'Colores estandarizados para productos y filtrado visual';

-- Poblar colores básicos
INSERT INTO colors (name, slug, hex_code, display_order) VALUES
  ('Negro', 'negro', '#000000', 1),
  ('Blanco', 'blanco', '#FFFFFF', 2),
  ('Gris', 'gris', '#808080', 3),
  ('Azul Marino', 'azul-marino', '#001f3f', 4),
  ('Azul', 'azul', '#0074D9', 5),
  ('Rojo', 'rojo', '#FF4136', 6),
  ('Verde', 'verde', '#2ECC40', 7),
  ('Amarillo', 'amarillo', '#FFDC00', 8),
  ('Rosa', 'rosa', '#FF69B4', 9),
  ('Marrón', 'marron', '#8B4513', 10),
  ('Beige', 'beige', '#F5F5DC', 11),
  ('Naranja', 'naranja', '#FF851B', 12)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- AMPLIACIÓN: categories → Categorías Jerárquicas
-- ============================================================================

-- Agregar columnas para jerarquía
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS gender_id UUID REFERENCES genders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1 CHECK (level BETWEEN 1 AND 3),
  ADD COLUMN IF NOT EXISTS category_type TEXT DEFAULT 'main' CHECK (category_type IN ('main', 'subcategory', 'style'));

-- Crear índices para consultas jerárquicas
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_gender ON categories(gender_id);
CREATE INDEX IF NOT EXISTS idx_categories_level ON categories(level);

COMMENT ON COLUMN categories.parent_id IS 'ID de la categoría padre para navegación jerárquica';
COMMENT ON COLUMN categories.gender_id IS 'Género al que pertenece esta categoría';
COMMENT ON COLUMN categories.level IS 'Nivel jerárquico: 1=principal, 2=subcategoría, 3=estilo';

-- ============================================================================
-- TABLA: product_variants (Variantes de Producto)
-- ============================================================================
CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku TEXT UNIQUE NOT NULL, -- 'CAM-H-001-M-NEG'
  color_id UUID REFERENCES colors(id) ON DELETE SET NULL,
  size TEXT NOT NULL, -- 'S', 'M', 'L', 'XL', '38', '40', '42'
  
  -- Stock y precio por variante
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  price_adjustment INTEGER DEFAULT 0, -- Ajuste al precio base en céntimos
  
  -- Imágenes específicas de esta variante (opcional)
  images TEXT[] DEFAULT '{}',
  
  -- Control
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_variants_color ON product_variants(color_id);
CREATE INDEX IF NOT EXISTS idx_variants_size ON product_variants(size);
CREATE INDEX IF NOT EXISTS idx_variants_sku ON product_variants(sku);
CREATE INDEX IF NOT EXISTS idx_variants_stock ON product_variants(stock);
CREATE INDEX IF NOT EXISTS idx_variants_active ON product_variants(is_active);

COMMENT ON TABLE product_variants IS 'Variantes de productos con stock real por talla y color';
COMMENT ON COLUMN product_variants.price_adjustment IS 'Ajuste de precio para esta variante (ej: +200 céntimos para tallas grandes)';

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_product_variants_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_product_variants_updated_at ON product_variants;
CREATE TRIGGER trigger_product_variants_updated_at
  BEFORE UPDATE ON product_variants
  FOR EACH ROW
  EXECUTE FUNCTION update_product_variants_updated_at();

-- ============================================================================
-- AMPLIACIÓN: products → Producto Base
-- ============================================================================

-- Agregar columnas para filtros y búsqueda
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS gender_id UUID REFERENCES genders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS color_ids UUID[] DEFAULT '{}', -- IDs de colores disponibles
  ADD COLUMN IF NOT EXISTS available_sizes TEXT[] DEFAULT '{}', -- Tallas disponibles
  ADD COLUMN IF NOT EXISTS material TEXT, -- 'Algodón 100%', 'Poliéster'
  ADD COLUMN IF NOT EXISTS care_instructions TEXT, -- 'Lavar a 30°C'
  ADD COLUMN IF NOT EXISTS is_new BOOLEAN DEFAULT false, -- Novedades
  ADD COLUMN IF NOT EXISTS is_on_sale BOOLEAN DEFAULT false, -- En oferta
  ADD COLUMN IF NOT EXISTS sale_price INTEGER CHECK (sale_price >= 0), -- Precio rebajado
  ADD COLUMN IF NOT EXISTS popularity_score INTEGER DEFAULT 0, -- Para ordenar por popularidad
  ADD COLUMN IF NOT EXISTS sales_count INTEGER DEFAULT 0; -- Total vendidos

-- Crear índices para filtros y búsqueda
CREATE INDEX IF NOT EXISTS idx_products_gender ON products(gender_id);
CREATE INDEX IF NOT EXISTS idx_products_new ON products(is_new);
CREATE INDEX IF NOT EXISTS idx_products_sale ON products(is_on_sale);
CREATE INDEX IF NOT EXISTS idx_products_popularity ON products(popularity_score DESC);
CREATE INDEX IF NOT EXISTS idx_products_sales ON products(sales_count DESC);

-- Índice full-text search en PostgreSQL
DROP INDEX IF EXISTS idx_products_search;
CREATE INDEX idx_products_search ON products 
  USING GIN (to_tsvector('spanish', name || ' ' || COALESCE(description, '')));

COMMENT ON COLUMN products.gender_id IS 'Género al que pertenece el producto';
COMMENT ON COLUMN products.color_ids IS 'Array de IDs de colores disponibles para este producto';
COMMENT ON COLUMN products.available_sizes IS 'Array de tallas disponibles (S, M, L, XL, etc.)';
COMMENT ON COLUMN products.popularity_score IS 'Score de popularidad calculado (vistas + ventas + favoritos)';

-- ============================================================================
-- TABLA: product_categories (Relación Muchos a Muchos)
-- ============================================================================
CREATE TABLE IF NOT EXISTS product_categories (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (product_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_product_categories_product ON product_categories(product_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_category ON product_categories(category_id);

COMMENT ON TABLE product_categories IS 'Relación muchos a muchos: un producto puede estar en múltiples categorías';

-- ============================================================================
-- FUNCIÓN: search_products (Búsqueda Avanzada)
-- ============================================================================

-- Eliminar versiones anteriores de la función
DROP FUNCTION IF EXISTS search_products(TEXT, UUID, UUID, INTEGER, INTEGER, UUID[], TEXT[], BOOLEAN, BOOLEAN, BOOLEAN, TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS search_products;

CREATE OR REPLACE FUNCTION search_products(
  search_query TEXT DEFAULT NULL,
  gender_filter UUID DEFAULT NULL,
  category_filter UUID DEFAULT NULL,
  min_price INTEGER DEFAULT NULL,
  max_price INTEGER DEFAULT NULL,
  colors_filter UUID[] DEFAULT NULL,
  sizes_filter TEXT[] DEFAULT NULL,
  only_in_stock BOOLEAN DEFAULT false,
  only_new BOOLEAN DEFAULT false,
  only_on_sale BOOLEAN DEFAULT false,
  sort_by TEXT DEFAULT 'relevance', -- 'relevance', 'price_asc', 'price_desc', 'popularity', 'newest'
  page_number INTEGER DEFAULT 1,
  page_size INTEGER DEFAULT 24
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  description TEXT,
  price INTEGER,
  sale_price INTEGER,
  images TEXT[],
  category_id UUID,
  category_name TEXT,
  gender_id UUID,
  gender_name TEXT,
  is_new BOOLEAN,
  is_on_sale BOOLEAN,
  available_sizes TEXT[],
  color_ids UUID[],
  featured BOOLEAN,
  relevance_score REAL,
  total_count BIGINT
) AS $$
DECLARE
  offset_value INTEGER;
BEGIN
  offset_value := (page_number - 1) * page_size;
  
  RETURN QUERY
  WITH filtered_products AS (
    SELECT DISTINCT
      p.id,
      p.name,
      p.slug,
      p.description,
      p.price,
      p.sale_price,
      p.images,
      p.category_id,
      c.name AS category_name,
      p.gender_id,
      g.name AS gender_name,
      p.is_new,
      p.is_on_sale,
      p.available_sizes,
      p.color_ids,
      p.featured,
      -- Calcular relevancia solo si hay query de búsqueda
      CASE 
        WHEN search_query IS NOT NULL THEN
          ts_rank(
            to_tsvector('spanish', p.name || ' ' || COALESCE(p.description, '')),
            plainto_tsquery('spanish', search_query)
          )
        ELSE 0
      END AS relevance_score
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN genders g ON p.gender_id = g.id
    LEFT JOIN product_variants pv ON p.id = pv.product_id
    WHERE
      p.is_active = true
      -- Búsqueda por texto
      AND (
        search_query IS NULL 
        OR to_tsvector('spanish', p.name || ' ' || COALESCE(p.description, '')) 
           @@ plainto_tsquery('spanish', search_query)
        OR p.name ILIKE '%' || search_query || '%'
        OR c.name ILIKE '%' || search_query || '%'
        OR g.name ILIKE '%' || search_query || '%'
      )
      -- Filtros
      AND (gender_filter IS NULL OR p.gender_id = gender_filter)
      AND (category_filter IS NULL OR p.category_id = category_filter)
      AND (min_price IS NULL OR COALESCE(p.sale_price, p.price) >= min_price)
      AND (max_price IS NULL OR COALESCE(p.sale_price, p.price) <= max_price)
      AND (only_in_stock = false OR EXISTS (
        SELECT 1 FROM product_variants pv2 
        WHERE pv2.product_id = p.id AND pv2.stock > 0 AND pv2.is_active = true
      ))
      AND (only_new = false OR p.is_new = true)
      AND (only_on_sale = false OR p.is_on_sale = true)
      AND (colors_filter IS NULL OR p.color_ids && colors_filter)
      AND (sizes_filter IS NULL OR p.available_sizes && sizes_filter)
  ),
  total AS (
    SELECT COUNT(*) AS total_count FROM filtered_products
  )
  SELECT 
    fp.*,
    t.total_count
  FROM filtered_products fp
  CROSS JOIN total t
  ORDER BY
    CASE WHEN sort_by = 'relevance' AND search_query IS NOT NULL THEN fp.relevance_score END DESC,
    CASE WHEN sort_by = 'price_asc' THEN COALESCE(fp.sale_price, fp.price) END ASC,
    CASE WHEN sort_by = 'price_desc' THEN COALESCE(fp.sale_price, fp.price) END DESC,
    CASE WHEN sort_by = 'popularity' THEN fp.featured END DESC,
    CASE WHEN sort_by = 'newest' THEN fp.id END DESC,
    fp.name ASC
  LIMIT page_size
  OFFSET offset_value;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION search_products IS 'Búsqueda avanzada de productos con filtros combinables y paginación';

-- ============================================================================
-- FUNCIÓN: autocomplete_search (Autocompletado)
-- ============================================================================

-- Eliminar versiones anteriores de la función
DROP FUNCTION IF EXISTS autocomplete_search(TEXT, INTEGER);
DROP FUNCTION IF EXISTS autocomplete_search;

CREATE OR REPLACE FUNCTION autocomplete_search(
  search_query TEXT,
  limit_results INTEGER DEFAULT 5
)
RETURNS TABLE (
  type TEXT, -- 'product', 'category', 'gender'
  id UUID,
  name TEXT,
  slug TEXT,
  image TEXT,
  additional_info TEXT
) AS $$
BEGIN
  RETURN QUERY
  -- Productos
  (
    SELECT 
      'product'::TEXT AS type,
      p.id,
      p.name,
      p.slug,
      CASE WHEN array_length(p.images, 1) > 0 THEN p.images[1] ELSE NULL END AS image,
      ('€' || (p.price / 100.0)::TEXT)::TEXT AS additional_info
    FROM products p
    WHERE 
      p.is_active = true
      AND (
        p.name ILIKE search_query || '%'
        OR to_tsvector('spanish', p.name) @@ plainto_tsquery('spanish', search_query)
      )
    ORDER BY p.popularity_score DESC, p.name ASC
    LIMIT limit_results
  )
  UNION ALL
  -- Categorías
  (
    SELECT 
      'category'::TEXT AS type,
      c.id,
      c.name,
      c.slug,
      c.image_url AS image,
      ('Categoría')::TEXT AS additional_info
    FROM categories c
    WHERE 
      c.is_active = true
      AND c.name ILIKE search_query || '%'
    ORDER BY c.display_order ASC
    LIMIT 3
  )
  UNION ALL
  -- Géneros
  (
    SELECT 
      'gender'::TEXT AS type,
      g.id,
      g.name,
      g.slug,
      NULL::TEXT AS image,
      ('Género')::TEXT AS additional_info
    FROM genders g
    WHERE 
      g.is_active = true
      AND g.name ILIKE search_query || '%'
    LIMIT 2
  );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION autocomplete_search IS 'Autocompletado rápido para barra de búsqueda';

-- ============================================================================
-- FUNCIÓN: get_category_tree (Árbol de Categorías)
-- ============================================================================

-- Eliminar versiones anteriores de la función
DROP FUNCTION IF EXISTS get_category_tree(UUID);
DROP FUNCTION IF EXISTS get_category_tree;

CREATE OR REPLACE FUNCTION get_category_tree(
  gender_filter UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  parent_id UUID,
  gender_id UUID,
  level INTEGER,
  product_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.slug,
    c.parent_id,
    c.gender_id,
    c.level,
    COUNT(p.id) AS product_count
  FROM categories c
  LEFT JOIN products p ON p.category_id = c.id AND p.is_active = true
  WHERE 
    c.is_active = true
    AND (gender_filter IS NULL OR c.gender_id = gender_filter)
  GROUP BY c.id, c.name, c.slug, c.parent_id, c.gender_id, c.level
  ORDER BY c.level ASC, c.display_order ASC, c.name ASC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_category_tree IS 'Obtener árbol de categorías con contador de productos';

-- ============================================================================
-- FUNCIÓN: get_available_filters (Filtros Disponibles)
-- ============================================================================

-- Eliminar versiones anteriores de la función
DROP FUNCTION IF EXISTS get_available_filters(UUID, UUID);
DROP FUNCTION IF EXISTS get_available_filters;

CREATE OR REPLACE FUNCTION get_available_filters(
  gender_filter UUID DEFAULT NULL,
  category_filter UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'sizes', (
      SELECT json_agg(DISTINCT size ORDER BY size)
      FROM (
        SELECT unnest(p.available_sizes) AS size
        FROM products p
        WHERE 
          p.is_active = true
          AND (gender_filter IS NULL OR p.gender_id = gender_filter)
          AND (category_filter IS NULL OR p.category_id = category_filter)
      ) sizes
    ),
    'colors', (
      SELECT json_agg(json_build_object(
        'id', c.id,
        'name', c.name,
        'slug', c.slug,
        'hex_code', c.hex_code
      ) ORDER BY c.display_order)
      FROM colors c
      WHERE c.is_active = true
      AND EXISTS (
        SELECT 1 FROM products p
        WHERE p.is_active = true
        AND c.id = ANY(p.color_ids)
        AND (gender_filter IS NULL OR p.gender_id = gender_filter)
        AND (category_filter IS NULL OR p.category_id = category_filter)
      )
    ),
    'priceRange', (
      SELECT json_build_object(
        'min', MIN(COALESCE(sale_price, price)),
        'max', MAX(COALESCE(sale_price, price))
      )
      FROM products p
      WHERE 
        p.is_active = true
        AND (gender_filter IS NULL OR p.gender_id = gender_filter)
        AND (category_filter IS NULL OR p.category_id = category_filter)
    ),
    'categories', (
      SELECT json_agg(json_build_object(
        'id', c.id,
        'name', c.name,
        'slug', c.slug,
        'productCount', COUNT(p.id)
      ) ORDER BY c.display_order)
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id AND p.is_active = true
      WHERE 
        c.is_active = true
        AND (gender_filter IS NULL OR c.gender_id = gender_filter)
      GROUP BY c.id, c.name, c.slug, c.display_order
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_available_filters IS 'Obtener filtros disponibles para una búsqueda';

-- ============================================================================
-- RLS POLICIES (Row Level Security)
-- ============================================================================

-- Géneros: Lectura pública
ALTER TABLE genders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Géneros visibles públicamente" ON genders;
CREATE POLICY "Géneros visibles públicamente"
  ON genders FOR SELECT
  USING (is_active = true);

-- Colores: Lectura pública
ALTER TABLE colors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Colores visibles públicamente" ON colors;
CREATE POLICY "Colores visibles públicamente"
  ON colors FOR SELECT
  USING (is_active = true);

-- Variantes: Lectura pública, escritura solo admin
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Variantes visibles públicamente" ON product_variants;
CREATE POLICY "Variantes visibles públicamente"
  ON product_variants FOR SELECT
  USING (is_active = true);

-- Product Categories: Lectura pública
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Relaciones producto-categoría visibles públicamente" ON product_categories;
CREATE POLICY "Relaciones producto-categoría visibles públicamente"
  ON product_categories FOR SELECT
  USING (true);

-- ============================================================================
-- DATOS INICIALES: Categorías para Hombre y Mujer
-- ============================================================================

-- Obtener IDs de géneros
DO $$
DECLARE
  hombre_id UUID;
  mujer_id UUID;
  unisex_id UUID;
BEGIN
  SELECT id INTO hombre_id FROM genders WHERE slug = 'hombre';
  SELECT id INTO mujer_id FROM genders WHERE slug = 'mujer';
  SELECT id INTO unisex_id FROM genders WHERE slug = 'unisex';

  -- CATEGORÍAS HOMBRE
  INSERT INTO categories (name, slug, gender_id, level, category_type, display_order) VALUES
    ('Camisetas Hombre', 'camisetas-hombre', hombre_id, 1, 'main', 1),
    ('Camisas Hombre', 'camisas-hombre', hombre_id, 1, 'main', 2),
    ('Sudaderas Hombre', 'sudaderas-hombre', hombre_id, 1, 'main', 3),
    ('Pantalones Hombre', 'pantalones-hombre', hombre_id, 1, 'main', 4),
    ('Chaquetas Hombre', 'chaquetas-hombre', hombre_id, 1, 'main', 5),
    ('Abrigos Hombre', 'abrigos-hombre', hombre_id, 1, 'main', 6),
    ('Trajes Hombre', 'trajes-hombre', hombre_id, 1, 'main', 7),
    ('Accesorios Hombre', 'accesorios-hombre', hombre_id, 1, 'main', 8)
  ON CONFLICT (slug) DO NOTHING;

  -- CATEGORÍAS MUJER
  INSERT INTO categories (name, slug, gender_id, level, category_type, display_order) VALUES
    ('Camisetas Mujer', 'camisetas-mujer', mujer_id, 1, 'main', 1),
    ('Camisas Mujer', 'camisas-mujer', mujer_id, 1, 'main', 2),
    ('Sudaderas Mujer', 'sudaderas-mujer', mujer_id, 1, 'main', 3),
    ('Pantalones Mujer', 'pantalones-mujer', mujer_id, 1, 'main', 4),
    ('Vestidos', 'vestidos', mujer_id, 1, 'main', 5),
    ('Faldas', 'faldas', mujer_id, 1, 'main', 6),
    ('Chaquetas Mujer', 'chaquetas-mujer', mujer_id, 1, 'main', 7),
    ('Abrigos Mujer', 'abrigos-mujer', mujer_id, 1, 'main', 8),
    ('Accesorios Mujer', 'accesorios-mujer', mujer_id, 1, 'main', 9)
  ON CONFLICT (slug) DO NOTHING;

END $$;

-- ============================================================================
-- FINALIZACIÓN
-- ============================================================================

-- Actualizar estadísticas para el optimizador de queries
ANALYZE genders;
ANALYZE colors;
ANALYZE categories;
ANALYZE products;
ANALYZE product_variants;
ANALYZE product_categories;

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migración completada exitosamente';
  RAISE NOTICE '📊 Tablas creadas: genders, colors, product_variants, product_categories';
  RAISE NOTICE '🔧 Funciones creadas: search_products, autocomplete_search, get_category_tree, get_available_filters';
  RAISE NOTICE '🎨 Géneros: %', (SELECT COUNT(*) FROM genders);
  RAISE NOTICE '🌈 Colores: %', (SELECT COUNT(*) FROM colors);
  RAISE NOTICE '📁 Categorías: %', (SELECT COUNT(*) FROM categories);
END $$;
