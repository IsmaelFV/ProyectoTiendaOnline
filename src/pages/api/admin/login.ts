/**
 * ============================================================================
 * API: Login de Administrador
 * ============================================================================
 * Autenticación de administradores con verificación en admin_users
 * ============================================================================
 */

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const formData = await request.formData();
  const email = formData.get('email')?.toString()?.trim();
  const password = formData.get('password')?.toString();

  // Validación básica
  if (!email || !password) {
    return redirect('/admin/login?error=missing_credentials');
  }

  // Validación de formato de email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return redirect('/admin/login?error=invalid_email');
  }

  try {
    // 1. Autenticar con Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      console.error('[Admin Login] Error de autenticación:', error);
      return redirect('/admin/login?error=invalid_credentials');
    }

    // 2. Verificar que sea administrador
    console.log('[Admin Login] Verificando admin para user_id:', data.user.id);
    
    const { data: adminUsers, error: adminError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', data.user.id);

    console.log('[Admin Login] Query resultado:', { adminUsers, adminError });

    if (adminError || !adminUsers || adminUsers.length === 0) {
      console.error('[Admin Login] Usuario no es admin:', email, 'Error:', adminError?.message);
      // Cerrar sesión
      await supabase.auth.signOut();
      return redirect('/admin/login?error=not_admin');
    }

    const adminUser = adminUsers[0]; // Tomar el primero si hay múltiples

    // 3. Guardar tokens en cookies
    cookies.set('sb-access-token', data.session.access_token, {
      path: '/',
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 días
    });

    cookies.set('sb-refresh-token', data.session.refresh_token, {
      path: '/',
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 días
    });

    // 4. Actualizar último acceso
    await supabase
      .from('admin_users')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', adminUser.id);

    console.log('[Admin Login] Admin autenticado:', email);

    // 5. Redirigir al dashboard de admin
    return redirect('/admin');

  } catch (error) {
    console.error('[Admin Login] Error inesperado:', error);
    return redirect('/admin/login?error=invalid_credentials');
  }
};
