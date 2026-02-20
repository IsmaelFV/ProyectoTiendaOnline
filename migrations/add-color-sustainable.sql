-- Migración: Añadir campos color y is_sustainable a productos
-- Fecha: 2026-02-20

-- Añadir columna color (nombre del color como texto)
ALTER TABLE products ADD COLUMN IF NOT EXISTS color TEXT;

-- Añadir columna is_sustainable (boolean, default false)
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_sustainable BOOLEAN DEFAULT false;

-- Comentarios
COMMENT ON COLUMN products.color IS 'Color principal del producto (texto libre)';
COMMENT ON COLUMN products.is_sustainable IS 'Indica si el producto cumple criterios de sostenibilidad';
