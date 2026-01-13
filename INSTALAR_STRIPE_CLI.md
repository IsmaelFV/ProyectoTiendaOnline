# 🔧 INSTALACIÓN RÁPIDA DE STRIPE CLI

## Opción 1: Descarga Manual (MÁS SIMPLE)

1. **Descarga el ejecutable:**
   https://github.com/stripe/stripe-cli/releases/latest/download/stripe_1.21.9_windows_x86_64.zip

2. **Extrae el archivo** `stripe.exe` a una carpeta, por ejemplo:
   `C:\stripe\stripe.exe`

3. **Abre PowerShell COMO ADMINISTRADOR** y ejecuta:
   ```powershell
   cd C:\stripe
   .\stripe.exe login
   ```

4. **Sigue las instrucciones** en el navegador para autenticarte

5. **Escucha webhooks:**
   ```powershell
   .\stripe.exe listen --forward-to localhost:4321/api/webhooks/stripe
   ```

6. **Copia el webhook secret** que te muestra (empieza con `whsec_`)

---

## Opción 2: Con Chocolatey (con permisos admin)

1. **Abre PowerShell COMO ADMINISTRADOR** (clic derecho → Ejecutar como administrador)

2. Ejecuta:
   ```powershell
   choco install stripe-cli -y
   ```

3. **Cierra y reabre** PowerShell

4. Ejecuta:
   ```powershell
   stripe login
   stripe listen --forward-to localhost:4321/api/webhooks/stripe
   ```

---

## ⚠️ IMPORTANTE: DIFERENCIA DESARROLLO vs PRODUCCIÓN

### 🏠 EN DESARROLLO (LOCAL) - Necesitas Stripe CLI
- El CLI escucha webhooks de Stripe
- Redirige los eventos a tu `localhost:4321`
- Solo funciona mientras el CLI esté ejecutándose
- **NO ES NECESARIO en producción**

### 🌐 EN PRODUCCIÓN (WEB SUBIDA)
**¡NO NECESITAS STRIPE CLI!**

Stripe enviará webhooks directamente a tu URL pública:
- Configuras en Stripe Dashboard → Webhooks
- URL: `https://tu-dominio.com/api/webhooks/stripe`
- Stripe llama directamente a tu API
- Funciona 24/7 sin CLI

---

## 🚀 PARA PROBAR AHORA (SIN WEBHOOKS)

**Puedes probar el checkout AHORA sin instalar el CLI:**

1. Inicia tu servidor:
   ```powershell
   npm run dev
   ```

2. Ve a http://localhost:4321

3. Añade productos al carrito

4. Click en "Proceder al Pago"

5. Usa tarjeta de prueba: `4242 4242 4242 4242`

6. Completa el pago

**QUÉ FUNCIONARÁ:**
✅ Checkout de Stripe
✅ Pago procesado
✅ Redirección a página de éxito

**QUÉ NO FUNCIONARÁ (sin CLI):**
❌ Creación automática del pedido en Supabase
❌ Actualización de stock

**Solución:**
- Instala el CLI después (opcional para desarrollo)
- En producción funcionará TODO automáticamente

---

## 💡 RECOMENDACIÓN

**Para desarrollo rápido:** Usa la Opción 1 (descarga manual)
**Para producción:** No necesitas hacer nada extra, funcionará automáticamente

¿Quieres que te ayude con la descarga manual o prefieres probar sin webhooks primero?
