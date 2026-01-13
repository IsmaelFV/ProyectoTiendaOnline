/**
 * ============================================================================
 * API: Registro de Usuario
 * ============================================================================
 * Crear nueva cuenta de usuario con Supabase Auth
 * ============================================================================
 */

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, redirect }) => {
  // Obtener datos del formulario
  const formData = await request.formData();
  const name = formData.get('name')?.toString()?.trim();
  const email = formData.get('email')?.toString()?.trim();
  const password = formData.get('password')?.toString();
  const confirmPassword = formData.get('confirmPassword')?.toString();
  const terms = formData.get('terms');
  const newsletter = formData.get('newsletter');

  // Validaciones
  if (!name || !email || !password || !confirmPassword) {
    return redirect('/auth/register?error=Por favor completa todos los campos');
  }

  if (!terms) {
    return redirect('/auth/register?error=Debes aceptar los términos y condiciones');
  }

  // Validar formato de email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return redirect('/auth/register?error=El formato del email no es válido');
  }

  // Validar longitud de contraseña
  if (password.length < 6) {
    return redirect('/auth/register?error=La contraseña debe tener al menos 6 caracteres');
  }

  // Validar que las contraseñas coincidan
  if (password !== confirmPassword) {
    return redirect('/auth/register?error=Las contraseñas no coinciden');
  }

  try {
    // Crear usuario en Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          newsletter: newsletter === 'on',
        },
      },
    });

    if (error) {
      console.error('[Register] Error:', error);
      let errorMessage = 'Error al crear la cuenta';
      
      if (error.message.includes('already registered')) {
        errorMessage = 'Este email ya está registrado';
      } else if (error.message.includes('Password should be')) {
        errorMessage = 'La contraseña no cumple los requisitos mínimos';
      }
      
      return redirect(`/auth/register?error=${encodeURIComponent(errorMessage)}`);
    }

    if (!data.user) {
      return redirect('/auth/register?error=Error al crear la cuenta');
    }

    console.log('[Register] Usuario registrado:', email);

    // Redirigir con mensaje de éxito
    const successMessage = data.user.identities && data.user.identities.length > 0
      ? 'Cuenta creada exitosamente. Por favor revisa tu email para confirmar tu cuenta.'
      : 'Cuenta creada exitosamente. Ya puedes iniciar sesión.';

    return redirect(`/auth/login?success=${encodeURIComponent(successMessage)}`);

  } catch (error) {
    console.error('[Register] Error inesperado:', error);
    return redirect('/auth/register?error=Error al crear la cuenta. Inténtalo de nuevo');
  }
};
