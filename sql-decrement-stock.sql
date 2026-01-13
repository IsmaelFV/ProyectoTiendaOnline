-- ============================================================================
-- FUNCIÓN PARA DECREMENTAR STOCK DE FORMA ATÓMICA
-- ============================================================================
-- Esta función asegura que el stock nunca sea negativo y 
-- maneja la concurrencia de múltiples compras simultáneas
-- ============================================================================

CREATE OR REPLACE FUNCTION decrement_stock(
  product_id UUID,
  quantity INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Actualizar stock con validación atómica
  UPDATE products
  SET 
    stock = stock - quantity,
    updated_at = NOW()
  WHERE 
    id = product_id
    AND stock >= quantity; -- Solo actualiza si hay suficiente stock

  -- Verificar si se actualizó alguna fila
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock insuficiente o producto no encontrado';
  END IF;
END;
$$;

-- Comentario en la función
COMMENT ON FUNCTION decrement_stock IS 
'Decrementa el stock de un producto de forma atómica. 
Falla si no hay suficiente stock disponible.';
