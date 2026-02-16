-- ============================================================================
-- MIGRACIÓN: STOCK INDEPENDIENTE POR TALLA
-- ============================================================================
-- PROPÓSITO: Cambiar de un stock global único a stock independiente por cada
--            talla del producto usando un campo JSONB stock_by_size.
--            Ejemplo: {"S": 10, "M": 15, "L": 8, "XL": 5}
-- 
-- EJECUCIÓN: Copiar y pegar en Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- 1. AÑADIR COLUMNA stock_by_size A products
-- ============================================================================
ALTER TABLE products
ADD COLUMN IF NOT EXISTS stock_by_size JSONB DEFAULT '{}';

COMMENT ON COLUMN products.stock_by_size IS 
'Stock independiente por talla. Formato: {"S": 10, "M": 15, "L": 8}. 
El campo stock (global) se mantiene como la SUMA total para compatibilidad.';

-- ============================================================================
-- 2. MIGRAR DATOS EXISTENTES
-- ============================================================================
-- Para productos que ya tienen tallas, distribuir el stock actual equitativamente
-- Para productos con talla única, asignar todo el stock a esa talla
UPDATE products
SET stock_by_size = (
  CASE
    -- Si no tiene tallas o es vacío, asignar todo a "Única"
    WHEN sizes IS NULL OR array_length(sizes, 1) IS NULL THEN
      jsonb_build_object('Única', stock)
    -- Si tiene una sola talla
    WHEN array_length(sizes, 1) = 1 THEN
      jsonb_build_object(sizes[1], stock)
    -- Si tiene múltiples tallas, distribuir equitativamente
    ELSE (
      SELECT jsonb_object_agg(
        s,
        CASE 
          WHEN row_number = array_length(sizes, 1) 
          THEN stock - (floor(stock::numeric / array_length(sizes, 1)) * (array_length(sizes, 1) - 1))
          ELSE floor(stock::numeric / array_length(sizes, 1))
        END
      )
      FROM (
        SELECT unnest(sizes) AS s, 
               row_number() OVER () AS row_number
      ) sub
    )
  END
)
WHERE stock_by_size IS NULL OR stock_by_size = '{}';

-- ============================================================================
-- 3. AÑADIR COLUMNA size A stock_reservations (para reservar por talla)
-- ============================================================================
ALTER TABLE stock_reservations
ADD COLUMN IF NOT EXISTS size TEXT DEFAULT NULL;

COMMENT ON COLUMN stock_reservations.size IS 
'Talla específica de la reserva. Ej: "M", "42", "Única"';

CREATE INDEX IF NOT EXISTS idx_reservations_size ON stock_reservations(product_id, size)
  WHERE status = 'active';

-- ============================================================================
-- 4. ACTUALIZAR FUNCIÓN reserve_stock (AÑADIR PARÁMETRO size)
-- ============================================================================
-- Eliminar versiones anteriores para evitar ambigüedad
DROP FUNCTION IF EXISTS reserve_stock(UUID, INTEGER, TEXT, UUID);
DROP FUNCTION IF EXISTS reserve_stock(UUID, INTEGER, TEXT, UUID, TEXT);

CREATE OR REPLACE FUNCTION reserve_stock(
  p_product_id UUID,
  p_quantity INTEGER,
  p_session_id TEXT,
  p_user_id UUID DEFAULT NULL,
  p_size TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_available_stock INTEGER;
  v_reserved_stock INTEGER;
  v_effective_stock INTEGER;
  v_reservation_id UUID;
  v_stock_by_size JSONB;
  v_size TEXT;
BEGIN
  -- Validar entrada
  IF p_quantity <= 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'invalid_quantity',
      'message', 'La cantidad debe ser mayor a 0'
    );
  END IF;

  -- ⭐ LOCK la fila del producto (previene race conditions)
  SELECT stock, stock_by_size INTO v_available_stock, v_stock_by_size
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  -- Verificar que el producto existe
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'product_not_found',
      'message', 'Producto no encontrado'
    );
  END IF;

  -- Determinar la talla a usar
  v_size := COALESCE(p_size, 'Única');

  -- Obtener stock de la talla específica
  IF v_stock_by_size IS NOT NULL AND v_stock_by_size ? v_size THEN
    v_available_stock := (v_stock_by_size ->> v_size)::INTEGER;
  ELSE
    -- Fallback al stock global si no hay stock_by_size para esta talla
    v_available_stock := v_available_stock;
  END IF;

  -- Calcular stock actualmente reservado para ESTA TALLA
  SELECT COALESCE(SUM(quantity), 0) INTO v_reserved_stock
  FROM stock_reservations
  WHERE product_id = p_product_id
    AND (size = v_size OR (size IS NULL AND p_size IS NULL))
    AND status = 'active'
    AND expires_at > NOW();

  -- Stock efectivo disponible = stock talla - stock reservado talla
  v_effective_stock := v_available_stock - v_reserved_stock;

  -- Validar disponibilidad
  IF v_effective_stock < p_quantity THEN
    RETURN json_build_object(
      'success', false,
      'error', 'insufficient_stock',
      'message', format('Stock insuficiente para talla %s. Disponible: %s', v_size, v_effective_stock),
      'available', v_effective_stock,
      'requested', p_quantity,
      'size', v_size
    );
  END IF;

  -- Crear reserva con talla (TTL: 15 minutos)
  INSERT INTO stock_reservations (
    product_id, 
    quantity, 
    session_id, 
    user_id,
    size,
    expires_at
  )
  VALUES (
    p_product_id, 
    p_quantity, 
    p_session_id, 
    p_user_id,
    v_size,
    NOW() + INTERVAL '15 minutes'
  )
  RETURNING id INTO v_reservation_id;

  RETURN json_build_object(
    'success', true,
    'reservation_id', v_reservation_id,
    'reserved', p_quantity,
    'size', v_size,
    'expires_at', (NOW() + INTERVAL '15 minutes')::TEXT,
    'available_stock', v_available_stock,
    'reserved_stock', v_reserved_stock + p_quantity,
    'effective_stock', v_effective_stock - p_quantity
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'database_error',
      'message', SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. ACTUALIZAR FUNCIÓN decrement_stock (POR TALLA)
-- ============================================================================
-- Eliminar versiones anteriores para evitar ambigüedad
DROP FUNCTION IF EXISTS decrement_stock(UUID, INTEGER);
DROP FUNCTION IF EXISTS decrement_stock(UUID, INTEGER, TEXT);

CREATE OR REPLACE FUNCTION decrement_stock(
  product_id UUID,
  quantity INTEGER,
  p_size TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_size TEXT;
  v_current_size_stock INTEGER;
BEGIN
  v_size := COALESCE(p_size, 'Única');

  -- Verificar stock de la talla
  SELECT (stock_by_size ->> v_size)::INTEGER INTO v_current_size_stock
  FROM products
  WHERE id = product_id
  FOR UPDATE;

  IF v_current_size_stock IS NULL OR v_current_size_stock < quantity THEN
    RAISE EXCEPTION 'Stock insuficiente para talla % (disponible: %, solicitado: %)', 
      v_size, COALESCE(v_current_size_stock, 0), quantity;
  END IF;

  -- Decrementar stock de la talla específica Y el stock global
  UPDATE products
  SET 
    stock_by_size = jsonb_set(
      stock_by_size, 
      ARRAY[v_size], 
      to_jsonb((stock_by_size ->> v_size)::INTEGER - quantity)
    ),
    stock = stock - quantity,
    updated_at = NOW()
  WHERE 
    id = product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto no encontrado';
  END IF;
END;
$$;

COMMENT ON FUNCTION decrement_stock IS 
'Decrementa el stock de una talla específica y el stock global. 
Falla si no hay suficiente stock para esa talla.';

-- ============================================================================
-- 6. ACTUALIZAR FUNCIÓN increment_stock (POR TALLA)
-- ============================================================================
-- Eliminar versiones anteriores para evitar ambigüedad
DROP FUNCTION IF EXISTS increment_stock(UUID, INTEGER);
DROP FUNCTION IF EXISTS increment_stock(UUID, INTEGER, TEXT);

CREATE OR REPLACE FUNCTION increment_stock(
  product_id UUID,
  quantity INTEGER,
  p_size TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_size TEXT;
BEGIN
  v_size := COALESCE(p_size, 'Única');

  -- Incrementar stock de la talla específica Y el stock global
  UPDATE products
  SET 
    stock_by_size = jsonb_set(
      COALESCE(stock_by_size, '{}'::jsonb),
      ARRAY[v_size], 
      to_jsonb(COALESCE((stock_by_size ->> v_size)::INTEGER, 0) + quantity)
    ),
    stock = stock + quantity,
    updated_at = NOW()
  WHERE 
    id = product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto no encontrado';
  END IF;
END;
$$;

COMMENT ON FUNCTION increment_stock IS 
'Incrementa el stock de una talla específica. Se usa en cancelaciones/devoluciones.';

-- ============================================================================
-- 7. FUNCIÓN HELPER: get_effective_stock POR TALLA
-- ============================================================================
-- Eliminar versiones anteriores para evitar ambigüedad
DROP FUNCTION IF EXISTS get_effective_stock(UUID);
DROP FUNCTION IF EXISTS get_effective_stock(UUID, TEXT);

CREATE OR REPLACE FUNCTION get_effective_stock(
  p_product_id UUID,
  p_size TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_real_stock INTEGER;
  v_reserved_stock INTEGER;
  v_size TEXT;
  v_stock_by_size JSONB;
BEGIN
  v_size := COALESCE(p_size, 'Única');

  SELECT stock, stock_by_size INTO v_real_stock, v_stock_by_size
  FROM products
  WHERE id = p_product_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Usar stock de la talla si existe
  IF v_stock_by_size IS NOT NULL AND v_stock_by_size ? v_size THEN
    v_real_stock := (v_stock_by_size ->> v_size)::INTEGER;
  END IF;

  -- Stock reservado activo para esta talla
  SELECT COALESCE(SUM(quantity), 0) INTO v_reserved_stock
  FROM stock_reservations
  WHERE product_id = p_product_id
    AND (size = v_size OR (size IS NULL AND p_size IS NULL))
    AND status = 'active'
    AND expires_at > NOW();

  RETURN GREATEST(v_real_stock - v_reserved_stock, 0);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. ACTUALIZAR VISTA active_reservations_summary
-- ============================================================================
DROP VIEW IF EXISTS active_reservations_summary;

CREATE OR REPLACE VIEW active_reservations_summary AS
SELECT 
  p.id AS product_id,
  p.name AS product_name,
  p.slug AS product_slug,
  p.stock AS total_stock,
  p.stock_by_size,
  sr.size AS reservation_size,
  COALESCE(SUM(sr.quantity), 0) AS reserved_stock,
  COUNT(sr.id) AS active_reservations
FROM products p
LEFT JOIN stock_reservations sr ON sr.product_id = p.id
  AND sr.status = 'active'
  AND sr.expires_at > NOW()
WHERE p.is_active = true
GROUP BY p.id, p.name, p.slug, p.stock, p.stock_by_size, sr.size
ORDER BY reserved_stock DESC;

-- ============================================================================
-- 9. FUNCIÓN HELPER: Recalcular stock global desde stock_by_size
-- ============================================================================
DROP FUNCTION IF EXISTS recalculate_total_stock(UUID);

CREATE OR REPLACE FUNCTION recalculate_total_stock(p_product_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_total INTEGER;
BEGIN
  SELECT COALESCE(
    (SELECT SUM(value::INTEGER) 
     FROM jsonb_each_text(stock_by_size)), 
    0
  ) INTO v_total
  FROM products
  WHERE id = p_product_id;

  UPDATE products
  SET stock = v_total, updated_at = NOW()
  WHERE id = p_product_id;

  RETURN v_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION recalculate_total_stock IS 
'Recalcula el stock global sumando todos los valores de stock_by_size.';

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Migración stock-por-talla completada';
  RAISE NOTICE 'Columna: products.stock_by_size (JSONB) añadida';
  RAISE NOTICE 'Columna: stock_reservations.size (TEXT) añadida';
  RAISE NOTICE 'Funciones actualizadas: reserve_stock, decrement_stock, increment_stock, get_effective_stock';
  RAISE NOTICE 'Nueva función: recalculate_total_stock';
  RAISE NOTICE 'Vista actualizada: active_reservations_summary';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  El stock global (products.stock) se mantiene como la SUMA de todas las tallas';
  RAISE NOTICE '⚠️  Los productos existentes se han migrado distribuyendo el stock equitativamente';
  RAISE NOTICE '⚠️  REVISA los productos y ajusta el stock por talla manualmente si necesario';
END $$;
