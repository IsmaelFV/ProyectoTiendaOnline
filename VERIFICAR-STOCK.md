# ============================================================================
# GUÍA DE VERIFICACIÓN: Sistema de Stock Automático
# ============================================================================

## 📋 Checklist de Verificación

### 1️⃣ Funciones SQL en Supabase

**Ejecuta en Supabase SQL Editor:**

```sql
-- Ver si las funciones existen
SELECT proname FROM pg_proc WHERE proname IN ('decrement_stock', 'increment_stock');
```

**Resultado esperado:**
```
decrement_stock
increment_stock
```

**Si NO aparecen:**
1. Abre `sql-decrement-stock.sql` → Copia todo → Ejecuta en Supabase
2. Abre `sql-increment-stock.sql` → Copia todo → Ejecuta en Supabase

---

### 2️⃣ Webhook de Stripe Activo

**Verifica en tu terminal:**
```
✅ Debe haber un terminal con: stripe.exe listen --forward-to localhost:4321/api/webhooks/stripe
```

**Si NO está corriendo:**
```powershell
cd "$env:USERPROFILE\stripe"
.\stripe.exe listen --forward-to localhost:4321/api/webhooks/stripe
```

---

### 3️⃣ Servidor Astro Corriendo

**Verifica que el servidor esté activo:**
```powershell
# En el terminal debe aparecer:
astro v5.x.x ready in XXX ms
➜  Local:   http://localhost:4321/
```

**Si NO está corriendo:**
```powershell
npm run dev
```

---

### 4️⃣ Test Completo de Compra

**Paso a paso:**

1. **Ver stock inicial:**
   - Ve a `/admin/productos`
   - Anota el stock de un producto (ej: 50 unidades)

2. **Hacer una compra:**
   - Ve a `/productos`
   - Añade el producto al carrito (cantidad: 2)
   - Completa checkout con tarjeta: `4242 4242 4242 4242`
   - Fecha: cualquier futura
   - CVV: cualquier 3 dígitos

3. **Verificar webhook:**
   - En el terminal de Stripe CLI debe aparecer:
     ```
     ✅ Order created: ORD-xxxxx
     ✅ Order processed successfully with X items
     ```

4. **Verificar stock actualizado:**
   - Ve a `/admin/productos`
   - El stock debe ser: 50 - 2 = **48 unidades** ✅

5. **Verificar pedido creado:**
   - Ve a `/admin/pedidos`
   - Debe aparecer el nuevo pedido con estado "Pendiente"

---

### 5️⃣ Problemas Comunes

#### ❌ Stock NO disminuye

**Causa 1:** Funciones SQL no instaladas
```sql
-- Ejecuta en Supabase:
SELECT proname FROM pg_proc WHERE proname = 'decrement_stock';
```
- Si no devuelve nada → Ejecuta `sql-decrement-stock.sql`

**Causa 2:** Webhook no está procesando
- Revisa el terminal de Stripe CLI
- Debe mostrar: `checkout.session.completed` received
- Si no aparece → Reinicia el listener

**Causa 3:** Error en el webhook
- Revisa el terminal del servidor Astro
- Busca mensajes de error en rojo
- Puede ser: producto no encontrado, nombre no coincide

#### ❌ Error "function decrement_stock does not exist"

**Solución:**
1. Abre Supabase Dashboard → SQL Editor
2. Copia el contenido completo de `sql-decrement-stock.sql`
3. Pega y ejecuta (botón Run)
4. Repite con `sql-increment-stock.sql`

#### ❌ Webhook no recibe eventos

**Solución:**
```powershell
# 1. Detener Stripe CLI (Ctrl+C)

# 2. Reiniciar listener
cd "$env:USERPROFILE\stripe"
.\stripe.exe listen --forward-to localhost:4321/api/webhooks/stripe

# 3. Copiar el nuevo webhook secret (whsec_xxxxx)
# 4. Actualizar .env con el nuevo secret
# 5. Reiniciar servidor: npm run dev
```

---

### 6️⃣ Verificación Final

**Ejecuta este SQL para ver todos los cambios:**

```sql
-- Ver últimas órdenes con su impacto en stock
SELECT 
  o.order_number,
  o.created_at,
  oi.product_name,
  oi.quantity as cantidad_comprada,
  p.stock as stock_actual,
  o.status
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
JOIN products p ON p.id = oi.product_id
ORDER BY o.created_at DESC
LIMIT 10;
```

**Resultado esperado:**
- Ver las últimas compras
- Ver que el `stock_actual` se redujo por `cantidad_comprada`
- Estado del pedido debe ser "pending" o "paid"

---

## 🎯 Resumen

✅ Funciones SQL instaladas en Supabase
✅ Stripe CLI webhook listener corriendo
✅ Servidor Astro corriendo
✅ Stock disminuye automáticamente al comprar
✅ Pedidos se crean en la base de datos
✅ Sistema de reembolso recupera el stock
