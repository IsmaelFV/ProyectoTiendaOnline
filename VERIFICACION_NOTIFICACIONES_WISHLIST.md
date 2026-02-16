# 🔔 Verificación del Sistema de Notificaciones de Wishlist

## ✅ Lo que está implementado

### 1. **Servicio de Notificaciones** (`src/lib/wishlist-notifications.ts`)
- ✅ Función `notifyWishlistSale()`: Envía emails cuando un producto entra en oferta
- ✅ Función `notifyWishlistLowStock()`: Envía emails cuando queda poco stock
- ✅ Función `checkAndNotifyLowStock()`: Smart wrapper que solo notifica al cruzar el umbral
- ✅ Templates HTML profesionales con gradientes, imágenes y CTAs
- ✅ Usa Brevo (Sendinblue) para envío de emails
- ✅ Usa service_role para bypass de RLS

### 2. **Integración en Endpoints**

#### **Ofertas desde Panel Admin** (`src/pages/api/offers/update.ts`)
```typescript
// Líneas 70-79
if (!product.is_on_sale) {
  notifyWishlistSale({
    productId: product_id,
    productName: product.name,
    productSlug: product.slug,
    productImage: product.images?.[0],
    originalPrice: product.price,
    salePrice: salePriceInCents,
    discountPercentage: discountPct,
  }).catch(err => console.error('[Offers] Error notificando wishlist:', err));
}
```
✅ **Funciona**: Cuando activas una oferta desde el panel admin

#### **Edición de Productos** (`src/pages/api/products/[id]/index.ts`)
```typescript
// Después del update exitoso
if (isOnSale && salePriceInCents !== null && !existingProduct.is_on_sale) {
  notifyWishlistSale({...}).catch(err => console.error('[Products] Error:', err));
}
```
✅ **Funciona**: Cuando editas un producto y activas la oferta

#### **Webhook de Stripe** (`src/pages/api/webhooks/stripe.ts`)
```typescript
// Línea 233-240
const stockBefore = product.stock || 0;
// ... después de decrement_stock ...
const stockAfter = stockBefore - quantity;
checkAndNotifyLowStock(product.id, stockBefore, stockAfter)
  .catch(err => console.error('[Webhook] Error notificando stock:', err));
```
✅ **Funciona**: Cuando alguien compra y el stock baja de 5 unidades

## 🔍 Cómo verificar que funciona

### Opción 1: Test Manual Completo

1. **Preparar usuario y producto**:
   ```bash
   # 1. Ejecuta el SQL setup-wishlist.sql en Supabase si no lo has hecho
   # 2. Inicia sesión en la app como usuario normal
   # 3. Ve a un producto y añádelo a favoritos (click en ❤️)
   ```

2. **Activar una oferta**:
   ```bash
   # 1. Inicia sesión como admin: /auth/login
   # 2. Ve al panel: /internal-admin/products
   # 3. Haz clic en "Activar oferta" en el producto que añadiste a favoritos
   # 4. Pon un % de descuento (ej: 20%)
   ```

3. **Verificar email**:
   - Revisa la bandeja de entrada del usuario
   - Revisa también la carpeta de SPAM
   - Deberías recibir un email con:
     - Asunto: "🔥 ¡'[Nombre Producto]' está en oferta! -20%"
     - Precio tachado y nuevo precio en rojo
     - Botón "Ver oferta →"

### Opción 2: Test Automático con Script

```bash
# Ejecutar el script de prueba
node test-wishlist-notifications.js
```

El script verificará:
- ✅ Que existen productos en la DB
- ✅ Que hay usuarios con productos en wishlist
- ✅ Simulará el envío de email de oferta
- ✅ Mostrará resultado detallado

## 📋 Requisitos para que funcione

### 1. Base de Datos Supabase
```sql
-- Ejecutar este SQL en Supabase (si no lo has hecho):
-- setup-wishlist.sql
```
Verifica que existe la tabla:
```sql
SELECT * FROM wishlist_items;
```

### 2. Variables de Entorno Brevo
```env
BREVO_API_KEY=xkeysib-xxxxx
EMAIL_FROM=tu-email@dominio.com
```

Verifica que estén configuradas:
```bash
# PowerShell
Get-Content .env | Select-String -Pattern "BREVO"
```

### 3. Usuario con producto en wishlist
```sql
-- Verificar wishlist_items en Supabase:
SELECT 
  wi.id,
  u.email as user_email,
  p.name as product_name
FROM wishlist_items wi
JOIN auth.users u ON u.id = wi.user_id
JOIN products p ON p.id = wi.product_id;
```

## 🐛 Troubleshooting

### ❌ "No hay usuarios con este producto en wishlist"
**Solución**: Añade el producto a favoritos primero
1. Inicia sesión como usuario normal
2. Ve al producto
3. Click en ❤️ (corazón)
4. Vuelve a intentar activar la oferta

### ❌ "Error al enviar email"
**Causas posibles**:
1. `BREVO_API_KEY` no configurada o inválida
2. `EMAIL_FROM` no verificado en Brevo
3. Límite de envíos diarios alcanzado (plan gratuito: 300/día)

**Verificar**:
```bash
# 1. Ve a Brevo Dashboard
# 2. Settings → SMTP & API → API Keys
# 3. Verifica que la key esté activa
# 4. Settings → Senders → Verifica que EMAIL_FROM esté verificado
```

### ❌ "El email llega a SPAM"
**Solución**: Es normal en desarrollo. Para producción:
1. Configura SPF, DKIM y DMARC en tu dominio
2. Usa un dominio verificado en Brevo
3. Calienta el dominio enviando emails graduales

### ❌ "No se ejecuta al activar oferta"
**Verificar logs del servidor**:
```bash
# En la consola del servidor busca:
[Wishlist Notify] Enviando notificación de oferta...
```

Si no aparece, revisa:
1. Que el producto NO estuviera ya en oferta antes
2. Que el endpoint esté usando la versión actualizada del código

## 📊 Logs Esperados

Cuando activas una oferta, deberías ver en la consola:

```bash
[Wishlist Notify] Enviando notificación de oferta de "Camiseta Básica" a 2 usuario(s)...
✅ Email enviado correctamente: { messageId: '...' }
✅ Email enviado correctamente: { messageId: '...' }
[Wishlist Notify] Oferta — Enviados: 2, Fallidos: 0
```

## ✅ Checklist de Verificación

- [ ] Tabla `wishlist_items` existe en Supabase
- [ ] Variables `BREVO_API_KEY` y `EMAIL_FROM` configuradas
- [ ] Al menos un usuario tiene un producto en favoritos
- [ ] El servidor está corriendo (`npm run dev`)
- [ ] Al activar oferta, aparecen logs en consola
- [ ] El email llega a la bandeja (o spam)

## 🎯 Próximos Pasos

Si todo funciona correctamente:
1. ✅ **Sistema de ofertas**: Las notificaciones se envían automáticamente
2. ✅ **Sistema de stock bajo**: Se activará cuando stock <= 5
3. ⚠️ **Producción**: Configura un dominio real y verifica en Brevo
4. 💡 **Opcional**: Añadir preferencias de notificación por usuario
5. 💡 **Opcional**: Dashboard de emails enviados en panel admin
