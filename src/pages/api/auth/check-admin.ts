/**
 * ============================================================================
 * API: Verificar si un usuario es administrador
 * ============================================================================
 * Usa service_role para consultar admin_users sin restricciones de RLS
 * ============================================================================
 */

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../../../lib/logger';

export const POST: APIRoute = async ({ request }) => {
  try {
    // Verificar autenticación mediante Bearer token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ isAdmin: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');

    // Usar service_role para evitar RLS
    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      logger.error('[check-admin] Missing Supabase env vars');
      return new Response(JSON.stringify({ isAdmin: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Obtener userId desde el token (no desde el body)
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ isAdmin: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: adminData, error } = await supabaseAdmin
      .from('admin_users')
      .select('id, user_id, email, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      logger.error('[check-admin] Error consultando admin_users:', error);
      return new Response(JSON.stringify({ isAdmin: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ isAdmin: !!adminData }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    logger.error('[check-admin] Error inesperado:', err);
    return new Response(JSON.stringify({ isAdmin: false }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
