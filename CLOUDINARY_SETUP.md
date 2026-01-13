# 📸 Integración de Cloudinary - Guía de Configuración

## 🎯 ¿Qué es Cloudinary?

Cloudinary no es solo almacenamiento de imágenes, es un **CDN de medios completo** que:

- **Almacena**: Guarda tus imágenes en la nube
- **Optimiza**: Convierte formatos automáticamente (WebP, AVIF)
- **Entrega**: Sirve las imágenes desde el servidor más cercano al usuario

## 🚀 Configuración Paso a Paso

### 1. Crear Cuenta en Cloudinary

1. Ve a [cloudinary.com](https://cloudinary.com)
2. Crea una cuenta gratuita
3. Accede a tu Dashboard

### 2. Obtener Credenciales

En el Dashboard principal encontrarás:

- **Cloud Name**: Tu identificador único (ej: `dxyz123abc`)
- **API Key**: Para operaciones autenticadas (opcional)
- **API Secret**: Para operaciones seguras (opcional)

### 3. Crear Upload Preset (IMPORTANTE)

Un **Upload Preset** permite subir imágenes sin autenticación desde el navegador:

1. Ve a: **Settings** ⚙️ → **Upload** → **Upload presets**
2. Haz clic en **Add upload preset**
3. Configura:
   - **Preset name**: `productos_tienda` (o el nombre que prefieras)
   - **Signing mode**: **Unsigned** ⚠️ (CRUCIAL para frontend)
   - **Folder**: `productos` (organiza tus imágenes)
   - **Allowed formats**: jpg, png, webp, gif
   - **Max file size**: 10 MB
   - **Overwrite**: No
4. Guarda el preset

### 4. Configurar Variables de Entorno

Copia el archivo `.env.local.example` a `.env.local`:

```bash
cp .env.local.example .env.local
```

Edita `.env.local` y añade tus credenciales:

```env
# Cloudinary
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=tu_cloud_name_aqui
NEXT_PUBLIC_CLOUDINARY_PRESET=productos_tienda
```

⚠️ **IMPORTANTE**: 
- NO subas `.env.local` a Git (ya está en `.gitignore`)
- El prefijo `NEXT_PUBLIC_` es necesario para que funcione en el navegador

### 5. Ejecutar Migraciones SQL

Antes de probar los productos, ejecuta las migraciones:

```bash
# 1. Ejecutar migración de navegación completa
# Ve a Supabase SQL Editor y ejecuta: setup-completo-navegacion.sql

# 2. Ejecutar migración de búsqueda y colores
# Ve a Supabase SQL Editor y ejecuta: supabase-migration-search.sql

# 3. Añadir productos de prueba
# Ve a Supabase SQL Editor y ejecuta: productos-prueba.sql
```

## 📦 Productos de Prueba

El archivo `productos-prueba.sql` incluye:

- ✅ **8 productos** de ejemplo
- 👗 **4 productos de mujer** (vestidos, camisetas, pantalones)
- 👔 **4 productos de hombre** (camisas, pantalones, sudaderas)
- 🏷️ Productos marcados como **nuevos** y **en oferta**
- 🎨 Múltiples **colores** y **tallas** por producto
- 📂 Asignados a **categorías** correctas
- 🖼️ **Imágenes de Unsplash** (reemplazables por Cloudinary)

## 🎨 Cómo Usar las Imágenes Optimizadas

### En Componentes Astro

```astro
---
import { ImagePresets } from '@lib/cloudinary';

const imageUrl = "https://res.cloudinary.com/.../foto.jpg";
const optimizedUrl = ImagePresets.productCard(imageUrl);
---

<img src={optimizedUrl} alt="Producto" />
```

### En Componentes React

```tsx
import { ImagePresets } from '@lib/cloudinary';

function ProductImage({ url }) {
  return <img src={ImagePresets.productCard(url)} alt="Producto" />;
}
```

### Presets Disponibles

```typescript
// Tarjetas de catálogo (400x500px)
ImagePresets.productCard(url)

// Galería de producto (800x1000px)
ImagePresets.productGallery(url)

// Thumbnails pequeños (150x150px)
ImagePresets.thumbnail(url)

// Hero/Banners (1920x800px)
ImagePresets.hero(url)

// Carrito (80x80px)
ImagePresets.cart(url)
```

### Optimización Personalizada

```typescript
import { getOptimizedImageUrl } from '@lib/cloudinary';

const customUrl = getOptimizedImageUrl(originalUrl, {
  width: 600,
  height: 400,
  quality: 'auto',
  format: 'auto',
  crop: 'fill',
  gravity: 'auto'
});
```

## 📈 Transformaciones Mágicas

Cloudinary convierte automáticamente las imágenes:

### Antes (sin optimización)
```
https://res.cloudinary.com/demo/image/upload/v1234/foto.jpg
Peso: 4 MB, Formato: JPG
```

### Después (con optimización)
```
https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_500/v1234/foto.jpg
Peso: 30 KB, Formato: WebP (en Chrome) o AVIF
```

### Parámetros de Transformación

- `f_auto` → Formato automático (WebP, AVIF)
- `q_auto` → Calidad automática optimizada
- `w_500` → Ancho de 500px
- `h_500` → Alto de 500px
- `c_fill` → Recortar y rellenar
- `g_auto` → Enfoque inteligente (rostros, productos)

## 🔧 Uso del Componente ImageUploader

En páginas de administración:

```tsx
import ImageUploader from '@components/admin/ImageUploader';

function NuevoProducto() {
  const [imageUrls, setImageUrls] = useState([]);

  return (
    <ImageUploader
      onImagesUploaded={setImageUrls}
      maxImages={5}
      existingImages={[]}
    />
  );
}
```

## 🧪 Probar la Integración

1. Accede a `/admin/productos/nuevo`
2. Arrastra o selecciona imágenes
3. Las imágenes se subirán automáticamente a Cloudinary
4. Verás las URLs de Cloudinary en el formulario
5. Guarda el producto con las URLs

## ⚡ Beneficios de la Optimización

### Sin Cloudinary
- ❌ Imágenes pesadas (1-5 MB)
- ❌ Carga lenta en móviles
- ❌ Formatos antiguos (JPG, PNG)
- ❌ Sin CDN global

### Con Cloudinary
- ✅ Imágenes ligeras (30-100 KB)
- ✅ Carga instantánea
- ✅ Formatos modernos (WebP, AVIF)
- ✅ CDN global (servidores cercanos)
- ✅ Transformaciones al vuelo

## 🔒 Seguridad

### Upload Preset Unsigned
- ✅ Permite subir desde el navegador sin API Key
- ⚠️ Configura restricciones en Cloudinary:
  - Tamaño máximo de archivo
  - Formatos permitidos
  - Carpeta específica

### Mejora Futura (Opcional)
Para mayor seguridad, implementa **signed uploads** desde el backend:
- Requiere API Secret
- El servidor firma las peticiones
- Evita uploads no autorizados

## 📚 Recursos Adicionales

- [Documentación de Cloudinary](https://cloudinary.com/documentation)
- [Guía de Transformaciones](https://cloudinary.com/documentation/image_transformations)
- [Upload Widget](https://cloudinary.com/documentation/upload_widget)

## 🐛 Troubleshooting

### Error: "Upload preset not found"
- Verifica que el preset existe en Cloudinary
- Comprueba que el nombre coincide exactamente
- Asegúrate que el modo es "Unsigned"

### Error: "Invalid cloud name"
- Revisa que el Cloud Name es correcto
- No debe incluir espacios ni caracteres especiales

### Imágenes no se optimizan
- Verifica que la URL es de Cloudinary
- Comprueba que incluyes los parámetros de transformación
- Usa los presets predefinidos

## ✅ Checklist de Configuración

- [ ] Cuenta de Cloudinary creada
- [ ] Cloud Name copiado
- [ ] Upload Preset creado (mode: Unsigned)
- [ ] Variables en `.env.local` configuradas
- [ ] Migraciones SQL ejecutadas
- [ ] Productos de prueba insertados
- [ ] Componente ImageUploader probado
- [ ] Imágenes se muestran optimizadas

---

**¡Listo!** Ya tienes Cloudinary integrado con optimización automática de imágenes 🎉
