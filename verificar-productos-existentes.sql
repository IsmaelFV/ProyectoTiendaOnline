-- ============================================================================
-- VERIFICAR: Productos existentes en la base de datos
-- ============================================================================

-- 1. Contar todos los productos
SELECT COUNT(*) as total_productos FROM products;

-- 2. Ver todos los productos
SELECT 
  id,
  name,
  slug,
  price / 100.0 as precio_euros,
  stock,
  featured,
  is_new,
  is_on_sale,
  category_id,
  gender_id,
  created_at
FROM products
ORDER BY created_at DESC;

-- 3. Ver productos con sus géneros y categorías
SELECT 
  p.name AS producto,
  p.slug,
  p.price / 100.0 as precio,
  p.featured as destacado,
  g.name AS genero,
  g.slug as genero_slug,
  c.name AS categoria,
  c.slug as categoria_slug,
  array_length(p.images, 1) AS num_imagenes
FROM products p
LEFT JOIN genders g ON p.gender_id = g.id
LEFT JOIN categories c ON p.category_id = c.id
ORDER BY p.created_at DESC;

-- 4. Verificar productos destacados (los que deberían aparecer en home)
SELECT 
  name,
  slug,
  price / 100.0 as precio,
  featured,
  gender_id,
  category_id
FROM products
WHERE featured = true
ORDER BY created_at DESC;

-- 5. Verificar que existen las tablas necesarias
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('products', 'genders', 'colors', 'categories', 'product_categories')
ORDER BY table_name;
