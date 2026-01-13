-- ============================================================================
-- DIAGNÓSTICO: Verificar estado de productos y tablas
-- ============================================================================

-- 1. Verificar si existen las tablas
SELECT 
  table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('products', 'categories', 'genders', 'colors', 'product_categories')
ORDER BY table_name;

-- 2. Verificar columnas de la tabla products
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'products'
ORDER BY ordinal_position;

-- 3. Contar productos en la base de datos
SELECT COUNT(*) AS total_productos FROM products;

-- 4. Ver productos existentes (si hay)
SELECT 
  id,
  name,
  slug,
  price,
  stock,
  featured,
  is_new,
  is_on_sale,
  created_at
FROM products
ORDER BY created_at DESC
LIMIT 10;

-- 5. Verificar géneros
SELECT * FROM genders ORDER BY display_order;

-- 6. Verificar categorías
SELECT 
  id,
  name,
  slug,
  level,
  parent_id,
  gender_id
FROM categories
ORDER BY display_order
LIMIT 20;

-- 7. Verificar colores
SELECT * FROM colors WHERE is_active = true ORDER BY display_order;

-- 8. Verificar relaciones product_categories
SELECT COUNT(*) AS total_relaciones FROM product_categories;

-- 9. Ver productos con sus relaciones
SELECT 
  p.name AS producto,
  p.price,
  g.name AS genero,
  c.name AS categoria_principal,
  array_agg(DISTINCT c2.name) AS categorias_asignadas
FROM products p
LEFT JOIN genders g ON p.gender_id = g.id
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN product_categories pc ON p.id = pc.product_id
LEFT JOIN categories c2 ON pc.category_id = c2.id
GROUP BY p.id, p.name, p.price, g.name, c.name
ORDER BY p.created_at DESC
LIMIT 10;
