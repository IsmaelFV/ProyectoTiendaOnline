-- ============================================================================
-- SCRIPT: Configurar productos para REBAJAS y NOVEDADES
-- ============================================================================
-- Este script te ayudará a marcar productos como ofertas (rebajas) o novedades
-- para que aparezcan en las páginas correspondientes de la barra lateral.
-- ============================================================================

-- 1. Ver productos actuales y su estado
SELECT 
  id,
  name,
  price,
  is_on_sale,
  sale_price,
  is_new,
  gender_id,
  created_at
FROM products
ORDER BY created_at DESC
LIMIT 20;

-- ============================================================================
-- 2. MARCAR PRODUCTOS COMO REBAJAS (Ofertas)
-- ============================================================================

-- Ejemplo: Marcar un producto específico como rebajado
-- Reemplaza 'ID_DEL_PRODUCTO' con el ID real del producto
UPDATE products
SET 
  is_on_sale = true,
  sale_price = (price * 0.7)::INTEGER  -- 30% de descuento
WHERE id = 'ID_DEL_PRODUCTO';

-- Ejemplo: Marcar TODOS los productos de una categoría como rebajados
UPDATE products
SET 
  is_on_sale = true,
  sale_price = (price * 0.7)::INTEGER  -- 30% de descuento
WHERE category_id IN (
  SELECT id FROM categories WHERE slug LIKE '%ropa%'
);

-- Ejemplo: Marcar productos aleatorios como rebajados (10 productos)
UPDATE products
SET 
  is_on_sale = true,
  sale_price = (price * 0.6)::INTEGER  -- 40% de descuento
WHERE id IN (
  SELECT id FROM products 
  WHERE is_on_sale = false 
  ORDER BY RANDOM() 
  LIMIT 10
);

-- ============================================================================
-- 3. MARCAR PRODUCTOS COMO NOVEDADES
-- ============================================================================

-- Ejemplo: Marcar productos recientes como novedades (últimos 30 días)
UPDATE products
SET is_new = true
WHERE created_at >= NOW() - INTERVAL '30 days';

-- Ejemplo: Marcar manualmente un producto como novedad
UPDATE products
SET is_new = true
WHERE id = 'ID_DEL_PRODUCTO';

-- Ejemplo: Marcar los 15 productos más recientes como novedades
UPDATE products
SET is_new = true
WHERE id IN (
  SELECT id FROM products 
  ORDER BY created_at DESC 
  LIMIT 15
);

-- ============================================================================
-- 4. QUITAR MARCAS DE REBAJAS/NOVEDADES
-- ============================================================================

-- Quitar marca de rebaja de todos los productos
UPDATE products
SET 
  is_on_sale = false,
  sale_price = NULL
WHERE is_on_sale = true;

-- Quitar marca de novedad de todos los productos
UPDATE products
SET is_new = false
WHERE is_new = true;

-- ============================================================================
-- 5. EJEMPLOS COMBINADOS POR GÉNERO
-- ============================================================================

-- Marcar productos de MUJER como rebajas (20 productos aleatorios)
UPDATE products
SET 
  is_on_sale = true,
  sale_price = (price * 0.65)::INTEGER  -- 35% de descuento
WHERE gender_id = (SELECT id FROM genders WHERE slug = 'mujer')
AND id IN (
  SELECT id FROM products 
  WHERE gender_id = (SELECT id FROM genders WHERE slug = 'mujer')
  AND is_on_sale = false
  ORDER BY RANDOM() 
  LIMIT 20
);

-- Marcar productos de HOMBRE como novedades (15 productos recientes)
UPDATE products
SET is_new = true
WHERE gender_id = (SELECT id FROM genders WHERE slug = 'hombre')
AND id IN (
  SELECT id FROM products 
  WHERE gender_id = (SELECT id FROM genders WHERE slug = 'hombre')
  ORDER BY created_at DESC 
  LIMIT 15
);

-- ============================================================================
-- 6. VERIFICAR RESULTADOS
-- ============================================================================

-- Ver productos en REBAJAS por género
SELECT 
  g.name as genero,
  p.name as producto,
  p.price as precio_original,
  p.sale_price as precio_rebajado,
  ROUND(((p.price - p.sale_price)::DECIMAL / p.price * 100), 0) as descuento_porcentaje
FROM products p
JOIN genders g ON p.gender_id = g.id
WHERE p.is_on_sale = true
ORDER BY g.name, descuento_porcentaje DESC;

-- Ver productos NOVEDADES por género
SELECT 
  g.name as genero,
  p.name as producto,
  p.created_at as fecha_creacion,
  p.is_new
FROM products p
JOIN genders g ON p.gender_id = g.id
WHERE p.is_new = true
ORDER BY g.name, p.created_at DESC;

-- Contar productos por tipo
SELECT 
  g.name as genero,
  COUNT(*) FILTER (WHERE p.is_on_sale = true) as total_rebajas,
  COUNT(*) FILTER (WHERE p.is_new = true) as total_novedades,
  COUNT(*) as total_productos
FROM products p
JOIN genders g ON p.gender_id = g.id
GROUP BY g.name;
