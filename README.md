# 🛍️ FashionMarket - E-commerce Premium de Moda

<!-- Build: 2026-01-13-20:00 -->

Tienda online profesional de moda (Mujer & Hombre) construida con **Astro 5.0**, **Tailwind CSS**, **Supabase** y **navegación tipo H&M**.

[![Seguridad](https://img.shields.io/badge/Seguridad-Nivel%20Empresarial-green)](./ARQUITECTURA_SEGURIDAD_TOTAL.md)
[![Navegación](https://img.shields.io/badge/Navegación-Tipo%20H&M-blue)](./NAVEGACION_HM_GUIA.md)
[![Búsqueda](https://img.shields.io/badge/Búsqueda-Full--Text-orange)](./ARQUITECTURA_BUSQUEDA_FILTROS.md)

---

## 🎯 CARACTERÍSTICAS PRINCIPALES

### 🏪 Navegación Tipo H&M (NUEVO)

- ✅ **Género como punto de partida**: /mujer y /hombre
- ✅ **Menú lateral jerárquico** con 125+ categorías
- ✅ **Diseño minimalista** tipo editorial
- ✅ **Categorías expandibles** (Ropa, Accesorios, Zapatos, Sport)
- ✅ **Subcategorías claras** (Vestidos, Camisetas, Pantalones...)
- ✅ **Experiencia de exploración** comparable a tiendas comerciales

➡️ **[VER GUÍA DE NAVEGACIÓN](./NAVEGACION_HM_GUIA.md)**

### 🔍 Sistema de Búsqueda Avanzado

- ✅ **Full-text search** en PostgreSQL (español)
- ✅ **Autocompletado instantáneo** (300ms debounce)
- ✅ **Filtros combinables**: género, categoría, precio, tallas, colores
- ✅ **Ordenamiento**: relevancia, precio, popularidad, novedades
- ✅ **Navegación con teclado** (↑↓ Enter Esc)

➡️ **[VER ARQUITECTURA DE BÚSQUEDA](./ARQUITECTURA_BUSQUEDA_FILTROS.md)**

### 🔒 Seguridad Empresarial

- ✅ **Separación total**: Usuarios finales vs Administradores
- ✅ **Panel admin oculto**: /internal-admin (no indexado)
- ✅ **7 capas de seguridad**: IP whitelist, rate limiting, RBAC
- ✅ **Auditoría completa** de acciones administrativas
- ✅ **RLS restrictivas** (solo service_role escribe)

➡️ **[VER ARQUITECTURA DE SEGURIDAD](./ARQUITECTURA_SEGURIDAD_TOTAL.md)**

---

## 🏗️ Arquitectura Técnica

### Stack Tecnológico

- **Frontend**: Astro 5.0 (SSR full server mode)
- **Estilos**: Tailwind CSS con paleta de moda premium
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **Estado del Cliente**: Nano Stores (< 1KB)
- **Islas Interactivas**: React 18
- **Búsqueda**: PostgreSQL Full-Text (GIN indexes)
- **Seguridad**: RBAC + Middleware + RLS

### Características Clave

#### 🏪 Navegación y Categorización
- Estructura jerárquica 3 niveles (Género → Categoría → Subcategoría)
- 125+ categorías profesionales (65 mujer + 60 hombre)
- Menú lateral tipo H&M con categorías expandibles
- URLs amigables: `/mujer/ropa-mujer/vestidos`
- Breadcrumbs de navegación
- Responsive mobile-first

#### 🔍 Búsqueda y Filtrado
- Full-text search con ranking de relevancia
- Autocompletado con productos, categorías y géneros
- 8 filtros combinables (género, categoría, precio, tallas, colores...)
- Paginación y ordenamiento dinámico
- Estado global con Nano Stores
- API REST optimizada

#### 🛡️ Seguridad (Completada)
- Sistema de roles de administrador
- Autenticación robusta con Supabase Auth
- Row Level Security (RLS) implementado correctamente
- Auditoría completa en `audit_logs`
- Cookies seguras (`httpOnly`, `secure`, `sameSite=strict`)
- Validaciones server-side

#### 🛒 E-commerce (Fase 2 - PENDIENTE)
- Catálogo de productos con categorías
- Gestión de inventario (stock, SKU)
- Carrito de compras (actualmente localStorage)
- Panel de administración protegido
- ⏳ Integración con Stripe (próxima fase)
- ⏳ Sistema de checkout (próxima fase)
- ⏳ Gestión de pedidos (schema listo)

#### ⚡ Performance
- SSG para páginas públicas (productos, categorías)
- SSR para panel de administración
- Imágenes optimizadas
- Lazy loading de componentes React

---

## 🚀 Inicio Rápido

### Opción A: Proyecto Nuevo (Recomendado)

#### 1. Instalación de Dependencias
```bash
npm install
```

#### 2. Configuración de Supabase

1. Crea un proyecto en [Supabase](https://supabase.com)
2. Ve a **SQL Editor** y ejecuta `supabase-schema-secure.sql`
3. Ve a **Authentication > Users** y crea tu primer admin
4. Copia el UUID del usuario creado

#### 3. Agregar Admin a la Base de Datos
```sql
-- En Supabase SQL Editor:
INSERT INTO admin_users (id, email, role, full_name, is_active)
VALUES (
  'uuid-del-usuario-aqui',  -- UUID del paso anterior
  'admin@fashionmarket.com',
  'super_admin',
  'Administrador Principal',
  true
);
```

#### 4. Variables de Entorno

Crea `.env` en la raíz:

```env
# Supabase (desde Dashboard > Settings > API)
PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-aqui
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-aqui

# Entorno
NODE_ENV=development
```

⚠️ **CRÍTICO:** 
- Agrega `.env` a tu `.gitignore`
- NUNCA expongas `SUPABASE_SERVICE_ROLE_KEY` en el cliente

#### 5. Ejecutar en Desarrollo
```bash
npm run dev
```

Abre http://localhost:4321

#### 6. Acceder al Panel de Admin
1. Ve a http://localhost:4321/internal-admin/login
2. Ingresa credenciales del admin creado
3. ✅ Deberías ver el panel de administración

### Opción B: Proyecto Existente (Migración)

Si ya tienes una base de datos con productos:

```bash
# En Supabase SQL Editor, ejecuta:
migrations/001_add_admin_security.sql
```

Este script actualiza tu DB sin perder datos existentes.

---

## 📚 Documentación

### 📖 Documentación Principal

| Documento | Propósito | Audiencia |
|-----------|-----------|-----------|
| [RESUMEN_EJECUTIVO.md](./RESUMEN_EJECUTIVO.md) | Visión general y beneficios | CTO, PM, Cliente |
| [IMPLEMENTACION_FASE_1.md](./IMPLEMENTACION_FASE_1.md) | Guía de implementación | Desarrolladores |
| [SECURITY_IMPLEMENTATION.md](./SECURITY_IMPLEMENTATION.md) | Documentación técnica completa (60 páginas) | Arquitectos, Seniors |
| [CHECKLIST_SEGURIDAD.md](./CHECKLIST_SEGURIDAD.md) | Checklist de verificación | QA, DevOps |
| [ARQUITECTURA_DIAGRAMAS.md](./ARQUITECTURA_DIAGRAMAS.md) | Diagramas visuales | Todos |
| [INDICE_ARCHIVOS.md](./INDICE_ARCHIVOS.md) | Índice de todos los archivos | Todos |

### 🎓 Aprende más sobre:

- **Sistema de Roles:** [SECURITY_IMPLEMENTATION.md#sistema-de-roles](./SECURITY_IMPLEMENTATION.md#sistema-de-roles)
- **RLS Policies:** [SECURITY_IMPLEMENTATION.md#rls-policies](./SECURITY_IMPLEMENTATION.md#arquitectura-de-rls)
- **Auditoría:** [SECURITY_IMPLEMENTATION.md#auditoría-y-compliance](./SECURITY_IMPLEMENTATION.md#auditoría-y-compliance)
- **Pruebas:** [CHECKLIST_SEGURIDAD.md](./CHECKLIST_SEGURIDAD.md)

---

## 🗂️ Estructura del Proyecto

```
fashionmarket/
├── migrations/
│   └── 001_add_admin_security.sql     # Migración de seguridad
├── public/
│   └── fonts/
├── src/
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.astro
│   │   │   ├── Header.astro
│   │   │   ├── Footer.astro
│   │   │   └── CartSlideOver.tsx
│   │   ├── product/
│   │   │   ├── ProductCard.astro
│   │   │   └── ProductGallery.astro
│   │   └── islands/
│   │       ├── AddToCartButton.tsx
│   │       └── CartIcon.tsx
│   ├── layouts/
│   │   ├── BaseLayout.astro
│   │   ├── PublicLayout.astro
│   │   └── AdminLayout.astro
│   ├── lib/
│   │   ├── auth.ts                    # ⭐ NUEVO: Helper de autenticación
│   │   ├── supabase.ts                # Actualizado con nuevos tipos
│   │   └── utils.ts
│   ├── pages/
│   │   ├── index.astro
│   │   ├── productos/
│   │   ├── categoria/
│   │   ├── admin/                     # Panel protegido
│   │   │   ├── index.astro
│   │   │   ├── login.astro            # Actualizado
│   │   │   └── productos/
│   │   └── api/
│   │       ├── auth/                  # Actualizado
│   │       │   ├── login.ts
│   │       │   └── logout.ts
│   │       └── products/              # Actualizado
│   │           └── create.ts
│   ├── stores/
│   │   └── cart.ts
│   ├── styles/
│   │   └── global.css
│   ├── middleware.ts                  # ⭐ Actualizado: Verificación de admin
│   └── env.d.ts                       # Actualizado
├── supabase-schema-secure.sql         # ⭐ NUEVO: Schema seguro (600 líneas)
├── supabase-schema.sql                # ⚠️  OBSOLETO (mantener como referencia)
├── RESUMEN_EJECUTIVO.md               # ⭐ NUEVO
├── IMPLEMENTACION_FASE_1.md           # ⭐ NUEVO
├── SECURITY_IMPLEMENTATION.md         # ⭐ NUEVO (60 páginas)
├── CHECKLIST_SEGURIDAD.md             # ⭐ NUEVO
├── ARQUITECTURA_DIAGRAMAS.md          # ⭐ NUEVO
├── INDICE_ARCHIVOS.md                 # ⭐ NUEVO
├── SUPABASE_SETUP.md                  # Existente
├── astro.config.mjs
├── tailwind.config.mjs
└── package.json
```

---

## 🔐 Sistema de Seguridad

### Autenticación de Admin

```typescript
// Solo admins verificados pueden acceder al panel
// src/middleware.ts
const permissionCheck = await verifyAdminSession(accessToken, refreshToken);
if (!permissionCheck.allowed) {
  return redirect('/internal-admin/login?error=not_admin');
}
locals.admin = permissionCheck.user; // Con rol y permisos
```

### Sistema de Roles (RBAC)

| Rol | Permisos |
|-----|----------|
| `super_admin` | Todo (incluso gestionar otros admins) |
| `admin` | Gestión completa (productos, pedidos, categorías) |
| `editor` | Solo crear/editar productos (no eliminar) |
| `viewer` | Solo lectura (reportes) |

### RLS Policies

```sql
-- Público: solo lectura
CREATE POLICY "Anyone can view active products"
  ON products FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Escritura: solo desde APIs con service_role
CREATE POLICY "Service role can manage products"
  ON products FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
```

### Auditoría Completa

Toda acción administrativa se registra en `audit_logs`:
- Quién (admin_user_id)
- Qué (action: LOGIN, CREATE, UPDATE, DELETE)
- Dónde (table_name, record_id)
- Cuándo (created_at)
- Desde dónde (ip_address, user_agent)
- Qué cambió (old_values, new_values en JSONB)

---

## 🧪 Pruebas

### Verificar Seguridad

```bash
# 1. Ejecuta el checklist de seguridad
# Ver CHECKLIST_SEGURIDAD.md

# 2. Pruebas básicas
npm run dev

# Test 1: Login sin ser admin
# Crear usuario en Supabase Auth (NO agregarlo a admin_users)
# Intentar login → Debería rechazar con "No es admin"

# Test 2: Crear producto
# Login como admin → Ir a /internal-admin/productos/nuevo
# Precio: 99.99 → Debería guardarse como 9999 céntimos

# Test 3: Verificar auditoría
# En Supabase SQL Editor:
SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10;
```

---

## 📊 Base de Datos

### Tablas Principales

```sql
admin_users      -- Administradores con roles
products         -- Catálogo de productos
categories       -- Categorías de productos
orders           -- Pedidos (preparado para Stripe)
order_items      -- Líneas de pedido
audit_logs       -- Auditoría de acciones
```

### Schema Completo

Ver [supabase-schema-secure.sql](./supabase-schema-secure.sql)

---

## 🚦 Roadmap

### ✅ Fase 1: Seguridad Crítica (COMPLETADA)
- [x] Sistema de roles de admin
- [x] Autenticación robusta
- [x] RLS policies corregidas
- [x] Auditoría completa
- [x] Validaciones server-side
- [x] Schema de pedidos preparado

### ⏳ Fase 2: E-commerce Funcional (Próxima)
- [ ] Integración con Stripe
- [ ] Sistema de checkout
- [ ] Webhooks de confirmación de pago
- [ ] Validación atómica de stock
- [ ] Emails transaccionales
- [ ] Carrito persistente en Supabase

### ⏳ Fase 3: Testing & Calidad
- [ ] Tests unitarios (Vitest)
- [ ] Tests E2E (Playwright)
- [ ] CI/CD pipeline
- [ ] Linting automatizado

### ⏳ Fase 4: Producción & Escalabilidad
- [ ] Rate limiting
- [ ] CDN para imágenes
- [ ] Monitoring (Sentry)
- [ ] Performance optimization
- [ ] Backup automatizado

---

## 🤝 Contribuir

Este proyecto sigue estándares profesionales de código:

1. Lee la documentación completa antes de contribuir
2. Sigue las convenciones de código existentes
3. Todas las APIs deben verificar autenticación y permisos
4. Todas las acciones administrativas deben registrarse en audit_logs
5. Nunca expongas `SUPABASE_SERVICE_ROLE_KEY` en el cliente
6. Escribe tests para nuevas funcionalidades

---

## 📝 Scripts Disponibles

```bash
npm run dev       # Desarrollo (localhost:4321)
npm run build     # Build para producción
npm run preview   # Preview del build
npm run astro     # CLI de Astro
```

---

## ⚠️ Advertencias Importantes

### NUNCA hacer:
❌ Usar `SUPABASE_SERVICE_ROLE_KEY` en el cliente  
❌ Confiar en validaciones del frontend  
❌ Mezclar usuarios finales con admins  
❌ Usar RLS policies permisivas para `authenticated`  
❌ Exponer precios calculados en el cliente

### SIEMPRE hacer:
✅ Validar TODO en el servidor  
✅ Usar `service_role` solo en APIs server-side  
✅ Registrar acciones sensibles en `audit_logs`  
✅ Separar admins de clientes  
✅ Revisar logs regularmente

---

## 🆘 Soporte

### Problemas Comunes

**Error: "Usuario no es administrador"**
- Verifica que el usuario existe en `admin_users`
- Verifica que `is_active = true`

**Error: "Missing Supabase environment variables"**
- Verifica que `.env` existe
- Verifica que tiene las 3 variables

**Error: "new row violates row-level security policy"**
- Las escrituras deben pasar por APIs con `service_role`

Ver [CHECKLIST_SEGURIDAD.md](./CHECKLIST_SEGURIDAD.md) para más soluciones.

---

## 📄 Licencia

Este proyecto es privado y confidencial.

---

## 🎯 Estado Actual

```
✅ Fase 1: Seguridad Crítica (COMPLETADA)
⏳ Fase 2: E-commerce Funcional (Pendiente - necesita Stripe)
⏳ Fase 3: Testing & Calidad (Pendiente)
⏳ Fase 4: Producción (Pendiente)
```

**Producción:** ⚠️ NO LISTO (falta integración de pagos en Fase 2)  
**Admin:** ✅ LISTO para uso inmediato

---

## 📞 Contacto

Para más información sobre la implementación, consulta:
- [RESUMEN_EJECUTIVO.md](./RESUMEN_EJECUTIVO.md) - Visión general
- [IMPLEMENTACION_FASE_1.md](./IMPLEMENTACION_FASE_1.md) - Guía práctica
- [SECURITY_IMPLEMENTATION.md](./SECURITY_IMPLEMENTATION.md) - Documentación técnica

---

**Desarrollado con ❤️ usando Astro + Supabase**  
**Seguridad de nivel empresarial implementada ✅**
