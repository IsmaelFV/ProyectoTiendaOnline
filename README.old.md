# FashionMarket - E-commerce Premium de Moda Masculina

Tienda online de moda masculina premium construida con **Astro 5.0**, **Tailwind CSS** y **Supabase**.

## 🏗️ Arquitectura Técnica

### Stack Tecnológico

- **Frontend**: Astro 5.0 (Modo Híbrido - SSG + SSR)
- **Estilos**: Tailwind CSS con configuración personalizada
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **Estado del Cliente**: Nano Stores con persistencia
- **Islas Interactivas**: React 18

### Estructura del Proyecto

```
fashionmarket/
├── public/
│   └── fonts/                    # Fuentes personalizadas
├── src/
│   ├── components/
│   │   ├── ui/                   # Componentes UI genéricos
│   │   │   ├── Button.astro
│   │   │   ├── Header.astro
│   │   │   ├── Footer.astro
│   │   │   └── CartSlideOver.tsx
│   │   ├── product/              # Componentes de productos
│   │   │   ├── ProductCard.astro
│   │   │   └── ProductGallery.astro
│   │   └── islands/              # Componentes React interactivos
│   │       ├── AddToCartButton.tsx
│   │       └── CartIcon.tsx
│   ├── layouts/
│   │   ├── BaseLayout.astro      # Layout base HTML
│   │   ├── PublicLayout.astro    # Layout tienda pública
│   │   └── AdminLayout.astro     # Layout panel admin
│   ├── lib/
│   │   ├── supabase.ts           # Cliente Supabase
│   │   └── utils.ts              # Funciones auxiliares
│   ├── pages/
│   │   ├── index.astro           # Homepage (SSG)
│   │   ├── productos/
│   │   │   ├── index.astro       # Listado productos (SSG)
│   │   │   └── [slug].astro      # Detalle producto (SSG)
│   │   ├── categoria/
│   │   │   └── [slug].astro      # Productos por categoría (SSG)
│   │   ├── admin/                # Panel administración (SSR)
│   │   │   ├── index.astro
│   │   │   ├── login.astro
│   │   │   └── productos/
│   │   │       ├── index.astro
│   │   │       └── nuevo.astro
│   │   └── api/                  # API Routes
│   │       ├── auth/
│   │       │   ├── login.ts
│   │       │   └── logout.ts
│   │       └── products/
│   │           └── create.ts
│   ├── stores/
│   │   └── cart.ts               # Estado global del carrito
│   ├── styles/
│   │   └── global.css            # Estilos globales
│   ├── middleware.ts             # Middleware de autenticación
│   └── env.d.ts                  # Tipos TypeScript
├── astro.config.mjs
├── tailwind.config.mjs
├── supabase-schema.sql           # Schema de base de datos
├── SUPABASE_SETUP.md             # Guía de configuración
└── package.json
```

## 🚀 Inicio Rápido

### 1. Instalación de Dependencias

```bash
npm install
```

### 2. Configuración de Supabase

1. Crea un proyecto en [Supabase](https://supabase.com)
2. Ejecuta el SQL en `supabase-schema.sql` en el SQL Editor
3. Configura el Storage según `SUPABASE_SETUP.md`
4. Crea un usuario administrador en Authentication

### 3. Variables de Entorno

Copia `.env.example` a `.env` y completa:

```env
PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
```

### 4. Ejecutar en Desarrollo

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:4321`

## 🎨 Identidad de Marca

### Paleta de Colores

- **Navy**: `#1a2332` - Color principal
- **Charcoal**: `#2d3748` - Textos principales
- **Slate**: `#475569` - Textos secundarios
- **Cream**: `#faf9f7` - Fondo
- **Gold**: `#b8976a` - Acentos premium

### Tipografías

- **Serif**: Playfair Display (Títulos)
- **Sans**: Inter (Textos)

## 📦 Funcionalidades

### Tienda Pública (SSG)

- ✅ Homepage con productos destacados
- ✅ Catálogo completo de productos
- ✅ Filtrado por categorías
- ✅ Páginas de detalle de producto
- ✅ Carrito de compra persistente (localStorage)
- ✅ Selección de tallas
- ✅ Gestión de stock en tiempo real

### Panel de Administración (SSR)

- ✅ Autenticación con Supabase Auth
- ✅ Dashboard con métricas
- ✅ Gestión de productos (CRUD)
- ✅ Creación de productos con imágenes
- ✅ Control de stock
- ✅ Productos destacados

## 🗄️ Base de Datos

### Tablas

**categories**
- `id` (UUID)
- `name` (TEXT)
- `slug` (TEXT UNIQUE)
- `description` (TEXT)

**products**
- `id` (UUID)
- `name` (TEXT)
- `slug` (TEXT UNIQUE)
- `description` (TEXT)
- `price` (INTEGER) - En céntimos
- `stock` (INTEGER)
- `category_id` (UUID FK)
- `images` (TEXT[]) - Array de URLs
- `sizes` (TEXT[]) - Array de tallas
- `featured` (BOOLEAN)

### Row Level Security (RLS)

- **Lectura pública**: Todos pueden ver productos y categorías
- **Escritura protegida**: Solo usuarios autenticados pueden modificar

## 🛒 Gestión del Carrito

El carrito usa **Nano Stores** con persistencia en localStorage:

```typescript
// Añadir al carrito
addToCart({ id, name, price, size, image, slug })

// Actualizar cantidad
updateQuantity(cartKey, quantity)

// Eliminar del carrito
removeFromCart(cartKey)

// Limpiar carrito
clearCart()
```

## 🔐 Autenticación

El middleware protege las rutas `/admin/*`:

- Verifica tokens en cookies
- Redirige a `/admin/login` si no autenticado
- Usa Supabase Auth para validación

## 📸 Gestión de Imágenes

Las imágenes se almacenan en **Supabase Storage**:

1. Bucket: `product-images` (público)
2. Sube imágenes manualmente al bucket
3. Copia la URL pública
4. Pégala en el formulario de producto

## 🎯 Renderizado

### SSG (Static Site Generation)
- Homepage
- Listado de productos
- Detalle de productos
- Páginas de categorías

### SSR (Server-Side Rendering)
- Panel de administración
- Login
- API routes

## 🚢 Despliegue

### Build de Producción

```bash
npm run build
```

### Preview

```bash
npm run preview
```

### Plataformas Recomendadas

- **Vercel** (Recomendado para Astro)
- **Netlify**
- **Cloudflare Pages**

Variables de entorno requeridas en producción:
- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## 📝 Próximas Funcionalidades

- [ ] Integración de pagos con Stripe
- [ ] Sistema de búsqueda
- [ ] Filtros avanzados (precio, talla, color)
- [ ] Wishlist / Favoritos
- [ ] Sistema de reviews
- [ ] Panel de pedidos
- [ ] Notificaciones por email
- [ ] Optimización de imágenes automática
- [ ] PWA (Progressive Web App)

## 🤝 Contribución

Este es un proyecto de demostración. Para contribuir:

1. Fork el repositorio
2. Crea una rama feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -am 'Añade nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

## 📄 Licencia

MIT License - Siéntete libre de usar este proyecto como base para tu tienda.

## 🆘 Soporte

Para problemas o preguntas:
- Revisa `SUPABASE_SETUP.md` para configuración de backend
- Consulta la [documentación de Astro](https://docs.astro.build)
- Revisa la [documentación de Supabase](https://supabase.com/docs)

---

**Desarrollado con ❤️ usando Astro, Tailwind CSS y Supabase**
