# ✅ FASE 3 COMPLETADA - CÓDIGOS DE DESCUENTO

## 📦 Archivos Creados/Modificados

### 1. Migración SQL (Base de Datos)
**Archivo**: `migrations/006_discount_codes.sql`
- ✅ Tabla `discount_codes` con campos:
  - `code` (único, case-insensitive)
  - `discount_type` (percentage | fixed)
  - `discount_value`
  - `valid_from`, `valid_until` (periodo de validez)
  - `max_uses`, `uses_count` (límites de uso)
  - `min_purchase_amount` (compra mínima)
  - `is_active` (activar/desactivar)
- ✅ Función `validate_discount_code()` - Valida código sin incrementar contador
- ✅ Función `increment_discount_usage()` - Incrementa contador tras pago exitoso
- ✅ Políticas RLS configuradas
- ✅ 3 códigos de ejemplo incluidos: BIENVENIDA10, PRIMERACOMPRA, VERANO2026

### 2. Componente UI
**Archivo**: `src/components/ui/DiscountCodeInput.astro`
- ✅ Input para ingresar código
- ✅ Botón "Aplicar"
- ✅ Validación en tiempo real con Supabase
- ✅ Muestra mensaje de éxito/error
- ✅ Box verde con código aplicado
- ✅ Botón "Quitar" para remover descuento
- ✅ Guarda en sessionStorage para checkout
- ✅ Actualiza total del carrito en tiempo real

### 3. API Checkout (Backend)
**Archivo**: `src/pages/api/checkout/create-session.ts`
- ✅ Acepta parámetro `discountCode` en body
- ✅ Valida código con `validate_discount_code()`
- ✅ Calcula descuento antes de crear sesión Stripe
- ✅ Crea cupón dinámico en Stripe con `amount_off`
- ✅ Guarda código y descuento en metadata
- ✅ Cancela reservas si código inválido

### 4. Webhook (Confirmación)
**Archivo**: `src/pages/api/webhooks/stripe.ts`
- ✅ Lee `discount_code` de metadata
- ✅ Calcula descuento real de `session.total_details.amount_discount`
- ✅ Guarda descuento en campo `discount` de orders
- ✅ Guarda código aplicado en `customer_notes`
- ✅ Llama `increment_discount_usage()` tras crear orden

---

## 🧪 Cómo Probar

### 1. Aplicar migración SQL
```bash
# En Supabase SQL Editor:
# Ejecutar migrations/006_discount_codes.sql
```

### 2. Integrar componente en carrito
```astro
<!-- En src/pages/carrito.astro (o donde esté el carrito) -->
---
import DiscountCodeInput from '@components/ui/DiscountCodeInput.astro';
---

<!-- Después del resumen del carrito -->
<DiscountCodeInput />
```

### 3. Modificar script de checkout
```typescript
// Al enviar datos a /api/checkout/create-session
const discountData = sessionStorage.getItem('appliedDiscount');
const body = {
  items: cartItems,
  discountCode: discountData ? JSON.parse(discountData).code : null
};
```

### 4. Probar códigos de ejemplo
- **BIENVENIDA10**: 10% descuento (mín €20, máx 100 usos)
- **PRIMERACOMPRA**: €5 descuento fijo (mín €30, usos ilimitados)
- **VERANO2026**: 15% descuento (mín €50, máx 500 usos)

---

## ✅ Validaciones Implementadas

1. **Código existe y está activo**
2. **Dentro del periodo de validez** (valid_from - valid_until)
3. **No excede límite de usos** (uses_count < max_uses)
4. **Cumple mínimo de compra** (total >= min_purchase_amount)
5. **Descuento no mayor al total** (evita totales negativos)

---

## 🎯 Flujo Completo

1. Usuario ingresa código en carrito
2. Frontend valida con `validate_discount_code()`
3. Si válido: muestra descuento aplicado, actualiza total
4. Usuario hace checkout
5. Backend valida código nuevamente (seguridad)
6. Si válido: crea cupón Stripe y aplica descuento
7. Webhook detecta pago exitoso
8. Incrementa `uses_count` del código
9. Guarda pedido con descuento aplicado

---

## 📝 Próximos Pasos

### Gestión de Códigos (Admin)
Crear página admin para:
- Crear nuevos códigos
- Ver estadísticas de uso
- Activar/desactivar códigos
- Editar fechas de validez

### Extensiones Futuras
- Códigos por usuario (un código por email)
- Códigos para categorías específicas
- Códigos acumulables vs exclusivos
- Historial de códigos usados por usuario

---

**Fecha**: 19 enero 2026
**Estado**: ✅ FASE 3 COMPLETA
**Siguiente**: Fase 4 (Modal de devoluciones) o Fase 5 (Popup promocional)
