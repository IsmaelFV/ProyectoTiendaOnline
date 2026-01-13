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

    // Guardar tokens en cookies
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

    console.log('[Login] Usuario autenticado:', email);

    // Redirigir a la página principal
    return redirect('/');

  } catch (error) {
    console.error('[Login] Error inesperado:', error);
    return redirect('/auth/login?error=Error al iniciar sesión. Inténtalo de nuevo');
  }
};

