-- ============================================================================
-- CREAR USUARIO ADMIN DIRECTAMENTE
-- ============================================================================
-- Email: no@gmail.com
-- Contraseña: admin
-- ============================================================================

-- Habilitar extensión para hashear contraseñas
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Insertar usuario en auth.users (solo si no existe)
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Verificar si ya existe
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'no@gmail.com';
  
  -- Si no existe, crearlo
  IF v_user_id IS NULL THEN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'no@gmail.com',
      crypt('admin', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      FALSE,
      '',
      '',
      '',
      ''
    )
    RETURNING id INTO v_user_id;
    
    RAISE NOTICE 'Usuario creado con ID: %', v_user_id;
  ELSE
    RAISE NOTICE 'Usuario ya existe con ID: %', v_user_id;
  END IF;
END $$;

-- ============================================================================
-- CREAR USUARIO ADMIN (SIMPLIFICADO)
-- ============================================================================

-- Insertar en admin_users vinculando al usuario existente
INSERT INTO admin_users (user_id, email, full_name)
SELECT 
  id,
  'no@gmail.com',
  'Administrador'
FROM auth.users
WHERE email = 'no@gmail.com'
ON CONFLICT (email) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  full_name = EXCLUDED.full_name;

-- Verificar
SELECT 
  au.*,
  u.email as auth_email
FROM admin_users au
JOIN auth.users u ON u.id = au.user_id
WHERE au.email = 'no@gmail.com';
