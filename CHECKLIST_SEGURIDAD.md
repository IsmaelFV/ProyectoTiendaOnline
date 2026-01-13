# 🛡️ CHECKLIST DE SEGURIDAD - FASE 1

## 🎯 Verificación Post-Implementación

Usa este checklist para verificar que la implementación de seguridad está correcta.

---

## ✅ BASE DE DATOS

### Schema
- [ ] Tabla `admin_users` existe
- [ ] Tabla `orders` existe
- [ ] Tabla `order_items` existe
- [ ] Tabla `audit_logs` existe
- [ ] Columna `is_active` agregada a `products`
- [ ] Columna `is_active` agregada a `categories`

**Verificar:**
```sql
-- Ejecuta en Supabase SQL Editor
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('admin_users', 'orders', 'order_items', 'audit_logs');

-- Deberías ver las 4 tablas
```

### RLS Policies
- [ ] Policy "Anyone can view active products" existe
- [ ] Policy "Service role can manage products" existe
- [ ] Policy antigua "Authenticated users can manage products" eliminada
- [ ] Policy antigua "Authenticated users can manage categories" eliminada

**Verificar:**
```sql
-- Ver policies de products
SELECT policyname, cmd, roles 
FROM pg_policies 
WHERE tablename = 'products';

-- Verificar que NO existe policy que permita a 'authenticated' hacer UPDATE/INSERT/DELETE
```

### Funciones Helper
- [ ] Función `is_admin()` existe
- [ ] Función `get_admin_role()` existe
- [ ] Función `generate_order_number()` existe
- [ ] Trigger `trigger_set_order_number` existe

**Verificar:**
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('is_admin', 'get_admin_role', 'generate_order_number');
```

---

## ✅ AUTENTICACIÓN

### Creación de Admin
- [ ] Usuario creado en Supabase Auth
- [ ] Usuario insertado en tabla `admin_users`
- [ ] Campo `is_active` = `true`
- [ ] Campo `role` configurado (`super_admin`, `admin`, `editor` o `viewer`)

**Verificar:**
```sql
SELECT id, email, role, is_active 
FROM admin_users 
WHERE is_active = true;

-- Deberías ver al menos 1 admin activo
```

### Variables de Entorno
- [ ] Archivo `.env` existe
- [ ] `PUBLIC_SUPABASE_URL` configurado
- [ ] `PUBLIC_SUPABASE_ANON_KEY` configurado
- [ ] `SUPABASE_SERVICE_ROLE_KEY` configurado
- [ ] `.env` está en `.gitignore`

**Verificar:**
```bash
# En la raíz del proyecto
cat .env | grep SUPABASE

# Deberías ver las 3 variables
```

### Archivos de Código
- [ ] Archivo `src/lib/auth.ts` existe
- [ ] Archivo `src/middleware.ts` actualizado
- [ ] Archivo `src/pages/api/auth/login.ts` actualizado
- [ ] Archivo `src/pages/api/auth/logout.ts` actualizado
- [ ] Archivo `src/pages/api/products/create.ts` actualizado
- [ ] Archivo `src/lib/supabase.ts` actualizado

---

## ✅ PRUEBAS FUNCIONALES

### Test 1: Login sin ser admin
- [ ] Crear usuario en Supabase Auth (NO agregarlo a `admin_users`)
- [ ] Intentar login en `/admin/login`
- [ ] **Resultado:** Error "Esta cuenta no tiene permisos de administrador"

### Test 2: Login con cuenta desactivada
- [ ] Crear admin con `is_active = false`
- [ ] Intentar login
- [ ] **Resultado:** Error "Tu cuenta ha sido desactivada"

### Test 3: Login exitoso
- [ ] Usar admin con `is_active = true`
- [ ] Login en `/admin/login`
- [ ] **Resultado:** Redirige a `/admin`
- [ ] Verificar que se registra en `audit_logs`:

```sql
SELECT * FROM audit_logs 
WHERE action = 'LOGIN' 
ORDER BY created_at DESC 
LIMIT 1;
```

### Test 4: Crear producto
- [ ] Login como admin
- [ ] Ir a `/admin/productos/nuevo`
- [ ] Completar formulario con precio `99.99`
- [ ] Submit
- [ ] **Resultado:** Producto creado
- [ ] Verificar precio en DB:

```sql
SELECT name, price 
FROM products 
ORDER BY created_at DESC 
LIMIT 1;

-- price debería ser 9999 (céntimos)
```

- [ ] Verificar registro en audit_logs:

```sql
SELECT * FROM audit_logs 
WHERE action = 'CREATE' 
AND table_name = 'products'
ORDER BY created_at DESC 
LIMIT 1;
```

### Test 5: Logout
- [ ] Click en logout
- [ ] **Resultado:** Redirige a `/admin/login`
- [ ] Intentar acceder a `/admin` sin login
- [ ] **Resultado:** Redirige a `/admin/login?error=unauthorized`
- [ ] Verificar registro en audit_logs:

```sql
SELECT * FROM audit_logs 
WHERE action = 'LOGOUT' 
ORDER BY created_at DESC 
LIMIT 1;
```

---

## ✅ PRUEBAS DE SEGURIDAD

### Test 6: Bypass de RLS (desde navegador)
```javascript
// Abrir DevTools en una página pública
// Ejecutar en consola (con anon key del cliente)
const { data, error } = await supabase
  .from('products')
  .update({ price: 1 })
  .eq('id', 'algún-uuid-real');

console.log(error);
```
- [ ] **Resultado esperado:** Error de policy (`new row violates row-level security policy`)

### Test 7: API sin autenticación
```bash
curl -X POST http://localhost:4321/api/products/create \
  -d "name=Hack&price=1&stock=10&category_id=uuid&sizes=M"
```
- [ ] **Resultado esperado:** Status 401 Unauthorized

### Test 8: Manipulación de precio (si tuvieras acceso)
- [ ] Intentar enviar precio negativo: `-100`
- [ ] **Resultado esperado:** Error de validación, redirección con error

### Test 9: Cookies seguras
- [ ] Login exitoso
- [ ] Abrir DevTools > Application > Cookies
- [ ] Verificar cookie `sb-access-token`:
  - [ ] Flag `HttpOnly` = ✅
  - [ ] Flag `Secure` = ✅ (en producción)
  - [ ] Flag `SameSite` = `Strict`

### Test 10: Roles y permisos
- [ ] Crear admin con rol `viewer`
- [ ] Login
- [ ] Intentar crear producto
- [ ] **Resultado esperado:** Error "Viewer solo tiene permisos de lectura"

---

## ✅ AUDITORÍA

### Verificar registros de auditoría
```sql
-- Ver todas las acciones del último día
SELECT 
  au.email,
  au.role,
  al.action,
  al.table_name,
  al.created_at
FROM audit_logs al
JOIN admin_users au ON al.admin_user_id = au.id
WHERE al.created_at >= CURRENT_DATE
ORDER BY al.created_at DESC;
```

- [ ] Logins registrados
- [ ] Creaciones de productos registradas
- [ ] Logouts registrados
- [ ] IP addresses capturadas (si están disponibles)
- [ ] User agents capturados

### Verificar integridad de logs
```sql
-- Los logs NO deberían tener updated_at (no se pueden modificar)
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'audit_logs' 
AND column_name = 'updated_at';

-- Debería estar vacío (no existe updated_at en audit_logs)
```

---

## ✅ DOCUMENTACIÓN

- [ ] `SECURITY_IMPLEMENTATION.md` leído
- [ ] `IMPLEMENTACION_FASE_1.md` leído
- [ ] Equipo capacitado en sistema de roles
- [ ] Proceso de agregar nuevos admins documentado
- [ ] Proceso de desactivar admins documentado

---

## ✅ PREPARACIÓN PARA PRODUCCIÓN

### Variables de Entorno
- [ ] `.env` en `.gitignore`
- [ ] Variables configuradas en plataforma de hosting (Vercel, Netlify, etc.)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` nunca expuesta en cliente

### Base de Datos
- [ ] RLS habilitado en todas las tablas
- [ ] Policies verificadas
- [ ] Backup configurado
- [ ] Índices optimizados

### Código
- [ ] Sin console.log sensibles en producción
- [ ] Manejo de errores implementado
- [ ] Validaciones server-side en todas las APIs
- [ ] TypeScript sin errores

### Seguridad
- [ ] HTTPS configurado
- [ ] Cookies en modo `secure: true`
- [ ] Headers de seguridad configurados
- [ ] CORS configurado correctamente

---

## 🚨 ERRORES COMUNES Y SOLUCIONES

### Error: "Missing Supabase environment variables"
**Causa:** Variables de entorno no configuradas  
**Solución:**
```bash
# Verificar que .env existe y tiene las 3 variables
cat .env | grep SUPABASE

# Reiniciar el servidor de desarrollo
npm run dev
```

### Error: "Usuario no es administrador"
**Causa:** Usuario no está en tabla `admin_users`  
**Solución:**
```sql
-- Verificar si el usuario existe en admin_users
SELECT * FROM admin_users WHERE email = 'tu-email@ejemplo.com';

-- Si no existe, insertarlo
INSERT INTO admin_users (id, email, role, is_active)
VALUES ('uuid-del-usuario', 'tu-email@ejemplo.com', 'super_admin', true);
```

### Error: "new row violates row-level security policy"
**Causa:** Intentando modificar DB sin service_role key  
**Solución:** Las operaciones de escritura deben pasar por APIs que usan `createServerSupabaseClient()`

### Error: Precio guardado incorrectamente
**Causa:** El input del formulario está en euros, no en céntimos  
**Solución:** Ya corregido en `src/pages/api/products/create.ts` - conversión en servidor

### Error: Audit logs vacíos
**Causa:** `logAdminAction()` no se está llamando  
**Solución:** Verificar que las APIs actualizadas usan `logAdminAction()`

---

## 📊 MÉTRICAS DE ÉXITO

Una implementación exitosa debería mostrar:

- ✅ **0 usuarios no-admin pueden acceder a `/admin`**
- ✅ **0 modificaciones de productos desde el cliente**
- ✅ **100% de acciones administrativas registradas en audit_logs**
- ✅ **0 precios incorrectos (todos en céntimos)**
- ✅ **0 vulnerabilidades críticas**

---

## 🎉 FASE 1 COMPLETADA

Si todos los checks están ✅, la Fase 1 está completada exitosamente.

**Próximo paso:** Fase 2 - Integración con Stripe y sistema de checkout.

---

**Última actualización:** 12 de enero de 2026  
**Mantenedor:** Equipo de Desarrollo FashionMarket
