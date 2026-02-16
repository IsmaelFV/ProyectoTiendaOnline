-- ============================================================================
-- CREAR USUARIO ADMINISTRADOR
-- ============================================================================
-- Este script crea las tablas necesarias para el sistema de administración
-- y añade un usuario admin de prueba
-- ============================================================================

-- ============================================================================
-- PASO 1: Crear tabla de usuarios administradores (si no existe)
-- ============================================================================
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin', 'editor')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- ============================================================================
-- PASO 2: Crear tabla de logs de auditoría (si no existe)
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  table_name VARCHAR(100),
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PASO 3: Habilitar RLS en las nuevas tablas
-- ============================================================================
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PASO 4: Crear políticas de seguridad para admin_users
-- ============================================================================
DROP POLICY IF EXISTS "Admin users can read all admin users" ON admin_users;
CREATE POLICY "Admin users can read all admin users"
ON admin_users FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users au
    WHERE au.user_id = auth.uid() AND au.is_active = true
  )
);

DROP POLICY IF EXISTS "Super admins can manage admin users" ON admin_users;
CREATE POLICY "Super admins can manage admin users"
ON admin_users FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users au
    WHERE au.user_id = auth.uid() 
    AND au.role = 'super_admin' 
    AND au.is_active = true
  )
);

-- ============================================================================
-- PASO 5: Crear políticas para audit_logs
-- ============================================================================
DROP POLICY IF EXISTS "Admin users can read audit logs" ON audit_logs;
CREATE POLICY "Admin users can read audit logs"
ON audit_logs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users au
    WHERE au.user_id = auth.uid() AND au.is_active = true
  )
);

DROP POLICY IF EXISTS "System can insert audit logs" ON audit_logs;
CREATE POLICY "System can insert audit logs"
ON audit_logs FOR INSERT
TO authenticated
WITH CHECK (true);

-- ============================================================================
-- PASO 6: Crear índices para mejor rendimiento
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_is_active ON admin_users(is_active);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_user_id ON audit_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- ============================================================================
-- PASO 7: INSTRUCCIONES PARA CREAR USUARIO ADMIN
-- ============================================================================
-- 
-- OPCIÓN A: Si ya tienes un usuario registrado en Supabase Auth:
-- ------------------------------------------------------------
-- 1. Ve a tu proyecto de Supabase → Authentication → Users
-- 2. Copia el UUID del usuario que quieres hacer admin
-- 3. Ejecuta este comando reemplazando los valores:
--
-- INSERT INTO admin_users (user_id, email, full_name, role, is_active)
-- VALUES (
--   'PEGA-AQUI-EL-UUID-DEL-USUARIO',
--   'tu-email@ejemplo.com',
--   'Tu Nombre Completo',
--   'super_admin',
--   true
-- );
--
-- OPCIÓN B: Crear un nuevo usuario admin desde cero:
-- --------------------------------------------------
-- 1. Ve a Supabase → Authentication → Add User
-- 2. Crea un usuario con email y contraseña
-- 3. Copia su UUID
-- 4. Ejecuta el INSERT de arriba con ese UUID
--
-- ============================================================================

-- Verificar que todo está correcto
SELECT 
  'admin_users' as tabla,
  COUNT(*) as total_registros
FROM admin_users
UNION ALL
SELECT 
  'audit_logs' as tabla,
  COUNT(*) as total_registros
FROM audit_logs;

-- Ver usuarios admin existentes
SELECT 
  id,
  email,
  full_name,
  role,
  is_active,
  created_at,
  last_login_at
FROM admin_users
ORDER BY created_at DESC;

SELECT 'TABLAS DE ADMINISTRACIÓN CREADAS CORRECTAMENTE' as resultado;
SELECT 'Ahora necesitas añadir un usuario admin manualmente (ver instrucciones arriba)' as siguiente_paso;
