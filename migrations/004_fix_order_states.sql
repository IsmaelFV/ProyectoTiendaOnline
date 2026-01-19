-- =====================================================
-- Migración 004: Arreglar estados de pedidos
-- =====================================================
-- Problema: El webhook usa 'confirmed' pero el CHECK constraint no lo incluye
-- Solución: Agregar 'confirmed' a los estados permitidos
-- Impacto: Sin riesgo (solo agrega estado, no modifica datos existentes)
-- =====================================================

BEGIN;

-- 1. Eliminar el constraint antiguo si existe
ALTER TABLE orders 
  DROP CONSTRAINT IF EXISTS orders_status_check;

-- 2. Agregar el nuevo constraint con 'confirmed' incluido
ALTER TABLE orders 
  ADD CONSTRAINT orders_status_check 
  CHECK (status IN (
    'pending',      -- Pedido creado, esperando pago
    'confirmed',    -- Pago confirmado por Stripe (usado por webhook)
    'processing',   -- En preparación
    'paid',         -- Pagado (alternativo a confirmed)
    'shipped',      -- Enviado
    'delivered',    -- Entregado
    'cancelled',    -- Cancelado (con stock restaurado)
    'refunded'      -- Reembolsado
  ));

-- 3. Verificar que no hay datos huérfanos (opcional, para debug)
-- Si esta query retorna filas, hay estados inválidos en la DB
DO $$
DECLARE
  invalid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO invalid_count
  FROM orders
  WHERE status NOT IN ('pending', 'confirmed', 'processing', 'paid', 'shipped', 'delivered', 'cancelled', 'refunded');
  
  IF invalid_count > 0 THEN
    RAISE WARNING 'Se encontraron % pedidos con estados inválidos. Revisar manualmente.', invalid_count;
  ELSE
    RAISE NOTICE 'Todos los pedidos tienen estados válidos ✓';
  END IF;
END $$;

COMMIT;

-- =====================================================
-- Notas:
-- - Esta migración es segura y no modifica datos existentes
-- - Solo expande los valores permitidos en el constraint
-- - Los pedidos existentes con 'confirmed' ahora son válidos
-- =====================================================
