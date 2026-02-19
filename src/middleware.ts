/**
 * ============================================================================
 * MIDDLEWARE DE SEGURIDAD CRÍTICO - SEPARACIÓN TOTAL
 * ============================================================================
 * ARQUITECTURA:
 * 
 * USUARIOS FINALES (Clientes):
 * - Registrados en auth.users de Supabase
 * - Acceden a: /, /productos, /categoria, /checkout
 * - NO tienen acceso a internal-admin bajo ninguna circunstancia
 * - Autenticación opcional para comprar
 * 
 * ADMINISTRADORES:
 * - Registrados en auth.users + admin_users (tabla separada)
 * - Acceden SOLO a: /internal-admin/*
 * - Ruta oculta, no indexada, protegida por múltiples capas
 * - NO deben usar cuentas de cliente
 * 
 * MODELO: Backoffice completamente separado (como Shopify Admin)
 * ============================================================================
 */

import { defineMiddleware, sequence } from 'astro:middleware';
import { 
  verifyAdminSession, 
  updateAdminLastLogin,
  AUTH_ERRORS,
  type AdminUser 
} from './lib/auth';
import type { User } from '@supabase/supabase-js';

// ============================================================================
// MIDDLEWARE DE HEADERS DE SEGURIDAD HTTP
// ============================================================================
const securityHeaders = defineMiddleware(async (_context, next) => {
  const response = await next();

  // ---------- Strict-Transport-Security (HSTS) ----------
  // Fuerza HTTPS durante 1 año, incluye subdominios, permite preload list
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );

  // ---------- Content-Security-Policy (CSP) ----------
  // Política restrictiva adaptada a los servicios que usa la tienda
  const cspDirectives = [
    // Base: solo mismo origen
    "default-src 'self'",

    // Scripts: mismo origen + inline de Astro/Vite (necesario para islands)
    "script-src 'self' 'unsafe-inline' https://js.stripe.com",

    // Estilos: mismo origen + inline (Tailwind/Astro) + Google Fonts
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",

    // Imágenes: mismo origen + cualquier HTTPS (productos pueden tener URLs externas)
    "img-src 'self' data: blob: https:",

    // Fuentes: mismo origen + Google Fonts CDN
    "font-src 'self' https://fonts.gstatic.com",

    // Conexiones API: mismo origen + Supabase API + Stripe
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://api.cloudinary.com",

    // Frames: solo Stripe (checkout embebido si se usa)
    "frame-src https://js.stripe.com https://hooks.stripe.com",

    // Objetos embebidos: ninguno
    "object-src 'none'",

    // Base URI: solo mismo origen (previene ataques de base-tag injection)
    "base-uri 'self'",

    // Form actions: mismo origen + Stripe checkout
    "form-action 'self' https://checkout.stripe.com",

    // Frame ancestors: ninguno (equivalente a X-Frame-Options DENY)
    "frame-ancestors 'none'",

    // Forzar HTTPS en recursos mixtos
    "upgrade-insecure-requests",
  ];

  response.headers.set('Content-Security-Policy', cspDirectives.join('; '));

  // ---------- X-Content-Type-Options ----------
  // Previene MIME-type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // ---------- X-Frame-Options ----------
  // Previene clickjacking (legacy, CSP frame-ancestors es el moderno)
  response.headers.set('X-Frame-Options', 'DENY');

  // ---------- X-XSS-Protection ----------
  // Legacy XSS filter del navegador
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // ---------- Referrer-Policy ----------
  // Envía origen solo en same-origin, no leakea URLs completas a terceros
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // ---------- Permissions-Policy ----------
  // Restringe APIs del navegador que la tienda no necesita
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(self "https://js.stripe.com"), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
  );

  // ---------- X-DNS-Prefetch-Control ----------
  // Permite DNS prefetch para mejorar rendimiento
  response.headers.set('X-DNS-Prefetch-Control', 'on');

  // ---------- Cross-Origin Policies ----------
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');

  return response;
});

// Extender el tipo de locals
declare global {
  namespace App {
    interface Locals {
      user?: User;           // Usuario final (cliente)
      admin?: AdminUser;     // Administrador
      isAdmin: boolean;
      isCustomer: boolean;
    }
  }
}

// ============================================================================
// CONFIGURACIÓN DE SEGURIDAD
// ============================================================================
const ADMIN_BASE_PATH = '/internal-admin';  // Ruta oculta del panel admin
const ALLOWED_IPS: string[] = []; // Whitelist IPs (opcional, vacío = todas)
const RATE_LIMIT_ATTEMPTS = 5;    // Intentos de login permitidos
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutos

// Rate limiting simple (en producción usar Redis)
const loginAttempts = new Map<string, { count: number; firstAttempt: number }>();

// ============================================================================
// MIDDLEWARE DE AUTENTICACIÓN Y AUTORIZACIÓN
// ============================================================================
const authMiddleware = defineMiddleware(async ({ locals, url, cookies, redirect, request }, next) => {
  // Inicializar locals
  locals.isAdmin = false;
  locals.isCustomer = false;
  
  const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                   request.headers.get('x-real-ip') || 
                   'unknown';

  // ============================================================================
  // 1. PROTECCIÓN DEL PANEL ADMINISTRATIVO (Ruta Oculta)
  // ============================================================================
  if (url.pathname.startsWith(ADMIN_BASE_PATH)) {
    // -----------------
    // 1.1 IP Whitelisting (opcional)
    // -----------------
    if (ALLOWED_IPS.length > 0 && !ALLOWED_IPS.includes(clientIP)) {
      console.warn(`[SECURITY] Admin access denied from IP: ${clientIP}`);
      return new Response('Forbidden', { status: 403 });
    }

    // -----------------
    // 1.2 Permitir acceso a login sin autenticación
    // -----------------
    if (url.pathname === `${ADMIN_BASE_PATH}/login`) {
      // Rate limiting en login
      const attempts = loginAttempts.get(clientIP);
      const now = Date.now();
      
      if (attempts) {
        if (now - attempts.firstAttempt > RATE_LIMIT_WINDOW) {
          // Reiniciar contador después de la ventana de tiempo
          loginAttempts.delete(clientIP);
        } else if (attempts.count >= RATE_LIMIT_ATTEMPTS) {
          console.warn(`[SECURITY] Rate limit exceeded for IP: ${clientIP}`);
          return new Response('Too Many Requests', { status: 429 });
        }
      }
      
      return next();
    }

    // -----------------
    // 1.3 Verificar tokens de sesión
    // -----------------
    const accessToken = cookies.get('sb-access-token')?.value;
    const refreshToken = cookies.get('sb-refresh-token')?.value;

    if (!accessToken) {
      console.warn('[SECURITY] No access token found for admin route');
      return redirect('/auth/login');
    }

    // -----------------
    // 1.4 Verificar que es admin REAL (no solo autenticado)
    // -----------------
    const permissionCheck = await verifyAdminSession(accessToken, refreshToken);

    if (!permissionCheck.allowed) {
      // CRÍTICO: Usuario autenticado en Supabase pero NO está en admin_users
      // Esto previene que usuarios finales accedan al panel
      console.error(`[SECURITY] Admin verification failed: ${permissionCheck.reason}`);
      console.error(`[SECURITY] IP: ${clientIP}, Attempted path: ${url.pathname}`);
      
      // Limpiar cookies completamente
      cookies.delete('sb-access-token', { path: '/' });
      cookies.delete('sb-refresh-token', { path: '/' });
      
      // Redirigir con error específico
      const errorParam = permissionCheck.reason === AUTH_ERRORS.NOT_ADMIN 
        ? 'forbidden'      // Usuario existe pero NO es admin
        : 'unauthorized';  // Token inválido o expirado
      
      return redirect('/auth/login');
    }

    // -----------------
    // 1.5 Verificar que el admin esté activo
    // -----------------
    if (!permissionCheck.user?.is_active) {
      console.warn(`[SECURITY] Inactive admin attempted access: ${permissionCheck.user?.email}`);
      cookies.delete('sb-access-token', { path: '/' });
      cookies.delete('sb-refresh-token', { path: '/' });
      return redirect('/auth/login');
    }

    // -----------------
    // 1.6 Admin válido - Adjuntar a locals
    // -----------------
    locals.admin = permissionCheck.user;
    locals.isAdmin = true;
    
    // Actualizar última fecha de login (no bloqueante)
    updateAdminLastLogin(permissionCheck.user.id).catch(err => {
      console.error('[Middleware] Error updating last login:', err);
    });

    // Log de auditoría en producción
    if (process.env.NODE_ENV === 'production') {
      console.info(`[ADMIN ACCESS] ${permissionCheck.user.email} | IP: ${clientIP} | Path: ${url.pathname}`);
    }

    // Limpiar intentos de login en caso de éxito
    loginAttempts.delete(clientIP);

    return next();
  }

  // ============================================================================
  // 2. PROTECCIÓN CRUZADA: Admins NO pueden acceder a checkout
  // ============================================================================
  // Los admins deben usar cuentas de cliente separadas para comprar
  if (url.pathname.startsWith('/checkout') && locals.isAdmin) {
    console.warn(`[SECURITY] Admin ${locals.admin?.email} attempted to access checkout`);
    return redirect(`${ADMIN_BASE_PATH}?warning=use_customer_account`);
  }

  // ============================================================================
  // 3. RUTAS PÚBLICAS (Clientes y visitantes)
  // ============================================================================
  // Aquí puedes agregar lógica de autenticación de clientes si lo necesitas
  // Por ahora, todo es público excepto internal-admin
  
  return next();
});

/**
 * ============================================================================
 * FUNCIONES AUXILIARES
 * ============================================================================
 */

/**
 * Registrar intento de login fallido para rate limiting
 */
export function recordLoginAttempt(ip: string): void {
  const attempts = loginAttempts.get(ip);
  const now = Date.now();
  
  if (!attempts) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now });
  } else {
    if (now - attempts.firstAttempt > RATE_LIMIT_WINDOW) {
      // Reiniciar
      loginAttempts.set(ip, { count: 1, firstAttempt: now });
    } else {
      attempts.count++;
    }
  }
}

// ============================================================================
// EXPORTAR MIDDLEWARE COMBINADO: Security Headers + Auth
// ============================================================================
export const onRequest = sequence(securityHeaders, authMiddleware);
