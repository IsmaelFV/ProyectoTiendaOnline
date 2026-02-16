-- ============================================================================
-- MIGRACIÓN: Stock Atómico Anti-Race-Condition
-- ============================================================================
-- PROPÓSITO: Función SQL que valida y decrementa stock de forma 100% atómica
--            usando FOR UPDATE para bloqueo pesimista, evitando que dos
--            compradores simultáneos compren el último stock.
-- ============================================================================

-- ============================================================================
-- 1. FUNCIÓN ATÓMICA: validate_and_decrement_stock
-- ============================================================================
-- Valida disponibilidad y decrementa en una sola transacción con bloqueo
-- Retorna JSON con éxito o error detallado por item
-- ============================================================================
CREATE OR REPLACE FUNCTION validate_and_decrement_stock(
  p_items JSONB  -- Array de objetos: [{"product_id": "uuid", "size": "M", "quantity": 2}, ...]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item JSONB;
  v_product_id UUID;
  v_size TEXT;
  v_quantity INTEGER;
  v_current_stock INTEGER;
  v_stock_by_size JSONB;
  v_product_name TEXT;
  v_errors JSONB := '[]'::JSONB;
  v_has_errors BOOLEAN := false;
BEGIN
  -- =====================================================================
  -- FASE 1: VALIDAR TODO PRIMERO (con bloqueo FOR UPDATE en cada producto)
  -- =====================================================================
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item ->> 'product_id')::UUID;
    v_size := COALESCE(v_item ->> 'size', 'Única');
    v_quantity := (v_item ->> 'quantity')::INTEGER;

    -- Bloquear fila del producto (previene race conditions)
    SELECT name, stock, stock_by_size
    INTO v_product_name, v_current_stock, v_stock_by_size
    FROM products
    WHERE id = v_product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      v_has_errors := true;
      v_errors := v_errors || jsonb_build_object(
        'product_id', v_product_id,
        'error', 'not_found',
        'message', 'Producto no encontrado'
      );
      CONTINUE;
    END IF;

    -- Obtener stock de la talla específica
    IF v_stock_by_size IS NOT NULL AND v_stock_by_size ? v_size THEN
      v_current_stock := (v_stock_by_size ->> v_size)::INTEGER;
    END IF;

    -- Verificar disponibilidad
    IF v_current_stock < v_quantity THEN
      v_has_errors := true;
      v_errors := v_errors || jsonb_build_object(
        'product_id', v_product_id,
        'product_name', v_product_name,
        'size', v_size,
        'error', 'insufficient_stock',
        'available', v_current_stock,
        'requested', v_quantity,
        'message', format('No hay suficiente stock de %s en talla %s (disponible: %s, solicitado: %s)',
          v_product_name, v_size, v_current_stock, v_quantity)
      );
    END IF;
  END LOOP;

  -- Si hay errores, abortar SIN decrementar nada (todo o nada)
  IF v_has_errors THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'stock_validation_failed',
      'message', 'No se pudo completar la compra por falta de stock',
      'details', v_errors
    );
  END IF;

  -- =====================================================================
  -- FASE 2: DECREMENTAR TODO (ya validado, con bloqueo activo)
  -- =====================================================================
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item ->> 'product_id')::UUID;
    v_size := COALESCE(v_item ->> 'size', 'Única');
    v_quantity := (v_item ->> 'quantity')::INTEGER;

    -- Decrementar stock de la talla específica Y el stock global
    UPDATE products
    SET
      stock_by_size = jsonb_set(
        stock_by_size,
        ARRAY[v_size],
        to_jsonb((stock_by_size ->> v_size)::INTEGER - v_quantity)
      ),
      stock = stock - v_quantity,
      updated_at = NOW()
    WHERE id = v_product_id;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Stock actualizado correctamente',
    'items_processed', jsonb_array_length(p_items)
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Cualquier error hace rollback automático de toda la transacción
    RETURN jsonb_build_object(
      'success', false,
      'error', 'database_error',
      'message', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION validate_and_decrement_stock IS
'Valida y decrementa stock de múltiples productos/tallas de forma atómica.
Usa FOR UPDATE para prevenir race conditions. Si algún item no tiene stock
suficiente, no se decrementa NADA (todo o nada).';

-- ============================================================================
-- 2. VERIFICACIÓN
-- ============================================================================
SELECT 'Función validate_and_decrement_stock creada correctamente' AS resultado;
