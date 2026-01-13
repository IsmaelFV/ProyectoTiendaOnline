-- ============================================================================
-- LIMPIAR Y RECREAR TABLA ADMIN_USERS (SIMPLIFICADA)
-- ============================================================================

-- 1. Eliminar todas las políticas que dependen de admin_users
DROP POLICY IF EXISTS "Admins can view all addresses" ON customer_addresses;
DROP POLICY IF EXISTS "Admins can manage all orders" ON orders;
DROP POLICY IF EXISTS "Admins can manage all order items" ON order_items;
DROP POLICY IF EXISTS "Admins can manage all returns" ON returns;
DROP POLICY IF EXISTS "Admins can manage all messages" ON return_messages;

-- 2. Eliminar y recrear tabla admin_users
DROP TABLE IF EXISTS admin_users CASCADE;

CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_admin_users_user_id ON admin_users(user_id);
CREATE INDEX idx_admin_users_email ON admin_users(email);

-- Políticas RLS para admin_users (permite a usuarios autenticados leer su propio registro)
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own admin status"
ON admin_users FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 3. Recrear políticas RLS simplificadas
ALTER TABLE customer_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view all addresses"
ON customer_addresses FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage all orders"
ON orders FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage all order items"
ON order_items FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
);

ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage all returns"
ON returns FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
);

ALTER TABLE return_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage all messages"
ON return_messages FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
);

-- 4. Limpiar duplicados y insertar admin
DELETE FROM admin_users WHERE email = 'no@gmail.com';

INSERT INTO admin_users (user_id, email, full_name)
SELECT 
  id,
  'no@gmail.com',
  'Administrador'
FROM auth.users
WHERE email = 'no@gmail.com'
LIMIT 1;

-- 5. Verificar
SELECT * FROM admin_users;

SELECT '✅ Admin_users recreado y simplificado' as resultado;
