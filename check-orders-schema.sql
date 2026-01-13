-- Verificar qué columnas tiene realmente la tabla orders en Supabase
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'orders'
ORDER BY ordinal_position;
