/**
 * ============================================================================
 * API: Logout de Administrador
 * ============================================================================
 * SEGURIDAD:
 * 1. Eliminar cookies de sesión
 * 2. Registrar logout en audit_logs
 * 3. Limpiar sesión de Supabase
 * ============================================================================
 */

import type { APIRoute } from 'astro';
import { 
  logAdminAction,
  getRequestMetadata,
} from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';
import { logger } from '../../../lib/logger';

export const POST: APIRoute = async ({ cookies, redirect, locals, request }) => {
  // Registrar logout si hay un admin activo
  if (locals.admin) {
    const metadata = getRequestMetadata(request);
    
    await logAdminAction({
      adminUserId: locals.admin.id,
      action: 'LOGOUT',
      tableName: 'admin_users',
      recordId: locals.admin.id,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });

    logger.info(`[Logout] Admin logged out: ${locals.admin.email}`);
  }

  // Cerrar sesión en Supabase (usa el cliente con la sesión actual)
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    logger.error('[Logout] Error cerrando sesión:', error);
  }

  // Eliminar cookies
  cookies.delete('sb-access-token', { path: '/' });
  cookies.delete('sb-refresh-token', { path: '/' });
  cookies.delete('sb-session-data', { path: '/' });

  return redirect('/auth/login');
};
