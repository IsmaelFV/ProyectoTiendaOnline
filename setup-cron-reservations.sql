-- ============================================================================
-- CRON JOB: Limpieza de Reservas Expiradas
-- ============================================================================
-- PROPÓSITO: Ejecutar cada 5 minutos para liberar stock de reservas expiradas
-- INSTALACIÓN: Usar pg_cron extension de Supabase
-- ============================================================================

-- Habilitar extensión pg_cron (solo si no está habilitada)
-- Ejecutar en Supabase SQL Editor:
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================================
-- JOB 1: Limpiar reservas expiradas cada 5 minutos
-- ============================================================================
SELECT cron.schedule(
  'cleanup-expired-stock-reservations', -- Nombre del job
  '*/5 * * * *',                         -- Cada 5 minutos
  $$SELECT cleanup_expired_reservations()$$
);

-- ============================================================================
-- JOB 2: (Opcional) Resumen diario de reservas
-- ============================================================================
SELECT cron.schedule(
  'daily-reservations-report',
  '0 8 * * *', -- Cada día a las 8:00 AM
  $$
    SELECT 
      status,
      COUNT(*) as total,
      SUM(quantity) as total_quantity
    FROM stock_reservations
    WHERE created_at >= CURRENT_DATE
    GROUP BY status;
  $$
);

-- ============================================================================
-- VERIFICAR JOBS CREADOS
-- ============================================================================
SELECT 
  jobid,
  jobname,
  schedule,
  command,
  active
FROM cron.job
WHERE jobname LIKE '%reservation%';

-- ============================================================================
-- DESACTIVAR UN JOB (si es necesario)
-- ============================================================================
-- SELECT cron.unschedule('cleanup-expired-stock-reservations');

-- ============================================================================
-- LOGS DE EJECUCIÓN (para debugging)
-- ============================================================================
-- SELECT * FROM cron.job_run_details 
-- WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'cleanup-expired-stock-reservations')
-- ORDER BY start_time DESC
-- LIMIT 10;

-- ============================================================================
-- ALTERNATIVA: Si pg_cron no está disponible en tu plan de Supabase
-- ============================================================================
-- Crear un endpoint API en tu proyecto que ejecute la limpieza:
-- GET /api/cron/cleanup-reservations
-- 
-- Luego usar un servicio externo como:
-- - Vercel Cron (si despliegas en Vercel)
-- - GitHub Actions (workflow schedule)
-- - cron-job.org (servicio gratuito)
-- - EasyCron (servicio externo)
--
-- Ejemplo de endpoint en Astro:
-- // src/pages/api/cron/cleanup-reservations.ts
-- export const GET: APIRoute = async ({ request }) => {
--   // Validar que la petición viene de un origen confiable
--   const authHeader = request.headers.get('authorization');
--   if (authHeader !== `Bearer ${import.meta.env.CRON_SECRET}`) {
--     return new Response('Unauthorized', { status: 401 });
--   }
--
--   const supabaseAdmin = createServerSupabaseClient();
--   const { data, error } = await supabaseAdmin.rpc('cleanup_expired_reservations');
--
--   return new Response(JSON.stringify(data), { status: 200 });
-- };
