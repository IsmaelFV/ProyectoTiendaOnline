/**
 * ============================================================================
 * API: Set Session (cookies HttpOnly)
 * ============================================================================
 * Recibe tokens de sesión del cliente (tras signInWithPassword),
 * los valida server-side, guarda cookies HttpOnly y devuelve
 * si el usuario es admin o no.
 *
 * Flujo:
 * 1. Client hace signInWithPassword() → Supabase SDK tiene sesión
 * 2. Client POST aquí con access_token + refresh_token
 * 3. Server valida con getUser(), guarda cookies HttpOnly
 * 4. Server consulta admin_users con service_role
 * 5. Devuelve JSON { success, isAdmin }
 * ============================================================================
 */

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../../../lib/logger';

export const POST: APIRoute = async ({ request, cookies }) => {
  const headers = { 'Content-Type': 'application/json' };

  try {
    const body = await request.json();
    const { access_token, refresh_token } = body;

    if (!access_token || !refresh_token) {
      return new Response(JSON.stringify({ success: false, error: 'Tokens requeridos' }), {
        status: 400,
        headers,
      });
    }

    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      logger.error('[SetSession] Missing Supabase env vars');
      return new Response(JSON.stringify({ success: false, error: 'Config error' }), {
        status: 500,
        headers,
      });
    }

    // Validar el token con service_role (stateless, fiable en SSR)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(access_token);

    if (userError || !userData?.user) {
      logger.warn('[SetSession] Token inválido:', userError?.message);
      return new Response(JSON.stringify({ success: false, error: 'Token inválido' }), {
        status: 401,
        headers,
      });
    }

    const user = userData.user;

    // Guardar tokens en cookies HttpOnly (para SSR)
    cookies.set('sb-access-token', access_token, {
      path: '/',
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 días
    });

    cookies.set('sb-refresh-token', refresh_token, {
      path: '/',
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 días
    });

    // Cookie no-HttpOnly con datos de sesión para el cliente
    cookies.set('sb-session-data', JSON.stringify({
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: {
        id: user.id,
        email: user.email,
      },
    }), {
      path: '/',
      httpOnly: false,
      secure: import.meta.env.PROD,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    });

    // Verificar si es admin (service_role bypasa RLS)
    let isAdmin = false;
    try {
      const { data: adminData } = await supabaseAdmin
        .from('admin_users')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      isAdmin = !!adminData;
    } catch (err) {
      logger.warn('[SetSession] Error verificando admin:', err);
    }

    logger.debug('[SetSession] Cookies guardadas para:', user.email, 'admin:', isAdmin);

    return new Response(JSON.stringify({ success: true, isAdmin }), {
      status: 200,
      headers,
    });

  } catch (error) {
    logger.error('[SetSession] Error:', error);
    return new Response(JSON.stringify({ success: false, error: 'Error interno' }), {
      status: 500,
      headers,
    });
  }
};
