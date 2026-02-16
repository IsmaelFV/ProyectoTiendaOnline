-- ============================================================================
-- Añadir columna size_measurements a la tabla products
-- ============================================================================
-- Esta columna almacena las medidas corporales (pecho, cintura, cadera)
-- para cada talla del producto, en formato JSONB.
--
-- Formato ejemplo:
-- {
--   "S":  { "chest": [82, 88],  "waist": [64, 70],  "hip": [90, 96]  },
--   "M":  { "chest": [88, 94],  "waist": [70, 76],  "hip": [96, 102] },
--   "L":  { "chest": [94, 100], "waist": [76, 82],  "hip": [102, 108] }
-- }
-- ============================================================================

-- Añadir la columna si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'size_measurements'
  ) THEN
    ALTER TABLE products ADD COLUMN size_measurements JSONB DEFAULT '{}'::jsonb;
    RAISE NOTICE 'Columna size_measurements añadida correctamente';
  ELSE
    RAISE NOTICE 'La columna size_measurements ya existe';
  END IF;
END $$;

-- Permitir acceso público de lectura (para el recomendador de tallas en la web)
-- Si ya tienes RLS configurado, asegúrate de que las políticas SELECT incluyan esta columna
