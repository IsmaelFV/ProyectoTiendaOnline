-- ============================================================================
-- CATEGORÍAS TIPO H&M - Estructura Jerárquica Realista
-- ============================================================================
-- PROPÓSITO: Crear una navegación de moda real similar a H&M
-- Estructura: Género → Secciones → Categorías → Subcategorías
-- ============================================================================

-- Limpiar categorías existentes para empezar limpio
DELETE FROM product_categories;
DELETE FROM categories;

-- Obtener IDs de géneros
DO $$
DECLARE
  mujer_id UUID;
  hombre_id UUID;
  unisex_id UUID;
  
  -- IDs de categorías (para referencias)
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
  SELECT id INTO unisex_id FROM genders WHERE slug = 'unisex';

  -- ============================================================================
  -- MUJER - NIVEL 1: SECCIONES DESTACADAS
  -- ============================================================================
  
  INSERT INTO categories (name, slug, gender_id, level, category_type, display_order, description) VALUES
    ('Rebajas Mujer', 'rebajas-mujer', mujer_id, 1, 'main', 1, 'Descuentos y ofertas especiales'),
    ('Novedades Mujer', 'novedades-mujer', mujer_id, 1, 'main', 2, 'Lo último en moda femenina');

  -- ============================================================================
  -- MUJER - NIVEL 2: CATEGORÍAS PRINCIPALES
  -- ============================================================================
  
  -- ROPA MUJER
  INSERT INTO categories (name, slug, gender_id, level, category_type, display_order, description)
  VALUES ('Ropa Mujer', 'ropa-mujer', mujer_id, 1, 'main', 3, 'Toda la ropa de mujer')
  RETURNING id INTO cat_ropa_mujer;
  
  -- Subcategorías de Ropa Mujer
  INSERT INTO categories (name, slug, parent_id, gender_id, level, category_type, display_order) VALUES
    ('Camisetas y Tops', 'camisetas-tops-mujer', cat_ropa_mujer, mujer_id, 2, 'subcategory', 1),
    ('Camisas y Blusas', 'camisas-blusas-mujer', cat_ropa_mujer, mujer_id, 2, 'subcategory', 2),
    ('Vestidos', 'vestidos', cat_ropa_mujer, mujer_id, 2, 'subcategory', 3),
    ('Faldas', 'faldas', cat_ropa_mujer, mujer_id, 2, 'subcategory', 4),
    ('Pantalones', 'pantalones-mujer', cat_ropa_mujer, mujer_id, 2, 'subcategory', 5),
    ('Jeans', 'jeans-mujer', cat_ropa_mujer, mujer_id, 2, 'subcategory', 6),
    ('Sudaderas', 'sudaderas-mujer', cat_ropa_mujer, mujer_id, 2, 'subcategory', 7),
    ('Chaquetas de Punto', 'chaquetas-punto-mujer', cat_ropa_mujer, mujer_id, 2, 'subcategory', 8),
    ('Abrigos y Chaquetas', 'abrigos-chaquetas-mujer', cat_ropa_mujer, mujer_id, 2, 'subcategory', 9),
    ('Blazers', 'blazers-mujer', cat_ropa_mujer, mujer_id, 2, 'subcategory', 10),
    ('Trajes', 'trajes-mujer', cat_ropa_mujer, mujer_id, 2, 'subcategory', 11),
    ('Ropa Interior', 'ropa-interior-mujer', cat_ropa_mujer, mujer_id, 2, 'subcategory', 12),
    ('Ropa de Dormir', 'ropa-dormir-mujer', cat_ropa_mujer, mujer_id, 2, 'subcategory', 13),
    ('Ropa de Baño', 'ropa-bano-mujer', cat_ropa_mujer, mujer_id, 2, 'subcategory', 14);
  
  -- ACCESORIOS MUJER
  INSERT INTO categories (name, slug, gender_id, level, category_type, display_order, description)
  VALUES ('Accesorios Mujer', 'accesorios-mujer', mujer_id, 1, 'main', 4, 'Complementos de moda')
  RETURNING id INTO cat_accesorios_mujer;
  
  INSERT INTO categories (name, slug, parent_id, gender_id, level, category_type, display_order) VALUES
    ('Bolsos', 'bolsos', cat_accesorios_mujer, mujer_id, 2, 'subcategory', 1),
    ('Joyas y Bisutería', 'joyas-bisuteria', cat_accesorios_mujer, mujer_id, 2, 'subcategory', 2),
    ('Cinturones', 'cinturones-mujer', cat_accesorios_mujer, mujer_id, 2, 'subcategory', 3),
    ('Bufandas y Pañuelos', 'bufandas-panuelos-mujer', cat_accesorios_mujer, mujer_id, 2, 'subcategory', 4),
    ('Gorros y Guantes', 'gorros-guantes-mujer', cat_accesorios_mujer, mujer_id, 2, 'subcategory', 5),
    ('Gafas de Sol', 'gafas-sol-mujer', cat_accesorios_mujer, mujer_id, 2, 'subcategory', 6);
  
  -- ZAPATOS MUJER
  INSERT INTO categories (name, slug, gender_id, level, category_type, display_order, description)
  VALUES ('Zapatos Mujer', 'zapatos-mujer', mujer_id, 1, 'main', 5, 'Calzado femenino')
  RETURNING id INTO cat_zapatos_mujer;
  
  INSERT INTO categories (name, slug, parent_id, gender_id, level, category_type, display_order) VALUES
    ('Zapatillas', 'zapatillas-mujer', cat_zapatos_mujer, mujer_id, 2, 'subcategory', 1),
    ('Botas', 'botas-mujer', cat_zapatos_mujer, mujer_id, 2, 'subcategory', 2),
    ('Botines', 'botines-mujer', cat_zapatos_mujer, mujer_id, 2, 'subcategory', 3),
    ('Sandalias', 'sandalias-mujer', cat_zapatos_mujer, mujer_id, 2, 'subcategory', 4),
    ('Tacones', 'tacones', cat_zapatos_mujer, mujer_id, 2, 'subcategory', 5),
    ('Zapatos Planos', 'zapatos-planos', cat_zapatos_mujer, mujer_id, 2, 'subcategory', 6);
  
  -- SPORT MUJER
  INSERT INTO categories (name, slug, gender_id, level, category_type, display_order, description)
  VALUES ('Sport Mujer', 'sport-mujer', mujer_id, 1, 'main', 6, 'Ropa deportiva')
  RETURNING id INTO cat_sport_mujer;
  
  INSERT INTO categories (name, slug, parent_id, gender_id, level, category_type, display_order) VALUES
    ('Tops Deportivos', 'tops-deportivos-mujer', cat_sport_mujer, mujer_id, 2, 'subcategory', 1),
    ('Sujetadores Deportivos', 'sujetadores-deportivos', cat_sport_mujer, mujer_id, 2, 'subcategory', 2),
    ('Leggings Deportivos', 'leggings-deportivos', cat_sport_mujer, mujer_id, 2, 'subcategory', 3),
    ('Sudaderas Deportivas', 'sudaderas-deportivas-mujer', cat_sport_mujer, mujer_id, 2, 'subcategory', 4),
    ('Chaquetas Deportivas', 'chaquetas-deportivas-mujer', cat_sport_mujer, mujer_id, 2, 'subcategory', 5);

  -- ============================================================================
  -- HOMBRE - NIVEL 1: SECCIONES DESTACADAS
  -- ============================================================================
  
  INSERT INTO categories (name, slug, gender_id, level, category_type, display_order, description) VALUES
    ('Rebajas Hombre', 'rebajas-hombre', hombre_id, 1, 'main', 1, 'Descuentos y ofertas especiales'),
    ('Novedades Hombre', 'novedades-hombre', hombre_id, 1, 'main', 2, 'Lo último en moda masculina');

  -- ============================================================================
  -- HOMBRE - NIVEL 2: CATEGORÍAS PRINCIPALES
  -- ============================================================================
  
  -- ROPA HOMBRE
  INSERT INTO categories (name, slug, gender_id, level, category_type, display_order, description)
  VALUES ('Ropa Hombre', 'ropa-hombre', hombre_id, 1, 'main', 3, 'Toda la ropa de hombre')
  RETURNING id INTO cat_ropa_hombre;
  
  -- Subcategorías de Ropa Hombre
  INSERT INTO categories (name, slug, parent_id, gender_id, level, category_type, display_order) VALUES
    ('Camisetas', 'camisetas-hombre', cat_ropa_hombre, hombre_id, 2, 'subcategory', 1),
    ('Camisas', 'camisas-hombre', cat_ropa_hombre, hombre_id, 2, 'subcategory', 2),
    ('Polos', 'polos-hombre', cat_ropa_hombre, hombre_id, 2, 'subcategory', 3),
    ('Sudaderas', 'sudaderas-hombre', cat_ropa_hombre, hombre_id, 2, 'subcategory', 4),
    ('Chaquetas de Punto', 'chaquetas-punto-hombre', cat_ropa_hombre, hombre_id, 2, 'subcategory', 5),
    ('Pantalones', 'pantalones-hombre', cat_ropa_hombre, hombre_id, 2, 'subcategory', 6),
    ('Jeans', 'jeans-hombre', cat_ropa_hombre, hombre_id, 2, 'subcategory', 7),
    ('Shorts', 'shorts-hombre', cat_ropa_hombre, hombre_id, 2, 'subcategory', 8),
    ('Trajes y Blazers', 'trajes-blazers-hombre', cat_ropa_hombre, hombre_id, 2, 'subcategory', 9),
    ('Abrigos y Chaquetas', 'abrigos-chaquetas-hombre', cat_ropa_hombre, hombre_id, 2, 'subcategory', 10),
    ('Ropa Interior', 'ropa-interior-hombre', cat_ropa_hombre, hombre_id, 2, 'subcategory', 11),
    ('Ropa de Dormir', 'ropa-dormir-hombre', cat_ropa_hombre, hombre_id, 2, 'subcategory', 12),
    ('Ropa de Baño', 'ropa-bano-hombre', cat_ropa_hombre, hombre_id, 2, 'subcategory', 13);
  
  -- ACCESORIOS HOMBRE
  INSERT INTO categories (name, slug, gender_id, level, category_type, display_order, description)
  VALUES ('Accesorios Hombre', 'accesorios-hombre', hombre_id, 1, 'main', 4, 'Complementos masculinos')
  RETURNING id INTO cat_accesorios_hombre;
  
  INSERT INTO categories (name, slug, parent_id, gender_id, level, category_type, display_order) VALUES
    ('Cinturones', 'cinturones-hombre', cat_accesorios_hombre, hombre_id, 2, 'subcategory', 1),
    ('Gorros y Guantes', 'gorros-guantes-hombre', cat_accesorios_hombre, hombre_id, 2, 'subcategory', 2),
    ('Bufandas', 'bufandas-hombre', cat_accesorios_hombre, hombre_id, 2, 'subcategory', 3),
    ('Gafas de Sol', 'gafas-sol-hombre', cat_accesorios_hombre, hombre_id, 2, 'subcategory', 4),
    ('Relojes', 'relojes-hombre', cat_accesorios_hombre, hombre_id, 2, 'subcategory', 5),
    ('Mochilas y Bolsas', 'mochilas-bolsas-hombre', cat_accesorios_hombre, hombre_id, 2, 'subcategory', 6);
  
  -- ZAPATOS HOMBRE
  INSERT INTO categories (name, slug, gender_id, level, category_type, display_order, description)
  VALUES ('Zapatos Hombre', 'zapatos-hombre', hombre_id, 1, 'main', 5, 'Calzado masculino')
  RETURNING id INTO cat_zapatos_hombre;
  
  INSERT INTO categories (name, slug, parent_id, gender_id, level, category_type, display_order) VALUES
    ('Zapatillas', 'zapatillas-hombre', cat_zapatos_hombre, hombre_id, 2, 'subcategory', 1),
    ('Botas', 'botas-hombre', cat_zapatos_hombre, hombre_id, 2, 'subcategory', 2),
    ('Zapatos Casual', 'zapatos-casual-hombre', cat_zapatos_hombre, hombre_id, 2, 'subcategory', 3),
    ('Zapatos Formal', 'zapatos-formal-hombre', cat_zapatos_hombre, hombre_id, 2, 'subcategory', 4),
    ('Sandalias', 'sandalias-hombre', cat_zapatos_hombre, hombre_id, 2, 'subcategory', 5);
  
  -- SPORT HOMBRE
  INSERT INTO categories (name, slug, gender_id, level, category_type, display_order, description)
  VALUES ('Sport Hombre', 'sport-hombre', hombre_id, 1, 'main', 6, 'Ropa deportiva')
  RETURNING id INTO cat_sport_hombre;
  
  INSERT INTO categories (name, slug, parent_id, gender_id, level, category_type, display_order) VALUES
    ('Camisetas Deportivas', 'camisetas-deportivas-hombre', cat_sport_hombre, hombre_id, 2, 'subcategory', 1),
    ('Pantalones Deportivos', 'pantalones-deportivos-hombre', cat_sport_hombre, hombre_id, 2, 'subcategory', 2),
    ('Sudaderas Deportivas', 'sudaderas-deportivas-hombre', cat_sport_hombre, hombre_id, 2, 'subcategory', 3),
    ('Chaquetas Deportivas', 'chaquetas-deportivas-hombre', cat_sport_hombre, hombre_id, 2, 'subcategory', 4),
    ('Shorts Deportivos', 'shorts-deportivos-hombre', cat_sport_hombre, hombre_id, 2, 'subcategory', 5);

END $$;

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

-- Ver estructura completa
SELECT 
  g.name AS genero,
  c.level,
  c.name AS categoria,
  c.slug,
  parent.name AS categoria_padre,
  c.display_order
FROM categories c
LEFT JOIN genders g ON c.gender_id = g.id
LEFT JOIN categories parent ON c.parent_id = parent.id
ORDER BY g.display_order, c.level, c.display_order;

-- Contadores
DO $$
BEGIN
  RAISE NOTICE '✅ Migración completada';
  RAISE NOTICE '📊 Categorías totales: %', (SELECT COUNT(*) FROM categories);
  RAISE NOTICE '👩 Categorías Mujer: %', (SELECT COUNT(*) FROM categories WHERE gender_id = (SELECT id FROM genders WHERE slug = 'mujer'));
  RAISE NOTICE '👨 Categorías Hombre: %', (SELECT COUNT(*) FROM categories WHERE gender_id = (SELECT id FROM genders WHERE slug = 'hombre'));
  RAISE NOTICE '📁 Nivel 1: %', (SELECT COUNT(*) FROM categories WHERE level = 1);
  RAISE NOTICE '📂 Nivel 2: %', (SELECT COUNT(*) FROM categories WHERE level = 2);
END $$;
