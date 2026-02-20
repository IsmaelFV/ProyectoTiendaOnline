-- Migración: Añadir campos color y is_sustainable a productos + ampliar colores
-- Fecha: 2026-02-20

-- ============================================================================
-- 1. Añadir columnas a products
-- ============================================================================

-- Añadir columna color (nombre del color como texto)
ALTER TABLE products ADD COLUMN IF NOT EXISTS color TEXT;

-- Añadir columna is_sustainable (boolean, default false)
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_sustainable BOOLEAN DEFAULT false;

-- Comentarios
COMMENT ON COLUMN products.color IS 'Color principal del producto (texto libre)';
COMMENT ON COLUMN products.is_sustainable IS 'Indica si el producto cumple criterios de sostenibilidad';

-- ============================================================================
-- 2. Ampliar catálogo de colores en la tabla colors
-- ============================================================================

INSERT INTO colors (name, slug, hex_code, display_order) VALUES
  -- Básicos
  ('Negro', 'negro', '#000000', 1),
  ('Blanco', 'blanco', '#FFFFFF', 2),
  ('Gris', 'gris', '#808080', 3),
  ('Gris Claro', 'gris-claro', '#D3D3D3', 4),
  ('Gris Oscuro', 'gris-oscuro', '#404040', 5),

  -- Azules
  ('Azul Marino', 'azul-marino', '#001F3F', 6),
  ('Azul', 'azul', '#0074D9', 7),
  ('Azul Cielo', 'azul-cielo', '#87CEEB', 8),
  ('Azul Petróleo', 'azul-petroleo', '#005F6B', 9),
  ('Índigo', 'indigo', '#4B0082', 10),

  -- Rojos y rosados
  ('Rojo', 'rojo', '#FF4136', 11),
  ('Burdeos', 'burdeos', '#800020', 12),
  ('Granate', 'granate', '#6B0D0D', 13),
  ('Coral', 'coral', '#FF7F50', 14),
  ('Rosa', 'rosa', '#FF69B4', 15),
  ('Rosa Palo', 'rosa-palo', '#FADADD', 16),
  ('Fucsia', 'fucsia', '#FF00FF', 17),
  ('Salmón', 'salmon', '#FA8072', 18),

  -- Verdes
  ('Verde', 'verde', '#2ECC40', 19),
  ('Verde Oscuro', 'verde-oscuro', '#006400', 20),
  ('Verde Oliva', 'verde-oliva', '#808000', 21),
  ('Verde Menta', 'verde-menta', '#98FF98', 22),
  ('Turquesa', 'turquesa', '#40E0D0', 23),
  ('Caqui', 'caqui', '#C3B091', 24),

  -- Amarillos y naranjas
  ('Amarillo', 'amarillo', '#FFDC00', 25),
  ('Amarillo Mostaza', 'amarillo-mostaza', '#E1AD01', 26),
  ('Naranja', 'naranja', '#FF851B', 27),
  ('Melocotón', 'melocoton', '#FFDAB9', 28),

  -- Marrones y tierra
  ('Marrón', 'marron', '#8B4513', 29),
  ('Marrón Claro', 'marron-claro', '#C4A882', 30),
  ('Beige', 'beige', '#F5F5DC', 31),
  ('Camel', 'camel', '#C19A6B', 32),
  ('Arena', 'arena', '#C2B280', 33),
  ('Chocolate', 'chocolate', '#7B3F00', 34),
  ('Tostado', 'tostado', '#D2B48C', 35),
  ('Terracota', 'terracota', '#E2725B', 36),

  -- Morados
  ('Morado', 'morado', '#800080', 37),
  ('Lila', 'lila', '#C8A2C8', 38),
  ('Lavanda', 'lavanda', '#E6E6FA', 39),
  ('Violeta', 'violeta', '#7F00FF', 40),
  ('Malva', 'malva', '#E0B0FF', 41),

  -- Metalizados y especiales
  ('Dorado', 'dorado', '#FFD700', 42),
  ('Plateado', 'plateado', '#C0C0C0', 43),
  ('Bronce', 'bronce', '#CD7F32', 44),
  ('Cobre', 'cobre', '#B87333', 45),

  -- Estampados (hex representativo)
  ('Multicolor', 'multicolor', '#FF6B6B', 46),
  ('Estampado', 'estampado', '#DAA520', 47),
  ('Rayas', 'rayas', '#4169E1', 48),
  ('Cuadros', 'cuadros', '#228B22', 49),
  ('Animal Print', 'animal-print', '#C4A35A', 50),
  ('Floral', 'floral', '#DB7093', 51),
  ('Tie-Dye', 'tie-dye', '#9B59B6', 52),
  ('Denim', 'denim', '#1560BD', 53),

  -- Neutros extra
  ('Crema', 'crema', '#FFFDD0', 54),
  ('Marfil', 'marfil', '#FFFFF0', 55),
  ('Carbón', 'carbon', '#36454F', 56)
ON CONFLICT (slug) DO UPDATE SET
  hex_code = EXCLUDED.hex_code,
  display_order = EXCLUDED.display_order;
