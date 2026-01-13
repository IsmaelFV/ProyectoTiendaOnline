-- Verificar usuario en auth.users
SELECT id, email, email_confirmed_at, created_at 
FROM auth.users 
WHERE email = 'no@gmail.com';

-- Verificar usuario en admin_users
SELECT * FROM admin_users WHERE email = 'no@gmail.com';

-- Ver todos los admins
SELECT 
  au.*,
  u.email as auth_email
FROM admin_users au
LEFT JOIN auth.users u ON u.id = au.user_id;
