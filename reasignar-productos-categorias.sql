-- ============================================================================
-- REASIGNAR PRODUCTOS A CATEGORÍAS CORRECTAS
-- ============================================================================

-- MUJER: Reasignar productos basándose en el nombre
UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = 'camisetas-mujer' LIMIT 1)
WHERE gender_id = '6704664a-56ac-4bce-ac84-47396eb5c5b1' 
  AND (name ILIKE '%camiseta%' OR name ILIKE '%t-shirt%' OR name ILIKE '%top%');

UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = 'camisas-mujer' LIMIT 1)
WHERE gender_id = '6704664a-56ac-4bce-ac84-47396eb5c5b1' 
  AND (name ILIKE '%camisa%' OR name ILIKE '%blusa%');

UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = 'vestidos-mujer' LIMIT 1)
WHERE gender_id = '6704664a-56ac-4bce-ac84-47396eb5c5b1' 
  AND name ILIKE '%vestido%';

UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = 'pantalones-mujer' LIMIT 1)
WHERE gender_id = '6704664a-56ac-4bce-ac84-47396eb5c5b1' 
  AND (name ILIKE '%pantalon%' OR name ILIKE '%pantalón%');

UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = 'jeans-mujer' LIMIT 1)
WHERE gender_id = '6704664a-56ac-4bce-ac84-47396eb5c5b1' 
  AND (name ILIKE '%jean%' OR name ILIKE '%vaquero%' OR name ILIKE '%denim%');

UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = 'faldas-mujer' LIMIT 1)
WHERE gender_id = '6704664a-56ac-4bce-ac84-47396eb5c5b1' 
  AND name ILIKE '%falda%';

UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = 'sudaderas-mujer' LIMIT 1)
WHERE gender_id = '6704664a-56ac-4bce-ac84-47396eb5c5b1' 
  AND (name ILIKE '%sudadera%' OR name ILIKE '%hoodie%' OR name ILIKE '%capucha%');

UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = 'chaquetas-mujer' LIMIT 1)
WHERE gender_id = '6704664a-56ac-4bce-ac84-47396eb5c5b1' 
  AND (name ILIKE '%chaqueta%' OR name ILIKE '%cazadora%' OR name ILIKE '%jacket%');

UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = 'abrigos-mujer' LIMIT 1)
WHERE gender_id = '6704664a-56ac-4bce-ac84-47396eb5c5b1' 
  AND (name ILIKE '%abrigo%' OR name ILIKE '%coat%');

-- HOMBRE: Reasignar productos basándose en el nombre
UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = 'camisetas-hombre' LIMIT 1)
WHERE gender_id = '15fc11f3-1a30-4cb6-96ce-ea42cd4a909f' 
  AND (name ILIKE '%camiseta%' OR name ILIKE '%t-shirt%');

UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = 'camisas-hombre' LIMIT 1)
WHERE gender_id = '15fc11f3-1a30-4cb6-96ce-ea42cd4a909f' 
  AND name ILIKE '%camisa%';

UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = 'polos-hombre' LIMIT 1)
WHERE gender_id = '15fc11f3-1a30-4cb6-96ce-ea42cd4a909f' 
  AND name ILIKE '%polo%';

UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = 'pantalones-hombre' LIMIT 1)
WHERE gender_id = '15fc11f3-1a30-4cb6-96ce-ea42cd4a909f' 
  AND (name ILIKE '%pantalon%' OR name ILIKE '%pantalón%' OR name ILIKE '%chino%');

UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = 'jeans-hombre' LIMIT 1)
WHERE gender_id = '15fc11f3-1a30-4cb6-96ce-ea42cd4a909f' 
  AND (name ILIKE '%jean%' OR name ILIKE '%vaquero%' OR name ILIKE '%denim%');

UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = 'sudaderas-hombre' LIMIT 1)
WHERE gender_id = '15fc11f3-1a30-4cb6-96ce-ea42cd4a909f' 
  AND (name ILIKE '%sudadera%' OR name ILIKE '%hoodie%' OR name ILIKE '%capucha%');

UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = 'chaquetas-hombre' LIMIT 1)
WHERE gender_id = '15fc11f3-1a30-4cb6-96ce-ea42cd4a909f' 
  AND (name ILIKE '%chaqueta%' OR name ILIKE '%cazadora%' OR name ILIKE '%jacket%');

UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = 'abrigos-hombre' LIMIT 1)
WHERE gender_id = '15fc11f3-1a30-4cb6-96ce-ea42cd4a909f' 
  AND (name ILIKE '%abrigo%' OR name ILIKE '%coat%');

-- Verificar distribución de productos por categoría
SELECT 
  c.name as categoria,
  c.slug,
  g.name as genero,
  COUNT(p.id) as total_productos
FROM categories c
LEFT JOIN products p ON p.category_id = c.id
LEFT JOIN genders g ON c.gender_id = g.id
WHERE c.level = 2
GROUP BY c.id, c.name, c.slug, g.name
ORDER BY g.name, c.name;
