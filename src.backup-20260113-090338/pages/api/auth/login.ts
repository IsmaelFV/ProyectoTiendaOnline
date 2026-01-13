/**
 * ============================================================================
 * API: Login de Administrador
 * ============================================================================
 * SEGURIDAD:
 * 1. Autenticación con Supabase Auth
 * 2. Verificación de que el usuario ES un admin (existe en admin_users)
 * 3. Verificación de que el admin está activo
 * 4. Cookies seguras (httpOnly, secure, sameSite)
 * 5. Registro de login en audit_logs
 * 6. Actualización de last_login_at
 * 
 * IMPORTANTE: Solo usuarios en la tabla admin_users pueden acceder al panel
 * ============================================================================
 */

import type { APIRoute } from 'astro';
import { 
  createPublicSupabaseClient,
  getAdminUser,
  updateAdminLastLogin,
  logAdminAction,
  getRequestMetadata,
  AUTH_ERRORS 
} from '../../../lib/auth';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  // ============================================================================
  // 1. OBTENER CREDENCIALES DEL FORMULARIO
  // ============================================================================
  const formData = await request.formData();
  const email = formData.get('email')?.toString()?.trim();
  const password = formData.get('password')?.toString();

  // Validación básica
  if (!email || !password) {
    console.warn('[Login] Missing email or password');
    return redirect('/admin/login?error=missing_credentials');
  }

  // Validación de formato de email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.warn(`[Login] Invalid email format: ${email}`);
    return redirect('/admin/login?error=invalid_email');
  }

  // ============================================================================
  // 2. AUTENTICACIÓN CON SUPABASE AUTH
  // ============================================================================
  const supabase = createPublicSupabaseClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session || !data.user) {
    console.warn(`[Login] Auth failed for email: ${email}`, error?.message);
    
    // No revelar si el usuario existe o no (prevención de enumeración)
    return redirect('/admin/login?error=invalid_credentials');
  }

  const userId = data.user.id;

  // ============================================================================
  // 3. VERIFICAR QUE EL USUARIO ES UN ADMIN
  // ============================================================================
  const adminUser = await getAdminUser(userId);

  if (!adminUser) {
    console.warn(`[Login] User ${email} authenticated but is not an admin`);
    
    // Cerrar sesión del usuario (no es admin)
    await supabase.auth.signOut();
    
    return redirect('/admin/login?error=not_admin');
  }

  // ============================================================================
  // 4. VERIFICAR QUE EL ADMIN ESTÁ ACTIVO
  // ============================================================================
  if (!adminUser.is_active) {
    console.warn(`[Login] Admin ${email} is disabled`);
    
    await supabase.auth.signOut();
    
    return redirect('/admin/login?error=account_disabled');
  }

  // ============================================================================
  // 5. ESTABLECER COOKIES DE SESIÓN SEGURAS
  // ============================================================================
  const isProduction = import.meta.env.PROD;

  cookies.set('sb-access-token', data.session.access_token, {
    path: '/',
    httpOnly: true, // No accesible desde JavaScript
    secure: isProduction, // Solo HTTPS en producción
    sameSite: 'strict', // CSRF protection (strict para admin)
    maxAge: 60 * 60 * 24 * 7, // 7 días
  });

  cookies.set('sb-refresh-token', data.session.refresh_token, {
    path: '/',
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 7, // 7 días
  });

  // ============================================================================
  // 6. ACTUALIZAR ÚLTIMA FECHA DE LOGIN
  // ============================================================================
  await updateAdminLastLogin(userId);

  // ============================================================================
  // 7. REGISTRAR LOGIN EN AUDIT LOG
  // ============================================================================
  const metadata = getRequestMetadata(request);
  
  await logAdminAction({
    adminUserId: userId,
    action: 'LOGIN',
    tableName: 'admin_users',
    recordId: userId,
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent,
  });

  console.info(`[Login] Admin logged in successfully: ${email} (${adminUser.role})`);

  // ============================================================================
  // 8. REDIRIGIR AL PANEL DE ADMINISTRACIÓN
  // ============================================================================
  return redirect('/admin');
};
