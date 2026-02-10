# 🔧 Solución: Filtros de Rebajas y Novedades

## ✅ Problema Resuelto

Los filtros de "Rebajas" y "Novedades" en la barra lateral no mostraban productos porque:

1. **La página estaba filtrando solo por `category_id`** - No consideraba los campos especiales `is_on_sale` y `is_new`
2. **Los productos probablemente no tienen estos campos marcados** en la base de datos

## 🔄 Cambios Realizados

### Archivo Modificado: `[gender]/[category]/index.astro`

**Antes:**
```typescript
// Solo filtraba por category_id
const { data: products } = await supabase
  .from('products')
  .in('category_id', categoryIds)
  .eq('gender_id', genderData.id)
```

**Ahora:**
```typescript
// Detecta el tipo de página y filtra adecuadamente
if (isRebajas) {
  // Filtra por is_on_sale = true
  .eq('is_on_sale', true)
} else if (isNovedades) {
  // Filtra por is_new = true
  .eq('is_new', true)
} else {
  // Otras categorías: filtra por category_id
  .in('category_id', categoryIds)
}
```

## 📋 Cómo Configurar Productos

### Opción 1: Por Supabase Dashboard (Interfaz Visual)

1. Ve a tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard)
2. Abre el **Table Editor**
3. Selecciona la tabla **`products`**
4. Para marcar como **REBAJA**:
   - Marca el checkbox `is_on_sale` = `true`
   - Establece un `sale_price` menor que `price` (ej: si price=5000, sale_price=3500 para 30% descuento)
5. Para marcar como **NOVEDAD**:
   - Marca el checkbox `is_new` = `true`

### Opción 2: Por SQL (Más Rápido)

He creado el archivo **`configurar-rebajas-novedades.sql`** con scripts listos para usar:

#### Marcar productos como REBAJAS:

```sql
-- 20 productos aleatorios de MUJER con 35% descuento
UPDATE products
SET 
  is_on_sale = true,
  sale_price = (price * 0.65)::INTEGER
WHERE gender_id = (SELECT id FROM genders WHERE slug = 'mujer')
AND id IN (
  SELECT id FROM products 
  WHERE gender_id = (SELECT id FROM genders WHERE slug = 'mujer')
  AND is_on_sale = false
  ORDER BY RANDOM() 
  LIMIT 20
);
```

#### Marcar productos como NOVEDADES:

```sql
-- 15 productos más recientes de HOMBRE
UPDATE products
SET is_new = true
WHERE gender_id = (SELECT id FROM genders WHERE slug = 'hombre')
AND id IN (
  SELECT id FROM products 
  WHERE gender_id = (SELECT id FROM genders WHERE slug = 'hombre')
  ORDER BY created_at DESC 
  LIMIT 15
);
```

## 🧪 Verificar que Funciona

Después de marcar productos en la base de datos:

1. **Verifica en SQL** que los productos tienen los campos correctos:
```sql
-- Ver productos en rebajas
SELECT name, is_on_sale, price, sale_price 
FROM products 
WHERE is_on_sale = true;

-- Ver productos novedades
SELECT name, is_new, created_at 
FROM products 
WHERE is_new = true;
```

2. **Prueba en el navegador**:
   - `/hombre/rebajas-hombre` → Debe mostrar productos con `is_on_sale = true` del género hombre
   - `/mujer/rebajas-mujer` → Debe mostrar productos con `is_on_sale = true` del género mujer
   - `/hombre/novedades-hombre` → Debe mostrar productos con `is_new = true` del género hombre
   - `/mujer/novedades-mujer` → Debe mostrar productos con `is_new = true` del género mujer

## 🎯 Resultado Esperado

### Página de Rebajas:
- ✅ Banner rojo con "HASTA -70%"
- ✅ Solo muestra productos donde `is_on_sale = true`
- ✅ Ordenados por precio rebajado (más baratos primero)
- ✅ Filtrados por género (hombre/mujer)

### Página de Novedades:
- ✅ Banner verde con "LO MÁS NUEVO"
- ✅ Solo muestra productos donde `is_new = true`
- ✅ Ordenados por fecha de creación (más recientes primero)
- ✅ Filtrados por género (hombre/mujer)

## 🔍 Troubleshooting

### "No aparecen productos en rebajas/novedades"

**Causa:** Los productos no tienen los campos `is_on_sale` o `is_new` marcados como `true`.

**Solución:** Ejecuta los scripts SQL del archivo `configurar-rebajas-novedades.sql` para marcar productos.

### "Aparecen productos de otro género"

**Causa:** Los productos no tienen el `gender_id` correcto.

**Solución:** 
```sql
-- Verificar gender_id de los productos
SELECT p.name, g.name as genero
FROM products p
LEFT JOIN genders g ON p.gender_id = g.id;
```

## 📝 Mantenimiento

### Actualizar Rebajas Regularmente

```sql
-- Quitar rebajas antiguas
UPDATE products
SET is_on_sale = false, sale_price = NULL
WHERE is_on_sale = true;

-- Agregar nuevas rebajas
UPDATE products
SET is_on_sale = true, sale_price = (price * 0.7)::INTEGER
WHERE id IN (...);
```

### Actualizar Novedades Automáticamente

```sql
-- Quitar novedad de productos antiguos
UPDATE products
SET is_new = false
WHERE is_new = true 
AND created_at < NOW() - INTERVAL '30 days';

-- Marcar nuevos productos automáticamente
UPDATE products
SET is_new = true
WHERE created_at >= NOW() - INTERVAL '30 days';
```

## ✨ Archivos Relacionados

- **Página actualizada:** `src/pages/[gender]/[category]/index.astro`
- **Scripts SQL:** `configurar-rebajas-novedades.sql`
- **Tipos TypeScript:** `src/lib/supabase.ts` (interface Product)
