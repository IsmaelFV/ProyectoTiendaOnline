-- ============================================================================
-- FIX: Reorganizar jerarquía de categorías (VERSIÓN AGRESIVA)
-- ============================================================================
-- Este script mueve las categorías sueltas dentro de "Ropa"

-- 1. Mover categorías sueltas dentro de "Ropa Mujer"
DO $$
DECLARE
  mujer_id UUID;
  cat_ropa_mujer UUID;
BEGIN
  -- Obtener ID de género mujer
  SELECT id INTO mujer_id FROM genders WHERE slug = 'mujer';
  
  -- Obtener o crear "Ropa Mujer"
  SELECT id INTO cat_ropa_mujer FROM categories 
  WHERE slug = 'ropa-mujer' AND parent_id IS NULL;
  
  IF cat_ropa_mujer IS NULL THEN
    INSERT INTO categories (name, slug, gender_id, level, category_type, display_order, description, is_active)
    VALUES ('Ropa Mujer', 'ropa-mujer', mujer_id, 1, 'main', 3, 'Toda la ropa de mujer', true)
    RETURNING id INTO cat_ropa_mujer;
  END IF;
  
  -- Actualizar categorías existentes para que sean hijas de "Ropa Mujer"
  UPDATE categories 
  SET parent_id = cat_ropa_mujer, level = 2
  WHERE slug IN ('camisetas-mujer', 'camisas-mujer') 
    AND parent_id IS NULL;
  
  -- Insertar categorías que faltan dentro de Ropa Mujer
  INSERT INTO categories (name, slug, parent_id, gender_id, level, category_type, display_order, is_active) VALUES
    ('Vestidos', 'vestidos-mujer', cat_ropa_mujer, mujer_id, 2, 'subcategory', 3, true),
    ('Pantalones', 'pantalones-mujer', cat_ropa_mujer, mujer_id, 2, 'subcategory', 4, true),
    ('Jeans', 'jeans-mujer', cat_ropa_mujer, mujer_id, 2, 'subcategory', 5, true),
    ('Faldas', 'faldas-mujer', cat_ropa_mujer, mujer_id, 2, 'subcategory', 6, true),
    ('Abrigos', 'abrigos-mujer', cat_ropa_mujer, mujer_id, 2, 'subcategory', 7, true),
    ('Chaquetas', 'chaquetas-mujer', cat_ropa_mujer, mujer_id, 2, 'subcategory', 8, true),
    ('Sudaderas', 'sudaderas-mujer', cat_ropa_mujer, mujer_id, 2, 'subcategory', 9, true)
  ON CONFLICT (slug) DO UPDATE SET
    parent_id = EXCLUDED.parent_id,
    level = EXCLUDED.level;
    
END $$;

-- 2. Mover categorías sueltas dentro de "Ropa Hombre"
DO $$
DECLARE
  hombre_id UUID;
  cat_ropa_hombre UUID;
BEGIN
  -- Obtener ID de género hombre
  SELECT id INTO hombre_id FROM genders WHERE slug = 'hombre';
  
  -- Obtener o crear "Ropa Hombre"
  SELECT id INTO cat_ropa_hombre FROM categories 
  WHERE slug = 'ropa-hombre' AND parent_id IS NULL;
  
  IF cat_ropa_hombre IS NULL THEN
    INSERT INTO categories (name, slug, gender_id, level, category_type, display_order, description, is_active)
    VALUES ('Ropa Hombre', 'ropa-hombre', hombre_id, 1, 'main', 3, 'Toda la ropa de hombre', true)
    RETURNING id INTO cat_ropa_hombre;
  END IF;
  
  -- Actualizar categorías existentes para que sean hijas de "Ropa Hombre"
  UPDATE categories 
  SET parent_id = cat_ropa_hombre, level = 2
  WHERE slug IN ('camisetas-hombre', 'camisas-hombre', 'polos-hombre') 
    AND parent_id IS NULL;
    
  -- Insertar categorías que faltan dentro de Ropa Hombre
  INSERT INTO categories (name, slug, parent_id, gender_id, level, category_type, display_order, is_active) VALUES
    ('Pantalones', 'pantalones-hombre', cat_ropa_hombre, hombre_id, 2, 'subcategory', 4, true),
    ('Jeans', 'jeans-hombre', cat_ropa_hombre, hombre_id, 2, 'subcategory', 5, true),
    ('Abrigos', 'abrigos-hombre', cat_ropa_hombre, hombre_id, 2, 'subcategory', 6, true),
    ('Chaquetas', 'chaquetas-hombre', cat_ropa_hombre, hombre_id, 2, 'subcategory', 7, true),
    ('Sudaderas', 'sudaderas-hombre', cat_ropa_hombre, hombre_id, 2, 'subcategory', 8, true)
  ON CONFLICT (slug) DO UPDATE SET
    parent_id = EXCLUDED.parent_id,
    level = EXCLUDED.level;
    
END $$;

-- 3. Verificar la jerarquía resultante
SELECT 
  c.name,
  c.slug,
  c.level,
  g.name as gender,
  p.name as parent_category
FROM categories c
LEFT JOIN genders g ON c.gender_id = g.id
LEFT JOIN categories p ON c.parent_id = p.id
WHERE c.is_active = true
ORDER BY g.name, c.level, c.display_order;
