-- ============================================================================
-- SCRIPT RÁPIDO: Marcar productos de prueba como REBAJAS y NOVEDADES
-- ============================================================================
-- Ejecuta este script en Supabase SQL Editor para tener productos de muestra
-- en las páginas de Rebajas y Novedades
-- ============================================================================

-- 1. MARCAR 10 PRODUCTOS ALEATORIOS DE MUJER COMO REBAJAS (40% descuento)
UPDATE products
SET 
  is_on_sale = true,
  sale_price = (price * 0.6)::INTEGER
WHERE gender_id = (SELECT id FROM genders WHERE slug = 'mujer')
AND is_on_sale = false
AND id IN (
  SELECT id FROM products 
  WHERE gender_id = (SELECT id FROM genders WHERE slug = 'mujer')
  ORDER BY RANDOM() 
  LIMIT 10
);

-- 2. MARCAR 10 PRODUCTOS ALEATORIOS DE HOMBRE COMO REBAJAS (40% descuento)
UPDATE products
SET 
  is_on_sale = true,
  sale_price = (price * 0.6)::INTEGER
WHERE gender_id = (SELECT id FROM genders WHERE slug = 'hombre')
AND is_on_sale = false
AND id IN (
  SELECT id FROM products 
  WHERE gender_id = (SELECT id FROM genders WHERE slug = 'hombre')
  ORDER BY RANDOM() 
  LIMIT 10
);

-- 3. MARCAR 8 PRODUCTOS RECIENTES DE MUJER COMO NOVEDADES
UPDATE products
SET is_new = true
WHERE gender_id = (SELECT id FROM genders WHERE slug = 'mujer')
AND id IN (
  SELECT id FROM products 
  WHERE gender_id = (SELECT id FROM genders WHERE slug = 'mujer')
  ORDER BY created_at DESC 
  LIMIT 8
);

-- 4. MARCAR 8 PRODUCTOS RECIENTES DE HOMBRE COMO NOVEDADES
UPDATE products
SET is_new = true
WHERE gender_id = (SELECT id FROM genders WHERE slug = 'hombre')
AND id IN (
  SELECT id FROM products 
  WHERE gender_id = (SELECT id FROM genders WHERE slug = 'hombre')
  ORDER BY created_at DESC 
  LIMIT 8
);

-- ============================================================================
-- VERIFICAR RESULTADOS
-- ============================================================================

-- Ver cuántos productos hay en cada categoría por género
SELECT 
  g.name as genero,
  COUNT(*) FILTER (WHERE p.is_on_sale = true) as rebajas,
  COUNT(*) FILTER (WHERE p.is_new = true) as novedades,
  COUNT(*) as total
FROM products p
LEFT JOIN genders g ON p.gender_id = g.id
GROUP BY g.name
ORDER BY g.name;

-- Ver algunos productos de rebajas
SELECT 
  g.name as genero,
  p.name as producto,
  p.price as precio_original,
  p.sale_price as precio_rebajado,
  ROUND((100 - (p.sale_price::DECIMAL / p.price * 100)), 0) as descuento
FROM products p
LEFT JOIN genders g ON p.gender_id = g.id
WHERE p.is_on_sale = true
ORDER BY g.name, descuento DESC
LIMIT 10;

-- Ver algunos productos de novedades
SELECT 
  g.name as genero,
  p.name as producto,
  p.created_at as fecha
FROM products p
LEFT JOIN genders g ON p.gender_id = g.id
WHERE p.is_new = true
ORDER BY g.name, p.created_at DESC
LIMIT 10;
