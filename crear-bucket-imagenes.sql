-- ============================================================================
-- Crear bucket de Supabase Storage para imágenes de productos
-- ============================================================================
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================================

-- Crear el bucket si no existe
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml'];

-- Política: cualquiera puede leer (las imágenes son públicas)
DROP POLICY IF EXISTS "Acceso público de lectura a product-images" ON storage.objects;
CREATE POLICY "Acceso público de lectura a product-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

-- Política: usuarios autenticados pueden subir
DROP POLICY IF EXISTS "Usuarios autenticados pueden subir a product-images" ON storage.objects;
CREATE POLICY "Usuarios autenticados pueden subir a product-images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-images');

-- Política: usuarios autenticados pueden actualizar
DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar product-images" ON storage.objects;
CREATE POLICY "Usuarios autenticados pueden actualizar product-images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'product-images');

-- Política: usuarios autenticados pueden eliminar
DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar de product-images" ON storage.objects;
CREATE POLICY "Usuarios autenticados pueden eliminar de product-images"
ON storage.objects FOR DELETE
USING (bucket_id = 'product-images');
