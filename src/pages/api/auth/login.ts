/**
 * ============================================================================
 * API: Login de Usuario
 * ============================================================================
 * Autenticación estándar de usuarios con Supabase Auth
 * ============================================================================
 */

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  // Obtener credenciales del formulario
  const formData = await request.formData();
  const email = formData.get('email')?.toString()?.trim();
  const password = formData.get('password')?.toString();

  // Validación básica
  if (!email || !password) {
    return redirect('/auth/login?error=Por favor ingresa email y contraseña');
  }

  // Validación de formato de email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return redirect('/auth/login?error=El formato del email no es válido');
  }

  try {
    // Autenticar con Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('[Login] Error:', error);
      let errorMessage = 'Credenciales inválidas';
      
      if (error.message.includes('Invalid login credentials')) {
        errorMessage = 'Email o contraseña incorrectos';
      } else if (error.message.includes('Email not confirmed')) {
        errorMessage = 'Por favor confirma tu email antes de iniciar sesión';
      }
      
      return redirect(`/auth/login?error=${encodeURIComponent(errorMessage)}`);
    }

    if (!data.session) {
      return redirect('/auth/login?error=No se pudo crear la sesión');
    }

    // Guardar tokens en cookies (para el servidor)
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

    // CRÍTICO: También guardar en cookie NO httpOnly para que el cliente pueda establecer la sesión
    cookies.set('sb-session-data', JSON.stringify({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      user: {
        id: data.session.user.id,
        email: data.session.user.email,
      }
    }), {
      path: '/',
      httpOnly: false, // El navegador DEBE poder leerla
      secure: import.meta.env.PROD,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    });

    console.log('[Login] Usuario autenticado:', email);
    console.log('[Login] Session data guardada para cliente');

    // Verificar si el usuario es administrador (usar service_role para evitar RLS)
    try {
      const { createClient: createAdminClient } = await import('@supabase/supabase-js');
      const supabaseAdmin = createAdminClient(
        import.meta.env.PUBLIC_SUPABASE_URL,
        import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

      const { data: adminData } = await supabaseAdmin
        .from('admin_users')
        .select('id, user_id, email')
        .eq('user_id', data.session.user.id)
        .maybeSingle();

      if (adminData) {
        console.log('[Login] Usuario es ADMIN, redirigiendo a /admin');
        return redirect('/admin');
      }
    } catch (adminCheckErr) {
      console.warn('[Login] Error verificando admin (no crítico):', adminCheckErr);
    }

    // Redirigir a la página principal (usuario normal)
    return redirect('/');

  } catch (error) {
    console.error('[Login] Error inesperado:', error);
    return redirect('/auth/login?error=Error al iniciar sesión. Inténtalo de nuevo');
  }
};

