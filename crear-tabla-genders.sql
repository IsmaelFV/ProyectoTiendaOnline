-- ============================================================================
-- SOLUCIÓN RÁPIDA: Crear tabla genders
-- ============================================================================
-- Copia y pega este SQL completo en Supabase SQL Editor
-- ============================================================================

-- 1. Crear tabla genders
CREATE TABLE IF NOT EXISTS genders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Crear índices
CREATE INDEX IF NOT EXISTS idx_genders_slug ON genders(slug);
CREATE INDEX IF NOT EXISTS idx_genders_active ON genders(is_active);

-- 3. Insertar datos (Mujer, Hombre, Unisex)
INSERT INTO genders (name, slug, display_order) VALUES
  ('Mujer', 'mujer', 1),
  ('Hombre', 'hombre', 2),
  ('Unisex', 'unisex', 3)
ON CONFLICT (slug) DO NOTHING;

-- 4. Habilitar Row Level Security
ALTER TABLE genders ENABLE ROW LEVEL SECURITY;

-- 5. Políticas RLS: Todos pueden leer
CREATE POLICY "Public can view genders"
  ON genders FOR SELECT
  TO anon, authenticated
  USING (true);

-- 6. Política: Service role puede gestionar
CREATE POLICY "Service role can manage genders"
  ON genders FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- VERIFICACIÓN (ejecuta esto después para confirmar)
-- ============================================================================
-- SELECT * FROM genders ORDER BY display_order;
-- Deberías ver 3 filas: Mujer, Hombre, Unisex
-- ============================================================================
