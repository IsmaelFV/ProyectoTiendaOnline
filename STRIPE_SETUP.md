# 🔐 Configuración de Stripe - Pasarela de Pago

## ✅ ARQUITECTURA IMPLEMENTADA

### Principios Fundamentales
- ✅ **Supabase es la única fuente de verdad** (productos, precios, stock)
- ✅ **Stripe solo procesa pagos** (no gestiona catálogo)
- ✅ **Validación server-side** (el frontend no define precios)
- ✅ **Actualización atómica de stock** (evita race conditions)
- ✅ **Webhooks seguros** (verificación de firma)

---

## 📋 PASOS PARA CONFIGURACIÓN

### 1️⃣ Crear Cuenta de Stripe (Modo TEST)

1. Ve a https://dashboard.stripe.com/register
2. Crea una cuenta
3. Ve a **Developers → API Keys** (modo TEST activado)

### 2️⃣ Obtener Claves de API

En el dashboard de Stripe (https://dashboard.stripe.com/test/apikeys):

```
Publishable key: pk_test_51xxxxx...
Secret key: sk_test_51xxxxx...
```

### 3️⃣ Configurar Variables de Entorno

Edita el archivo `.env` y reemplaza:

```env
# Stripe Configuration (TEST MODE)
PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_TU_CLAVE_PUBLICA_AQUI
STRIPE_SECRET_KEY=sk_test_TU_CLAVE_SECRETA_AQUI
STRIPE_WEBHOOK_SECRET=whsec_TU_WEBHOOK_SECRET_AQUI
```

Con tus claves reales:

```env
# Stripe Configuration (TEST MODE)
PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51OYxxxxxxxxxxxxxxxxxxxxx
STRIPE_SECRET_KEY=sk_test_51OYxxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxx
```

### 4️⃣ Ejecutar Script SQL para Stock Atómico

**IMPORTANTE:** Ejecuta este SQL en tu base de datos Supabase:

```bash
# El archivo sql-decrement-stock.sql contiene la función
```

Ve a Supabase Dashboard → SQL Editor y ejecuta el contenido de:
`sql-decrement-stock.sql`

Esto crea la función `decrement_stock()` que actualiza el stock de forma segura.

### 5️⃣ Configurar Webhooks (OBLIGATORIO)

Los webhooks permiten que Stripe notifique a tu servidor cuando un pago se completa.

#### Opción A: Desarrollo Local con Stripe CLI

1. Instala Stripe CLI:
   ```bash
   # Windows (con Scoop)
   scoop install stripe
   
   # macOS (con Homebrew)
   brew install stripe/stripe-cli/stripe
   
   # Linux
   # Descarga desde: https://github.com/stripe/stripe-cli/releases
   ```

2. Autentica:
   ```bash
   stripe login
   ```

3. Escucha webhooks (en una terminal separada):
   ```bash
   stripe listen --forward-to localhost:4321/api/webhooks/stripe
   ```

4. Stripe CLI te dará un **webhook signing secret** que empieza con `whsec_`:
   ```
   > Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxx
   ```

5. Copia ese secreto al archivo `.env`:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
   ```

#### Opción B: Producción con ngrok/Endpoint Público

1. Expón tu servidor local:
   ```bash
   # Con ngrok
   ngrok http 4321
   ```

2. En Stripe Dashboard → Developers → Webhooks:
   - Click en "Add endpoint"
   - URL: `https://tu-dominio.com/api/webhooks/stripe`
   - Eventos: Selecciona `checkout.session.completed`
   - Copia el **Signing secret** al `.env`

---

## 🧪 PROBAR LA INTEGRACIÓN

### 1. Iniciar el Servidor

```bash
npm run dev
```

### 2. Iniciar Stripe CLI (en otra terminal)

```bash
stripe listen --forward-to localhost:4321/api/webhooks/stripe
```

### 3. Probar Compra

1. Ve a http://localhost:4321
2. Añade productos al carrito
3. Click en "Proceder al Pago"
4. Usa tarjetas de prueba de Stripe:

#### Tarjetas de Prueba

| Tarjeta | Resultado |
|---------|-----------|
| `4242 4242 4242 4242` | ✅ Pago exitoso |
| `4000 0000 0000 9995` | ❌ Fondos insuficientes |
| `4000 0000 0000 0002` | ❌ Tarjeta rechazada |

**Datos adicionales:**
- Fecha: Cualquier fecha futura (ej: 12/28)
- CVV: Cualquier 3 dígitos (ej: 123)
- Código postal: Cualquiera (ej: 12345)

### 4. Verificar el Flujo

1. **En el navegador:**
   - Redirige a Stripe Checkout
   - Completa el pago con tarjeta de prueba
   - Redirige a `/checkout/success`

2. **En la terminal de Stripe CLI:**
   ```
   2026-01-13 17:00:00  --> checkout.session.completed
   ```

3. **En Supabase:**
   - Verifica que se creó el pedido en la tabla `orders`
   - Verifica que se crearon los items en `order_items`
   - Verifica que el stock se decrementó en `products`

---

## 🔄 FLUJO COMPLETO

```
1. Usuario → Añade productos al carrito (datos desde Supabase)
   ↓
2. Usuario → Click "Proceder al Pago"
   ↓
3. Frontend → POST /api/checkout/create-session
   - Envía solo IDs de productos y cantidades
   ↓
4. Backend → Valida stock y precios en Supabase
   - Calcula total en el servidor
   - Crea sesión de Stripe
   ↓
5. Usuario → Redirige a Stripe Checkout
   - Completa datos de pago
   ↓
6. Stripe → Procesa el pago
   ↓
7. Stripe → Envía webhook a /api/webhooks/stripe
   ↓
8. Backend → Verifica firma del webhook
   - Crea pedido en Supabase
   - Actualiza stock atómicamente
   ↓
9. Usuario → Redirige a /checkout/success
```

---

## 🛡️ SEGURIDAD IMPLEMENTADA

### ✅ Validaciones Server-Side
- **Precios:** Siempre se obtienen desde Supabase, nunca del cliente
- **Stock:** Se verifica disponibilidad antes de crear la sesión
- **Cantidades:** Se validan en el servidor

### ✅ Webhooks Seguros
- Verificación de firma con `stripe.webhooks.constructEvent()`
- Solo procesa eventos firmados por Stripe

### ✅ Stock Atómico
- Función SQL `decrement_stock()` con transacción
- Evita ventas por encima del stock disponible
- Maneja concurrencia de múltiples compras

### ✅ Separación de Responsabilidades
- Frontend: Solo muestra productos y recolecta selección
- Backend: Valida, calcula y crea sesiones
- Stripe: Solo procesa pagos
- Supabase: Única fuente de verdad

---

## 📊 MONITOREO

### En Stripe Dashboard

1. **Pagos:**
   - https://dashboard.stripe.com/test/payments
   - Verifica pagos exitosos/fallidos

2. **Eventos:**
   - https://dashboard.stripe.com/test/events
   - Monitorea webhooks recibidos

3. **Logs:**
   - https://dashboard.stripe.com/test/logs
   - Debug de errores de API

### En Supabase

1. **Tabla `orders`:**
   ```sql
   SELECT * FROM orders ORDER BY created_at DESC LIMIT 10;
   ```

2. **Verificar stock:**
   ```sql
   SELECT id, name, stock FROM products WHERE stock < 10;
   ```

---

## 🚀 PASAR A PRODUCCIÓN

### 1. Activar Modo Live en Stripe
1. Ve a Stripe Dashboard
2. Cambia de "Test Mode" a "Live Mode"
3. Obtén las claves **LIVE** (empiezan con `pk_live_` y `sk_live_`)

### 2. Actualizar Variables de Entorno
```env
PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_tu_clave_real
STRIPE_SECRET_KEY=sk_live_tu_clave_real
```

### 3. Configurar Webhook de Producción
1. En Stripe Dashboard → Webhooks
2. Añadir endpoint: `https://tu-dominio.com/api/webhooks/stripe`
3. Seleccionar evento: `checkout.session.completed`
4. Copiar el signing secret al `.env`

### 4. Activar HTTPS
- Stripe requiere HTTPS en producción
- Usa certificado SSL válido
- Vercel/Netlify incluyen HTTPS automáticamente

---

## ❓ SOLUCIÓN DE PROBLEMAS

### Error: "Webhook signature verification failed"
- Verifica que `STRIPE_WEBHOOK_SECRET` esté configurado
- Asegúrate de usar el secret del webhook correcto (test vs live)

### Error: "Stock insuficiente"
- Verifica que hay stock disponible en Supabase
- Revisa que la función `decrement_stock()` esté creada

### Pago exitoso pero no se crea el pedido
- Verifica que el webhook esté configurado correctamente
- Revisa los logs de Stripe CLI o Stripe Dashboard
- Comprueba que la función webhook no tiene errores

### Redirección no funciona
- Verifica las URLs de `success_url` y `cancel_url`
- Asegúrate de que no hay errores en las páginas de éxito/cancelación

---

## 📚 RECURSOS

- [Stripe Docs - Checkout](https://stripe.com/docs/payments/checkout)
- [Stripe Docs - Webhooks](https://stripe.com/docs/webhooks)
- [Stripe CLI](https://stripe.com/docs/stripe-cli)
- [Tarjetas de Prueba](https://stripe.com/docs/testing)

---

## ✅ CHECKLIST DE VERIFICACIÓN

- [ ] Variables de entorno configuradas en `.env`
- [ ] Función SQL `decrement_stock()` ejecutada en Supabase
- [ ] Stripe CLI instalado y autenticado
- [ ] Webhook escuchando en `localhost:4321/api/webhooks/stripe`
- [ ] Servidor de desarrollo ejecutándose (`npm run dev`)
- [ ] Probado con tarjeta de prueba `4242 4242 4242 4242`
- [ ] Pedido creado correctamente en Supabase
- [ ] Stock actualizado en la tabla `products`
- [ ] Página de éxito muestra información correcta

---

**🎉 ¡Integración de Stripe completada!**

Tu tienda ahora puede procesar pagos reales de forma segura con Stripe como pasarela de pago, mientras mantiene Supabase como única fuente de verdad para productos, precios y stock.
