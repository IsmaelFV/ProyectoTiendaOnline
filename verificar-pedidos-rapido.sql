-- =====================================================
-- VERIFICACIÓN RÁPIDA: ¿Por qué no veo mis pedidos?
-- =====================================================

-- 1️⃣ ¿Hay pedidos en la base de datos?
SELECT COUNT(*) as total_pedidos FROM orders;

-- 2️⃣ Ver últimos 5 pedidos (con o sin user_id)
SELECT 
  order_number,
  CASE 
    WHEN user_id IS NULL THEN '❌ INVITADO'
    ELSE '✅ ' || user_id
  END as usuario,
  status,
  total,
  TO_CHAR(created_at, 'DD/MM/YYYY HH24:MI') as fecha
FROM orders
ORDER BY created_at DESC
LIMIT 5;

-- 3️⃣ Verificar políticas RLS
SELECT policyname FROM pg_policies WHERE tablename = 'orders';

-- 4️⃣ Probar acceso directo (SIN RLS)
-- Esta consulta usa privilegios de admin
SELECT 
  order_number,
  user_id,
  status,
  total
FROM orders
ORDER BY created_at DESC
LIMIT 3;
