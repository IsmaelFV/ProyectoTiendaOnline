-- =====================================================
-- DIAGNÓSTICO: Por qué no aparecen los pedidos
-- =====================================================
-- Ejecuta estas queries paso a paso en Supabase SQL Editor
-- para identificar el problema
-- =====================================================

-- =====================================================
-- 1. Verificar si hay pedidos en la tabla orders
-- =====================================================
SELECT 
  id, 
  order_number, 
  user_id, 
  status, 
  total, 
  created_at,
  shipping_full_name
FROM orders
ORDER BY created_at DESC
LIMIT 10;

-- ❓ PREGUNTA: ¿Ves pedidos aquí?
-- ✅ SÍ → Continúa al paso 2
-- ❌ NO → El problema es que no se están creando pedidos (problema en webhook)

-- =====================================================
-- 2. Verificar el valor de user_id en los pedidos
-- =====================================================
SELECT 
  order_number,
  user_id,
  CASE 
    WHEN user_id IS NULL THEN '⚠️ NULL (pedido de invitado)'
    ELSE '✅ Tiene user_id'
  END as user_status,
  shipping_full_name,
  total
FROM orders
ORDER BY created_at DESC
LIMIT 10;

-- ❓ PREGUNTA: ¿Los pedidos tienen user_id o son NULL?
-- ⚠️ NULL → Los pedidos se crearon como invitado
-- ✅ UUID → Continúa al paso 3

-- =====================================================
-- 3. Obtener tu user_id actual de Supabase Auth
-- =====================================================
-- Ejecuta esto en tu navegador (Console F12):
-- 
-- const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
-- const supabase = createClient(
--   'TU_SUPABASE_URL',
--   'TU_ANON_KEY'
-- );
-- const { data: { session } } = await supabase.auth.getSession();
-- console.log('Mi user_id:', session?.user?.id);
--
-- Copia el user_id y úsalo en la siguiente query:

-- =====================================================
-- 4. Buscar pedidos con tu user_id específico
-- =====================================================
-- REEMPLAZA 'TU_USER_ID_AQUI' con el ID que obtuviste
SELECT 
  order_number,
  user_id,
  status,
  total,
  created_at,
  shipping_full_name
FROM orders
WHERE user_id = 'TU_USER_ID_AQUI'
ORDER BY created_at DESC;

-- ❓ PREGUNTA: ¿Aparecen pedidos aquí?
-- ✅ SÍ → El problema es RLS, continúa al paso 5
-- ❌ NO → Los pedidos se crearon con otro user_id o como invitado

-- =====================================================
-- 5. Verificar políticas RLS activas
-- =====================================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('orders', 'order_items')
ORDER BY tablename, policyname;

-- ❓ PREGUNTA: ¿Ves estas políticas?
-- ✅ "Users can view their own orders" → RLS configurado correctamente
-- ✅ "Users can view items of their orders" → RLS configurado correctamente
-- ❌ NO aparecen → Las migraciones no se aplicaron correctamente

-- =====================================================
-- 6. Probar consulta con RLS simulando usuario
-- =====================================================
-- Esta query simula lo que hace el frontend
-- REEMPLAZA 'TU_USER_ID_AQUI' con tu user_id
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims.sub TO 'TU_USER_ID_AQUI';

SELECT 
  id,
  order_number,
  status,
  total,
  created_at
FROM orders
WHERE user_id = 'TU_USER_ID_AQUI';

RESET ROLE;

-- ❓ PREGUNTA: ¿Aparecen pedidos con esta query?
-- ✅ SÍ → RLS funciona, problema en frontend
-- ❌ NO → RLS bloqueando incorrectamente

-- =====================================================
-- 7. Verificar que RLS está habilitado
-- =====================================================
SELECT 
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN ('orders', 'order_items')
AND schemaname = 'public';

-- Debe mostrar rowsecurity = true para ambas tablas

-- =====================================================
-- RESUMEN DE DIAGNÓSTICO
-- =====================================================
-- 
-- CASO 1: No hay pedidos en la tabla
-- → Problema: Webhook no está creando pedidos
-- → Solución: Revisar logs de Stripe CLI y webhook
--
-- CASO 2: Pedidos con user_id = NULL
-- → Problema: Checkout no está detectando usuario autenticado
-- → Solución: Revisar cookies y sesión al hacer checkout
--
-- CASO 3: Pedidos con user_id diferente al tuyo
-- → Problema: Hiciste checkout con otra cuenta
-- → Solución: Usar la cuenta correcta
--
-- CASO 4: Pedidos existen con tu user_id pero no aparecen
-- → Problema: RLS bloqueando consulta
-- → Solución: Verificar políticas y reintentar migraciones
--
-- =====================================================
