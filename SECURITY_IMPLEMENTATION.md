# 🔒 Implementación de Seguridad - FashionMarket E-commerce

**Fecha:** 12 de enero de 2026  
**Autor:** Arquitecto de Software Senior  
**Estado:** Fase 1 - Seguridad Crítica ✅ COMPLETADA

---

## 📋 Tabla de Contenidos

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Vulnerabilidades Corregidas](#vulnerabilidades-corregidas)
3. [Arquitectura de Seguridad](#arquitectura-de-seguridad)
4. [Guía de Implementación](#guía-de-implementación)
5. [Sistema de Roles](#sistema-de-roles)
6. [Auditoría y Compliance](#auditoría-y-compliance)
7. [Pruebas de Seguridad](#pruebas-de-seguridad)
8. [Próximos Pasos](#próximos-pasos)

---

## 🎯 Resumen Ejecutivo

### Problema Inicial

El proyecto tenía **vulnerabilidades críticas** que lo hacían **INVIABLE para producción**:

- ❌ Cualquier usuario autenticado podía acceder al panel de admin
- ❌ RLS policies permitían a TODOS los usuarios autenticados modificar productos
- ❌ Sin distinción entre administradores y clientes
- ❌ Sin auditoría de acciones administrativas
- ❌ Precio manipulable desde el frontend
- ❌ Sin verificación de permisos en APIs

### Solución Implementada

✅ **Sistema de roles separado** (tabla `admin_users`)  
✅ **RLS policies restrictivas** (solo service_role puede escribir)  
✅ **Middleware de autenticación robusto** con verificación de admin  
✅ **APIs protegidas** con validación de permisos y auditoría  
✅ **Sistema de auditoría completo** (tabla `audit_logs`)  
✅ **Validaciones server-side** (precio, stock, imágenes)

---

## 🐛 Vulnerabilidades Corregidas

### 1. Autenticación Rota → Sistema de Roles RBAC

**Antes:**
```typescript
// ❌ CUALQUIER usuario autenticado podía acceder
if (accessToken && refreshToken) {
  locals.user = data.session.user;
  return next(); // Sin verificar si es admin
}
```

**Ahora:**
```typescript
// ✅ Verificación de admin real
const permissionCheck = await verifyAdminSession(accessToken, refreshToken);
if (!permissionCheck.allowed) {
  return redirect('/admin/login?error=not_admin');
}
locals.admin = permissionCheck.user; // AdminUser con rol
```

**Impacto:** Solo usuarios en la tabla `admin_users` pueden acceder al panel.

---

### 2. RLS Policies Inseguras → Lectura Pública, Escritura Service Role

**Antes:**
```sql
-- ❌ CUALQUIER usuario autenticado puede modificar
CREATE POLICY "Authenticated users can manage products"
  ON products FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);
```

**Ahora:**
```sql
-- ✅ Solo lectura pública, escritura solo desde APIs
CREATE POLICY "Anyone can view active products"
  ON products FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Service role can manage products"
  ON products FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
```

**Impacto:** 
- Frontend solo puede leer
- Escrituras pasan por APIs que verifican permisos
- Imposible manipular datos desde DevTools

---

### 3. Precio Manipulable → Conversión Server-Side

**Antes:**
```typescript
// ❌ Cliente envía precio en céntimos (manipulable)
const price = parseInt(formData.get('price')?.toString() || '0');
```

**Ahora:**
```typescript
// ✅ Servidor convierte euros a céntimos
const priceInEuros = parseFloat(priceInput);
if (isNaN(priceInEuros) || priceInEuros < 0) {
  return redirect('/admin/productos/nuevo?error=invalid_price');
}
const priceInCents = Math.round(priceInEuros * 100);
```

**Impacto:** Imposible crear productos con precio manipulado.

---

### 4. APIs Sin Autenticación → Verificación Multi-Capa

**Antes:**
```typescript
// ❌ Cualquiera puede crear productos
export const POST: APIRoute = async ({ request }) => {
  const formData = await request.formData();
  // ... insert directamente
}
```

**Ahora:**
```typescript
// ✅ Verificación de admin + permisos + auditoría
if (!locals.admin) {
  return new Response(JSON.stringify({ error: 'Not admin' }), { status: 401 });
}

const permissionCheck = await checkAdminPermission(locals.admin.id, AdminRole.EDITOR);
if (!permissionCheck.allowed) {
  return new Response(JSON.stringify({ error: permissionCheck.reason }), { status: 403 });
}

// ... operación con service_role
await logAdminAction({ adminUserId: locals.admin.id, action: 'CREATE', ... });
```

**Impacto:** Trazabilidad completa, imposible evadir autenticación.

---

### 5. Sin Auditoría → Registro Completo de Acciones

**Nueva tabla `audit_logs`:**
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  admin_user_id UUID REFERENCES admin_users(id),
  action TEXT NOT NULL, -- 'LOGIN', 'CREATE', 'UPDATE', 'DELETE'
  table_name TEXT NOT NULL,
  record_id UUID,
  old_values JSONB, -- Valores antes del cambio
  new_values JSONB, -- Valores después del cambio
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Uso:**
```typescript
await logAdminAction({
  adminUserId: locals.admin.id,
  action: 'CREATE',
  tableName: 'products',
  recordId: product.id,
  newValues: productData,
  ipAddress: request.headers.get('x-forwarded-for'),
  userAgent: request.headers.get('user-agent'),
});
```

**Beneficios:**
- Saber quién cambió qué y cuándo
- Compliance (GDPR, PCI-DSS)
- Detección de fraude interno
- Recuperación de datos

---

## 🏗️ Arquitectura de Seguridad

### Separación de Responsabilidades

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENTE                             │
│  (Browser - Solo anon key)                                  │
│  - Lectura de productos/categorías                          │
│  - No puede escribir directamente en DB                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ HTTP Requests
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    MIDDLEWARE                               │
│  - Verificar autenticación                                  │
│  - Verificar admin (tabla admin_users)                      │
│  - Adjuntar admin info a locals                             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ locals.admin
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    ASTRO PAGES / API ROUTES                 │
│  - Acceder a locals.admin                                   │
│  - Verificar permisos específicos                           │
│  - Usar service_role client para escrituras                 │
│  - Registrar en audit_logs                                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ service_role key
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE POSTGRESQL                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ RLS Policies:                                        │   │
│  │ - anon/authenticated: SELECT (productos activos)     │   │
│  │ - service_role: ALL (bypass RLS)                     │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Tablas:                                              │   │
│  │ - admin_users (quién puede ser admin)               │   │
│  │ - products (catálogo)                                │   │
│  │ - categories (categorías)                            │   │
│  │ - orders (pedidos)                                   │   │
│  │ - order_items (líneas de pedido)                     │   │
│  │ - audit_logs (auditoría)                             │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Flujo de Autenticación de Admin

```
1. Admin ingresa email/password en /admin/login
   ↓
2. API /api/auth/login:
   - Autentica con Supabase Auth
   - Verifica que existe en admin_users
   - Verifica que is_active = true
   - Establece cookies httpOnly + secure + sameSite=strict
   - Registra LOGIN en audit_logs
   ↓
3. Usuario navega a /admin/productos
   ↓
4. Middleware:
   - Lee cookies
   - Verifica sesión con Supabase
   - Verifica que user.id existe en admin_users
   - Adjunta locals.admin con role
   ↓
5. Página /admin/productos renderiza
   - Accede a locals.admin para personalizar UI
   ↓
6. Admin crea un producto
   ↓
7. POST /api/products/create:
   - Verifica locals.admin (middleware ya lo hizo)
   - Verifica permiso de CREAR (role >= 'editor')
   - Valida datos (precio, stock, imágenes)
   - Inserta con service_role client
   - Registra CREATE en audit_logs
```

---

## 📖 Guía de Implementación

### Paso 1: Ejecutar Schema Seguro

```bash
# 1. Abre Supabase Dashboard > SQL Editor
# 2. Copia el contenido de supabase-schema-secure.sql
# 3. Ejecuta el script completo
```

Esto creará:
- ✅ Tabla `admin_users` con roles
- ✅ Tablas `orders` y `order_items` (para Stripe)
- ✅ Tabla `audit_logs`
- ✅ RLS policies corregidas
- ✅ Funciones helper (is_admin, get_admin_role)
- ✅ Triggers automáticos

### Paso 2: Crear Tu Primer Admin

```bash
# 1. Ve a Supabase Dashboard > Authentication > Users
# 2. Crea un nuevo usuario manualmente:
#    Email: admin@fashionmarket.com
#    Password: (contraseña segura)
# 3. Copia el UUID del usuario creado
```

```sql
-- 4. En SQL Editor, ejecuta:
INSERT INTO admin_users (id, email, role, full_name, is_active)
VALUES (
  'uuid-del-usuario-aqui',  -- UUID copiado
  'admin@fashionmarket.com',
  'super_admin',
  'Administrador Principal',
  true
);
```

### Paso 3: Configurar Variables de Entorno

Crea/actualiza `.env`:

```env
# Supabase (obtenidas del Dashboard)
PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-aqui
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-aqui  # ¡NUNCA expongas esto!

# Entorno
NODE_ENV=development
```

**CRÍTICO:** 
- ❌ NUNCA subas `.env` a Git
- ❌ NUNCA uses `SUPABASE_SERVICE_ROLE_KEY` en el cliente
- ✅ Solo úsalo en server-side (APIs, middleware)

### Paso 4: Instalar Dependencias (si es necesario)

```bash
npm install
# Ya tienes todo lo necesario en package.json
```

### Paso 5: Probar el Sistema

```bash
npm run dev
```

**Prueba 1: Login sin ser admin**
1. Crea un usuario normal en Supabase Auth (NO lo agregues a admin_users)
2. Intenta hacer login en `/admin/login`
3. ✅ Debería rechazarte con "Usuario no es administrador"

**Prueba 2: Login como admin**
1. Usa el usuario que agregaste a `admin_users`
2. Login en `/admin/login`
3. ✅ Debería redirigir a `/admin`

**Prueba 3: Crear producto**
1. Ve a `/admin/productos/nuevo`
2. Rellena el formulario con precio `99.99`
3. ✅ El producto se guarda con precio `9999` (céntimos)
4. ✅ Se registra en `audit_logs`

**Prueba 4: Verificar auditoría**
```sql
-- En Supabase SQL Editor
SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10;
```
✅ Deberías ver tus acciones registradas.

---

## 👥 Sistema de Roles

### Jerarquía de Roles

```
super_admin (nivel 4)
    ↓
  admin (nivel 3)
    ↓
  editor (nivel 2)
    ↓
  viewer (nivel 1)
```

### Permisos por Rol

| Acción | viewer | editor | admin | super_admin |
|--------|--------|--------|-------|-------------|
| Ver productos | ✅ | ✅ | ✅ | ✅ |
| Crear productos | ❌ | ✅ | ✅ | ✅ |
| Editar productos | ❌ | ✅ | ✅ | ✅ |
| Eliminar productos | ❌ | ❌ | ✅ | ✅ |
| Ver pedidos | ✅ | ✅ | ✅ | ✅ |
| Gestionar pedidos | ❌ | ❌ | ✅ | ✅ |
| Gestionar admins | ❌ | ❌ | ❌ | ✅ |

### Uso en Código

```typescript
// Verificar rol específico
const permissionCheck = await checkAdminPermission(userId, AdminRole.EDITOR);

if (permissionCheck.allowed) {
  // Usuario tiene rol de editor o superior
}

// Verificar acción específica
const canDelete = await canPerformAction(userId, 'delete');

if (canDelete.allowed) {
  // Usuario puede eliminar
}
```

### Ejemplo: Proteger una API

```typescript
// src/pages/api/products/delete.ts
export const POST: APIRoute = async ({ locals, request }) => {
  // Verificar autenticación
  if (!locals.admin) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Verificar permiso de eliminar (solo admin o superior)
  const permissionCheck = await canPerformAction(locals.admin.id, 'delete');
  
  if (!permissionCheck.allowed) {
    return new Response(
      JSON.stringify({ error: permissionCheck.reason }),
      { status: 403 }
    );
  }

  // Proceder con la eliminación...
};
```

---

## 📊 Auditoría y Compliance

### Consultas Útiles

**Ver todos los logins del día:**
```sql
SELECT 
  au.email,
  au.role,
  al.created_at,
  al.ip_address
FROM audit_logs al
JOIN admin_users au ON al.admin_user_id = au.id
WHERE al.action = 'LOGIN'
AND al.created_at >= CURRENT_DATE
ORDER BY al.created_at DESC;
```

**Ver cambios en un producto:**
```sql
SELECT 
  au.email,
  al.action,
  al.old_values,
  al.new_values,
  al.created_at
FROM audit_logs al
JOIN admin_users au ON al.admin_user_id = au.id
WHERE al.table_name = 'products'
AND al.record_id = 'uuid-del-producto'
ORDER BY al.created_at DESC;
```

**Detectar acciones sospechosas:**
```sql
SELECT 
  au.email,
  COUNT(*) as action_count,
  al.action,
  al.ip_address
FROM audit_logs al
JOIN admin_users au ON al.admin_user_id = au.id
WHERE al.created_at >= NOW() - INTERVAL '1 hour'
GROUP BY au.email, al.action, al.ip_address
HAVING COUNT(*) > 50 -- Más de 50 acciones en 1 hora
ORDER BY action_count DESC;
```

### Retención de Logs

Por defecto, los logs se guardan indefinidamente. Para producción, considera:

```sql
-- Crear política de retención (ej: 2 años)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM audit_logs
  WHERE created_at < NOW() - INTERVAL '2 years';
END;
$$ LANGUAGE plpgsql;

-- Ejecutar mensualmente con pg_cron (extensión de Supabase)
-- O manualmente según necesites
```

---

## 🧪 Pruebas de Seguridad

### Checklist de Seguridad

- [ ] **Autenticación**
  - [ ] Login solo funciona con usuario en `admin_users`
  - [ ] Login falla si admin está inactivo (`is_active = false`)
  - [ ] Cookies tienen flags `httpOnly`, `secure`, `sameSite=strict`
  - [ ] Sesión expira después de 7 días
  
- [ ] **Autorización**
  - [ ] Rutas `/admin/*` redirigen a login sin sesión
  - [ ] Usuario autenticado pero no admin no puede acceder
  - [ ] Roles se respetan (viewer no puede crear, editor no puede eliminar)
  
- [ ] **Validaciones**
  - [ ] Precio se convierte correctamente (€99.99 → 9999 céntimos)
  - [ ] Stock negativo es rechazado
  - [ ] URLs de imágenes se validan contra dominios permitidos
  - [ ] SKU duplicado es rechazado
  
- [ ] **RLS Policies**
  - [ ] Cliente anónimo solo puede leer productos activos
  - [ ] Cliente no puede modificar productos desde DevTools
  - [ ] Service role puede hacer todo
  
- [ ] **Auditoría**
  - [ ] Login se registra en `audit_logs`
  - [ ] Creación de productos se registra
  - [ ] IP y User-Agent se capturan correctamente

### Pruebas de Penetración Básicas

**Prueba 1: Bypass de autenticación**
```bash
# Intentar acceder a API sin cookies
curl -X POST https://tu-dominio.com/api/products/create \
  -d "name=Hack&price=1"

# ✅ Debería retornar 401 Unauthorized
```

**Prueba 2: Manipulación de precio**
```bash
# Intentar enviar precio negativo
curl -X POST https://tu-dominio.com/api/products/create \
  -H "Cookie: sb-access-token=...; sb-refresh-token=..." \
  -d "name=Test&price=-100"

# ✅ Debería retornar error de validación
```

**Prueba 3: RLS bypass**
```javascript
// En DevTools del navegador (con anon key)
const { data, error } = await supabase
  .from('products')
  .update({ price: 1 })
  .eq('id', 'algún-uuid');

// ✅ Debería retornar error de policy violation
```

---

## 🚀 Próximos Pasos

### Fase 2: E-commerce Funcional (Próxima Semana)

**Pendiente:**
1. [ ] Implementar Stripe Checkout
2. [ ] Crear webhook handler para confirmar pagos
3. [ ] Validación de stock en checkout (transacciones atómicas)
4. [ ] Carrito persistente en Supabase
5. [ ] Envío de emails de confirmación

**Archivos a crear:**
```
src/
  pages/
    api/
      checkout/
        create-session.ts    # Crear sesión de Stripe
        webhook.ts           # Webhook de Stripe
      orders/
        [id].ts             # Ver pedido
  lib/
    stripe.ts              # Cliente de Stripe
    email.ts               # Envío de emails
```

### Fase 3: Experiencia Profesional

**Pendiente:**
1. [ ] Rate limiting (Upstash Redis)
2. [ ] Logging estructurado (Winston/Pino)
3. [ ] Monitoreo (Sentry)
4. [ ] Tests automatizados (Vitest + Playwright)

### Fase 4: Escalabilidad

**Pendiente:**
1. [ ] Arquitectura de servicios (separar lógica de negocio)
2. [ ] CDN para imágenes (Cloudflare)
3. [ ] Cache de productos (Redis)
4. [ ] CI/CD pipeline (GitHub Actions)

---

## ⚠️ Advertencias Importantes

### NUNCA Hagas Esto

❌ **NO uses service_role key en el cliente:**
```javascript
// ❌ PELIGRO: Expone control total de la DB
const supabase = createClient(url, SERVICE_ROLE_KEY);
```

❌ **NO confíes en validaciones del cliente:**
```javascript
// ❌ El cliente puede modificar esto
<input min="0" max="1000" />
// ✅ Siempre valida en el servidor
```

❌ **NO mezcles usuarios finales con admins:**
```sql
-- ❌ NO hagas esto
ALTER TABLE auth.users ADD COLUMN is_admin BOOLEAN;
-- ✅ Usa tabla separada admin_users
```

❌ **NO uses RLS policies permisivas:**
```sql
-- ❌ NO hagas esto
CREATE POLICY "todos pueden modificar"
ON products FOR ALL USING (true);
-- ✅ Separa lectura (anon) de escritura (service_role)
```

### Siempre Haz Esto

✅ **Valida todo en el servidor**
✅ **Usa service_role solo en server-side**
✅ **Registra acciones sensibles en audit_logs**
✅ **Usa transacciones para operaciones críticas**
✅ **Mantén separados admins de clientes**
✅ **Revisa logs de auditoría regularmente**

---

## 📞 Soporte y Mantenimiento

### Agregar un Nuevo Admin

```sql
-- 1. Crear usuario en Supabase Auth Dashboard
-- 2. Insertar en admin_users
INSERT INTO admin_users (id, email, role, full_name, is_active)
VALUES (
  'uuid-del-nuevo-usuario',
  'nuevo-admin@fashionmarket.com',
  'admin',  -- o 'editor', 'viewer'
  'Nombre Completo',
  true
);
```

### Desactivar un Admin

```sql
-- NO eliminar, solo desactivar
UPDATE admin_users 
SET is_active = false,
    updated_at = NOW()
WHERE email = 'admin@ejemplo.com';
```

### Ver Estadísticas de Admin

```sql
SELECT 
  au.email,
  au.role,
  COUNT(DISTINCT al.action) as unique_actions,
  COUNT(*) as total_actions,
  MAX(al.created_at) as last_action
FROM admin_users au
LEFT JOIN audit_logs al ON au.id = al.admin_user_id
WHERE au.is_active = true
GROUP BY au.id, au.email, au.role
ORDER BY total_actions DESC;
```

---

## ✅ Checklist de Producción

Antes de desplegar a producción:

- [ ] Schema seguro ejecutado en Supabase producción
- [ ] Primer super_admin creado
- [ ] Variables de entorno configuradas (con service_role key seguro)
- [ ] RLS policies verificadas
- [ ] Pruebas de seguridad completadas
- [ ] SSL/HTTPS configurado
- [ ] Cookies en modo `secure: true`
- [ ] Rate limiting implementado
- [ ] Backup de base de datos configurado
- [ ] Monitoreo activo (Sentry, etc.)
- [ ] Logs de auditoría revisados
- [ ] Política de retención de logs definida
- [ ] Documentación interna actualizada
- [ ] Equipo capacitado en sistema de roles

---

## 📚 Referencias

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [PostgreSQL Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

---

**FIN DE LA FASE 1 - SEGURIDAD CRÍTICA**

*Este documento debe mantenerse actualizado con cada cambio de seguridad.*
