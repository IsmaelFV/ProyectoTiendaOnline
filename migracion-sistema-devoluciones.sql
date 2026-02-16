-- ============================================================================
-- MIGRACIÓN: Sistema Completo de Cancelaciones y Devoluciones (2 fases)
-- ============================================================================
-- Fase 1: Cancelación (<2h desde el pedido) → reembolso inmediato
-- Fase 2: Devolución (>2h) → solicitar reembolso con plazo 1 semana
-- ============================================================================

-- 1. Añadir 'return_requested' al CHECK constraint de orders.status
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN (
  'pending', 'confirmed', 'processing', 'shipped', 'delivered', 
  'cancelled', 'refunded', 'return_requested'
));

-- 2. Añadir campo customer_email a orders si no existe
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'customer_email') THEN
    ALTER TABLE orders ADD COLUMN customer_email VARCHAR(255);
  END IF;
END $$;

-- 3. Actualizar tabla returns: añadir campos para el nuevo sistema
-- Tipo de solicitud: cancellation (<2h) o return (>2h)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'returns' AND column_name = 'type') THEN
    ALTER TABLE returns ADD COLUMN type VARCHAR(20) DEFAULT 'return' CHECK (type IN ('cancellation', 'return'));
  END IF;
END $$;

-- Descripción detallada del cliente
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'returns' AND column_name = 'description') THEN
    ALTER TABLE returns ADD COLUMN description TEXT;
  END IF;
END $$;

-- Fecha límite para devolver el producto (1 semana desde la solicitud)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'returns' AND column_name = 'return_deadline') THEN
    ALTER TABLE returns ADD COLUMN return_deadline TIMESTAMPTZ;
  END IF;
END $$;

-- Fecha en que el producto fue recibido por la tienda
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'returns' AND column_name = 'received_at') THEN
    ALTER TABLE returns ADD COLUMN received_at TIMESTAMPTZ;
  END IF;
END $$;

-- ID del reembolso de Stripe
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'returns' AND column_name = 'stripe_refund_id') THEN
    ALTER TABLE returns ADD COLUMN stripe_refund_id VARCHAR(255);
  END IF;
END $$;

-- Email del cliente para la devolución
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'returns' AND column_name = 'customer_email') THEN
    ALTER TABLE returns ADD COLUMN customer_email VARCHAR(255);
  END IF;
END $$;

-- Fecha de solicitud
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'returns' AND column_name = 'requested_at') THEN
    ALTER TABLE returns ADD COLUMN requested_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- 4. Actualizar el CHECK de reason para incluir más opciones
ALTER TABLE returns DROP CONSTRAINT IF EXISTS returns_reason_check;
ALTER TABLE returns ADD CONSTRAINT returns_reason_check CHECK (reason IN (
  'defective', 'wrong_item', 'wrong_size', 'not_as_described', 
  'changed_mind', 'too_late', 'better_price', 'other'
));

-- 5. Hacer que algunos campos NOT NULL sean opcionales para cancelaciones
-- (items puede ser null en cancelaciones rápidas)
ALTER TABLE returns ALTER COLUMN items DROP NOT NULL;
ALTER TABLE returns ALTER COLUMN return_number DROP NOT NULL;

-- 6. Actualizar constraint de status de returns para incluir 'expired'
ALTER TABLE returns DROP CONSTRAINT IF EXISTS returns_status_check;
ALTER TABLE returns ADD CONSTRAINT returns_status_check CHECK (status IN (
  'pending', 'approved', 'rejected', 'received', 'refunded', 'cancelled', 'expired'
));

-- 7. Función para auto-expirar devoluciones pasado el plazo
CREATE OR REPLACE FUNCTION expire_overdue_returns()
RETURNS void AS $$
BEGIN
  UPDATE returns
  SET status = 'expired',
      admin_notes = COALESCE(admin_notes, '') || E'\n[SISTEMA] Devolución expirada automáticamente por superar el plazo de 7 días.',
      updated_at = NOW()
  WHERE status IN ('pending', 'approved')
    AND type = 'return'
    AND return_deadline IS NOT NULL
    AND return_deadline < NOW()
    AND status != 'expired';
    
  -- También actualizar el estado del pedido asociado
  UPDATE orders
  SET status = 'delivered',
      updated_at = NOW()
  WHERE id IN (
    SELECT order_id FROM returns 
    WHERE status = 'expired' 
    AND updated_at >= NOW() - INTERVAL '1 minute'
  )
  AND status = 'return_requested';
END;
$$ LANGUAGE plpgsql;

-- 8. Políticas RLS para service role en returns (para las APIs)
DROP POLICY IF EXISTS "Service role can manage all returns" ON returns;
CREATE POLICY "Service role can manage all returns"
ON returns FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage all orders" ON orders;
CREATE POLICY "Service role can manage all orders"
ON orders FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 9. Verificación
SELECT '✅ MIGRACIÓN COMPLETADA: Sistema de cancelaciones y devoluciones actualizado' AS resultado;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'returns' 
ORDER BY ordinal_position;
