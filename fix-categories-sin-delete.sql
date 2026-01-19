-- ============================================================================
-- FIX CORRECTO: Solo UPDATE, SIN DELETE - Mantener IDs originales
-- ============================================================================

-- MUJER: Asegurar que existe "Ropa Mujer" y mover subcategorías
DO $$
DECLARE
  mujer_id UUID;
  cat_ropa_mujer UUID;
BEGIN
  SELECT id INTO mujer_id FROM genders WHERE slug = 'mujer';
  
  -- Buscar o crear "Ropa Mujer"
  SELECT id INTO cat_ropa_mujer FROM categories 
  WHERE slug = 'ropa-mujer' AND gender_id = mujer_id;
  
  IF cat_ropa_mujer IS NULL THEN
    INSERT INTO categories (name, slug, gender_id, parent_id, level, category_type, display_order, is_active)
    VALUES ('Ropa', 'ropa-mujer', mujer_id, NULL, 1, 'main', 3, true)
    RETURNING id INTO cat_ropa_mujer;
  ELSE
    -- Asegurar que Ropa Mujer es categoría principal
    UPDATE categories 
    SET parent_id = NULL, level = 1, category_type = 'main'
    WHERE id = cat_ropa_mujer;
  END IF;
  
  -- ACTUALIZAR (no eliminar) las categorías existentes para que sean hijas de Ropa
  UPDATE categories 
  SET parent_id = cat_ropa_mujer, level = 2, category_type = 'subcategory'
  WHERE slug IN ('camisetas-mujer', 'camisas-mujer', 'polos-mujer')
    AND gender_id = mujer_id;
  
  -- INSERTAR solo las que NO existen
  INSERT INTO categories (name, slug, parent_id, gender_id, level, category_type, display_order, is_active) 
  SELECT 'Vestidos', 'vestidos-mujer', cat_ropa_mujer, mujer_id, 2, 'subcategory', 3, true
  WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'vestidos-mujer');
  
  INSERT INTO categories (name, slug, parent_id, gender_id, level, category_type, display_order, is_active)
  SELECT 'Pantalones', 'pantalones-mujer', cat_ropa_mujer, mujer_id, 2, 'subcategory', 4, true
  WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'pantalones-mujer');
  
  INSERT INTO categories (name, slug, parent_id, gender_id, level, category_type, display_order, is_active)
  SELECT 'Jeans', 'jeans-mujer', cat_ropa_mujer, mujer_id, 2, 'subcategory', 5, true
  WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'jeans-mujer');
  
  INSERT INTO categories (name, slug, parent_id, gender_id, level, category_type, display_order, is_active)
  SELECT 'Faldas', 'faldas-mujer', cat_ropa_mujer, mujer_id, 2, 'subcategory', 6, true
  WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'faldas-mujer');
  
  INSERT INTO categories (name, slug, parent_id, gender_id, level, category_type, display_order, is_active)
  SELECT 'Abrigos', 'abrigos-mujer', cat_ropa_mujer, mujer_id, 2, 'subcategory', 7, true
  WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'abrigos-mujer');
  
  INSERT INTO categories (name, slug, parent_id, gender_id, level, category_type, display_order, is_active)
  SELECT 'Chaquetas', 'chaquetas-mujer', cat_ropa_mujer, mujer_id, 2, 'subcategory', 8, true
  WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'chaquetas-mujer');
  
  INSERT INTO categories (name, slug, parent_id, gender_id, level, category_type, display_order, is_active)
  SELECT 'Sudaderas', 'sudaderas-mujer', cat_ropa_mujer, mujer_id, 2, 'subcategory', 9, true
  WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'sudaderas-mujer');
  
END $$;

-- HOMBRE: Asegurar que existe "Ropa Hombre" y mover subcategorías
DO $$
DECLARE
  hombre_id UUID;
  cat_ropa_hombre UUID;
BEGIN
  SELECT id INTO hombre_id FROM genders WHERE slug = 'hombre';
  
  -- Buscar o crear "Ropa Hombre"
  SELECT id INTO cat_ropa_hombre FROM categories 
  WHERE slug = 'ropa-hombre' AND gender_id = hombre_id;
  
  IF cat_ropa_hombre IS NULL THEN
    INSERT INTO categories (name, slug, gender_id, parent_id, level, category_type, display_order, is_active)
    VALUES ('Ropa', 'ropa-hombre', hombre_id, NULL, 1, 'main', 3, true)
    RETURNING id INTO cat_ropa_hombre;
  ELSE
    -- Asegurar que Ropa Hombre es categoría principal
    UPDATE categories 
    SET parent_id = NULL, level = 1, category_type = 'main'
    WHERE id = cat_ropa_hombre;
  END IF;
  
  -- ACTUALIZAR (no eliminar) las categorías existentes
  UPDATE categories 
  SET parent_id = cat_ropa_hombre, level = 2, category_type = 'subcategory'
  WHERE slug IN ('camisetas-hombre', 'camisas-hombre', 'polos-hombre')
    AND gender_id = hombre_id;
  
  -- INSERTAR solo las que NO existen
  INSERT INTO categories (name, slug, parent_id, gender_id, level, category_type, display_order, is_active)
  SELECT 'Pantalones', 'pantalones-hombre', cat_ropa_hombre, hombre_id, 2, 'subcategory', 4, true
  WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'pantalones-hombre');
  
  INSERT INTO categories (name, slug, parent_id, gender_id, level, category_type, display_order, is_active)
  SELECT 'Jeans', 'jeans-hombre', cat_ropa_hombre, hombre_id, 2, 'subcategory', 5, true
  WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'jeans-hombre');
  
  INSERT INTO categories (name, slug, parent_id, gender_id, level, category_type, display_order, is_active)
  SELECT 'Abrigos', 'abrigos-hombre', cat_ropa_hombre, hombre_id, 2, 'subcategory', 6, true
  WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'abrigos-hombre');
  
  INSERT INTO categories (name, slug, parent_id, gender_id, level, category_type, display_order, is_active)
  SELECT 'Chaquetas', 'chaquetas-hombre', cat_ropa_hombre, hombre_id, 2, 'subcategory', 7, true
  WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'chaquetas-hombre');
  
  INSERT INTO categories (name, slug, parent_id, gender_id, level, category_type, display_order, is_active)
  SELECT 'Sudaderas', 'sudaderas-hombre', cat_ropa_hombre, hombre_id, 2, 'subcategory', 8, true
  WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'sudaderas-hombre');
  
END $$;

-- Verificar
SELECT 
  c.name,
  c.slug,
  c.level,
  COUNT(p.id) as num_productos
FROM categories c
LEFT JOIN products p ON p.category_id = c.id
WHERE c.is_active = true
GROUP BY c.id, c.name, c.slug, c.level
ORDER BY c.level, c.display_order;
