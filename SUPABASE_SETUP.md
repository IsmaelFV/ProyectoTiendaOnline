# Configuración de Supabase para FashionMarket

## 1. Crear Proyecto en Supabase

1. Ve a [https://supabase.com](https://supabase.com) y crea una cuenta
2. Crea un nuevo proyecto
3. Guarda la URL del proyecto y las API keys

## 2. Ejecutar el Schema SQL

1. En el dashboard de Supabase, ve a **SQL Editor**
2. Crea una nueva query
3. Copia y pega el contenido de `supabase-schema.sql`
4. Ejecuta la query (Run)

Esto creará:
- Tabla `categories` con 3 categorías de ejemplo
- Tabla `products` con 3 productos de ejemplo
- Políticas RLS para acceso público de lectura y escritura solo para autenticados
- Índices para optimizar consultas
- Triggers para actualizar `updated_at` automáticamente

## 3. Configurar Storage para Imágenes

### Crear el Bucket

1. Ve a **Storage** en el menú lateral
2. Haz clic en **New bucket**
3. Nombre: `product-images`
4. **Public bucket**: ✅ Activado (para que las imágenes sean accesibles públicamente)
5. Haz clic en **Create bucket**

### Configurar Políticas de Storage

1. Selecciona el bucket `product-images`
2. Ve a **Policies**
3. Crea las siguientes políticas:

#### Política 1: Lectura Pública
```sql
-- Nombre: Public can view product images
-- Operación: SELECT
-- Target roles: public

CREATE POLICY "Public can view product images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-images');
```

#### Política 2: Upload para Autenticados
```sql
-- Nombre: Authenticated users can upload product images
-- Operación: INSERT
-- Target roles: authenticated

CREATE POLICY "Authenticated users can upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images');
```

#### Política 3: Delete para Autenticados
```sql
-- Nombre: Authenticated users can delete product images
-- Operación: DELETE
-- Target roles: authenticated

CREATE POLICY "Authenticated users can delete product images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-images');
```

#### Política 4: Update para Autenticados
```sql
-- Nombre: Authenticated users can update product images
-- Operación: UPDATE
-- Target roles: authenticated

CREATE POLICY "Authenticated users can update product images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images')
WITH CHECK (bucket_id = 'product-images');
```

## 4. Configurar Autenticación

1. Ve a **Authentication** > **Providers**
2. Habilita **Email** (ya está habilitado por defecto)
3. Ve a **Authentication** > **Users**
4. Crea un usuario administrador manualmente:
   - Email: tu-email@ejemplo.com
   - Password: (contraseña segura)
   - Confirma el email automáticamente

## 5. Configurar Variables de Entorno

1. Copia `.env.example` a `.env`
2. En el dashboard de Supabase, ve a **Settings** > **API**
3. Copia los valores:
   - `PUBLIC_SUPABASE_URL`: Project URL
   - `PUBLIC_SUPABASE_ANON_KEY`: anon/public key
   - `SUPABASE_SERVICE_ROLE_KEY`: service_role key (¡mantén esto secreto!)

```env
PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-aqui
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-aqui
```

## 6. Estructura de URLs de Imágenes

Las imágenes subidas al bucket se accederán mediante:
```
https://tu-proyecto.supabase.co/storage/v1/object/public/product-images/nombre-archivo.jpg
```

Esta URL se guardará en el array `images` de la tabla `products`.

## 7. Verificación

Para verificar que todo funciona:

1. **Base de datos**: Ve a **Table Editor** y verifica que existen las tablas `categories` y `products`
2. **Storage**: Ve a **Storage** y verifica que existe el bucket `product-images`
3. **Auth**: Ve a **Authentication** > **Users** y verifica que existe tu usuario admin

¡Listo! Tu backend de Supabase está configurado.
