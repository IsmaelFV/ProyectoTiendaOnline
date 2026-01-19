-- =====================================================
-- Verificar cuenta: ismaelfloresvargas22@gmail.com
-- =====================================================

-- 1️⃣ Buscar el user_id de este email en Supabase Auth
SELECT 
  id as user_id,
  email,
  created_at,
  last_sign_in_at
FROM auth.users
WHERE email = 'ismaelfloresvargas22@gmail.com';

-- ❓ ¿El user_id coincide con: 283869ea-97e3-41e4-a959-4bc197c108ec?

-- 2️⃣ Pedidos de esta cuenta específica
SELECT 
  order_number,
  status,
  total,
  created_at
FROM orders
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'ismaelfloresvargas22@gmail.com'
);

-- ❓ ¿Cuántos pedidos aparecen aquí?
