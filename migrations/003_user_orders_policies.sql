-- =====================================================
-- Migración 003: Políticas RLS para pedidos de usuarios
-- =====================================================
-- Problema: Los usuarios no pueden ver sus propios pedidos
-- Causa: Política comentada en schema original
-- Solución: Habilitar políticas para que usuarios vean sus pedidos
-- =====================================================

BEGIN;

-- =====================================================
-- 1. Políticas para tabla orders
-- =====================================================

-- Eliminar políticas existentes si existen (para hacer la migración idempotente)
DROP POLICY IF EXISTS "Users can view their own orders" ON orders;
DROP POLICY IF EXISTS "Users can create their own orders" ON orders;
DROP POLICY IF EXISTS "Users can update their own orders" ON orders;

-- Permitir a usuarios ver sus propios pedidos
CREATE POLICY "Users can view their own orders"
  ON orders FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Permitir a usuarios crear pedidos (usado por webhook con service role)
-- Esta política no afecta porque el webhook usa service_role
CREATE POLICY "Users can create their own orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Permitir a usuarios actualizar el estado de sus pedidos (usado por API de cancelación)
CREATE POLICY "Users can update their own orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =====================================================
-- 2. Políticas para tabla order_items
-- =====================================================

-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Users can view items of their orders" ON order_items;
DROP POLICY IF EXISTS "Users can create items for their orders" ON order_items;

-- Permitir a usuarios ver los items de sus propios pedidos
CREATE POLICY "Users can view items of their orders"
  ON order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
  );

-- Permitir crear items (usado por webhook con service role)
CREATE POLICY "Users can create items for their orders"
  ON order_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
  );

-- =====================================================
-- 3. Verificar que RLS está habilitado
-- =====================================================

-- Asegurar que RLS está habilitado en ambas tablas
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

COMMIT;

-- =====================================================
-- Notas:
-- - Las políticas de service_role ya existen y tienen prioridad
-- - Estas políticas solo afectan a usuarios autenticados con anon key
-- - El webhook (service role) ignora RLS y puede hacer todo
-- - Política de UPDATE permite cancelación desde frontend
-- =====================================================
