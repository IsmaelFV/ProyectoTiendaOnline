/**
 * ============================================================================
 * Authentication & Authorization Helper
 * ============================================================================
 * PROPÓSITO: Centralizar lógica de autenticación y verificación de permisos
 * 
 * ARQUITECTURA:
 * - Verificación de admin vs cliente
 * - Control de acceso basado en roles (RBAC)
 * - Auditoría de acciones administrativas
 * - Gestión segura de sesiones
 * 
 * SEGURIDAD:
 * - Siempre usa service_role key para operaciones sensibles
 * - Nunca confíes en el cliente para verificaciones de permisos
 * - Registra todas las acciones administrativas
 * ============================================================================
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';

/**
 * Roles de administrador con permisos específicos
 */
export enum AdminRole {
  SUPER_ADMIN = 'super_admin', // Acceso total: gestión de admins, configuración
  ADMIN = 'admin',              // Gestión completa: productos, pedidos, categorías
  EDITOR = 'editor',            // Solo productos y categorías
  VIEWER = 'viewer',            // Solo lectura
}

/**
 * Interfaz de usuario administrador
 */
export interface AdminUser {
  id: string;
  email: string;
  role: AdminRole;
  full_name?: string;
  is_active: boolean;
  created_at: string;
  last_login_at?: string;
}

/**
 * Resultado de verificación de permisos
 */
export interface PermissionCheck {
  allowed: boolean;
  reason?: string;
  user?: AdminUser;
}

/**
 * Crear cliente de Supabase con service_role (server-side only)
 * NUNCA uses esta función en el cliente
 */
export function createServerSupabaseClient(): SupabaseClient {
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Verificar si un usuario es administrador activo
 * @param userId - UUID del usuario de Supabase Auth
 * @returns AdminUser si es admin, null si no lo es
 */
export async function getAdminUser(userId: string): Promise<AdminUser | null> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('admin_users')
    .select('*')
    .eq('id', userId)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    return null;
  }

  return data as AdminUser;
}

/**
 * Verificar si un usuario tiene un rol específico o superior
 * @param userId - UUID del usuario
 * @param requiredRole - Rol mínimo requerido
 * @returns PermissionCheck con resultado y razón
 */
export async function checkAdminPermission(
  userId: string,
  requiredRole: AdminRole = AdminRole.ADMIN
): Promise<PermissionCheck> {
  const adminUser = await getAdminUser(userId);

  if (!adminUser) {
    return {
      allowed: false,
      reason: 'Usuario no es administrador',
    };
  }

  if (!adminUser.is_active) {
    return {
      allowed: false,
      reason: 'Cuenta de administrador desactivada',
      user: adminUser,
    };
  }

  // Super admin puede hacer todo
  if (adminUser.role === AdminRole.SUPER_ADMIN) {
    return {
      allowed: true,
      user: adminUser,
    };
  }

  // Jerarquía de roles
  const roleHierarchy = {
    [AdminRole.SUPER_ADMIN]: 4,
    [AdminRole.ADMIN]: 3,
    [AdminRole.EDITOR]: 2,
    [AdminRole.VIEWER]: 1,
  };

  const userLevel = roleHierarchy[adminUser.role as AdminRole] || 0;
  const requiredLevel = roleHierarchy[requiredRole] || 0;

  if (userLevel >= requiredLevel) {
    return {
      allowed: true,
      user: adminUser,
    };
  }

  return {
    allowed: false,
    reason: `Rol insuficiente. Requerido: ${requiredRole}, actual: ${adminUser.role}`,
    user: adminUser,
  };
}

/**
 * Verificar si un usuario puede realizar una acción específica
 * @param userId - UUID del usuario
 * @param action - Acción a realizar
 * @returns PermissionCheck con resultado
 */
export async function canPerformAction(
  userId: string,
  action: 'create' | 'read' | 'update' | 'delete' | 'manage_admins'
): Promise<PermissionCheck> {
  const adminUser = await getAdminUser(userId);

  if (!adminUser) {
    return {
      allowed: false,
      reason: 'Usuario no es administrador',
    };
  }

  // Super admin puede hacer todo
  if (adminUser.role === AdminRole.SUPER_ADMIN) {
    return { allowed: true, user: adminUser };
  }

  // Gestión de admins solo para super_admin
  if (action === 'manage_admins') {
    return {
      allowed: false,
      reason: 'Solo super_admin puede gestionar otros administradores',
      user: adminUser,
    };
  }

  // Admin puede crear, leer, actualizar y eliminar
  if (adminUser.role === AdminRole.ADMIN) {
    return { allowed: true, user: adminUser };
  }

  // Editor puede crear, leer y actualizar (no eliminar)
  if (adminUser.role === AdminRole.EDITOR) {
    if (action === 'delete') {
      return {
        allowed: false,
        reason: 'Editor no puede eliminar recursos',
        user: adminUser,
      };
    }
    return { allowed: true, user: adminUser };
  }

  // Viewer solo puede leer
  if (adminUser.role === AdminRole.VIEWER) {
    if (action === 'read') {
      return { allowed: true, user: adminUser };
    }
    return {
      allowed: false,
      reason: 'Viewer solo tiene permisos de lectura',
      user: adminUser,
    };
  }

  return {
    allowed: false,
    reason: 'Rol no reconocido',
    user: adminUser,
  };
}

/**
 * Registrar acción administrativa en audit_logs
 * @param params - Parámetros de auditoría
 */
export async function logAdminAction(params: {
  adminUserId: string;
  action: string;
  tableName: string;
  recordId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  const supabase = createServerSupabaseClient();

  const { error } = await supabase.from('audit_logs').insert({
    admin_user_id: params.adminUserId,
    action: params.action,
    table_name: params.tableName,
    record_id: params.recordId || null,
    old_values: params.oldValues || null,
    new_values: params.newValues || null,
    ip_address: params.ipAddress || null,
    user_agent: params.userAgent || null,
  });

  if (error) {
    console.error('Error logging admin action:', error);
    // No lanzar error para no bloquear la operación principal
  }
}

/**
 * Obtener usuario de Supabase Auth desde tokens de sesión
 * @param accessToken - Token de acceso
 * @param refreshToken - Token de refresco
 * @returns User si la sesión es válida, null si no lo es
 */
export async function getUserFromSession(
  accessToken: string,
  refreshToken: string
): Promise<User | null> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error || !data.session) {
    return null;
  }

  return data.session.user;
}

/**
 * Actualizar última fecha de login del admin
 * @param userId - UUID del usuario
 */
export async function updateAdminLastLogin(userId: string): Promise<void> {
  const supabase = createServerSupabaseClient();

  await supabase
    .from('admin_users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', userId);
}

/**
 * Obtener cliente de Supabase con anon key (para operaciones públicas)
 */
export function createPublicSupabaseClient(): SupabaseClient {
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

/**
 * Extraer IP y User-Agent de una Request
 * @param request - Request de Astro
 * @returns Objeto con ipAddress y userAgent
 */
export function getRequestMetadata(request: Request): {
  ipAddress?: string;
  userAgent?: string;
} {
  return {
    ipAddress: request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               undefined,
    userAgent: request.headers.get('user-agent') || undefined,
  };
}

/**
 * Verificar si una sesión es válida y el usuario es admin
 * Función helper para usar en middleware y APIs
 * @param accessToken - Token de acceso
 * @param refreshToken - Token de refresco
 * @returns PermissionCheck con usuario admin si es válido
 */
export async function verifyAdminSession(
  accessToken: string | undefined,
  refreshToken: string | undefined
): Promise<PermissionCheck> {
  if (!accessToken || !refreshToken) {
    return {
      allowed: false,
      reason: 'Sesión no encontrada',
    };
  }

  const user = await getUserFromSession(accessToken, refreshToken);

  if (!user) {
    return {
      allowed: false,
      reason: 'Sesión inválida o expirada',
    };
  }

  return await checkAdminPermission(user.id, AdminRole.VIEWER);
}

/**
 * Constantes de mensajes de error
 */
export const AUTH_ERRORS = {
  NO_SESSION: 'Sesión no encontrada. Por favor, inicia sesión.',
  INVALID_SESSION: 'Sesión inválida o expirada. Por favor, inicia sesión nuevamente.',
  NOT_ADMIN: 'No tienes permisos de administrador.',
  INSUFFICIENT_PERMISSIONS: 'Permisos insuficientes para esta acción.',
  ACCOUNT_DISABLED: 'Tu cuenta ha sido desactivada. Contacta al administrador.',
} as const;
