# 🛒 Sistema de Carrito Persistente por Usuario

## 📋 Problema Identificado

**CRÍTICO - SEGURIDAD Y PRIVACIDAD**

El carrito se estaba compartiendo entre diferentes cuentas de usuario cuando se probaba desde el mismo navegador/ordenador.

### ¿Por qué ocurría?

```typescript
// ❌ PROBLEMA: localStorage se comparte por navegador, NO por usuario
export const cartItems = persistentMap<Record<string, CartItem>>('cart:', {}, {
  encode: JSON.stringify,
  decode: JSON.parse,
});
```

- `localStorage` es específico del **navegador + dominio**
- NO es específico del **usuario**
- Resultado: Usuario A hace login → ve carrito de Usuario B

### Implicaciones

- 🔴 **Violación de privacidad**: Usuarios ven productos de otros
- 🔴 **Problema de seguridad**: Información sensible compartida
- 🔴 **Mala experiencia**: Confusión total al cambiar de cuenta
- 🔴 **Pérdida de ventas**: Carritos vaciados accidentalmente

---

## ✅ Solución Implementada: Carrito Híbrido

### Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                    CARRITO HÍBRIDO                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Usuario NO autenticado          Usuario autenticado       │
│  ┌──────────────────┐            ┌──────────────────┐      │
│  │   localStorage   │            │   Supabase DB    │      │
│  │   (temporal)     │            │   (persistente)  │      │
│  └──────────────────┘            └──────────────────┘      │
│           │                               │                │
│           └──────── LOGIN ────────────────┘                │
│              (migración automática)                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Flujo de Funcionamiento

#### 1️⃣ Usuario NO autenticado (invitado)
```typescript
// Carrito en localStorage (temporal)
addToCart() → localStorage
updateQuantity() → localStorage
removeFromCart() → localStorage
```

#### 2️⃣ Usuario hace LOGIN
```typescript
// Migración automática
1. Detectar login (supabase.auth.onAuthStateChange)
2. Copiar items de localStorage → Supabase DB
3. Limpiar localStorage
4. Cargar carrito desde DB
```

#### 3️⃣ Usuario autenticado
```typescript
// Carrito en Supabase (persistente y privado)
addToCart() → Supabase RPC 'add_to_cart'
updateQuantity() → Supabase RPC 'update_cart_item_quantity'
removeFromCart() → Supabase RPC 'remove_from_cart'
clearCart() → Supabase RPC 'clear_cart'
```

#### 4️⃣ Usuario hace LOGOUT
```typescript
// Volver a localStorage
1. Detectar logout
2. Limpiar estado (cartItems = {})
3. Volver a modo localStorage
```

---

## 🗄️ Estructura de Base de Datos

### Tabla: `shopping_carts`
```sql
CREATE TABLE shopping_carts (
  id UUID PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Regla:** Un usuario = un carrito

### Tabla: `cart_items`
```sql
CREATE TABLE cart_items (
  id UUID PRIMARY KEY,
  cart_id UUID NOT NULL REFERENCES shopping_carts(id),
  product_id UUID NOT NULL REFERENCES products(id),
  size TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(cart_id, product_id, size) -- Un producto+talla solo una vez
);
```

### RLS Policies (Seguridad)

```sql
-- Los usuarios SOLO pueden ver/modificar su propio carrito
CREATE POLICY "Users can view own cart"
  ON shopping_carts
  FOR SELECT
  USING (auth.uid() = user_id);

-- Los usuarios SOLO pueden ver items de su carrito
CREATE POLICY "Users can view own cart items"
  ON cart_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM shopping_carts
      WHERE shopping_carts.id = cart_items.cart_id
      AND shopping_carts.user_id = auth.uid()
    )
  );
```

✅ **Garantía de seguridad**: Imposible ver carritos de otros usuarios

---

## 🔧 Funciones SQL Disponibles

### 1. `add_to_cart(p_user_id, p_product_id, p_size, p_quantity)`
Agrega producto al carrito o incrementa cantidad si ya existe.

**Uso en frontend:**
```typescript
await supabase.rpc('add_to_cart', {
  p_user_id: userId,
  p_product_id: productId,
  p_size: 'M',
  p_quantity: 1
});
```

### 2. `update_cart_item_quantity(p_user_id, p_product_id, p_size, p_quantity)`
Actualiza cantidad de un item (o lo elimina si quantity = 0).

### 3. `remove_from_cart(p_user_id, p_product_id, p_size)`
Elimina un item específico del carrito.

### 4. `clear_cart(p_user_id)`
Vacía completamente el carrito del usuario.

### 5. `get_cart_with_products(p_user_id)`
Obtiene carrito completo con información de productos (JOIN con tabla `products`).

**Retorna:**
```typescript
{
  cart_id: UUID,
  product_id: UUID,
  product_name: string,
  product_slug: string,
  product_price: number,
  product_image: string,
  size: string,
  quantity: number,
  subtotal: number
}[]
```

---

## 📦 Instalación

### Paso 1: Ejecutar Migración SQL

```bash
# En Supabase Dashboard → SQL Editor
# Ejecutar: migrations/003_persistent_cart.sql
```

### Paso 2: Verificar Instalación

```sql
-- Ver tablas creadas
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('shopping_carts', 'cart_items');

-- Ver funciones creadas
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE '%cart%';
```

### Paso 3: Reiniciar Servidor

```bash
# Ctrl+C para detener
npm run dev
```

---

## 🧪 Testing

### Test 1: Carrito NO autenticado (localStorage)
```typescript
// 1. Abrir navegador en modo incógnito
// 2. Agregar productos al carrito (sin login)
// 3. Cerrar y reabrir → carrito se mantiene (localStorage)
```

### Test 2: Migración al hacer LOGIN
```typescript
// 1. Sin login: agregar 3 productos al carrito
// 2. Hacer login con Usuario A
// 3. ✅ Verificar: carrito se mantiene (migrado a DB)
// 4. Abrir DevTools → Application → localStorage
// 5. ✅ Verificar: 'cart:' está vacío (limpiado)
```

### Test 3: Carrito separado por usuario
```typescript
// 1. Login Usuario A: agregar Producto X
// 2. Logout
// 3. Login Usuario B: agregar Producto Y
// 4. ✅ Verificar: Usuario B NO ve Producto X
// 5. Logout Usuario B
// 6. Login Usuario A
// 7. ✅ Verificar: Usuario A solo ve Producto X (no ve Y)
```

### Test 4: Persistencia cross-device
```typescript
// 1. PC1: Login Usuario A → agregar 5 productos
// 2. PC2: Login Usuario A
// 3. ✅ Verificar: Ver los mismos 5 productos
// 4. PC2: Eliminar 1 producto
// 5. PC1: Recargar página
// 6. ✅ Verificar: Solo quedan 4 productos
```

### Test 5: Carrito se vacía al hacer LOGOUT
```typescript
// 1. Login Usuario A: agregar productos
// 2. Logout
// 3. ✅ Verificar: Carrito vacío (vista de invitado)
// 4. Login Usuario A nuevamente
// 5. ✅ Verificar: Carrito recuperado (desde DB)
```

---

## 📊 Monitoreo SQL

### Ver todos los carritos activos
```sql
SELECT 
  sc.id AS cart_id,
  sc.user_id,
  au.email AS user_email,
  COUNT(ci.id) AS item_count,
  SUM(ci.quantity * p.price) AS total_value_cents,
  sc.updated_at AS last_activity
FROM shopping_carts sc
LEFT JOIN cart_items ci ON ci.cart_id = sc.id
LEFT JOIN products p ON p.id = ci.product_id
LEFT JOIN auth.users au ON au.id = sc.user_id
GROUP BY sc.id, sc.user_id, au.email, sc.updated_at
ORDER BY sc.updated_at DESC;
```

### Ver carritos abandonados (>7 días sin actividad)
```sql
SELECT 
  sc.user_id,
  COUNT(ci.id) AS abandoned_items,
  SUM(ci.quantity * p.price) AS potential_revenue_cents,
  sc.updated_at AS last_activity
FROM shopping_carts sc
INNER JOIN cart_items ci ON ci.cart_id = sc.id
INNER JOIN products p ON p.id = ci.product_id
WHERE sc.updated_at < NOW() - INTERVAL '7 days'
GROUP BY sc.user_id, sc.updated_at
ORDER BY potential_revenue_cents DESC;
```

### Ver productos más agregados al carrito
```sql
SELECT 
  p.name,
  p.slug,
  ci.size,
  COUNT(*) AS times_added,
  SUM(ci.quantity) AS total_quantity
FROM cart_items ci
INNER JOIN products p ON p.id = ci.product_id
GROUP BY p.name, p.slug, ci.size
ORDER BY times_added DESC
LIMIT 20;
```

---

## 🔄 Integración con Checkout

### Actualizar `/api/checkout/create-session.ts`

```typescript
// ❌ ANTES: Leer de localStorage (inseguro)
const cartItems = JSON.parse(localStorage.getItem('cart:'));

// ✅ AHORA: Leer de base de datos (seguro)
const { data: cartItems } = await supabase.rpc('get_cart_with_products', {
  p_user_id: session.user.id
});
```

### Después del pago exitoso: limpiar carrito

```typescript
// En webhook Stripe (handleSuccessfulPayment)
await supabase.rpc('clear_cart', {
  p_user_id: order.user_id
});
```

---

## 📈 KPIs y Métricas

### 1. Tasa de conversión de carrito
```sql
WITH cart_stats AS (
  SELECT COUNT(DISTINCT user_id) AS users_with_cart
  FROM shopping_carts sc
  WHERE EXISTS (SELECT 1 FROM cart_items WHERE cart_id = sc.id)
),
order_stats AS (
  SELECT COUNT(DISTINCT customer_email) AS users_who_purchased
  FROM orders
  WHERE created_at > NOW() - INTERVAL '30 days'
)
SELECT 
  users_with_cart,
  users_who_purchased,
  ROUND(100.0 * users_who_purchased / NULLIF(users_with_cart, 0), 2) AS conversion_rate_percent
FROM cart_stats, order_stats;
```

### 2. Valor promedio del carrito
```sql
SELECT 
  AVG(cart_value) / 100.0 AS avg_cart_value_eur
FROM (
  SELECT 
    sc.id,
    SUM(ci.quantity * p.price) AS cart_value
  FROM shopping_carts sc
  INNER JOIN cart_items ci ON ci.cart_id = sc.id
  INNER JOIN products p ON p.id = ci.product_id
  GROUP BY sc.id
) subquery;
```

### 3. Productos por carrito (promedio)
```sql
SELECT 
  ROUND(AVG(item_count), 2) AS avg_products_per_cart
FROM (
  SELECT 
    sc.id,
    SUM(ci.quantity) AS item_count
  FROM shopping_carts sc
  INNER JOIN cart_items ci ON ci.cart_id = sc.id
  GROUP BY sc.id
) subquery;
```

---

## ⚠️ Consideraciones Importantes

### 1. Carritos Antiguos
Los carritos en localStorage de sesiones antiguas NO se migran automáticamente. Solo se migran al hacer login por primera vez después del despliegue.

**Solución:** Esto es esperado. Los usuarios harán login y sus carritos temporales se migrarán.

### 2. Límite de Items por Carrito
Actualmente no hay límite. Considera agregar uno para prevenir abuso:

```sql
-- Agregar constraint (opcional)
ALTER TABLE cart_items 
ADD CONSTRAINT max_items_per_cart 
CHECK (
  (SELECT COUNT(*) FROM cart_items ci2 WHERE ci2.cart_id = cart_id) <= 50
);
```

### 3. Limpieza de Carritos Abandonados
Considera un CRON job para eliminar carritos abandonados >30 días:

```sql
-- Función para limpieza periódica
CREATE OR REPLACE FUNCTION cleanup_abandoned_carts()
RETURNS JSON AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM shopping_carts
  WHERE updated_at < NOW() - INTERVAL '30 days'
  RETURNING COUNT(*) INTO v_deleted_count;

  RETURN json_build_object(
    'success', true,
    'deleted_carts', v_deleted_count
  );
END;
$$ LANGUAGE plpgsql;
```

---

## 🎯 Próximos Pasos

### ✅ Completado
- [x] Migración SQL creada (`003_persistent_cart.sql`)
- [x] Store actualizado (`cart.ts`) con lógica híbrida
- [x] RLS policies configuradas (seguridad por usuario)
- [x] Funciones SQL (add, update, remove, clear, get)
- [x] Migración automática localStorage → DB al login

### ⏳ Pendiente
- [ ] Ejecutar migración en Supabase SQL Editor
- [ ] Reiniciar servidor dev (`npm run dev`)
- [ ] Testing completo (5 escenarios descritos arriba)
- [ ] Actualizar componente CartSlideOver (manejar async/await)
- [ ] Actualizar API checkout para leer de DB en vez de localStorage
- [ ] Limpiar carrito después de pago exitoso
- [ ] Configurar CRON para limpiar carritos abandonados

---

## 🔥 Prioridad: CRÍTICA

Este cambio es **bloqueante para producción**. No puedes lanzar con el carrito compartido entre usuarios.

**Estimación de implementación:** 30-45 minutos
**Impacto:** Alto - Afecta experiencia de usuario y seguridad

---

## 📝 Checklist de Despliegue

```bash
□ Ejecutar migrations/003_persistent_cart.sql en Supabase
□ Verificar tablas creadas (shopping_carts, cart_items)
□ Verificar funciones creadas (5 funciones RPC)
□ Reiniciar servidor local
□ Test: Agregar producto sin login → OK
□ Test: Login → carrito migrado → OK
□ Test: Logout → carrito limpio → OK
□ Test: Login Usuario A → ver solo sus items → OK
□ Test: Login Usuario B → NO ve items de A → OK
□ Actualizar CartSlideOver para async functions
□ Actualizar checkout API
□ Deployment a producción
□ Monitorear logs primeras 24h
```

---

## 💬 Mensaje para Testing

**INSTRUCCIONES PARA PROBAR:**

1. **Abrir en modo incógnito** (simular nuevo usuario)
2. **Agregar 2-3 productos al carrito** (sin hacer login)
3. **Verificar que aparecen en el cart slideout**
4. **Hacer login con una cuenta**
5. **✅ VERIFICAR: Los productos siguen ahí** (migración exitosa)
6. **Cerrar sesión (logout)**
7. **✅ VERIFICAR: Carrito vacío**
8. **Login con OTRA cuenta diferente**
9. **Agregar producto diferente**
10. **✅ VERIFICAR: Solo ves el nuevo producto** (no el del paso 2)
11. **Logout y login con la primera cuenta**
12. **✅ VERIFICAR: Ves los productos del paso 2** (persistencia)

Si todos los checks pasan → Sistema funcionando correctamente ✅

---

**¿Listo para ejecutar la migración SQL?** 🚀
