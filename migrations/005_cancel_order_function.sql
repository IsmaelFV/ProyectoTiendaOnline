-- =====================================================
-- Migración 005: Función de cancelación atómica
-- =====================================================
-- Función para cancelar un pedido y restaurar stock automáticamente
-- Garantiza atomicidad: todo o nada
-- Reutiliza la función increment_stock() existente
-- =====================================================

BEGIN;

-- =====================================================
-- Función: cancel_order_and_restore_stock
-- =====================================================
-- Cancela un pedido y restaura el stock de todos los productos
-- del pedido de forma atómica (transacción implícita)
--
-- Parámetros:
--   p_order_id: UUID del pedido a cancelar
--   p_user_id: UUID del usuario (para verificación de permisos)
--
-- Retorna:
--   JSON con success:boolean y message:text
--
-- Validaciones:
--   - El pedido existe
--   - El pedido pertenece al usuario
--   - El estado es 'confirmed' o 'processing' (no se puede cancelar si ya está shipped)
--   - Restaura stock de TODOS los productos en order_items
-- =====================================================

CREATE OR REPLACE FUNCTION cancel_order_and_restore_stock(
  p_order_id UUID,
  p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_status TEXT;
  v_order_user_id UUID;
  v_item RECORD;
  v_restored_count INTEGER := 0;
BEGIN
  -- 1. Verificar que el pedido existe y obtener su estado
  SELECT status, user_id 
  INTO v_current_status, v_order_user_id
  FROM orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Pedido no encontrado'
    );
  END IF;

  -- 2. Verificar que el pedido pertenece al usuario
  IF v_order_user_id != p_user_id THEN
    RETURN json_build_object(
      'success', false,
      'message', 'No tienes permiso para cancelar este pedido'
    );
  END IF;

  -- 3. Verificar que el estado permite cancelación
  IF v_current_status NOT IN ('confirmed', 'processing') THEN
    RETURN json_build_object(
      'success', false,
      'message', format('No se puede cancelar un pedido en estado "%s". Solo se pueden cancelar pedidos confirmados o en proceso.', v_current_status)
    );
  END IF;

  -- 4. Restaurar stock de todos los productos del pedido
  FOR v_item IN 
    SELECT product_id, quantity
    FROM order_items
    WHERE order_id = p_order_id
  LOOP
    -- Reutilizar la función existente increment_stock()
    PERFORM increment_stock(v_item.product_id, v_item.quantity);
    v_restored_count := v_restored_count + 1;
  END LOOP;

  -- 5. Actualizar el estado del pedido a 'cancelled'
  UPDATE orders
  SET 
    status = 'cancelled',
    updated_at = NOW()
  WHERE id = p_order_id;

  -- 6. Retornar éxito
  RETURN json_build_object(
    'success', true,
    'message', format('Pedido cancelado correctamente. Stock restaurado para %s productos.', v_restored_count),
    'restored_items', v_restored_count
  );

EXCEPTION
  WHEN OTHERS THEN
    -- En caso de error, la transacción se revierte automáticamente
    RETURN json_build_object(
      'success', false,
      'message', format('Error al cancelar pedido: %s', SQLERRM)
    );
END;
$$;

-- Agregar comentario descriptivo
COMMENT ON FUNCTION cancel_order_and_restore_stock IS 
'Cancela un pedido y restaura el stock de forma atómica. Solo permite cancelar pedidos en estado confirmed o processing.';

-- =====================================================
-- Permisos RLS (Row Level Security)
-- =====================================================
-- Permitir que usuarios autenticados llamen a esta función
-- (la verificación de permisos está DENTRO de la función)
GRANT EXECUTE ON FUNCTION cancel_order_and_restore_stock TO authenticated;

COMMIT;

-- =====================================================
-- Notas:
-- - Reutiliza increment_stock() existente (NO duplica código)
-- - Transacción implícita garantiza atomicidad
-- - Validaciones de seguridad en la función misma
-- - Retorna JSON para feedback claro al frontend
-- =====================================================
