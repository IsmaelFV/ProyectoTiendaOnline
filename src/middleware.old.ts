/**
 * ============================================================================
 * Middleware de Autenticación y Autorización
 * ============================================================================
 * SEGURIDAD:
 * 1. Verifica que el usuario está autenticado
 * 2. Verifica que el usuario ES UN ADMIN (existe en admin_users)
 * 3. Verifica que el admin está activo
 * 4. Adjunta información del admin a locals para usar en páginas/APIs
 * 
 * RUTAS PROTEGIDAS:
 * - /admin/* (excepto /admin/login)
 * - Requiere ser admin activo
 * ============================================================================
 */

import { defineMiddleware } from 'astro:middleware';
import { 
  verifyAdminSession, 
  updateAdminLastLogin,
  AUTH_ERRORS,
  type AdminUser 
} from './lib/auth';
import type { User } from '@supabase/supabase-js';

// Extender el tipo de locals para incluir información del admin
declare global {
  namespace App {
    interface Locals {
      user?: User;
      admin?: AdminUser;
      isAdmin: boolean;
    }
  }
}

export const onRequest = defineMiddleware(async ({ locals, url, cookies, redirect }, next) => {
  // Inicializar locals
  locals.isAdmin = false;
  
  // ============================================================================
  // PROTECCIÓN DE RUTAS /admin/*
  // ============================================================================
  if (url.pathname.startsWith('/admin')) {
    // Permitir acceso a /admin/login sin autenticación
    if (url.pathname === '/admin/login') {
      return next();
    }

    // Obtener tokens de sesión
    const accessToken = cookies.get('sb-access-token')?.value;
    const refreshToken = cookies.get('sb-refresh-token')?.value;

    // Verificar sesión y permisos de admin
    const permissionCheck = await verifyAdminSession(accessToken, refreshToken);

    if (!permissionCheck.allowed) {
      console.warn(`[Middleware] Admin access denied: ${permissionCheck.reason}`);
      
      // Limpiar cookies inválidas
      cookies.delete('sb-access-token', { path: '/' });
      cookies.delete('sb-refresh-token', { path: '/' });
      
      // Redirigir a login con mensaje de error
      const errorParam = permissionCheck.reason === AUTH_ERRORS.NOT_ADMIN 
        ? 'not_admin'
        : 'unauthorized';
      
      return redirect(`/admin/login?error=${errorParam}`);
    }

    // Usuario válido y es admin
    if (permissionCheck.user) {
      locals.admin = permissionCheck.user;
      locals.isAdmin = true;
      
      // Actualizar última fecha de login (no bloqueante)
      updateAdminLastLogin(permissionCheck.user.id).catch(err => {
        console.error('[Middleware] Error updating last login:', err);
      });

      // Log de acceso (opcional, para auditoría)
      if (process.env.NODE_ENV === 'production') {
        console.info(`[Admin Access] ${permissionCheck.user.email} - ${url.pathname}`);
      }
    }

    return next();
  }

  // ============================================================================
  // RUTAS PÚBLICAS (no /admin)
  // ============================================================================
  // Puedes agregar lógica adicional aquí si necesitas autenticación de clientes
  
  return next();
});
