# 🏗️ ARQUITECTURA DE BÚSQUEDA Y FILTRADO AVANZADO

> **Tienda de Moda Premium - Sistema de Catálogo Profesional**  
> Diseñado para escalabilidad, rendimiento y experiencia de usuario excepcional

---

## 📋 TABLA DE CONTENIDOS

1. [Visión General](#visión-general)
2. [Modelo de Datos Ampliado](#modelo-de-datos-ampliado)
3. [Sistema de Búsqueda](#sistema-de-búsqueda)
4. [Sistema de Filtrado](#sistema-de-filtrado)
5. [Categorización Jerárquica](#categorización-jerárquica)
6. [Experiencia de Usuario (UX)](#experiencia-de-usuario-ux)
7. [Arquitectura Técnica](#arquitectura-técnica)
8. [Plan de Implementación](#plan-de-implementación)

---

## 🎯 VISIÓN GENERAL

### Objetivo del Sistema

Crear un sistema de catálogo comparable a **Zara**, **Mango** o **H&M**:
- Búsqueda instantánea y precisa
- Filtros combinables y claros
- Navegación intuitiva por género y categorías
- Gestión de variantes (tallas, colores)
- Escalable a miles de productos

### Principios de Diseño

1. **Realista**: No es una demo, es un e-commerce funcional
2. **Escalable**: Preparado para crecer sin reestructurar
3. **Performante**: Búsquedas rápidas incluso con 10,000+ productos
4. **UX Premium**: Experiencia comparable a tiendas de moda comerciales
5. **Mantenible**: Código limpio, estructura clara

---

## 🗃️ MODELO DE DATOS AMPLIADO

### 1. Nueva Tabla: `genders` (Géneros)

```sql
CREATE TABLE genders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE, -- 'Hombre', 'Mujer', 'Unisex'
  slug TEXT NOT NULL UNIQUE, -- 'hombre', 'mujer', 'unisex'
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Justificación**: Separar géneros permite:
- Navegación clara (Hombre / Mujer en menú principal)
- Filtrar productos por audiencia
- Añadir géneros futuros (Niños, Unisex) sin romper código

### 2. Ampliación: `categories` → Categorías Jerárquicas

```sql
-- MODIFICACIÓN: Agregar jerarquía y género
ALTER TABLE categories
  ADD COLUMN parent_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  ADD COLUMN gender_id UUID REFERENCES genders(id) ON DELETE SET NULL,
  ADD COLUMN level INTEGER DEFAULT 1 CHECK (level BETWEEN 1 AND 3),
  ADD COLUMN category_type TEXT CHECK (category_type IN ('main', 'subcategory', 'style'));

-- Índices para consultas jerárquicas
CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_gender ON categories(gender_id);
CREATE INDEX idx_categories_level ON categories(level);
```

**Estructura Jerárquica**:
```
Nivel 1 (Gender-specific): Camisetas Hombre, Pantalones Mujer
Nivel 2 (Subcategory): Camisetas Manga Corta, Pantalones Casual
Nivel 3 (Style): Verano, Formal, Deportivo
```

### 3. Nueva Tabla: `colors` (Colores)

```sql
CREATE TABLE colors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE, -- 'Negro', 'Azul Marino', 'Rojo'
  slug TEXT NOT NULL UNIQUE, -- 'negro', 'azul-marino', 'rojo'
  hex_code TEXT NOT NULL, -- '#000000', '#001f3f', '#ff0000'
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_colors_slug ON colors(slug);
```

**Justificación**: Colores predefinidos para:
- Consistencia en la tienda (evitar "Negro" vs "negro" vs "Black")
- Filtros estandarizados
- Interfaz visual con swatches de color

### 4. Nueva Tabla: `product_variants` (Variantes de Producto)

```sql
CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku TEXT UNIQUE NOT NULL, -- 'CAM-H-001-M-NEG'
  color_id UUID REFERENCES colors(id) ON DELETE SET NULL,
  size TEXT NOT NULL, -- 'S', 'M', 'L', 'XL', '38', '40', '42'
  
  -- Stock y precio por variante
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  price_adjustment INTEGER DEFAULT 0, -- Ajuste al precio base (en céntimos)
  
  -- Imágenes específicas de esta variante (opcional)
  images TEXT[] DEFAULT '{}',
  
  -- Control
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_variants_product ON product_variants(product_id);
CREATE INDEX idx_variants_color ON product_variants(color_id);
CREATE INDEX idx_variants_size ON product_variants(size);
CREATE INDEX idx_variants_sku ON product_variants(sku);
CREATE INDEX idx_variants_stock ON product_variants(stock);
```

**Justificación**: Sistema profesional de variantes:
- Stock real por talla y color (no stock genérico)
- SKUs únicos para cada combinación
- Precios diferenciados (ej: tallas grandes +2€)
- Imágenes específicas por color

### 5. Modificación: `products` → Producto Base

```sql
-- MODIFICACIONES en tabla products
ALTER TABLE products
  ADD COLUMN gender_id UUID REFERENCES genders(id) ON DELETE SET NULL,
  ADD COLUMN color_ids UUID[] DEFAULT '{}', -- IDs de colores disponibles
  ADD COLUMN available_sizes TEXT[] DEFAULT '{}', -- Tallas disponibles
  ADD COLUMN material TEXT, -- 'Algodón 100%', 'Poliéster'
  ADD COLUMN care_instructions TEXT, -- 'Lavar a 30°C'
  ADD COLUMN is_new BOOLEAN DEFAULT false, -- Novedades
  ADD COLUMN is_on_sale BOOLEAN DEFAULT false, -- En oferta
  ADD COLUMN sale_price INTEGER CHECK (sale_price >= 0), -- Precio rebajado
  ADD COLUMN popularity_score INTEGER DEFAULT 0, -- Para ordenar por popularidad
  ADD COLUMN sales_count INTEGER DEFAULT 0; -- Total vendidos

-- Índices para filtros y búsqueda
CREATE INDEX idx_products_gender ON products(gender_id);
CREATE INDEX idx_products_new ON products(is_new);
CREATE INDEX idx_products_sale ON products(is_on_sale);
CREATE INDEX idx_products_popularity ON products(popularity_score DESC);

-- Índice full-text search en PostgreSQL
CREATE INDEX idx_products_search ON products 
  USING GIN (to_tsvector('spanish', name || ' ' || COALESCE(description, '')));
```

**Cambios clave**:
- Producto = entidad base sin stock específico
- Stock real en `product_variants`
- Género asignado directamente
- Campos para filtros (novedades, ofertas)
- Índice de búsqueda full-text

### 6. Nueva Tabla: `product_categories` (Relación Muchos a Muchos)

```sql
CREATE TABLE product_categories (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, category_id)
);

CREATE INDEX idx_product_categories_product ON product_categories(product_id);
CREATE INDEX idx_product_categories_category ON product_categories(category_id);
```

**Justificación**: Un producto puede estar en múltiples categorías:
- Camiseta Manga Corta → "Camisetas" + "Verano" + "Casual"
- Flexibilidad para cross-selling

---

## 🔍 SISTEMA DE BÚSQUEDA

### Estrategia de Búsqueda en 3 Capas

#### Capa 1: Búsqueda Full-Text (PostgreSQL)

**Ventajas**:
- Nativa de PostgreSQL
- Coincidencias parciales automáticas
- Ranking por relevancia
- Sin coste adicional

**Implementación**:
```sql
-- Función de búsqueda avanzada
CREATE OR REPLACE FUNCTION search_products(
  search_query TEXT,
  gender_filter UUID DEFAULT NULL,
  category_filter UUID DEFAULT NULL,
  min_price INTEGER DEFAULT NULL,
  max_price INTEGER DEFAULT NULL,
  colors_filter UUID[] DEFAULT NULL,
  sizes_filter TEXT[] DEFAULT NULL,
  only_in_stock BOOLEAN DEFAULT false,
  only_new BOOLEAN DEFAULT false,
  only_on_sale BOOLEAN DEFAULT false,
  sort_by TEXT DEFAULT 'relevance' -- 'relevance', 'price_asc', 'price_desc', 'popularity', 'newest'
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  price INTEGER,
  sale_price INTEGER,
  images TEXT[],
  category_name TEXT,
  gender_name TEXT,
  relevance_score REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    p.id,
    p.name,
    p.slug,
    p.price,
    p.sale_price,
    p.images,
    c.name AS category_name,
    g.name AS gender_name,
    ts_rank(to_tsvector('spanish', p.name || ' ' || COALESCE(p.description, '')), 
            plainto_tsquery('spanish', search_query)) AS relevance_score
  FROM products p
  LEFT JOIN categories c ON p.category_id = c.id
  LEFT JOIN genders g ON p.gender_id = g.id
  LEFT JOIN product_variants pv ON p.id = pv.product_id
  WHERE
    p.is_active = true
    -- Búsqueda por texto
    AND (
      search_query IS NULL 
      OR to_tsvector('spanish', p.name || ' ' || COALESCE(p.description, '')) 
         @@ plainto_tsquery('spanish', search_query)
      OR c.name ILIKE '%' || search_query || '%'
      OR g.name ILIKE '%' || search_query || '%'
    )
    -- Filtros
    AND (gender_filter IS NULL OR p.gender_id = gender_filter)
    AND (category_filter IS NULL OR p.category_id = category_filter)
    AND (min_price IS NULL OR p.price >= min_price)
    AND (max_price IS NULL OR p.price <= max_price)
    AND (only_in_stock = false OR pv.stock > 0)
    AND (only_new = false OR p.is_new = true)
    AND (only_on_sale = false OR p.is_on_sale = true)
    AND (colors_filter IS NULL OR p.color_ids && colors_filter)
    AND (sizes_filter IS NULL OR p.available_sizes && sizes_filter)
  ORDER BY
    CASE 
      WHEN sort_by = 'relevance' THEN ts_rank(to_tsvector('spanish', p.name || ' ' || COALESCE(p.description, '')), plainto_tsquery('spanish', search_query))
      ELSE NULL
    END DESC,
    CASE WHEN sort_by = 'price_asc' THEN p.price ELSE NULL END ASC,
    CASE WHEN sort_by = 'price_desc' THEN p.price ELSE NULL END DESC,
    CASE WHEN sort_by = 'popularity' THEN p.popularity_score ELSE NULL END DESC,
    CASE WHEN sort_by = 'newest' THEN p.created_at ELSE NULL END DESC;
END;
$$ LANGUAGE plpgsql;
```

#### Capa 2: Búsqueda del Cliente (API Endpoint)

**Endpoint**: `GET /api/search`

**Parámetros**:
```typescript
interface SearchParams {
  q?: string; // Query de búsqueda
  gender?: string; // Slug del género
  category?: string; // Slug de categoría
  minPrice?: number;
  maxPrice?: number;
  colors?: string[]; // Slugs de colores
  sizes?: string[]; // Tallas
  inStock?: boolean;
  new?: boolean;
  sale?: boolean;
  sortBy?: 'relevance' | 'price_asc' | 'price_desc' | 'popularity' | 'newest';
  page?: number;
  limit?: number; // Default: 24
}
```

**Respuesta**:
```typescript
interface SearchResponse {
  products: ProductCard[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: {
    appliedFilters: AppliedFilter[];
    availableFilters: AvailableFilters;
  };
}
```

#### Capa 3: Búsqueda Instantánea (Autocomplete)

**Endpoint**: `GET /api/search/autocomplete?q=camis`

**Respuesta**:
```typescript
interface AutocompleteResponse {
  suggestions: {
    products: Array<{ name: string; slug: string; image: string }>;
    categories: Array<{ name: string; slug: string }>;
    terms: string[]; // Sugerencias de búsqueda
  };
}
```

---

## 🎛️ SISTEMA DE FILTRADO

### Filtros Disponibles

| Filtro | Tipo | Valores | Comportamiento |
|--------|------|---------|----------------|
| **Género** | Radio / Tabs | Hombre, Mujer, Unisex | Excluyente (solo uno) |
| **Categoría** | Checkbox Multi | Todas las categorías activas | Combinable (OR) |
| **Precio** | Range Slider | €0 - €500 | Rango continuo |
| **Talla** | Checkbox Multi | S, M, L, XL, XXL, 36-46 | Combinable (OR) |
| **Color** | Checkbox Visual | Swatches de colores | Combinable (OR) |
| **Disponibilidad** | Toggle | Solo con stock | Binario |
| **Novedades** | Toggle | Solo nuevos | Binario |
| **Ofertas** | Toggle | Solo en oferta | Binario |

### Lógica de Filtros Combinados

**Ejemplo de combinación**:
```
Usuario selecciona:
- Género: Mujer
- Categoría: Camisetas, Sudaderas
- Talla: M, L
- Color: Negro, Blanco
- Precio: €20 - €50
- Solo con stock: ✓

Query SQL generada:
WHERE gender = 'Mujer'
  AND category IN ('Camisetas', 'Sudaderas')
  AND (exists variant with size IN ('M', 'L') AND stock > 0)
  AND color IN ('Negro', 'Blanco')
  AND price BETWEEN 2000 AND 5000
```

### UI de Filtros

**Desktop**:
```
┌─────────────────────────────────────────────────┐
│ FILTROS                           [Limpiar todo]│
├─────────────────────────────────────────────────┤
│                                                  │
│ ▼ Género                                        │
│   ○ Mujer    ● Hombre    ○ Unisex              │
│                                                  │
│ ▼ Categoría                                     │
│   ☑ Camisetas (234)                             │
│   ☐ Camisas (156)                               │
│   ☐ Pantalones (189)                            │
│   ☑ Sudaderas (98)                              │
│                                                  │
│ ▼ Precio                                        │
│   [====●────────] €20 - €150                    │
│                                                  │
│ ▼ Talla                                         │
│   ☑ S  ☑ M  ☑ L  ☐ XL  ☐ XXL                   │
│                                                  │
│ ▼ Color                                         │
│   ☑ ⬛ Negro  ☐ ⬜ Blanco  ☑ 🟦 Azul            │
│                                                  │
│ ▼ Disponibilidad                                │
│   [●───] Solo con stock                         │
│                                                  │
│ ▼ Otros                                         │
│   [─●─] Novedades                               │
│   [───] En oferta                               │
└─────────────────────────────────────────────────┘
```

**Mobile**: Overlay deslizable desde abajo

---

## 🗂️ CATEGORIZACIÓN JERÁRQUICA

### Estructura de Navegación

```
┌─────────────────────────────────────────────────┐
│ NAVBAR: [Hombre] [Mujer] [Novedades] [Ofertas] │
└─────────────────────────────────────────────────┘

Al hacer click en "Hombre":
┌─────────────────────────────────────────────────┐
│ HOMBRE                                          │
├─────────────────────────────────────────────────┤
│ Camisetas        Pantalones      Abrigos       │
│ · Manga corta    · Vaqueros      · Plumíferos  │
│ · Manga larga    · Chinos        · Abrigos     │
│ · Polos          · Deportivos    · Parkas      │
│                                                  │
│ Camisas          Sudaderas       Accesorios    │
│ · Casual         · Con capucha   · Gorros      │
│ · Formal         · Sin capucha   · Bufandas    │
│ · Vaqueras       · Cremallera    · Cinturones  │
└─────────────────────────────────────────────────┘
```

### Categorías Predefinidas

**Hombre**:
- Camisetas (Manga corta, Manga larga, Polos)
- Camisas (Casual, Formal, Vaqueras)
- Sudaderas (Con capucha, Sin capucha, Cremallera)
- Pantalones (Vaqueros, Chinos, Deportivos)
- Chaquetas (Bomber, Vaquera, Cuero)
- Abrigos (Plumíferos, Abrigos, Parkas)
- Trajes (Chaquetas, Pantalones, Conjuntos)
- Accesorios (Gorros, Bufandas, Cinturones)

**Mujer**:
- Camisetas (Básicas, Manga larga, Crop tops)
- Camisas (Blusas, Camisas, Bodys)
- Sudaderas (Con capucha, Sin capucha, Oversize)
- Pantalones (Vaqueros, Palazzo, Leggings)
- Vestidos (Cortos, Midi, Largos)
- Faldas (Mini, Midi, Largas)
- Chaquetas (Blazers, Vaqueras, Bomber)
- Abrigos (Abrigos, Parkas, Plumíferos)
- Accesorios (Bolsos, Bufandas, Cinturones)

### URLs Amigables

```
/hombre                           → Todos los productos de hombre
/hombre/camisetas                 → Camisetas de hombre
/hombre/camisetas/manga-corta     → Subcategoría
/mujer                            → Todos los productos de mujer
/mujer/vestidos                   → Vestidos
/mujer/vestidos/largos            → Vestidos largos
/novedades                        → Productos nuevos
/ofertas                          → Productos en oferta
```

---

## 🎨 EXPERIENCIA DE USUARIO (UX)

### Componente: Barra de Búsqueda en Header

**Características**:
- Siempre visible (sticky header)
- Icono de lupa + placeholder "Buscar ropa, zapatos..."
- Autocomplete instantáneo al escribir (debounced 300ms)
- Shortcuts de teclado (Cmd+K / Ctrl+K)
- Navegación con teclado (↑↓ Enter)

**Comportamiento**:
1. Usuario escribe "camis"
2. Aparece dropdown con sugerencias:
   - 5 productos más relevantes (imagen + nombre + precio)
   - 3 categorías relacionadas
   - 3 términos de búsqueda populares
3. Usuario selecciona o presiona Enter
4. Navega a `/search?q=camis`

### Página de Resultados de Búsqueda

**Layout**:
```
┌─────────────┬───────────────────────────────────────┐
│             │ Buscar: "camisetas hombre"            │
│             ├───────────────────────────────────────┤
│             │ 156 resultados                        │
│   FILTROS   │ [Aplicados: Hombre, Talla M] [✕ todos]
│   (sidebar) │                                       │
│             │ Ordenar: [Relevancia ▾]              │
│             ├───────────────────────────────────────┤
│             │ [Producto] [Producto] [Producto]     │
│             │ [Producto] [Producto] [Producto]     │
│             │ [Producto] [Producto] [Producto]     │
│             │                                       │
│             │ [Cargar más] o [Paginación 1 2 3]    │
└─────────────┴───────────────────────────────────────┘
```

### Feedback Visual

| Acción | Feedback |
|--------|----------|
| Aplicar filtro | Recuento actualizado + animación fade en productos |
| Sin resultados | "No encontramos productos con estos filtros. [Limpiar filtros]" |
| Cargando | Skeleton screens (no spinners) |
| Filtro aplicado | Tag con ✕ para quitar: `[Hombre ✕] [Talla M ✕]` |
| Añadir al carrito | Toast "Añadido al carrito" + contador carrito animado |

### Mobile-First

**Adaptaciones mobile**:
- Barra de búsqueda en parte superior (siempre visible)
- Filtros en bottom sheet deslizable
- Botón flotante "Filtros" con badge de filtros activos
- Grid de productos 2 columnas (vs 4 en desktop)
- Infinite scroll (vs paginación)

---

## 🏗️ ARQUITECTURA TÉCNICA

### Stack Tecnológico

| Capa | Tecnología | Justificación |
|------|------------|---------------|
| **Frontend** | Astro + React Islands | SSR para SEO + interactividad donde necesaria |
| **Búsqueda** | PostgreSQL Full-Text | Nativo, rápido, sin coste extra |
| **Estado Cliente** | Nano Stores | Filtros reactivos, ligero |
| **Estilos** | Tailwind CSS | Componentes rápidos, consistentes |
| **Imágenes** | Supabase Storage | CDN global, optimización automática |

### Estructura de Archivos

```
src/
├── pages/
│   ├── search.astro                    # Página de resultados
│   ├── [gender]/
│   │   ├── index.astro                 # /hombre, /mujer
│   │   └── [category]/
│   │       ├── index.astro             # /hombre/camisetas
│   │       └── [subcategory].astro     # /hombre/camisetas/manga-corta
│   └── api/
│       └── search/
│           ├── index.ts                # GET /api/search
│           └── autocomplete.ts         # GET /api/search/autocomplete
│
├── components/
│   ├── search/
│   │   ├── SearchBar.tsx               # Barra de búsqueda + autocomplete
│   │   ├── SearchResults.astro         # Grid de productos
│   │   └── NoResults.tsx               # Estado vacío
│   │
│   ├── filters/
│   │   ├── FilterSidebar.tsx           # Sidebar de filtros (desktop)
│   │   ├── FilterSheet.tsx             # Bottom sheet (mobile)
│   │   ├── FilterGroup.tsx             # Grupo de filtros
│   │   ├── PriceSlider.tsx             # Slider de precio
│   │   ├── ColorPicker.tsx             # Selector visual de colores
│   │   └── AppliedFilters.tsx          # Tags de filtros activos
│   │
│   └── product/
│       └── ProductCard.astro           # Tarjeta de producto
│
├── stores/
│   └── filters.ts                      # Estado de filtros (Nano Store)
│
└── lib/
    ├── search.ts                       # Lógica de búsqueda
    └── filters.ts                      # Lógica de filtros
```

### API de Búsqueda (TypeScript)

```typescript
// src/lib/search.ts
export interface SearchFilters {
  query?: string;
  gender?: string;
  categories?: string[];
  minPrice?: number;
  maxPrice?: number;
  colors?: string[];
  sizes?: string[];
  inStock?: boolean;
  isNew?: boolean;
  onSale?: boolean;
  sortBy?: 'relevance' | 'price_asc' | 'price_desc' | 'popularity' | 'newest';
}

export async function searchProducts(
  filters: SearchFilters,
  page: number = 1,
  limit: number = 24
): Promise<SearchResponse> {
  // Llamar a función SQL search_products()
}
```

### Store de Filtros (Nano Store)

```typescript
// src/stores/filters.ts
import { atom, map } from 'nanostores';

export const activeFilters = map<SearchFilters>({});
export const searchResults = atom<Product[]>([]);
export const isLoading = atom<boolean>(false);

export function addFilter(key: keyof SearchFilters, value: any) {
  activeFilters.setKey(key, value);
}

export function removeFilter(key: keyof SearchFilters) {
  const current = activeFilters.get();
  delete current[key];
  activeFilters.set(current);
}

export function clearFilters() {
  activeFilters.set({});
}
```

---

## 📦 PLAN DE IMPLEMENTACIÓN

### Fase 1: Modelo de Datos (1-2 días)

**Tareas**:
1. ✅ Crear migración SQL con todas las tablas nuevas
2. ✅ Actualizar tipos TypeScript
3. ✅ Poblar datos iniciales (géneros, colores, categorías)
4. ✅ Crear función `search_products()` en PostgreSQL

**Entregables**:
- `supabase-migration-search.sql`
- `src/lib/supabase.ts` actualizado

### Fase 2: API de Búsqueda (1 día)

**Tareas**:
1. ✅ Endpoint `/api/search/index.ts`
2. ✅ Endpoint `/api/search/autocomplete.ts`
3. ✅ Funciones helper en `src/lib/search.ts`
4. ✅ Tests de búsqueda

**Entregables**:
- APIs funcionales
- Documentación de endpoints

### Fase 3: Componentes de Filtrado (2-3 días)

**Tareas**:
1. ✅ `FilterSidebar.tsx` (desktop)
2. ✅ `FilterSheet.tsx` (mobile)
3. ✅ Componentes individuales (PriceSlider, ColorPicker, etc.)
4. ✅ Store de filtros (Nano Store)
5. ✅ Lógica de filtros combinados

**Entregables**:
- Componentes reutilizables
- Experiencia responsive

### Fase 4: Búsqueda en Header (1 día)

**Tareas**:
1. ✅ Integrar barra de búsqueda en `Header.astro`
2. ✅ Componente `SearchBar.tsx` con autocomplete
3. ✅ Navegación con teclado
4. ✅ Debouncing y optimización

**Entregables**:
- Búsqueda instantánea funcional

### Fase 5: Páginas de Navegación (1-2 días)

**Tareas**:
1. ✅ `/search.astro` - Resultados de búsqueda
2. ✅ `/[gender]/index.astro` - Productos por género
3. ✅ `/[gender]/[category]/index.astro` - Por categoría
4. ✅ Breadcrumbs y navegación jerárquica

**Entregables**:
- Sistema completo de navegación

### Fase 6: Testing y Optimización (1 día)

**Tareas**:
1. ✅ Tests de búsqueda con diferentes queries
2. ✅ Optimización de queries SQL (EXPLAIN ANALYZE)
3. ✅ Caché de resultados frecuentes
4. ✅ Testing mobile

**Entregables**:
- Sistema optimizado y testeado

---

## 🎯 MÉTRICAS DE ÉXITO

| Métrica | Objetivo | Medición |
|---------|----------|----------|
| **Velocidad de búsqueda** | < 500ms | Tiempo respuesta API |
| **Relevancia** | > 85% clics en top 5 | Analytics de clics |
| **Uso de filtros** | > 60% usuarios | Tracking de filtros |
| **Mobile UX** | > 4.5/5 estrellas | User testing |
| **Tasa de conversión** | +20% vs sin filtros | A/B testing |

---

## 🚀 ESCALABILIDAD FUTURA

### Mejoras Planificadas

1. **Búsqueda Semántica (IA)**:
   - "vestido elegante para boda" → recomendaciones inteligentes
   - Azure OpenAI Embeddings

2. **Recomendaciones Personalizadas**:
   - "Basado en tu historial"
   - Collaborative filtering

3. **Búsqueda Visual**:
   - Subir foto de prenda → encontrar similar
   - Azure Computer Vision

4. **Filtros Dinámicos**:
   - "Ocasión" (Casual, Formal, Deportivo)
   - "Temporada" (Otoño, Invierno)

5. **Multi-idioma**:
   - Inglés, Francés, Alemán
   - Búsqueda en todos los idiomas

---

## 📚 REFERENCIAS

**Tiendas analizadas**:
- Zara: Filtros claros, búsqueda potente
- Mango: Categorización jerárquica excelente
- H&M: UX mobile ejemplar
- ASOS: Sistema de filtros más completo del mercado

**Tecnologías**:
- PostgreSQL Full-Text Search: https://www.postgresql.org/docs/current/textsearch.html
- Astro Islands: https://docs.astro.build/en/concepts/islands/
- Nano Stores: https://github.com/nanostores/nanostores

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

### Modelo de Datos
- [ ] Crear tabla `genders`
- [ ] Crear tabla `colors`
- [ ] Crear tabla `product_variants`
- [ ] Modificar tabla `products`
- [ ] Modificar tabla `categories`
- [ ] Crear tabla `product_categories`
- [ ] Crear función `search_products()`
- [ ] Crear índices de búsqueda
- [ ] Poblar datos iniciales

### Backend
- [ ] API `/api/search`
- [ ] API `/api/search/autocomplete`
- [ ] Funciones helper búsqueda
- [ ] Funciones helper filtros

### Frontend - Componentes
- [ ] `SearchBar.tsx`
- [ ] `FilterSidebar.tsx`
- [ ] `FilterSheet.tsx`
- [ ] `PriceSlider.tsx`
- [ ] `ColorPicker.tsx`
- [ ] `AppliedFilters.tsx`
- [ ] `SearchResults.astro`
- [ ] `NoResults.tsx`

### Frontend - Páginas
- [ ] `/search.astro`
- [ ] `/[gender]/index.astro`
- [ ] `/[gender]/[category]/index.astro`
- [ ] Actualizar `Header.astro`

### Estado y Lógica
- [ ] Store de filtros (Nano Store)
- [ ] Store de búsqueda
- [ ] Lógica de filtros combinados

### UX y Testing
- [ ] Responsive design
- [ ] Animaciones y transiciones
- [ ] Estados de carga
- [ ] Manejo de errores
- [ ] Testing mobile
- [ ] Testing de rendimiento

---

**Documento creado**: 13 de enero de 2026  
**Versión**: 1.0  
**Autor**: Arquitecto Senior E-commerce

