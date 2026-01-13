# 📦 Guía de Instalación Completa - FashionMarket

Esta guía te llevará paso a paso desde cero hasta tener el proyecto funcionando.

## ✅ Requisitos Previos

- **Node.js** 18.x o superior ([Descargar aquí](https://nodejs.org/))
- **npm** 9.x o superior (viene con Node.js)
- Cuenta en **Supabase** ([Crear cuenta gratis](https://supabase.com))
- Editor de código (recomendado: VS Code)

## 🚀 Paso 1: Instalar Dependencias

Abre una terminal en la carpeta del proyecto y ejecuta:

```bash
npm install
```

Esto instalará todas las dependencias necesarias:
- Astro 5.0
- React 18
- Tailwind CSS
- Supabase Client
- Nano Stores
- TypeScript

**Tiempo estimado:** 2-3 minutos

## 🗄️ Paso 2: Configurar Supabase

### 2.1 Crear Proyecto en Supabase

1. Ve a [https://supabase.com](https://supabase.com)
2. Haz clic en "Start your project"
3. Crea una nueva organización (si no tienes una)
4. Crea un nuevo proyecto:
   - **Name:** FashionMarket (o el nombre que prefieras)
   - **Database Password:** Guarda esta contraseña en un lugar seguro
   - **Region:** Elige la más cercana a ti
5. Espera 1-2 minutos mientras se crea el proyecto

### 2.2 Ejecutar el Script SQL

1. En tu proyecto de Supabase, ve al menú lateral → **SQL Editor**
2. Haz clic en **New query**
3. Abre el archivo `supabase-setup-completo.sql` de este proyecto
4. Copia TODO el contenido del archivo
5. Pégalo en el editor SQL de Supabase
6. Haz clic en **Run** (o presiona Ctrl+Enter)

✅ Deberías ver un mensaje de éxito con:
- ✓ Categorías creadas: 4
- ✓ Productos de ejemplo creados: 6
- ✓ RLS habilitado en todas las tablas
- ✓ Políticas de acceso configuradas

### 2.3 Verificar las Tablas

1. Ve a **Table Editor** en el menú lateral
2. Deberías ver dos tablas:
   - `categories` (4 registros)
   - `products` (6 registros)

### 2.4 Configurar Storage para Imágenes

1. Ve a **Storage** en el menú lateral
2. Verifica que existe el bucket `product-images`
3. Si no existe, créalo manualmente:
   - Haz clic en **New bucket**
   - Name: `product-images`
   - ✅ Marca "Public bucket"
   - Haz clic en **Create bucket**

Las políticas de storage ya fueron creadas por el script SQL.

### 2.5 Crear Usuario Administrador

1. Ve a **Authentication** → **Users** en el menú lateral
2. Haz clic en **Add user** → **Create new user**
3. Completa:
   - **Email:** tu-email@ejemplo.com
   - **Password:** Una contraseña segura (mínimo 8 caracteres)
   - ✅ Marca "Auto Confirm User"
4. Haz clic en **Create user**

**Guarda estas credenciales**, las necesitarás para acceder al panel de administración.

## 🔐 Paso 3: Configurar Variables de Entorno

### 3.1 Obtener las Credenciales de Supabase

1. En tu proyecto de Supabase, ve a **Settings** (⚙️) → **API**
2. Encontrarás:
   - **Project URL** (algo como: `https://abcdefgh.supabase.co`)
   - **anon/public key** (una clave larga que empieza con `eyJ...`)
   - **service_role key** (⚠️ SECRETA - solo para backend)

### 3.2 Crear el Archivo .env

1. En la raíz del proyecto, copia el archivo `.env.example` a `.env`:

```bash
# En Windows PowerShell:
Copy-Item .env.example .env

# En Mac/Linux:
cp .env.example .env
```

2. Abre el archivo `.env` y completa con tus credenciales:

```env
PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

⚠️ **IMPORTANTE:** 
- Nunca compartas el `SUPABASE_SERVICE_ROLE_KEY`
- No subas el archivo `.env` a Git (ya está en `.gitignore`)

## 🎨 Paso 4: Ejecutar el Proyecto

### 4.1 Modo Desarrollo

```bash
npm run dev
```

El proyecto se abrirá en: **http://localhost:4321**

### 4.2 Verificar que Todo Funciona

1. **Homepage:** Deberías ver la página principal con productos destacados
2. **Productos:** Ve a `/productos` - deberías ver 6 productos
3. **Categorías:** Haz clic en "Camisas", "Pantalones" o "Trajes"
4. **Detalle:** Haz clic en un producto para ver su página de detalle
5. **Carrito:** Selecciona una talla y añade al carrito
6. **Admin:** Ve a `/admin/login` e inicia sesión con las credenciales que creaste

## 🔧 Solución de Problemas Comunes

### Error: "Cannot find module '@supabase/supabase-js'"

**Solución:** Las dependencias no están instaladas.
```bash
npm install
```

### Error: "Missing Supabase environment variables"

**Solución:** El archivo `.env` no existe o está mal configurado.
1. Verifica que el archivo `.env` existe en la raíz del proyecto
2. Verifica que las variables están correctamente copiadas de Supabase
3. Reinicia el servidor de desarrollo (`Ctrl+C` y luego `npm run dev`)

### Error: "Failed to fetch products"

**Solución:** Problema con la base de datos o RLS.
1. Verifica que ejecutaste el script SQL completo
2. Ve a Supabase → Table Editor → verifica que existen las tablas
3. Ve a Authentication → Policies → verifica que existen las políticas

### Las imágenes no se muestran

**Solución:** Las URLs de ejemplo de Unsplash pueden no funcionar.
1. Ve al panel de administración (`/admin`)
2. Edita los productos
3. Sube tus propias imágenes a Supabase Storage
4. Actualiza las URLs de las imágenes

### No puedo iniciar sesión en /admin/login

**Solución:** 
1. Verifica que creaste el usuario en Supabase Authentication
2. Verifica que el email y contraseña son correctos
3. Verifica que el usuario está confirmado (Auto Confirm User)

## 📝 Comandos Útiles

```bash
# Instalar dependencias
npm install

# Desarrollo
npm run dev

# Build para producción
npm run build

# Preview del build
npm run preview

# Verificar TypeScript
npm run astro check
```

## 🎯 Próximos Pasos

Una vez que todo funciona:

1. **Personaliza los productos:**
   - Ve a `/admin/productos`
   - Edita o crea nuevos productos

2. **Sube imágenes reales:**
   - Ve a Supabase → Storage → `product-images`
   - Sube tus imágenes
   - Copia las URLs públicas
   - Actualiza los productos con las nuevas URLs

3. **Personaliza el diseño:**
   - Edita `tailwind.config.mjs` para cambiar colores
   - Modifica componentes en `src/components/`

4. **Añade más funcionalidades:**
   - Sistema de búsqueda
   - Filtros avanzados
   - Integración de pagos (Stripe)
   - Sistema de reviews

## 🚢 Desplegar a Producción

### Opción 1: Vercel (Recomendado)

1. Sube tu código a GitHub
2. Ve a [vercel.com](https://vercel.com)
3. Importa tu repositorio
4. Añade las variables de entorno
5. Deploy automático

### Opción 2: Netlify

1. Sube tu código a GitHub
2. Ve a [netlify.com](https://netlify.com)
3. Importa tu repositorio
4. Añade las variables de entorno
5. Deploy automático

## 📞 Soporte

Si tienes problemas:

1. Revisa esta guía completa
2. Revisa `README.md` para más información
3. Revisa `SUPABASE_SETUP.md` para detalles de Supabase
4. Consulta la [documentación de Astro](https://docs.astro.build)
5. Consulta la [documentación de Supabase](https://supabase.com/docs)

---

**¡Listo! Tu tienda FashionMarket está funcionando. 🎉**
