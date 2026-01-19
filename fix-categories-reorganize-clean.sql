-- ============================================================================
-- FIX DEFINITIVO: Reorganizar categorías - LIMPIEZA COMPLETA
-- ============================================================================
-- Este script elimina las categorías problemáticas y las recrea correctamente

-- 1. ELIMINAR categorías sueltas problemáticas que deberían estar dentro de Ropa
DELETE FROM categories 
WHERE slug IN (
  'camisetas-mujer', 'camisas-mujer', 'polos-mujer',
  'vestidos-mujer', 'pantalones-mujer', 'jeans-mujer', 
  'faldas-mujer', 'abrigos-mujer', 'chaquetas-mujer', 'sudaderas-mujer',
  'camisetas-hombre', 'camisas-hombre', 'polos-hombre',
  'pantalones-hombre', 'jeans-hombre', 'abrigos-hombre', 
  'chaquetas-hombre', 'sudaderas-hombre'
);

-- 2. ASEGURAR que existe "Ropa Mujer" como categoría principal
DO $$
DECLARE
  mujer_id UUID;
  cat_ropa_mujer UUID;
BEGIN
  -- Obtener ID de género mujer
  SELECT id INTO mujer_id FROM genders WHERE slug = 'mujer';
  
  -- Eliminar "Ropa Mujer" si existe y recrearla
  DELETE FROM categories WHERE slug = 'ropa-mujer';
  
  -- Crear "Ropa Mujer" como categoría principal
  INSERT INTO categories (name, slug, gender_id, parent_id, level, category_type, display_order, description, is_active)
  VALUES ('Ropa', 'ropa-mujer', mujer_id, NULL, 1, 'main', 3, 'Ropa de mujer', true)
  RETURNING id INTO cat_ropa_mujer;
  
  RAISE NOTICE 'Creado Ropa Mujer con ID: %', cat_ropa_mujer;
  
  -- Crear TODAS las subcategorías dentro de Ropa Mujer
  INSERT INTO categories (name, slug, parent_id, gender_id, level, category_type, display_order, is_active) VALUES
    ('Camisetas', 'camisetas-mujer', cat_ropa_mujer, mujer_id, 2, 'subcategory', 1, true),
    ('Camisas', 'camisas-mujer', cat_ropa_mujer, mujer_id, 2, 'subcategory', 2, true),
    ('Vestidos', 'vestidos-mujer', cat_ropa_mujer, mujer_id, 2, 'subcategory', 3, true),
    ('Pantalones', 'pantalones-mujer', cat_ropa_mujer, mujer_id, 2, 'subcategory', 4, true),
    ('Jeans', 'jeans-mujer', cat_ropa_mujer, mujer_id, 2, 'subcategory', 5, true),
    ('Faldas', 'faldas-mujer', cat_ropa_mujer, mujer_id, 2, 'subcategory', 6, true),
    ('Abrigos', 'abrigos-mujer', cat_ropa_mujer, mujer_id, 2, 'subcategory', 7, true),
    ('Chaquetas', 'chaquetas-mujer', cat_ropa_mujer, mujer_id, 2, 'subcategory', 8, true),
    ('Sudaderas', 'sudaderas-mujer', cat_ropa_mujer, mujer_id, 2, 'subcategory', 9, true);
    
  RAISE NOTICE 'Creadas 9 subcategorías para Ropa Mujer';
END $$;

-- 3. ASEGURAR que existe "Ropa Hombre" como categoría principal
DO $$
DECLARE
  hombre_id UUID;
  cat_ropa_hombre UUID;
BEGIN
  -- Obtener ID de género hombre
  SELECT id INTO hombre_id FROM genders WHERE slug = 'hombre';
  
  -- Eliminar "Ropa Hombre" si existe y recrearla
  DELETE FROM categories WHERE slug = 'ropa-hombre';
  
  -- Crear "Ropa Hombre" como categoría principal
  INSERT INTO categories (name, slug, gender_id, parent_id, level, category_type, display_order, description, is_active)
  VALUES ('Ropa', 'ropa-hombre', hombre_id, NULL, 1, 'main', 3, 'Ropa de hombre', true)
  RETURNING id INTO cat_ropa_hombre;
  
  RAISE NOTICE 'Creado Ropa Hombre con ID: %', cat_ropa_hombre;
  
  -- Crear TODAS las subcategorías dentro de Ropa Hombre
  INSERT INTO categories (name, slug, parent_id, gender_id, level, category_type, display_order, is_active) VALUES
    ('Camisetas', 'camisetas-hombre', cat_ropa_hombre, hombre_id, 2, 'subcategory', 1, true),
    ('Camisas', 'camisas-hombre', cat_ropa_hombre, hombre_id, 2, 'subcategory', 2, true),
    ('Polos', 'polos-hombre', cat_ropa_hombre, hombre_id, 2, 'subcategory', 3, true),
    ('Pantalones', 'pantalones-hombre', cat_ropa_hombre, hombre_id, 2, 'subcategory', 4, true),
    ('Jeans', 'jeans-hombre', cat_ropa_hombre, hombre_id, 2, 'subcategory', 5, true),
    ('Abrigos', 'abrigos-hombre', cat_ropa_hombre, hombre_id, 2, 'subcategory', 6, true),
    ('Chaquetas', 'chaquetas-hombre', cat_ropa_hombre, hombre_id, 2, 'subcategory', 7, true),
    ('Sudaderas', 'sudaderas-hombre', cat_ropa_hombre, hombre_id, 2, 'subcategory', 8, true);
    
  RAISE NOTICE 'Creadas 8 subcategorías para Ropa Hombre';
END $$;

-- 4. Verificar la jerarquía resultante
SELECT 
  c.name,
  c.slug,
  c.level,
  g.name as gender,
  CASE WHEN c.parent_id IS NULL THEN '(PRINCIPAL)' ELSE p.name END as parent_category
FROM categories c
LEFT JOIN genders g ON c.gender_id = g.id
LEFT JOIN categories p ON c.parent_id = p.id
WHERE c.is_active = true
ORDER BY g.name, c.level, c.display_order;
