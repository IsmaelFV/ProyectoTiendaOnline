-- ============================================================================
-- SQL PARA PRODUCTOS DEMO - PRESENTACIÓN
-- Ejecutar en Supabase SQL Editor
-- ============================================================================

-- 1. Primero sincronizar colors[] de productos existentes
UPDATE products 
SET colors = ARRAY[color] 
WHERE color IS NOT NULL AND color != '' AND (colors IS NULL OR colors = '{}');

-- 2. Inferir gender_id de la categoría para productos que no lo tengan
UPDATE products p
SET gender_id = c.gender_id
FROM categories c
WHERE p.category_id = c.id
  AND p.gender_id IS NULL
  AND c.gender_id IS NOT NULL;

-- 3. Insertar productos demo
DO $$
DECLARE
  -- Géneros
  v_mujer UUID;
  v_hombre UUID;
  -- Categorías MUJER
  cat_camisetas_mujer UUID;
  cat_vestidos UUID;
  cat_faldas UUID;
  cat_pantalones_mujer UUID;
  cat_jeans_mujer UUID;
  cat_sudaderas_mujer UUID;
  cat_abrigos_mujer UUID;
  cat_blazers_mujer UUID;
  cat_camisas_mujer UUID;
  cat_bolsos UUID;
  cat_zapatillas_mujer UUID;
  cat_botas_mujer UUID;
  cat_leggings UUID;
  cat_tops_dep_mujer UUID;
  -- Categorías HOMBRE
  cat_camisetas_hombre UUID;
  cat_camisas_hombre UUID;
  cat_polos UUID;
  cat_sudaderas_hombre UUID;
  cat_pantalones_hombre UUID;
  cat_jeans_hombre UUID;
  cat_abrigos_hombre UUID;
  cat_trajes_hombre UUID;
  cat_zapatillas_hombre UUID;
  cat_botas_hombre UUID;
  cat_shorts_hombre UUID;
  cat_camisetas_dep_hombre UUID;
  -- Producto temporal
  v_prod UUID;
BEGIN
  -- Obtener IDs de géneros
  SELECT id INTO v_mujer FROM genders WHERE slug = 'mujer';
  SELECT id INTO v_hombre FROM genders WHERE slug = 'hombre';

  -- Obtener IDs de categorías MUJER
  SELECT id INTO cat_camisetas_mujer FROM categories WHERE slug = 'camisetas-tops-mujer';
  SELECT id INTO cat_vestidos FROM categories WHERE slug = 'vestidos';
  SELECT id INTO cat_faldas FROM categories WHERE slug = 'faldas';
  SELECT id INTO cat_pantalones_mujer FROM categories WHERE slug = 'pantalones-mujer';
  SELECT id INTO cat_jeans_mujer FROM categories WHERE slug = 'jeans-mujer';
  SELECT id INTO cat_sudaderas_mujer FROM categories WHERE slug = 'sudaderas-mujer';
  SELECT id INTO cat_abrigos_mujer FROM categories WHERE slug = 'abrigos-chaquetas-mujer';
  SELECT id INTO cat_blazers_mujer FROM categories WHERE slug = 'blazers-mujer';
  SELECT id INTO cat_camisas_mujer FROM categories WHERE slug = 'camisas-blusas-mujer';
  SELECT id INTO cat_bolsos FROM categories WHERE slug = 'bolsos';
  SELECT id INTO cat_zapatillas_mujer FROM categories WHERE slug = 'zapatillas-mujer';
  SELECT id INTO cat_botas_mujer FROM categories WHERE slug = 'botas-mujer';
  SELECT id INTO cat_leggings FROM categories WHERE slug = 'leggings-deportivos';
  SELECT id INTO cat_tops_dep_mujer FROM categories WHERE slug = 'tops-deportivos-mujer';

  -- Obtener IDs de categorías HOMBRE
  SELECT id INTO cat_camisetas_hombre FROM categories WHERE slug = 'camisetas-hombre';
  SELECT id INTO cat_camisas_hombre FROM categories WHERE slug = 'camisas-hombre';
  SELECT id INTO cat_polos FROM categories WHERE slug = 'polos-hombre';
  SELECT id INTO cat_sudaderas_hombre FROM categories WHERE slug = 'sudaderas-hombre';
  SELECT id INTO cat_pantalones_hombre FROM categories WHERE slug = 'pantalones-hombre';
  SELECT id INTO cat_jeans_hombre FROM categories WHERE slug = 'jeans-hombre';
  SELECT id INTO cat_abrigos_hombre FROM categories WHERE slug = 'abrigos-chaquetas-hombre';
  SELECT id INTO cat_trajes_hombre FROM categories WHERE slug = 'trajes-blazers-hombre';
  SELECT id INTO cat_zapatillas_hombre FROM categories WHERE slug = 'zapatillas-hombre';
  SELECT id INTO cat_botas_hombre FROM categories WHERE slug = 'botas-hombre';
  SELECT id INTO cat_shorts_hombre FROM categories WHERE slug = 'shorts-hombre';
  SELECT id INTO cat_camisetas_dep_hombre FROM categories WHERE slug = 'camisetas-deportivas-hombre';

  -- =============================================
  -- MUJER - CAMISETAS Y TOPS (6 productos)
  -- =============================================
  INSERT INTO products (name, slug, description, price, stock, stock_by_size, category_id, gender_id, images, sizes, available_sizes, colors, color, featured, is_active, is_sustainable, is_new, is_on_sale, sale_price, material, sku)
  VALUES
  ('Camiseta Básica Algodón Orgánico', 'camiseta-basica-algodon-organico', 'Camiseta esencial de algodón 100% orgánico. Corte relajado y tacto suave.', 1999, 60, '{"XS":10,"S":15,"M":15,"L":10,"XL":10}', cat_camisetas_mujer, v_mujer, ARRAY['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800','https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800'], ARRAY['XS','S','M','L','XL'], ARRAY['XS','S','M','L','XL'], ARRAY['Blanco'], 'Blanco', false, true, true, false, false, NULL, 'Algodón orgánico 100%', 'SKU-CM001'),
  ('Top Crop Estampado Floral', 'top-crop-estampado-floral', 'Top corto con estampado floral primaveral. Perfecto para looks frescos.', 2499, 45, '{"XS":10,"S":10,"M":10,"L":10,"XL":5}', cat_camisetas_mujer, v_mujer, ARRAY['https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800','https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800'], ARRAY['XS','S','M','L','XL'], ARRAY['XS','S','M','L','XL'], ARRAY['Rosa'], 'Rosa', true, true, false, true, false, NULL, 'Viscosa 95%, Elastano 5%', 'SKU-CM002'),
  ('Camiseta Oversize Urban', 'camiseta-oversize-urban', 'Camiseta oversized con diseño urbano minimalista.', 2999, 40, '{"S":10,"M":15,"L":10,"XL":5}', cat_camisetas_mujer, v_mujer, ARRAY['https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800'], ARRAY['S','M','L','XL'], ARRAY['S','M','L','XL'], ARRAY['Negro'], 'Negro', false, true, false, false, false, NULL, 'Algodón 100%', 'SKU-CM003'),
  ('Top Tirantes Satinado', 'top-tirantes-satinado', 'Top de tirantes en tejido satinado. Elegancia para el día a día.', 2799, 35, '{"XS":8,"S":10,"M":10,"L":7}', cat_camisetas_mujer, v_mujer, ARRAY['https://images.unsplash.com/photo-1564257631407-4deb1f99d992?w=800'], ARRAY['XS','S','M','L'], ARRAY['XS','S','M','L'], ARRAY['Beige'], 'Beige', false, true, false, false, true, 1959, 'Poliéster satinado 100%', 'SKU-CM004'),
  ('Camiseta Rayas Marineras', 'camiseta-rayas-marineras', 'Clásica camiseta de rayas estilo marinero bretón.', 2499, 50, '{"XS":10,"S":15,"M":10,"L":10,"XL":5}', cat_camisetas_mujer, v_mujer, ARRAY['https://images.unsplash.com/photo-1554568218-0f1715e72254?w=800','https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=800'], ARRAY['XS','S','M','L','XL'], ARRAY['XS','S','M','L','XL'], ARRAY['Azul Marino'], 'Azul Marino', false, true, false, false, false, NULL, 'Algodón 100%', 'SKU-CM005'),
  ('Body Manga Larga Premium', 'body-manga-larga-premium', 'Body ceñido de manga larga con cierre de corchetes. Básico imprescindible.', 3499, 30, '{"XS":5,"S":10,"M":10,"L":5}', cat_camisetas_mujer, v_mujer, ARRAY['https://images.unsplash.com/photo-1583744946564-b52ac1c389c8?w=800'], ARRAY['XS','S','M','L'], ARRAY['XS','S','M','L'], ARRAY['Negro'], 'Negro', true, true, false, true, false, NULL, 'Modal 60%, Algodón 35%, Elastano 5%', 'SKU-CM006');

  -- =============================================
  -- MUJER - VESTIDOS (5 productos)
  -- =============================================
  INSERT INTO products (name, slug, description, price, stock, stock_by_size, category_id, gender_id, images, sizes, available_sizes, colors, color, featured, is_active, is_sustainable, is_new, is_on_sale, sale_price, material, sku)
  VALUES
  ('Vestido Midi Satinado', 'vestido-midi-satinado', 'Vestido midi con caída fluida en tejido satinado. Escote en V y manga corta.', 5999, 25, '{"XS":5,"S":7,"M":7,"L":4,"XL":2}', cat_vestidos, v_mujer, ARRAY['https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800','https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=800'], ARRAY['XS','S','M','L','XL'], ARRAY['XS','S','M','L','XL'], ARRAY['Verde Oscuro'], 'Verde Oscuro', true, true, false, true, false, NULL, 'Poliéster satinado 100%', 'SKU-VE001'),
  ('Vestido Camisero Lino', 'vestido-camisero-lino', 'Vestido camisero largo en lino natural. Cinturón incluido.', 6999, 20, '{"S":5,"M":7,"L":5,"XL":3}', cat_vestidos, v_mujer, ARRAY['https://images.unsplash.com/photo-1585487000160-6ebcfceb0d44?w=800'], ARRAY['S','M','L','XL'], ARRAY['S','M','L','XL'], ARRAY['Beige'], 'Beige', false, true, true, false, false, NULL, 'Lino 100%', 'SKU-VE002'),
  ('Vestido Corto Estampado', 'vestido-corto-estampado', 'Vestido corto con estampado abstracto. Corte en A y tirantes ajustables.', 4599, 30, '{"XS":6,"S":8,"M":8,"L":5,"XL":3}', cat_vestidos, v_mujer, ARRAY['https://images.unsplash.com/photo-1612336307429-8a898d10e223?w=800','https://images.unsplash.com/photo-1568252542512-9fe8fe9c87bb?w=800'], ARRAY['XS','S','M','L','XL'], ARRAY['XS','S','M','L','XL'], ARRAY['Coral'], 'Coral', false, true, false, false, true, 3219, 'Viscosa 100%', 'SKU-VE003'),
  ('Vestido Negro Elegante', 'vestido-negro-elegante', 'Little black dress imprescindible. Corte ajustado con escote redondo.', 7999, 18, '{"XS":3,"S":5,"M":5,"L":3,"XL":2}', cat_vestidos, v_mujer, ARRAY['https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=800'], ARRAY['XS','S','M','L','XL'], ARRAY['XS','S','M','L','XL'], ARRAY['Negro'], 'Negro', true, true, false, false, false, NULL, 'Poliéster 92%, Elastano 8%', 'SKU-VE004'),
  ('Vestido Punto Canale', 'vestido-punto-canale', 'Vestido midi de punto canalé. Cuello alto y silueta ceñida.', 4999, 22, '{"XS":4,"S":6,"M":6,"L":4,"XL":2}', cat_vestidos, v_mujer, ARRAY['https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=800'], ARRAY['XS','S','M','L','XL'], ARRAY['XS','S','M','L','XL'], ARRAY['Marrón'], 'Marrón', false, true, false, true, false, NULL, 'Algodón 70%, Poliéster 30%', 'SKU-VE005');

  -- =============================================
  -- MUJER - PANTALONES Y JEANS (5 productos)
  -- =============================================
  INSERT INTO products (name, slug, description, price, stock, stock_by_size, category_id, gender_id, images, sizes, available_sizes, colors, color, featured, is_active, is_sustainable, is_new, is_on_sale, sale_price, material, sku)
  VALUES
  ('Pantalón Wide Leg Fluido', 'pantalon-wide-leg-fluido', 'Pantalón de pierna ancha con cintura alta elástica. Caída impecable.', 4599, 30, '{"XS":6,"S":8,"M":8,"L":5,"XL":3}', cat_pantalones_mujer, v_mujer, ARRAY['https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=800'], ARRAY['XS','S','M','L','XL'], ARRAY['XS','S','M','L','XL'], ARRAY['Negro'], 'Negro', false, true, false, false, false, NULL, 'Poliéster 100%', 'SKU-PM001'),
  ('Jeans Mom Fit Vintage', 'jeans-mom-fit-vintage', 'Jeans de corte mom con tiro alto y lavado vintage. Comodidad retro.', 4999, 35, '{"34":5,"36":8,"38":8,"40":7,"42":5,"44":2}', cat_jeans_mujer, v_mujer, ARRAY['https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=800','https://images.unsplash.com/photo-1604176354204-9268737828e4?w=800'], ARRAY['34','36','38','40','42','44'], ARRAY['34','36','38','40','42','44'], ARRAY['Azul'], 'Azul', true, true, false, true, false, NULL, 'Algodón 99%, Elastano 1%', 'SKU-PM002'),
  ('Pantalón Palazzo Lino', 'pantalon-palazzo-lino-mujer', 'Pantalón palazzo de lino con cintura elástica. Ideal para verano.', 5499, 25, '{"S":6,"M":8,"L":6,"XL":5}', cat_pantalones_mujer, v_mujer, ARRAY['https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800'], ARRAY['S','M','L','XL'], ARRAY['S','M','L','XL'], ARRAY['Blanco'], 'Blanco', false, true, true, false, true, 3849, 'Lino 100%', 'SKU-PM003'),
  ('Jeans Skinny Negro', 'jeans-skinny-negro-mujer', 'Jeans skinny de tiro alto en denim negro. Efecto push-up.', 3999, 40, '{"34":6,"36":10,"38":10,"40":8,"42":4,"44":2}', cat_jeans_mujer, v_mujer, ARRAY['https://images.unsplash.com/photo-1582418702059-97ebafb35d09?w=800'], ARRAY['34','36','38','40','42','44'], ARRAY['34','36','38','40','42','44'], ARRAY['Negro'], 'Negro', false, true, false, false, false, NULL, 'Algodón 92%, Poliéster 6%, Elastano 2%', 'SKU-PM004'),
  ('Pantalón Cargo Oversize', 'pantalon-cargo-oversize-mujer', 'Pantalón cargo de corte amplio con bolsillos laterales.', 4299, 28, '{"XS":4,"S":7,"M":8,"L":6,"XL":3}', cat_pantalones_mujer, v_mujer, ARRAY['https://images.unsplash.com/photo-1517438476312-10d79c077509?w=800'], ARRAY['XS','S','M','L','XL'], ARRAY['XS','S','M','L','XL'], ARRAY['Caqui'], 'Caqui', false, true, false, true, false, NULL, 'Algodón 100%', 'SKU-PM005');

  -- =============================================
  -- MUJER - SUDADERAS Y ABRIGOS (5 productos)
  -- =============================================
  INSERT INTO products (name, slug, description, price, stock, stock_by_size, category_id, gender_id, images, sizes, available_sizes, colors, color, featured, is_active, is_sustainable, is_new, is_on_sale, sale_price, material, sku)
  VALUES
  ('Sudadera Oversize con Capucha', 'sudadera-oversize-capucha-mujer', 'Sudadera oversized con capucha y bolsillo canguro. Interior afelpado.', 3999, 40, '{"S":10,"M":12,"L":10,"XL":8}', cat_sudaderas_mujer, v_mujer, ARRAY['https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800','https://images.unsplash.com/photo-1578587018452-892bacefd3f2?w=800'], ARRAY['S','M','L','XL'], ARRAY['S','M','L','XL'], ARRAY['Gris'], 'Gris', false, true, false, false, false, NULL, 'Algodón 80%, Poliéster 20%', 'SKU-SM001'),
  ('Blazer Entallado Clásico', 'blazer-entallado-clasico', 'Blazer entallado con solapas de pico. Forro interior completo.', 7999, 18, '{"XS":3,"S":5,"M":5,"L":3,"XL":2}', cat_blazers_mujer, v_mujer, ARRAY['https://images.unsplash.com/photo-1591369822096-ffd140ec948f?w=800'], ARRAY['XS','S','M','L','XL'], ARRAY['XS','S','M','L','XL'], ARRAY['Negro'], 'Negro', true, true, false, false, false, NULL, 'Poliéster 65%, Viscosa 30%, Elastano 5%', 'SKU-SM002'),
  ('Abrigo Largo Paño', 'abrigo-largo-pano-mujer', 'Abrigo largo de paño con cierre cruzado. Elegancia invernal.', 12999, 12, '{"S":3,"M":4,"L":3,"XL":2}', cat_abrigos_mujer, v_mujer, ARRAY['https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=800','https://images.unsplash.com/photo-1548624313-0396c75e4b1a?w=800'], ARRAY['S','M','L','XL'], ARRAY['S','M','L','XL'], ARRAY['Camel'], 'Camel', true, true, false, false, true, 8999, 'Lana 60%, Poliéster 40%', 'SKU-SM003'),
  ('Chaqueta Denim Oversize', 'chaqueta-denim-oversize-mujer', 'Chaqueta vaquera oversized con lavado medio.', 5999, 20, '{"S":5,"M":7,"L":5,"XL":3}', cat_abrigos_mujer, v_mujer, ARRAY['https://images.unsplash.com/photo-1527016261049-3ae1d57e8ebc?w=800'], ARRAY['S','M','L','XL'], ARRAY['S','M','L','XL'], ARRAY['Denim'], 'Denim', false, true, false, true, false, NULL, 'Algodón 100%', 'SKU-SM004'),
  ('Sudadera Cuello Alto Cropped', 'sudadera-cuello-alto-cropped', 'Sudadera cropped con cuello alto. Estilo athleisure.', 3499, 32, '{"XS":6,"S":8,"M":10,"L":5,"XL":3}', cat_sudaderas_mujer, v_mujer, ARRAY['https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800'], ARRAY['XS','S','M','L','XL'], ARRAY['XS','S','M','L','XL'], ARRAY['Rosa Palo'], 'Rosa Palo', false, true, false, false, false, NULL, 'Algodón 85%, Poliéster 15%', 'SKU-SM005');

  -- =============================================
  -- MUJER - FALDAS Y CAMISAS (4 productos)
  -- =============================================
  INSERT INTO products (name, slug, description, price, stock, stock_by_size, category_id, gender_id, images, sizes, available_sizes, colors, color, featured, is_active, is_sustainable, is_new, is_on_sale, sale_price, material, sku)
  VALUES
  ('Falda Midi Plisada', 'falda-midi-plisada', 'Falda midi plisada con cintura elástica. Movimiento y elegancia.', 3999, 25, '{"XS":4,"S":7,"M":7,"L":5,"XL":2}', cat_faldas, v_mujer, ARRAY['https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=800'], ARRAY['XS','S','M','L','XL'], ARRAY['XS','S','M','L','XL'], ARRAY['Azul Marino'], 'Azul Marino', false, true, false, false, false, NULL, 'Poliéster 100%', 'SKU-FL001'),
  ('Falda Mini Denim', 'falda-mini-denim', 'Minifalda vaquera con cierre de botones frontales.', 2999, 30, '{"34":5,"36":8,"38":8,"40":5,"42":4}', cat_faldas, v_mujer, ARRAY['https://images.unsplash.com/photo-1592301933927-35b597393c0a?w=800'], ARRAY['34','36','38','40','42'], ARRAY['34','36','38','40','42'], ARRAY['Azul'], 'Azul', false, true, false, true, true, 2099, 'Algodón 100%', 'SKU-FL002'),
  ('Blusa Romántica Volantes', 'blusa-romantica-volantes', 'Blusa con volantes en escote y mangas. Aire romántico.', 3599, 22, '{"XS":4,"S":6,"M":6,"L":4,"XL":2}', cat_camisas_mujer, v_mujer, ARRAY['https://images.unsplash.com/photo-1518622358385-8ea7d0794bf6?w=800'], ARRAY['XS','S','M','L','XL'], ARRAY['XS','S','M','L','XL'], ARRAY['Blanco'], 'Blanco', false, true, false, false, false, NULL, 'Gasa 100%', 'SKU-BL001'),
  ('Camisa Lino Oversize', 'camisa-lino-oversize-mujer', 'Camisa oversized de lino con bolsillo al pecho. Frescura natural.', 4499, 20, '{"S":5,"M":7,"L":5,"XL":3}', cat_camisas_mujer, v_mujer, ARRAY['https://images.unsplash.com/photo-1598554747436-c9293d6a588f?w=800'], ARRAY['S','M','L','XL'], ARRAY['S','M','L','XL'], ARRAY['Arena'], 'Arena', false, true, true, false, false, NULL, 'Lino 100%', 'SKU-BL002');

  -- =============================================
  -- MUJER - ZAPATOS Y ACCESORIOS (4 productos)
  -- =============================================
  INSERT INTO products (name, slug, description, price, stock, stock_by_size, category_id, gender_id, images, sizes, available_sizes, colors, color, featured, is_active, is_sustainable, is_new, is_on_sale, sale_price, material, sku)
  VALUES
  ('Zapatillas Blancas Minimalistas', 'zapatillas-blancas-minimalistas-mujer', 'Zapatillas deportivas blancas de piel. Diseño limpio y atemporal.', 6999, 30, '{"36":5,"37":6,"38":7,"39":6,"40":4,"41":2}', cat_zapatillas_mujer, v_mujer, ARRAY['https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=800','https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=800'], ARRAY['36','37','38','39','40','41'], ARRAY['36','37','38','39','40','41'], ARRAY['Blanco'], 'Blanco', true, true, false, true, false, NULL, 'Piel sintética', 'SKU-ZM001'),
  ('Botines Chelsea Piel', 'botines-chelsea-piel-mujer', 'Botines chelsea con elásticos laterales y suela track.', 8999, 18, '{"36":3,"37":4,"38":4,"39":4,"40":3}', cat_botas_mujer, v_mujer, ARRAY['https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800'], ARRAY['36','37','38','39','40'], ARRAY['36','37','38','39','40'], ARRAY['Negro'], 'Negro', false, true, false, false, true, 6299, 'Piel vacuno', 'SKU-ZM002'),
  ('Bolso Tote Grande', 'bolso-tote-grande', 'Bolso tote espacioso con cierre magnético y bolsillo interior.', 4999, 15, '{"UNICA":15}', cat_bolsos, v_mujer, ARRAY['https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800','https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800'], ARRAY['UNICA'], ARRAY['UNICA'], ARRAY['Camel'], 'Camel', false, true, false, false, false, NULL, 'Piel sintética', 'SKU-AC001'),
  ('Bolso Bandolera Mini', 'bolso-bandolera-mini', 'Mini bandolera con cadena dorada y cierre de solapa.', 3499, 20, '{"UNICA":20}', cat_bolsos, v_mujer, ARRAY['https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=800'], ARRAY['UNICA'], ARRAY['UNICA'], ARRAY['Negro'], 'Negro', false, true, false, true, false, NULL, 'Piel sintética', 'SKU-AC002');

  -- =============================================
  -- MUJER - SPORT (3 productos)
  -- =============================================
  INSERT INTO products (name, slug, description, price, stock, stock_by_size, category_id, gender_id, images, sizes, available_sizes, colors, color, featured, is_active, is_sustainable, is_new, is_on_sale, sale_price, material, sku)
  VALUES
  ('Leggings Deportivos Seamless', 'leggings-deportivos-seamless', 'Leggings sin costuras de tiro alto con compresión media.', 3499, 40, '{"XS":8,"S":10,"M":12,"L":7,"XL":3}', cat_leggings, v_mujer, ARRAY['https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=800'], ARRAY['XS','S','M','L','XL'], ARRAY['XS','S','M','L','XL'], ARRAY['Negro'], 'Negro', false, true, true, true, false, NULL, 'Nylon 80%, Elastano 20%', 'SKU-SP001'),
  ('Top Deportivo Cruzado', 'top-deportivo-cruzado', 'Top deportivo con diseño cruzado en espalda. Sujeción media.', 2499, 35, '{"XS":7,"S":8,"M":10,"L":7,"XL":3}', cat_tops_dep_mujer, v_mujer, ARRAY['https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800'], ARRAY['XS','S','M','L','XL'], ARRAY['XS','S','M','L','XL'], ARRAY['Lila'], 'Lila', false, true, false, false, false, NULL, 'Poliéster 88%, Elastano 12%', 'SKU-SP002'),
  ('Conjunto Sport Tie-Dye', 'conjunto-sport-tie-dye', 'Set de leggings + top a juego con estampado tie-dye.', 5499, 20, '{"S":5,"M":7,"L":5,"XL":3}', cat_leggings, v_mujer, ARRAY['https://images.unsplash.com/photo-1518459031867-a89b944bffe4?w=800'], ARRAY['S','M','L','XL'], ARRAY['S','M','L','XL'], ARRAY['Lavanda'], 'Lavanda', true, true, false, true, true, 3849, 'Nylon 75%, Elastano 25%', 'SKU-SP003');

  -- =============================================
  -- HOMBRE - CAMISETAS (5 productos)
  -- =============================================
  INSERT INTO products (name, slug, description, price, stock, stock_by_size, category_id, gender_id, images, sizes, available_sizes, colors, color, featured, is_active, is_sustainable, is_new, is_on_sale, sale_price, material, sku)
  VALUES
  ('Camiseta Esencial Cuello Redondo', 'camiseta-esencial-cuello-redondo', 'Camiseta básica de algodón peinado con cuello redondo reforzado.', 1999, 70, '{"S":15,"M":20,"L":20,"XL":10,"XXL":5}', cat_camisetas_hombre, v_hombre, ARRAY['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800','https://images.unsplash.com/photo-1622445275576-721325763afe?w=800'], ARRAY['S','M','L','XL','XXL'], ARRAY['S','M','L','XL','XXL'], ARRAY['Blanco'], 'Blanco', false, true, true, false, false, NULL, 'Algodón peinado 100%', 'SKU-CH001'),
  ('Camiseta Gráfica Downtown', 'camiseta-grafica-downtown', 'Camiseta con estampado gráfico urbano frontal. Algodón grueso.', 2999, 45, '{"S":10,"M":12,"L":12,"XL":8,"XXL":3}', cat_camisetas_hombre, v_hombre, ARRAY['https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800'], ARRAY['S','M','L','XL','XXL'], ARRAY['S','M','L','XL','XXL'], ARRAY['Negro'], 'Negro', false, true, false, true, false, NULL, 'Algodón 100%', 'SKU-CH002'),
  ('Camiseta Henley Manga Larga', 'camiseta-henley-manga-larga', 'Camiseta estilo henley con botones y manga larga. Look casual refinado.', 3499, 35, '{"S":7,"M":10,"L":10,"XL":5,"XXL":3}', cat_camisetas_hombre, v_hombre, ARRAY['https://images.unsplash.com/photo-1618517351616-38fb9c5210c6?w=800'], ARRAY['S','M','L','XL','XXL'], ARRAY['S','M','L','XL','XXL'], ARRAY['Burdeos'], 'Burdeos', false, true, false, false, false, NULL, 'Algodón 95%, Elastano 5%', 'SKU-CH003'),
  ('Camiseta Técnica Dry-Fit', 'camiseta-tecnica-dry-fit-hombre', 'Camiseta deportiva con tecnología de secado rápido.', 2499, 50, '{"S":10,"M":15,"L":15,"XL":7,"XXL":3}', cat_camisetas_dep_hombre, v_hombre, ARRAY['https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=800'], ARRAY['S','M','L','XL','XXL'], ARRAY['S','M','L','XL','XXL'], ARRAY['Azul Marino'], 'Azul Marino', false, true, false, false, true, 1749, 'Poliéster 100%', 'SKU-CH004'),
  ('Polo Clásico Piqué', 'polo-clasico-pique', 'Polo de piqué con logo bordado. Cuello y puños de canalé.', 3999, 40, '{"S":8,"M":12,"L":10,"XL":7,"XXL":3}', cat_polos, v_hombre, ARRAY['https://images.unsplash.com/photo-1586363104862-3a5e2ab60d99?w=800','https://images.unsplash.com/photo-1625910513413-5fc42ef9c3ac?w=800'], ARRAY['S','M','L','XL','XXL'], ARRAY['S','M','L','XL','XXL'], ARRAY['Verde Oscuro'], 'Verde Oscuro', true, true, false, false, false, NULL, 'Algodón piqué 100%', 'SKU-CH005');

  -- =============================================
  -- HOMBRE - CAMISAS (4 productos)
  -- =============================================
  INSERT INTO products (name, slug, description, price, stock, stock_by_size, category_id, gender_id, images, sizes, available_sizes, colors, color, featured, is_active, is_sustainable, is_new, is_on_sale, sale_price, material, sku)
  VALUES
  ('Camisa Oxford Slim Fit', 'camisa-oxford-slim-fit', 'Camisa Oxford con cuello button-down. Corte slim fit impecable.', 4999, 30, '{"S":6,"M":8,"L":8,"XL":5,"XXL":3}', cat_camisas_hombre, v_hombre, ARRAY['https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800','https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=800'], ARRAY['S','M','L','XL','XXL'], ARRAY['S','M','L','XL','XXL'], ARRAY['Azul Cielo'], 'Azul Cielo', true, true, false, false, false, NULL, 'Algodón Oxford 100%', 'SKU-CAH001'),
  ('Camisa Lino Manga Corta', 'camisa-lino-manga-corta-hombre', 'Camisa de lino con manga corta y cuello cubano. Estilo mediterráneo.', 4499, 25, '{"S":5,"M":7,"L":7,"XL":4,"XXL":2}', cat_camisas_hombre, v_hombre, ARRAY['https://images.unsplash.com/photo-1564584217132-2271feaeb3c5?w=800'], ARRAY['S','M','L','XL','XXL'], ARRAY['S','M','L','XL','XXL'], ARRAY['Blanco'], 'Blanco', false, true, true, true, false, NULL, 'Lino 100%', 'SKU-CAH002'),
  ('Camisa Franela Cuadros', 'camisa-franela-cuadros-hombre', 'Camisa de franela con patrón de cuadros. Calidez y estilo.', 4299, 28, '{"S":5,"M":8,"L":8,"XL":5,"XXL":2}', cat_camisas_hombre, v_hombre, ARRAY['https://images.unsplash.com/photo-1589310243389-96a5483213a8?w=800'], ARRAY['S','M','L','XL','XXL'], ARRAY['S','M','L','XL','XXL'], ARRAY['Rojo'], 'Rojo', false, true, false, false, true, 2999, 'Algodón franela 100%', 'SKU-CAH003'),
  ('Camisa Vestir Popelín', 'camisa-vestir-popelin', 'Camisa de vestir en popelín de algodón. Puños para gemelos.', 5999, 20, '{"S":4,"M":6,"L":5,"XL":3,"XXL":2}', cat_camisas_hombre, v_hombre, ARRAY['https://images.unsplash.com/photo-1620012253295-c15cc3e65df4?w=800'], ARRAY['S','M','L','XL','XXL'], ARRAY['S','M','L','XL','XXL'], ARRAY['Blanco'], 'Blanco', false, true, false, false, false, NULL, 'Algodón popelín 100%', 'SKU-CAH004');

  -- =============================================
  -- HOMBRE - PANTALONES Y JEANS (5 productos)
  -- =============================================
  INSERT INTO products (name, slug, description, price, stock, stock_by_size, category_id, gender_id, images, sizes, available_sizes, colors, color, featured, is_active, is_sustainable, is_new, is_on_sale, sale_price, material, sku)
  VALUES
  ('Pantalón Chino Slim', 'pantalon-chino-slim-hombre', 'Pantalón chino de corte slim con pinzas. Algodón stretch.', 4499, 40, '{"38":5,"40":8,"42":10,"44":8,"46":5,"48":4}', cat_pantalones_hombre, v_hombre, ARRAY['https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=800'], ARRAY['38','40','42','44','46','48'], ARRAY['38','40','42','44','46','48'], ARRAY['Beige'], 'Beige', false, true, false, false, false, NULL, 'Algodón 97%, Elastano 3%', 'SKU-PH001'),
  ('Jeans Straight Fit', 'jeans-straight-fit-hombre', 'Jeans de corte recto clásico. Lavado medio auténtico.', 4999, 45, '{"38":6,"40":10,"42":12,"44":8,"46":5,"48":4}', cat_jeans_hombre, v_hombre, ARRAY['https://images.unsplash.com/photo-1542272604-787c3835535d?w=800','https://images.unsplash.com/photo-1604176354204-9268737828e4?w=800'], ARRAY['38','40','42','44','46','48'], ARRAY['38','40','42','44','46','48'], ARRAY['Azul'], 'Azul', true, true, false, false, false, NULL, 'Algodón 99%, Elastano 1%', 'SKU-PH002'),
  ('Pantalón Jogger Premium', 'pantalon-jogger-premium-hombre', 'Jogger de felpa francesa con puños elásticos. Comodidad elevada.', 3999, 35, '{"S":7,"M":10,"L":10,"XL":5,"XXL":3}', cat_pantalones_hombre, v_hombre, ARRAY['https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=800'], ARRAY['S','M','L','XL','XXL'], ARRAY['S','M','L','XL','XXL'], ARRAY['Gris'], 'Gris', false, true, false, true, false, NULL, 'Algodón 80%, Poliéster 20%', 'SKU-PH003'),
  ('Jeans Slim Fit Negro', 'jeans-slim-fit-negro-hombre', 'Jeans slim fit en denim negro. Estilo moderno y versátil.', 4499, 38, '{"38":5,"40":8,"42":10,"44":8,"46":5,"48":2}', cat_jeans_hombre, v_hombre, ARRAY['https://images.unsplash.com/photo-1555689502-c4b22d76c56f?w=800'], ARRAY['38','40','42','44','46','48'], ARRAY['38','40','42','44','46','48'], ARRAY['Negro'], 'Negro', false, true, false, false, true, 3149, 'Algodón 92%, Poliéster 6%, Elastano 2%', 'SKU-PH004'),
  ('Shorts Bermuda Lino', 'shorts-bermuda-lino-hombre', 'Bermudas de lino con cintura elástica y cordón. Perfectas para verano.', 2999, 30, '{"S":6,"M":8,"L":8,"XL":5,"XXL":3}', cat_shorts_hombre, v_hombre, ARRAY['https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=800'], ARRAY['S','M','L','XL','XXL'], ARRAY['S','M','L','XL','XXL'], ARRAY['Arena'], 'Arena', false, true, true, false, false, NULL, 'Lino 100%', 'SKU-PH005');

  -- =============================================
  -- HOMBRE - SUDADERAS Y ABRIGOS (5 productos)
  -- =============================================
  INSERT INTO products (name, slug, description, price, stock, stock_by_size, category_id, gender_id, images, sizes, available_sizes, colors, color, featured, is_active, is_sustainable, is_new, is_on_sale, sale_price, material, sku)
  VALUES
  ('Sudadera Crew Neck Básica', 'sudadera-crew-neck-basica', 'Sudadera cuello redondo sin capucha. Interior perchado suave.', 3999, 40, '{"S":8,"M":12,"L":10,"XL":7,"XXL":3}', cat_sudaderas_hombre, v_hombre, ARRAY['https://images.unsplash.com/photo-1578768079470-0a4a2e195d09?w=800'], ARRAY['S','M','L','XL','XXL'], ARRAY['S','M','L','XL','XXL'], ARRAY['Azul Marino'], 'Azul Marino', false, true, false, false, false, NULL, 'Algodón 80%, Poliéster 20%', 'SKU-SH001'),
  ('Hoodie Cremallera Completa', 'hoodie-cremallera-completa', 'Sudadera con capucha y cremallera completa. Doble bolsillo frontal.', 4999, 35, '{"S":7,"M":10,"L":10,"XL":5,"XXL":3}', cat_sudaderas_hombre, v_hombre, ARRAY['https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800','https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=800'], ARRAY['S','M','L','XL','XXL'], ARRAY['S','M','L','XL','XXL'], ARRAY['Negro'], 'Negro', true, true, false, true, false, NULL, 'Algodón 85%, Poliéster 15%', 'SKU-SH002'),
  ('Abrigo Tres Cuartos Lana', 'abrigo-tres-cuartos-lana', 'Abrigo de lana mezcla con cuello alto y cierre cruzado.', 14999, 10, '{"M":3,"L":3,"XL":2,"XXL":2}', cat_abrigos_hombre, v_hombre, ARRAY['https://images.unsplash.com/photo-1544923246-77307dd270b8?w=800'], ARRAY['M','L','XL','XXL'], ARRAY['M','L','XL','XXL'], ARRAY['Gris Oscuro'], 'Gris Oscuro', true, true, false, false, false, NULL, 'Lana 65%, Poliéster 35%', 'SKU-SH003'),
  ('Chaqueta Bomber Nylon', 'chaqueta-bomber-nylon-hombre', 'Bomber clásica en nylon con forro acolchado. Puños y bajo de canalé.', 7999, 20, '{"S":4,"M":6,"L":5,"XL":3,"XXL":2}', cat_abrigos_hombre, v_hombre, ARRAY['https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800'], ARRAY['S','M','L','XL','XXL'], ARRAY['S','M','L','XL','XXL'], ARRAY['Verde Oliva'], 'Verde Oliva', false, true, false, false, true, 5599, 'Nylon 100%', 'SKU-SH004'),
  ('Blazer Casual Desestructurado', 'blazer-casual-desestructurado', 'Blazer sin forro con parche en codos. Elegancia informal.', 8999, 15, '{"S":3,"M":4,"L":4,"XL":2,"XXL":2}', cat_trajes_hombre, v_hombre, ARRAY['https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800'], ARRAY['S','M','L','XL','XXL'], ARRAY['S','M','L','XL','XXL'], ARRAY['Azul Marino'], 'Azul Marino', false, true, false, false, false, NULL, 'Algodón 60%, Lino 40%', 'SKU-SH005');

  -- =============================================
  -- HOMBRE - ZAPATOS (4 productos)
  -- =============================================
  INSERT INTO products (name, slug, description, price, stock, stock_by_size, category_id, gender_id, images, sizes, available_sizes, colors, color, featured, is_active, is_sustainable, is_new, is_on_sale, sale_price, material, sku)
  VALUES
  ('Zapatillas Urbanas Blancas', 'zapatillas-urbanas-blancas-hombre', 'Zapatillas de piel blanca con suela vulcanizada. Estilo limpio.', 7999, 25, '{"40":4,"41":5,"42":6,"43":5,"44":3,"45":2}', cat_zapatillas_hombre, v_hombre, ARRAY['https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800','https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=800'], ARRAY['40','41','42','43','44','45'], ARRAY['40','41','42','43','44','45'], ARRAY['Blanco'], 'Blanco', true, true, false, true, false, NULL, 'Piel vacuno', 'SKU-ZH001'),
  ('Botas Chelsea Ante', 'botas-chelsea-ante-hombre', 'Botines chelsea en ante con suela de goma natural.', 9999, 15, '{"40":2,"41":3,"42":4,"43":3,"44":2,"45":1}', cat_botas_hombre, v_hombre, ARRAY['https://images.unsplash.com/photo-1638247025967-b4e38f787b76?w=800'], ARRAY['40','41','42','43','44','45'], ARRAY['40','41','42','43','44','45'], ARRAY['Marrón'], 'Marrón', false, true, false, false, false, NULL, 'Ante vacuno', 'SKU-ZH002'),
  ('Sneakers Running Técnicas', 'sneakers-running-tecnicas', 'Zapatillas de running con amortiguación reactiva y upper transpirable.', 8999, 20, '{"40":3,"41":4,"42":5,"43":4,"44":3,"45":1}', cat_zapatillas_hombre, v_hombre, ARRAY['https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800'], ARRAY['40','41','42','43','44','45'], ARRAY['40','41','42','43','44','45'], ARRAY['Negro'], 'Negro', false, true, false, false, true, 6299, 'Mesh transpirable', 'SKU-ZH003'),
  ('Mocasines Piel Clásicos', 'mocasines-piel-clasicos', 'Mocasines de piel con antifaz. Elegancia para cualquier ocasión.', 7499, 18, '{"40":3,"41":4,"42":4,"43":4,"44":2,"45":1}', cat_zapatillas_hombre, v_hombre, ARRAY['https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?w=800'], ARRAY['40','41','42','43','44','45'], ARRAY['40','41','42','43','44','45'], ARRAY['Marrón Claro'], 'Marrón Claro', false, true, false, false, false, NULL, 'Piel vacuno', 'SKU-ZH004');

  -- =============================================
  -- INSERTAR EN product_categories (relación M:N)
  -- =============================================
  INSERT INTO product_categories (product_id, category_id)
  SELECT p.id, p.category_id 
  FROM products p
  WHERE p.sku LIKE 'SKU-%'
    AND p.category_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM product_categories pc 
      WHERE pc.product_id = p.id AND pc.category_id = p.category_id
    );

  RAISE NOTICE '✅ Productos demo insertados correctamente';
END $$;

-- 4. Verificación final
SELECT 
  g.name AS genero,
  COUNT(*) AS total_productos,
  SUM(CASE WHEN p.is_sustainable THEN 1 ELSE 0 END) AS sostenibles,
  SUM(CASE WHEN p.is_new THEN 1 ELSE 0 END) AS novedades,
  SUM(CASE WHEN p.is_on_sale THEN 1 ELSE 0 END) AS en_rebajas,
  SUM(CASE WHEN p.featured THEN 1 ELSE 0 END) AS destacados
FROM products p
LEFT JOIN genders g ON p.gender_id = g.id
WHERE p.is_active = true
GROUP BY g.name
ORDER BY g.name;
