# 🔒 SISTEMA DE RESERVA DE STOCK - Guía de Implementación

> **Implementado:** 16 de enero de 2026  
> **Prioridad:** CRÍTICA - Previene overselling en producción  
> **Patrón:** Reserved Stock con TTL (Time To Live)

---

## 📋 ÍNDICE

1. [¿Qué problema resuelve?](#problema)
2. [Arquitectura de la solución](#arquitectura)
3. [Pasos de instalación](#instalacion)
4. [Configuración de CRON](#cron)
5. [Testing](#testing)
6. [Monitoreo](#monitoreo)
7. [Troubleshooting](#troubleshooting)

---

## 🔴 PROBLEMA: Race Condition en Checkout

### Escenario de Fallo

```
┌─────────────────────────────────────────────────────────────┐
│ ANTES (Sin reservas) - VULNERABLE A OVERSELLING            │
├─────────────────────────────────────────────────────────────┤
│ T0: Usuario A consulta stock → stock = 1 ✅                │
│ T1: Usuario B consulta stock → stock = 1 ✅                │
│ T2: Usuario A crea sesión Stripe ✅                         │
│ T3: Usuario B crea sesión Stripe ✅                         │
│ T4: Usuario A completa pago → stock = 0 ✅                 │
│ T5: Usuario B completa pago → stock = -1 ❌ OVERSELLING    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ AHORA (Con reservas) - PROTEGIDO                           │
├─────────────────────────────────────────────────────────────┤
│ T0: Usuario A reserva stock (LOCK) → reservado = 1 ✅      │
│ T1: Usuario B intenta reservar → ERROR: Sin stock ❌       │
│ T2: Usuario A completa pago → confirma reserva ✅          │
│ T3: Stock efectivo = stock_real - reservas_activas         │
└─────────────────────────────────────────────────────────────┘
```

### Impacto Empresarial

Sin este sistema:
- ❌ Ventas de productos sin stock
- ❌ Reembolsos obligatorios
- ❌ Pérdida de confianza del cliente
- ❌ Posibles problemas legales
- ❌ Métricas infladas (conversión irreal)

Con este sistema:
- ✅ Garantía de disponibilidad real
- ✅ Experiencia de usuario profesional
- ✅ Métricas fiables
- ✅ Compliance legal

---

## 🏗️ ARQUITECTURA

### Componentes

```
┌────────────────────────────────────────────────────────────┐
│                    FLUJO COMPLETO                          │
└────────────────────────────────────────────────────────────┘

1. Usuario añade productos al carrito
   └─> localStorage (carrito cliente)

2. Usuario hace clic en "Proceder al Pago"
   └─> POST /api/checkout/create-session
       ├─> reserve_stock() para cada producto (LOCK ATÓMICO)
       │   ├─> Calcula: stock_efectivo = stock_real - reservas_activas
       │   └─> Si OK: Crea reserva con TTL 15 minutos
       └─> Crea sesión Stripe con metadata de reservas

3. Usuario paga en Stripe (15 min máximo)
   ├─> CASO A: Pago exitoso
   │   └─> Webhook: checkout.session.completed
   │       ├─> confirm_reservation(session_id)
   │       └─> Crear pedido + decrementar stock
   │
   ├─> CASO B: Pago cancelado/expirado
   │   └─> Webhook: checkout.session.expired
   │       └─> cancel_reservation(session_id)
   │
   └─> CASO C: Timeout 15 min
       └─> CRON: cleanup_expired_reservations()
           └─> Marca reservas como 'expired'
```

### Base de Datos

**Nueva tabla:** `stock_reservations`

```sql
┌─────────────┬──────────┬──────────────────────────────┐
│ Campo       │ Tipo     │ Descripción                  │
├─────────────┼──────────┼──────────────────────────────┤
│ id          │ UUID     │ PK                           │
│ product_id  │ UUID     │ FK → products                │
│ quantity    │ INTEGER  │ Cantidad reservada           │
│ session_id  │ TEXT     │ Stripe session ID            │
│ user_id     │ UUID     │ FK → auth.users (nullable)   │
│ reserved_at │ TIMESTAMP│ Momento de reserva           │
│ expires_at  │ TIMESTAMP│ reserved_at + 15 min         │
│ status      │ TEXT     │ active/completed/expired/    │
│             │          │ cancelled                    │
└─────────────┴──────────┴──────────────────────────────┘
```

**Funciones SQL:**
- `reserve_stock()` - Reserva atómica con lock
- `confirm_reservation()` - Confirma tras pago
- `cancel_reservation()` - Cancela reserva
- `cleanup_expired_reservations()` - Limpieza CRON
- `get_effective_stock()` - Stock disponible real

---

## 📦 INSTALACIÓN

### Paso 1: Ejecutar Migración SQL

```bash
# En Supabase SQL Editor, ejecutar:
migrations/002_stock_reservations.sql
```

✅ **Verifica que se crearon:**
- Tabla `stock_reservations`
- 4 funciones PL/pgSQL
- 1 vista `active_reservations_summary`
- Índices optimizados

### Paso 2: Actualizar Variables de Entorno

```bash
# .env
CRON_SECRET=genera_un_token_seguro_aqui
```

**Generar token seguro:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Paso 3: Verificar Archivos Actualizados

✅ Archivos modificados:
- `src/pages/api/checkout/create-session.ts` (con reservas)
- `src/pages/api/webhooks/stripe.ts` (confirmar/cancelar)

✅ Archivos nuevos:
- `src/pages/api/cron/cleanup-reservations.ts`
- `migrations/002_stock_reservations.sql`
- `setup-cron-reservations.sql`

### Paso 4: Desplegar Cambios

```bash
# Desarrollo
npm run dev

# Producción
npm run build
# Desplegar en tu VPS/Coolify
```

---

## ⏰ CONFIGURACIÓN DE CRON

### Opción A: pg_cron (Supabase Pro/Enterprise)

```sql
-- En Supabase SQL Editor:
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'cleanup-expired-stock-reservations',
  '*/5 * * * *', -- Cada 5 minutos
  $$SELECT cleanup_expired_reservations()$$
);
```

### Opción B: Vercel Cron (Si despliegas en Vercel)

```json
// vercel.json
{
  "crons": [{
    "path": "/api/cron/cleanup-reservations",
    "schedule": "*/5 * * * *"
  }]
}
```

### Opción C: GitHub Actions

```yaml
# .github/workflows/cron-cleanup.yml
name: Cleanup Expired Reservations
on:
  schedule:
    - cron: '*/5 * * * *'
jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Call cleanup endpoint
        run: |
          curl -X GET https://tu-dominio.com/api/cron/cleanup-reservations \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

### Opción D: Servicio Externo (cron-job.org)

1. Ir a https://cron-job.org
2. Crear cuenta gratuita
3. Nuevo job:
   - URL: `https://tu-dominio.com/api/cron/cleanup-reservations`
   - Headers: `Authorization: Bearer TU_CRON_SECRET`
   - Intervalo: Cada 5 minutos

---

## 🧪 TESTING

### Test 1: Reserva Básica

```bash
# 1. Crear producto de prueba con stock=2
# 2. Añadir 2 unidades al carrito
# 3. Intentar checkout
# 4. Verificar en Supabase que se creó reserva:

SELECT * FROM stock_reservations 
WHERE status = 'active' 
ORDER BY created_at DESC 
LIMIT 1;
```

**Esperado:** 
- ✅ Reserva creada con `expires_at` = +15 min
- ✅ `status` = 'active'

### Test 2: Prevención de Overselling

```bash
# 1. Producto con stock=1
# 2. Usuario A: Añade 1 al carrito → Checkout (NO PAGAR AÚN)
# 3. Usuario B: Añade 1 al carrito → Intentar checkout
```

**Esperado:**
- ✅ Usuario A: Reserva exitosa
- ❌ Usuario B: Error "Stock insuficiente. Disponible: 0"

### Test 3: Expiración Automática

```sql
-- Forzar expiración manual (para testing)
UPDATE stock_reservations 
SET expires_at = NOW() - INTERVAL '1 minute'
WHERE status = 'active';

-- Ejecutar limpieza
SELECT cleanup_expired_reservations();

-- Verificar
SELECT * FROM stock_reservations WHERE status = 'expired';
```

### Test 4: Confirmación de Reserva

```bash
# 1. Checkout completo con pago exitoso
# 2. Verificar webhook de Stripe
# 3. Consultar reserva:

SELECT * FROM stock_reservations 
WHERE session_id = 'cs_test_...' 
AND status = 'completed';
```

---

## 📊 MONITOREO

### Dashboard de Reservas (Query para Admin)

```sql
-- Resumen actual
SELECT 
  status,
  COUNT(*) as total,
  SUM(quantity) as total_quantity,
  MIN(expires_at) as proxima_expiracion
FROM stock_reservations
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status;
```

### Productos con Mayor Reserva

```sql
SELECT * FROM active_reservations_summary
ORDER BY reserved_stock DESC
LIMIT 10;
```

### Alertas a Configurar

1. **Stock efectivo < 5**: Notificar reposición
2. **Reservas expiradas > 50/día**: Revisar UX de checkout
3. **Tiempo promedio checkout > 10 min**: Optimizar flujo

---

## 🔧 TROUBLESHOOTING

### Problema: "No se encontraron reservas para confirmar"

**Causa:** Reservas ya expiradas antes de completar pago  
**Solución:** Usuario debe reintentar checkout

### Problema: CRON no ejecuta

**Diagnóstico:**
```bash
# Test manual del endpoint
curl -X GET http://localhost:4321/api/cron/cleanup-reservations \
  -H "Authorization: Bearer $CRON_SECRET"
```

**Soluciones:**
1. Verificar `CRON_SECRET` en .env
2. Revisar logs del servicio CRON externo
3. Usar opción alternativa (GitHub Actions, etc.)

### Problema: Stock negativo aún con reservas

**Causa:** Decremento de stock sin verificar reservas  
**Solución:** Usar SIEMPRE `get_effective_stock()` para validaciones

```sql
-- Correcto:
SELECT get_effective_stock('product-uuid-here');

-- Incorrecto:
SELECT stock FROM products WHERE id = 'product-uuid-here';
```

---

## ✅ CHECKLIST FINAL

Antes de ir a producción:

- [ ] Migración SQL ejecutada sin errores
- [ ] CRON configurado (cualquier opción)
- [ ] Test de overselling pasado
- [ ] Test de confirmación de reserva pasado
- [ ] Test de expiración pasado
- [ ] `CRON_SECRET` en producción (no el de desarrollo)
- [ ] Monitoreo de reservas configurado
- [ ] Logs de CRON funcionando

---

## 📈 MÉTRICAS DE ÉXITO

**KPIs a trackear:**
- **Tasa de conversión de reservas**: `completadas / totales`
- **Tasa de expiración**: `expiradas / totales`
- **Tiempo promedio de checkout**: `completed_at - reserved_at`
- **Prevención de overselling**: `rechazos por stock insuficiente`

**Objetivos:**
- ✅ 0 casos de overselling
- ✅ Tasa de expiración < 20%
- ✅ Tiempo promedio < 8 minutos

---

## 🚀 PRÓXIMOS PASOS

Con el sistema de reservas funcionando, puedes implementar:

1. **Carrito persistente en BD** (próxima prioridad)
2. **Notificaciones de stock bajo**
3. **Analytics de abandono de checkout**
4. **Optimización del TTL** (A/B testing entre 10-20 min)

---

**Documentado por:** Arquitecto de Software Senior  
**Fecha:** 16 de enero de 2026  
**Versión:** 1.0
