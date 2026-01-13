-- Verificar si el usuario existe en auth.users
SELECT 
  id, 
  email, 
  email_confirmed_at,
  created_at,
  encrypted_password IS NOT NULL as tiene_password
FROM auth.users 
WHERE email = 'no@gmail.com';

-- Verificar si está en admin_users
SELECT * FROM admin_users WHERE email = 'no@gmail.com';

-- Ver TODOS los usuarios en auth.users
SELECT id, email, email_confirmed_at FROM auth.users ORDER BY created_at DESC LIMIT 5;

-- Ver TODOS los admins
SELECT * FROM admin_users;
