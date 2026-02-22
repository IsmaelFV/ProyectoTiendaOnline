/**
 * ============================================================================
 * CRON ENDPOINT: Limpiar reservas expiradas
 * ============================================================================
 * Ruta: GET /api/cron/cleanup-reservations
 * Propósito: Marcar como expiradas las reservas cuyo TTL ha caducado
 * Seguridad: Requiere token Bearer en header Authorization
 * Frecuencia recomendada: Cada 5 minutos
 * ============================================================================
 */

import type { APIRoute } from 'astro';
import { createServerSupabaseClient } from '../../../lib/auth';

export const GET: APIRoute = async ({ request }) => {
  try {
    // ============================================================================
    // SEGURIDAD: Validar que la petición viene de un origen autorizado
    // ============================================================================
    const authHeader = request.headers.get('authorization');
    const expectedToken = `Bearer ${import.meta.env.CRON_SECRET}`;

    if (!import.meta.env.CRON_SECRET) {
      console.error('[CRON] CRON_SECRET no configurado en .env');
      return new Response(JSON.stringify({ 
        error: 'Server misconfiguration' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (authHeader !== expectedToken) {
      console.warn('[CRON] Intento de acceso no autorizado desde:', request.headers.get('x-forwarded-for') || 'unknown');
      return new Response(JSON.stringify({ 
        error: 'Unauthorized' 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ============================================================================
    // EJECUTAR LIMPIEZA
    // ============================================================================
    const supabaseAdmin = createServerSupabaseClient();
    
    console.log('[CRON] Iniciando limpieza de reservas expiradas...');
    const startTime = Date.now();

    const { data: result, error } = await supabaseAdmin.rpc('cleanup_expired_reservations') as { data: any; error: any };

    if (error) {
      console.error('[CRON] Error al limpiar reservas:', error);
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Error al limpiar reservas expiradas' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const duration = Date.now() - startTime;

    console.log(`[CRON] Limpieza completada en ${duration}ms`);
    console.log(`[CRON] Reservas expiradas: ${result.expired}`);

    // ============================================================================
    // MÉTRICAS ADICIONALES (Opcional)
    // ============================================================================
    const { count: activeCount } = await supabaseAdmin
      .from('stock_reservations')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    return new Response(JSON.stringify({ 
      success: true,
      expired: result.expired,
      active_reservations: activeCount || 0,
      duration_ms: duration,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[CRON] Error crítico:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: 'Error interno del servidor' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

/**
 * ============================================================================
 * CONFIGURACIÓN EN SERVICIOS EXTERNOS
 * ============================================================================
 * 
 * 1. VERCEL CRON (Si despliegas en Vercel)
 * -------------------------------------------
 * Archivo: vercel.json
 * {
 *   "crons": [{
 *     "path": "/api/cron/cleanup-reservations",
 *     "schedule": "*\/5 * * * *"
 *   }]
 * }
 * 
 * 2. GITHUB ACTIONS
 * -------------------------------------------
 * Archivo: .github/workflows/cron-cleanup.yml
 * name: Cleanup Expired Reservations
 * on:
 *   schedule:
 *     - cron: '*\/5 * * * *'
 * jobs:
 *   cleanup:
 *     runs-on: ubuntu-latest
 *     steps:
 *       - name: Call cleanup endpoint
 *         run: |
 *           curl -X GET https://tu-dominio.com/api/cron/cleanup-reservations \
 *             -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
 * 
 * 3. CRON-JOB.ORG (Servicio gratuito externo)
 * -------------------------------------------
 * - Registrarse en https://cron-job.org
 * - Crear nuevo job con URL: https://tu-dominio.com/api/cron/cleanup-reservations
 * - Añadir header: Authorization: Bearer TU_CRON_SECRET
 * - Intervalo: Cada 5 minutos
 * 
 * 4. EASYCRON
 * -------------------------------------------
 * - https://www.easycron.com
 * - Similar a cron-job.org con más opciones
 * 
 * ============================================================================
 * TESTING LOCAL
 * ============================================================================
 * 
 * curl -X GET http://localhost:4321/api/cron/cleanup-reservations \
 *   -H "Authorization: Bearer tu-secret-local"
 * 
 * ============================================================================
 * VARIABLES DE ENTORNO REQUERIDAS
 * ============================================================================
 * 
 * .env:
 * CRON_SECRET=genera-un-token-seguro-aleatorio-aqui
 * 
 * Generar token:
 * node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 * 
 * ============================================================================
 */
