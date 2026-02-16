-- ============================================================================
-- PRODUCTOS DE PRUEBA - Sistema de Categorías
-- ============================================================================
-- FECHA: 13 de enero de 2026
-- PROPÓSITO: Añadir productos de ejemplo para probar el sistema de navegación
-- ============================================================================

-- ============================================================================
-- PASO 1: Obtener IDs de géneros y categorías
-- ============================================================================

DO $$
DECLARE
  -- IDs de géneros
  mujer_id UUID;
  hombre_id UUID;
  unisex_id UUID;
  
  -- IDs de categorías (solo algunas para el ejemplo)
  cat_vestidos_id UUID;
  cat_camisetas_mujer_id UUID;
  cat_pantalones_mujer_id UUID;
  cat_camisas_hombre_id UUID;
  cat_pantalones_hombre_id UUID;
  cat_sudaderas_hombre_id UUID;
  
  -- IDs de colores
  negro_id UUID;
  blanco_id UUID;
  azul_id UUID;
  rojo_id UUID;
  
  -- IDs de productos (para asignar a múltiples categorías)
  prod_id UUID;
BEGIN
  -- Obtener IDs de géneros
  SELECT id INTO mujer_id FROM genders WHERE slug = 'mujer';
  SELECT id INTO hombre_id FROM genders WHERE slug = 'hombre';
  SELECT id INTO unisex_id FROM genders WHERE slug = 'unisex';

  -- Obtener IDs de categorías
  SELECT id INTO cat_vestidos_id FROM categories WHERE slug = 'vestidos';
  SELECT id INTO cat_camisetas_mujer_id FROM categories WHERE slug = 'camisetas-mujer';
  SELECT id INTO cat_pantalones_mujer_id FROM categories WHERE slug = 'pantalones-mujer';
  SELECT id INTO cat_camisas_hombre_id FROM categories WHERE slug = 'camisas-hombre';
  SELECT id INTO cat_pantalones_hombre_id FROM categories WHERE slug = 'pantalones-hombre';
  SELECT id INTO cat_sudaderas_hombre_id FROM categories WHERE slug = 'sudaderas-hombre';

  -- Obtener IDs de colores
  SELECT id INTO negro_id FROM colors WHERE slug = 'negro';
  SELECT id INTO blanco_id FROM colors WHERE slug = 'blanco';
  SELECT id INTO azul_id FROM colors WHERE slug = 'azul';
  SELECT id INTO rojo_id FROM colors WHERE slug = 'rojo';

  -- ============================================================================
  -- PRODUCTOS MUJER
  -- ============================================================================

  -- 1. Vestido Elegante Negro
  INSERT INTO products (
    name, slug, description, price, stock, category_id, gender_id,
    images, sizes, colors, available_sizes, color_ids,
    is_new, is_on_sale, sale_price, featured, material
  ) VALUES (
    'Vestido Elegante Negro',
    'vestido-elegante-negro',
    'Vestido de corte clásico perfecto para eventos formales. Confeccionado en tejido premium con un diseño atemporal.',
    7999, -- 79.99€
    15,
    cat_vestidos_id,
    mujer_id,
    ARRAY[
      'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800',
      'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=800'
    ],
    ARRAY['XS', 'S', 'M', 'L', 'XL'],
    ARRAY['Negro'],
    ARRAY['XS', 'S', 'M', 'L', 'XL'],
    ARRAY[negro_id],
    true, -- es nuevo
    false,
    NULL, -- sin precio rebajado
    true, -- destacado
    'Poliéster 95%, Elastano 5%'
  ) RETURNING id INTO prod_id;

  -- Asignar a múltiples categorías
  INSERT INTO product_categories (product_id, category_id) VALUES
    (prod_id, cat_vestidos_id);

  -- 2. Camiseta Básica Blanca Mujer
  INSERT INTO products (
    name, slug, description, price, stock, category_id, gender_id,
    images, sizes, colors, available_sizes, color_ids,
    is_new, is_on_sale, sale_price, featured, material
  ) VALUES (
    'Camiseta Básica Blanca',
    'camiseta-basica-blanca-mujer',
    'Camiseta de algodón 100% orgánico. Corte regular y máxima comodidad para el día a día.',
    1499, -- 14.99€
    50,
    cat_camisetas_mujer_id,
    mujer_id,
    ARRAY[
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800',
      'https://images.unsplash.com/photo-1627225924765-552d49cf47ad?w=800'
    ],
    ARRAY['XS', 'S', 'M', 'L', 'XL'],
    ARRAY['Blanco', 'Negro'],
    ARRAY['XS', 'S', 'M', 'L', 'XL'],
    ARRAY[blanco_id, negro_id],
    false,
    true, -- en oferta
    1199, -- precio rebajado 11.99€
    true,
    'Algodón 100% orgánico'
  ) RETURNING id INTO prod_id;

  INSERT INTO product_categories (product_id, category_id) VALUES
    (prod_id, cat_camisetas_mujer_id);

  -- 3. Pantalón Vaquero Azul Mujer
  INSERT INTO products (
    name, slug, description, price, stock, category_id, gender_id,
    images, sizes, colors, available_sizes, color_ids,
    is_new, is_on_sale, sale_price, featured, material
  ) VALUES (
    'Pantalón Vaquero Azul',
    'pantalon-vaquero-azul-mujer',
    'Jeans de corte slim fit con cintura alta. Denim de calidad premium con ajuste perfecto.',
    4999, -- 49.99€
    30,
    cat_pantalones_mujer_id,
    mujer_id,
    ARRAY[
      'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=800',
      'https://images.unsplash.com/photo-1582418702059-97ebafb35d09?w=800'
    ],
    ARRAY['34', '36', '38', '40', '42', '44'],
    ARRAY['Azul'],
    ARRAY['34', '36', '38', '40', '42', '44'],
    ARRAY[azul_id],
    true,
    false,
    NULL,
    true,
    'Denim 98%, Elastano 2%'
  ) RETURNING id INTO prod_id;

  INSERT INTO product_categories (product_id, category_id) VALUES
    (prod_id, cat_pantalones_mujer_id);

  -- 4. Vestido Floral Primavera
  INSERT INTO products (
    name, slug, description, price, stock, category_id, gender_id,
    images, sizes, colors, available_sizes, color_ids,
    is_new, is_on_sale, sale_price, featured, material
  ) VALUES (
    'Vestido Floral Primavera',
    'vestido-floral-primavera',
    'Vestido ligero con estampado floral, perfecto para la temporada de primavera-verano.',
    3999, -- 39.99€
    20,
    cat_vestidos_id,
    mujer_id,
    ARRAY[
      'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=800',
      'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=800'
    ],
    ARRAY['XS', 'S', 'M', 'L'],
    ARRAY['Rosa', 'Blanco'],
    ARRAY['XS', 'S', 'M', 'L'],
    ARRAY[blanco_id],
    true,
    false,
    NULL,
    false,
    'Viscosa 100%'
  ) RETURNING id INTO prod_id;

  INSERT INTO product_categories (product_id, category_id) VALUES
    (prod_id, cat_vestidos_id);

  -- ============================================================================
  -- PRODUCTOS HOMBRE
  -- ============================================================================

  -- 5. Camisa Oxford Azul
  INSERT INTO products (
    name, slug, description, price, stock, category_id, gender_id,
    images, sizes, colors, available_sizes, color_ids,
    is_new, is_on_sale, sale_price, featured, material
  ) VALUES (
    'Camisa Oxford Azul',
    'camisa-oxford-azul-hombre',
    'Camisa clásica de tejido Oxford. Perfecta para looks formales e informales.',
    3499, -- 34.99€
    40,
    cat_camisas_hombre_id,
    hombre_id,
    ARRAY[
      'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=800',
      'https://images.unsplash.com/photo-1620012253295-c15cc3e65df4?w=800'
    ],
    ARRAY['S', 'M', 'L', 'XL', 'XXL'],
    ARRAY['Azul', 'Blanco'],
    ARRAY['S', 'M', 'L', 'XL', 'XXL'],
    ARRAY[azul_id, blanco_id],
    false,
    true, -- en oferta
    2799, -- 27.99€
    true,
    'Algodón 100%'
  ) RETURNING id INTO prod_id;

  INSERT INTO product_categories (product_id, category_id) VALUES
    (prod_id, cat_camisas_hombre_id);

  -- 6. Pantalón Chino Beige
  INSERT INTO products (
    name, slug, description, price, stock, category_id, gender_id,
    images, sizes, colors, available_sizes, color_ids,
    is_new, is_on_sale, sale_price, featured, material
  ) VALUES (
    'Pantalón Chino Beige',
    'pantalon-chino-beige-hombre',
    'Chinos de corte slim. Versátiles y cómodos para cualquier ocasión.',
    3999, -- 39.99€
    35,
    cat_pantalones_hombre_id,
    hombre_id,
    ARRAY[
      'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=800',
      'https://images.unsplash.com/photo-1624378515195-6bbdb73dbe4a?w=800'
    ],
    ARRAY['38', '40', '42', '44', '46'],
    ARRAY['Beige', 'Negro', 'Azul Marino'],
    ARRAY['38', '40', '42', '44', '46'],
    ARRAY[negro_id, azul_id],
    true,
    false,
    NULL,
    true,
    'Algodón 97%, Elastano 3%'
  ) RETURNING id INTO prod_id;

  INSERT INTO product_categories (product_id, category_id) VALUES
    (prod_id, cat_pantalones_hombre_id);

  -- 7. Sudadera Capucha Gris
  INSERT INTO products (
    name, slug, description, price, stock, category_id, gender_id,
    images, sizes, colors, available_sizes, color_ids,
    is_new, is_on_sale, sale_price, featured, material
  ) VALUES (
    'Sudadera Capucha Gris',
    'sudadera-capucha-gris-hombre',
    'Sudadera con capucha de felpa francesa. Interior suave y cálido.',
    2999, -- 29.99€
    45,
    cat_sudaderas_hombre_id,
    hombre_id,
    ARRAY[
      'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800',
      'https://images.unsplash.com/photo-1578587018452-892bacefd3f2?w=800'
    ],
    ARRAY['S', 'M', 'L', 'XL', 'XXL'],
    ARRAY['Gris', 'Negro', 'Azul Marino'],
    ARRAY['S', 'M', 'L', 'XL', 'XXL'],
    ARRAY[negro_id, azul_id],
    true,
    false,
    NULL,
    false,
    'Algodón 80%, Poliéster 20%'
  ) RETURNING id INTO prod_id;

  INSERT INTO product_categories (product_id, category_id) VALUES
    (prod_id, cat_sudaderas_hombre_id);

  -- 8. Camisa Blanca Formal
  INSERT INTO products (
    name, slug, description, price, stock, category_id, gender_id,
    images, sizes, colors, available_sizes, color_ids,
    is_new, is_on_sale, sale_price, featured, material
  ) VALUES (
    'Camisa Blanca Formal',
    'camisa-blanca-formal-hombre',
    'Camisa de vestir de corte entallado. Imprescindible en todo guardarropa.',
    2999, -- 29.99€
    25,
    cat_camisas_hombre_id,
    hombre_id,
    ARRAY[
      'https://images.unsplash.com/photo-1603252109360-909baaf261c7?w=800',
      'https://images.unsplash.com/photo-1621072156002-e2fccdc0b176?w=800'
    ],
    ARRAY['S', 'M', 'L', 'XL'],
    ARRAY['Blanco'],
    ARRAY['S', 'M', 'L', 'XL'],
    ARRAY[blanco_id],
    false,
    true,
    2499, -- 24.99€
    true,
    'Algodón 100%'
  ) RETURNING id INTO prod_id;

  INSERT INTO product_categories (product_id, category_id) VALUES
    (prod_id, cat_camisas_hombre_id);

  RAISE NOTICE 'Se han insertado 8 productos de prueba';
  RAISE NOTICE 'Productos con múltiples categorías configurados';
  RAISE NOTICE 'Productos con colores y tallas asignados';
  RAISE NOTICE 'Productos nuevos y en oferta marcados';
END $$;

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

SELECT 
  p.name AS producto,
  g.name AS genero,
  c.name AS categoria,
  p.is_new AS nuevo,
  p.is_on_sale AS oferta,
  array_length(p.images, 1) AS num_imagenes,
  array_length(p.sizes, 1) AS num_tallas
FROM products p
LEFT JOIN genders g ON p.gender_id = g.id
LEFT JOIN categories c ON p.category_id = c.id
ORDER BY p.created_at DESC
LIMIT 10;
