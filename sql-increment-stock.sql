-- ============================================================================
-- FUNCIÓN PARA INCREMENTAR STOCK (RECUPERAR PRODUCTOS)
-- ============================================================================
-- Esta función se usa cuando se cancela o reembolsa un pedido
-- para devolver el stock al inventario
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_stock(
  product_id UUID,
  quantity INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Incrementar stock
  UPDATE products
  SET 
    stock = stock + quantity,
    updated_at = NOW()
  WHERE 
    id = product_id;

  -- Verificar si se actualizó alguna fila
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto no encontrado';
  END IF;
END;
$$;

-- Comentario en la función
COMMENT ON FUNCTION increment_stock IS 
'Incrementa el stock de un producto. Se usa cuando se cancela o reembolsa un pedido.';
