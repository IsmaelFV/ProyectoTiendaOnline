# 🚀 GUÍA DE MIGRACIÓN A SEGURIDAD TOTAL

## ✅ COMPLETADO

### Archivos Actualizados:

1. **src/middleware.ts** ✅
   - Nueva verificación multi-capa
   - Ruta cambiada de `/admin` a `/internal-admin`
   - Rate limiting implementado
   - IP whitelist preparado (desactivado por defecto)
   - Cross-access prevention (admin no puede checkout)

2. **src/pages/admin** → **src/pages/internal-admin** ✅
   - Carpeta renombrada completamente
   - Incluye: login.astro, index.astro, productos/*

3. **ARQUITECTURA_SEGURIDAD_TOTAL.md** ✅
   - Documentación completa de 200+ líneas
   - Diagramas de flujo
   - Tests de seguridad
   - Troubleshooting

---

## 📋 TAREAS PENDIENTES (Requeridas)

### 1. Actualizar Referencias a `/admin` → `/internal-admin`

Archivos que necesitas revisar y actualizar:

#### ❌ APIs de autenticación:
- `src/pages/api/auth/login.ts` → Cambiar redirects de `/admin/login` a `/internal-admin/login`
- `src/pages/api/auth/logout.ts` → Cambiar redirect destino

```typescript
// BUSCAR Y REEMPLAZAR:
// Antes: redirect('/admin/login')
// Después: redirect('/internal-admin/login')
```

#### ❌ Páginas de admin:
- `src/pages/internal-admin/login.astro` → Actualizar action del form
- `src/pages/internal-admin/index.astro` → Verificar rutas internas
- `src/pages/internal-admin/productos/*.astro` → Actualizar links

```html
<!-- BUSCAR Y REEMPLAZAR: -->
<!-- Antes: href="/admin/..." -->
<!-- Después: href="/internal-admin/..." -->
```

#### ❌ Layouts:
- `src/layouts/AdminLayout.astro` → Actualizar navegación

```astro
<!-- Buscar referencias a /admin y cambiar a /internal-admin -->
<a href="/internal-admin">Dashboard</a>
<a href="/internal-admin/productos">Productos</a>
```

### 2. Actualizar Documentación Principal

#### ❌ README.md
```markdown
# Cambiar:
## Acceder al Panel de Admin
1. Ve a http://localhost:4321/admin/login

# Por:
## Acceder al Panel de Admin
1. Ve a http://localhost:4321/internal-admin/login
```

#### ❌ IMPLEMENTACION_FASE_1.md
- Actualizar todas las referencias de rutas `/admin` → `/internal-admin`

### 3. Configurar IP Whitelist (Opcional pero Recomendado)

Si quieres restringir acceso solo desde IPs conocidas:

```typescript
// src/middleware.ts (línea ~43)
const ALLOWED_IPS: string[] = [
  // Descomenta y agrega tus IPs:
  // '203.0.113.50',    // Tu oficina
  // '198.51.100.25',   // Tu casa
];
```

Para obtener tu IP actual:
```bash
curl https://api.ipify.org
```

### 4. Crear robots.txt

```bash
# Crear archivo: public/robots.txt
```

```txt
User-agent: *
Disallow: /internal-admin/
Disallow: /api/

# Permitir todo lo demás
Allow: /
Allow: /productos/
Allow: /categoria/
```

### 5. Agregar Meta Tags No-Index

En cada página de `src/pages/internal-admin/*.astro`:

```astro
<head>
  <meta name="robots" content="noindex, nofollow">
  <meta name="googlebot" content="noindex, nofollow">
  <!-- ... resto del head -->
</head>
```

---

## 🧪 TESTING DESPUÉS DE MIGRACIÓN

### Test 1: Servidor Arranca Sin Errores

```bash
npm run dev
```

✅ Esperado: Sin errores de TypeScript o rutas no encontradas

### Test 2: Ruta Anterior Bloqueada

```bash
# Abrir navegador
http://localhost:4321/admin
```

✅ Esperado: 404 Not Found (ya no existe)

### Test 3: Nueva Ruta Accesible

```bash
http://localhost:4321/internal-admin/login
```

✅ Esperado: Página de login visible

### Test 4: Login Admin Funciona

1. Ir a Supabase Dashboard > Authentication
2. Crear un usuario: admin@test.com
3. En SQL Editor:
   ```sql
   INSERT INTO admin_users (id, email, role, full_name, is_active)
   VALUES (
     'uuid-del-usuario-creado',
     'admin@test.com',
     'super_admin',
     'Admin Test',
     true
   );
   ```
4. Login en http://localhost:4321/internal-admin/login
5. Verificar acceso al panel

### Test 5: Usuario NO-Admin Bloqueado

1. Crear usuario cliente: cliente@test.com (solo en Auth, NO en admin_users)
2. Login desde algún endpoint de cliente (si existe)
3. Intentar acceder: http://localhost:4321/internal-admin

✅ Esperado: Redirect a login con error=forbidden

---

## 🔧 COMANDOS ÚTILES

### Buscar todas las referencias a /admin:

```powershell
# En PowerShell:
Get-ChildItem -Path "c:\Users\ismae\Documents\ProyectoTiendaOnline\src" -Recurse -Include *.astro,*.ts,*.tsx | Select-String -Pattern '\/admin' -CaseSensitive
```

### Reemplazar automáticamente (CON CUIDADO):

```powershell
# Backup primero
Copy-Item -Path "c:\Users\ismae\Documents\ProyectoTiendaOnline\src" -Destination "c:\Users\ismae\Documents\ProyectoTiendaOnline\src.backup" -Recurse

# Reemplazar en archivos TypeScript y Astro
Get-ChildItem -Path "c:\Users\ismae\Documents\ProyectoTiendaOnline\src" -Recurse -Include *.astro,*.ts,*.tsx | ForEach-Object {
    (Get-Content $_.FullName) -replace '\/admin\/', '/internal-admin/' | Set-Content $_.FullName
}
```

---

## 📊 VERIFICACIÓN FINAL

Antes de considerar la migración completa, verifica:

- [ ] `npm run dev` arranca sin errores
- [ ] Login admin funciona en `/internal-admin/login`
- [ ] Panel admin carga en `/internal-admin`
- [ ] Crear producto funciona
- [ ] Audit logs se registran correctamente
- [ ] Usuario NO-admin es bloqueado
- [ ] Ruta antigua `/admin` devuelve 404
- [ ] robots.txt bloquea crawlers
- [ ] Meta tags noindex agregados

---

## 🚨 PROBLEMAS COMUNES

### Error: "Cannot find module './lib/auth'"

**Causa:** Imports de auth.ts no actualizados

**Solución:**
```typescript
// Verificar que todos los archivos importen:
import { verifyAdminSession } from './lib/auth';
// O desde APIs:
import { verifyAdminSession } from '../../../lib/auth';
```

### Error: "404 Not Found" en /internal-admin

**Causa:** Carpeta no renombrada correctamente

**Solución:**
```bash
# Verificar que existe:
ls "c:\Users\ismae\Documents\ProyectoTiendaOnline\src\pages\internal-admin"
```

### Warning: "Redirected from /admin to /internal-admin"

**Causa:** Referencias antiguas no actualizadas

**Solución:** Usar comando de búsqueda arriba para encontrar todas las referencias

---

## 🎯 PRÓXIMOS PASOS OPCIONALES

### 1. Agregar MFA (Multi-Factor Authentication)

Seguir guía en `ARQUITECTURA_SEGURIDAD_TOTAL.md` sección "Fase 2"

### 2. Configurar Alertas de Seguridad

- Sentry integration
- Email notifications
- Slack webhooks

### 3. Session Management Avanzado

- Auto-logout después de 30 min inactividad
- Lista de sesiones activas
- Logout remoto

---

## 📞 SOPORTE

Si encuentras problemas:

1. Revisa logs en terminal (`npm run dev`)
2. Verifica logs de Supabase (Dashboard > Logs)
3. Consulta `ARQUITECTURA_SEGURIDAD_TOTAL.md` sección Troubleshooting
4. Verifica que todas las variables de entorno están configuradas (`.env`)

---

**Migración creada:** 13 de enero de 2026  
**Versión:** 2.0 - Seguridad Total  
**Estado:** ⏳ Requiere completar tareas pendientes arriba
