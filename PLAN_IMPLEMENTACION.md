# PLAN DE IMPLEMENTACIÓN - POST-VENTA

## 📋 Estado Actual Verificado

### ✅ Código Funcional Existente (NO TOCAR)
- Webhook usa `status: 'confirmed'` al crear pedidos
- Reserva de stock atómica funcional
- Funciones SQL existentes: `reserve_stock()`, `confirm_reservation()`, `decrement_stock()`
- Checkout integrado con Stripe

### ⚠️ Inconsistencia Detectada
- Schema permite: `pending`, `processing`, `paid`, `shipped`, `delivered`, `cancelled`, `refunded`
- Webhook usa: `confirmed` (no está en el CHECK constraint)
- **Solución**: Agregar `confirmed` al CHECK sin romper datos existentes

---

## 🎯 Fase 1: Arreglar Estados (CRÍTICO)

### Archivo: `migrations/004_fix_order_states.sql`

**Acción:**
```sql
-- Agregar 'confirmed' a los estados permitidos
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check 
  CHECK (status IN ('pending', 'confirmed', 'processing', 'paid', 'shipped', 'delivered', 'cancelled', 'refunded'));
```

**Impacto**: ✅ Sin riesgo (solo agrega estado, no modifica datos)

---

## 🎯 Fase 2: Cancelación Atómica

### 2.1 Función SQL: `cancel_order_and_restore_stock()`

**Archivo**: `migrations/005_cancel_order_function.sql`

**Nueva función atómica:**
- Verifica que el pedido esté en estado `confirmed` o `processing`
- Cambia estado a `cancelled`
- Restaura stock de TODOS los productos del pedido
- Usa transacción implícita (función PostgreSQL garantiza atomicidad)

**Reutiliza**: 
- ✅ Ya existe `decrement_stock()` → crear `increment_stock()` simétrica
- ✅ Ya existe tabla `order_items` → leer de ahí los productos

### 2.2 API Endpoint

**Archivo**: `src/pages/api/orders/cancel.ts`

**Lógica:**
1. Verificar autenticación
2. Verificar que el pedido pertenece al usuario
3. Llamar función SQL `cancel_order_and_restore_stock()`
4. Retornar resultado

### 2.3 UI - Botón Cancelar

**Archivos a modificar:**
- `src/pages/perfil/mis-pedidos.astro` (ya tiene estructura de botones)

**Lógica:**
- Solo mostrar si `status === 'confirmed' || status === 'processing'`
- Al hacer click: confirmar con modal → llamar API → recargar

---

## 🎯 Fase 3: Códigos de Descuento

### 3.1 Tabla + Funciones SQL

**Archivo**: `migrations/006_discount_codes.sql`

**Nueva tabla:**
```sql
discount_codes (
  code TEXT UNIQUE,
  discount_type (percentage, fixed),
  discount_value,
  valid_from, valid_until,
  max_uses, uses_count,
  min_purchase_amount,
  is_active
)
```

**Nueva función:**
- `validate_discount_code(p_code, p_cart_total, p_user_id)`
- Verifica vigencia, límites, mínimo de compra
- Incrementa uses_count si es válido

### 3.2 Integrar en Checkout

**Archivo**: `src/pages/api/checkout/create-session.ts`

**Modificación:**
- Agregar parámetro opcional `discountCode` en body
- SI hay código: validar con función SQL
- Calcular descuento ANTES de line_items
- Aplicar descuento en `total_amount` y metadata de Stripe

---

## 🎯 Fase 4: Modal Devoluciones (Solo UI)

**Archivo**: `src/components/ui/ReturnRequestModal.tsx` (nuevo)

**Contenido:**
- Instrucciones de envío
- Disclaimer financiero
- Botón "Entendido"

**Integración:**
- Botón "Solicitar devolución" en pedidos con `status === 'delivered'`
- Al click: abrir modal (no crea registro en DB aún)

---

## 🎯 Fase 5: Popup Promocional

**Archivo**: `src/components/ui/PromoPopup.tsx` (nuevo)

**Lógica:**
- Mostrar una vez por sesión (localStorage)
- Formulario email → generar código automático
- Enviar email con código vía Brevo (ya integrado)

---

## ⚠️ REGLAS DE SEGURIDAD

### NO HACER:
- ❌ Modificar funciones SQL existentes que funcionan
- ❌ Cambiar schema de `orders` o `order_items` (solo agregar constraints)
- ❌ Tocar webhook de Stripe (ya funciona correctamente)
- ❌ Duplicar lógica de stock (reutilizar funciones existentes)

### SÍ HACER:
- ✅ Crear nuevas funciones SQL atómicas
- ✅ Agregar nuevas tablas sin afectar existentes
- ✅ Reutilizar patrones y funciones ya probadas
- ✅ Validar TODO en backend

---

## 📦 Orden de Implementación

1. ✅ Análisis completo (HECHO)
2. 🔄 Fase 1: Fix estados (SIGUIENTE)
3. 🔄 Fase 2: Cancelación
4. 🔄 Fase 3: Descuentos
5. 🔄 Fase 4: Modal devoluciones
6. 🔄 Fase 5: Popup promocional

---

**Fecha**: 19 enero 2026
**Autor**: AI Assistant
**Revisado**: Usuario confirmó plan
