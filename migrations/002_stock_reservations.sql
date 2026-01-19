-- ============================================================================
-- MIGRACIÓN: SISTEMA DE RESERVA DE STOCK (Prevenir Overselling)
-- ============================================================================
-- FECHA: 16 de enero de 2026
-- PRIORIDAD: CRÍTICA - Bloqueante de producción
-- PROPÓSITO: Implementar Reserved Stock Pattern para prevenir race conditions
--            en entornos con alta concurrencia
-- ============================================================================

-- ============================================================================
-- TABLA: stock_reservations
-- PROPÓSITO: Registrar reservas temporales de stock durante checkout
-- ============================================================================
CREATE TABLE IF NOT EXISTS stock_reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  session_id TEXT NOT NULL, -- Stripe session ID o temporal
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reserved_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL, -- +15 minutos desde creación
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para optimizar consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_reservations_product ON stock_reservations(product_id);
CREATE INDEX IF NOT EXISTS idx_reservations_session ON stock_reservations(session_id);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON stock_reservations(status);
CREATE INDEX IF NOT EXISTS idx_reservations_expires ON stock_reservations(expires_at, status) 
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_reservations_user ON stock_reservations(user_id);

COMMENT ON TABLE stock_reservations IS 'Reservas temporales de stock durante proceso de checkout. Previene overselling con TTL de 15 minutos.';
COMMENT ON COLUMN stock_reservations.session_id IS 'ID de sesión Stripe o temporal pre-checkout';
COMMENT ON COLUMN stock_reservations.expires_at IS 'Timestamp de expiración (15 min). Reservas expiradas se marcan como expired automáticamente.';
COMMENT ON COLUMN stock_reservations.status IS 'active: reserva vigente | completed: compra exitosa | expired: timeout | cancelled: checkout cancelado';

-- ============================================================================
-- FUNCIÓN: reserve_stock
-- PROPÓSITO: Reservar stock de forma atómica (previene race conditions)
-- RETORNA: JSON con success/error y detalles
-- ============================================================================
CREATE OR REPLACE FUNCTION reserve_stock(
  p_product_id UUID,
  p_quantity INTEGER,
  p_session_id TEXT,
  p_user_id UUID DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_available_stock INTEGER;
  v_reserved_stock INTEGER;
  v_effective_stock INTEGER;
  v_reservation_id UUID;
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
  -- Usa FOR UPDATE para garantizar consistencia en lecturas concurrentes
  SELECT stock INTO v_available_stock
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

  -- Calcular stock actualmente reservado (solo reservas activas no expiradas)
  SELECT COALESCE(SUM(quantity), 0) INTO v_reserved_stock
  FROM stock_reservations
  WHERE product_id = p_product_id
    AND status = 'active'
    AND expires_at > NOW();

  -- Stock efectivo disponible = stock real - stock reservado
  v_effective_stock := v_available_stock - v_reserved_stock;

  -- Validar disponibilidad
  IF v_effective_stock < p_quantity THEN
    RETURN json_build_object(
      'success', false,
      'error', 'insufficient_stock',
      'message', format('Stock insuficiente. Disponible: %s', v_effective_stock),
      'available', v_effective_stock,
      'requested', p_quantity
    );
  END IF;

  -- Crear reserva (TTL: 15 minutos)
  INSERT INTO stock_reservations (
    product_id, 
    quantity, 
    session_id, 
    user_id, 
    expires_at
  )
  VALUES (
    p_product_id, 
    p_quantity, 
    p_session_id, 
    p_user_id, 
    NOW() + INTERVAL '15 minutes'
  )
  RETURNING id INTO v_reservation_id;

  -- Respuesta exitosa
  RETURN json_build_object(
    'success', true,
    'reservation_id', v_reservation_id,
    'reserved', p_quantity,
    'expires_at', (NOW() + INTERVAL '15 minutes')::TEXT,
    'available_stock', v_available_stock,
    'reserved_stock', v_reserved_stock + p_quantity,
    'effective_stock', v_effective_stock - p_quantity
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Capturar errores inesperados
    RETURN json_build_object(
      'success', false,
      'error', 'database_error',
      'message', SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION reserve_stock IS 'Reserva stock de forma atómica con lock de fila. Previene overselling en alta concurrencia.';

-- ============================================================================
-- FUNCIÓN: confirm_reservation
-- PROPÓSITO: Confirmar reserva tras pago exitoso (webhook Stripe)
-- ============================================================================
CREATE OR REPLACE FUNCTION confirm_reservation(
  p_session_id TEXT,
  p_order_id UUID DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_affected_rows INTEGER;
BEGIN
  -- Marcar reservas como completadas
  UPDATE stock_reservations
  SET 
    status = 'completed',
    updated_at = NOW()
  WHERE session_id = p_session_id
    AND status = 'active'
  RETURNING COUNT(*) INTO v_affected_rows;

  IF v_affected_rows = 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'no_reservations_found',
      'message', 'No se encontraron reservas activas para esta sesión'
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'confirmed', v_affected_rows,
    'order_id', p_order_id
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCIÓN: cancel_reservation
-- PROPÓSITO: Cancelar reserva (checkout cancelado o expirado)
-- ============================================================================
CREATE OR REPLACE FUNCTION cancel_reservation(
  p_session_id TEXT,
  p_reason TEXT DEFAULT 'user_cancelled'
) RETURNS JSON AS $$
DECLARE
  v_affected_rows INTEGER;
BEGIN
  UPDATE stock_reservations
  SET 
    status = 'cancelled',
    updated_at = NOW()
  WHERE session_id = p_session_id
    AND status = 'active'
  RETURNING COUNT(*) INTO v_affected_rows;

  IF v_affected_rows = 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'no_reservations_found',
      'message', 'No se encontraron reservas activas para esta sesión'
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'cancelled', v_affected_rows,
    'reason', p_reason
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCIÓN: cleanup_expired_reservations
-- PROPÓSITO: Marcar reservas expiradas (ejecutar periódicamente)
-- USO: Llamar desde CRON cada 5 minutos o vía pg_cron
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_expired_reservations()
RETURNS JSON AS $$
DECLARE
  v_expired_count INTEGER;
BEGIN
  UPDATE stock_reservations
  SET 
    status = 'expired',
    updated_at = NOW()
  WHERE status = 'active'
    AND expires_at < NOW()
  RETURNING COUNT(*) INTO v_expired_count;

  RETURN json_build_object(
    'success', true,
    'expired', v_expired_count,
    'cleaned_at', NOW()
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_reservations IS 'Limpia reservas expiradas. Ejecutar vía CRON cada 5 minutos.';

-- ============================================================================
-- FUNCIÓN: get_effective_stock
-- PROPÓSITO: Obtener stock efectivo (real - reservado)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_effective_stock(p_product_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_real_stock INTEGER;
  v_reserved_stock INTEGER;
BEGIN
  -- Stock real del producto
  SELECT stock INTO v_real_stock
  FROM products
  WHERE id = p_product_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Stock reservado activo
  SELECT COALESCE(SUM(quantity), 0) INTO v_reserved_stock
  FROM stock_reservations
  WHERE product_id = p_product_id
    AND status = 'active'
    AND expires_at > NOW();

  RETURN GREATEST(v_real_stock - v_reserved_stock, 0);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_effective_stock IS 'Calcula stock disponible real descontando reservas activas.';

-- ============================================================================
-- VISTA: active_reservations_summary
-- PROPÓSITO: Resumen de reservas activas por producto
-- ============================================================================
CREATE OR REPLACE VIEW active_reservations_summary AS
SELECT 
  p.id AS product_id,
  p.name AS product_name,
  p.slug AS product_slug,
  p.stock AS real_stock,
  COALESCE(SUM(sr.quantity), 0) AS reserved_stock,
  p.stock - COALESCE(SUM(sr.quantity), 0) AS effective_stock,
  COUNT(sr.id) AS active_reservations
FROM products p
LEFT JOIN stock_reservations sr ON sr.product_id = p.id
  AND sr.status = 'active'
  AND sr.expires_at > NOW()
WHERE p.is_active = true
GROUP BY p.id, p.name, p.slug, p.stock
ORDER BY reserved_stock DESC;

COMMENT ON VIEW active_reservations_summary IS 'Vista para monitoreo: stock real vs reservado por producto.';

-- ============================================================================
-- TRIGGER: Auto-actualizar updated_at
-- ============================================================================
CREATE TRIGGER trigger_reservations_updated_at
  BEFORE UPDATE ON stock_reservations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ÍNDICE PARCIAL: Solo reservas activas (optimización)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_active_reservations_product ON stock_reservations(product_id, quantity)
  WHERE status = 'active';

-- ============================================================================
-- DATOS DE PRUEBA (Opcional - comentar en producción)
-- ============================================================================
-- Ejemplo de uso:
-- SELECT reserve_stock(
--   'product-uuid-here',
--   2,
--   'session_temp_123456',
--   'user-uuid-here'
-- );

-- ============================================================================
-- VERIFICACIÓN DE INSTALACIÓN
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Migración 002_stock_reservations completada';
  RAISE NOTICE 'Tabla: stock_reservations creada';
  RAISE NOTICE 'Funciones: reserve_stock, confirm_reservation, cancel_reservation, cleanup_expired_reservations';
  RAISE NOTICE 'Vista: active_reservations_summary';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  ACCIÓN REQUERIDA:';
  RAISE NOTICE '1. Configurar CRON job para ejecutar cleanup_expired_reservations() cada 5 minutos';
  RAISE NOTICE '2. Actualizar API /api/checkout/create-session para usar reserve_stock()';
  RAISE NOTICE '3. Actualizar webhook Stripe para confirmar/cancelar reservas';
END $$;
