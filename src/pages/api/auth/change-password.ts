import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../../../lib/logger';
import { RateLimiter, getClientIP } from '../../../lib/rate-limit';

const changePwdLimiter = new RateLimiter({ maxAttempts: 5, windowMs: 15 * 60_000 });

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Rate limiting: máximo 5 intentos en 15 minutos por IP
    const ip = getClientIP(request);
    if (!changePwdLimiter.check(ip)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Demasiados intentos. Inténtalo de nuevo más tarde.' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return new Response(
        JSON.stringify({ success: false, error: 'Todos los campos son requeridos' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (newPassword.length < 6) {
      return new Response(
        JSON.stringify({ success: false, error: 'La contraseña debe tener al menos 6 caracteres' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Obtener token de acceso
    const accessToken = cookies.get('sb-access-token')?.value;
    const refreshToken = cookies.get('sb-refresh-token')?.value;

    if (!accessToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'No autenticado' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Crear cliente de Supabase con el token del usuario
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, import.meta.env.PUBLIC_SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    });

    // Establecer sesión
    if (refreshToken) {
      await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      });
    }

    // Verificar la contraseña actual haciendo un re-login
    const { data: userData } = await supabase.auth.getUser(accessToken);
    if (!userData.user?.email) {
      return new Response(
        JSON.stringify({ success: false, error: 'No se pudo obtener información del usuario' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verificar contraseña actual intentando login
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: userData.user.email,
      password: currentPassword
    });

    if (signInError) {
      return new Response(
        JSON.stringify({ success: false, error: 'La contraseña actual es incorrecta' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Actualizar la contraseña
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (updateError) {
      logger.error('[ChangePassword] Error updating password:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Error al actualizar la contraseña' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Contraseña actualizada correctamente' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logger.error('[ChangePassword] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Error interno del servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
