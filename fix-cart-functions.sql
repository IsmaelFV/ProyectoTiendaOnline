-- ============================================================================
-- FIX: Recrear funciones del carrito con permisos correctos
-- ============================================================================
-- Ejecutar DESPUÉS de 003_persistent_cart.sql
-- Este script soluciona problemas de permisos con SECURITY DEFINER
-- ============================================================================

-- Eliminar funciones anteriores
DROP FUNCTION IF EXISTS get_or_create_cart(UUID);
DROP FUNCTION IF EXISTS add_to_cart(UUID, UUID, TEXT, INTEGER);
DROP FUNCTION IF EXISTS update_cart_item_quantity(UUID, UUID, TEXT, INTEGER);
DROP FUNCTION IF EXISTS remove_from_cart(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS clear_cart(UUID);
DROP FUNCTION IF EXISTS get_cart_with_products(UUID);

-- ============================================================================
-- FUNCIÓN: get_or_create_cart (CON PERMISOS CORRECTOS)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_or_create_cart(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cart_id UUID;
BEGIN
  SELECT id INTO v_cart_id
  FROM shopping_carts
  WHERE user_id = p_user_id;

  IF v_cart_id IS NULL THEN
    INSERT INTO shopping_carts (user_id)
    VALUES (p_user_id)
    RETURNING id INTO v_cart_id;
  END IF;

  RETURN v_cart_id;
END;
$$;

-- ============================================================================
-- FUNCIÓN: add_to_cart (CON PERMISOS CORRECTOS)
-- ============================================================================
CREATE OR REPLACE FUNCTION add_to_cart(
  p_user_id UUID,
  p_product_id UUID,
  p_size TEXT,
  p_quantity INTEGER DEFAULT 1
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cart_id UUID;
  v_existing_quantity INTEGER;
BEGIN
  IF p_quantity <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'invalid_quantity');
  END IF;

  v_cart_id := get_or_create_cart(p_user_id);

  SELECT quantity INTO v_existing_quantity
  FROM cart_items
  WHERE cart_id = v_cart_id
    AND product_id = p_product_id
    AND size = p_size;

  IF FOUND THEN
    UPDATE cart_items
    SET quantity = quantity + p_quantity, updated_at = NOW()
    WHERE cart_id = v_cart_id AND product_id = p_product_id AND size = p_size;
  ELSE
    INSERT INTO cart_items (cart_id, product_id, size, quantity)
    VALUES (v_cart_id, p_product_id, p_size, p_quantity);
  END IF;

  RETURN json_build_object('success', true, 'cart_id', v_cart_id);
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'database_error', 'message', SQLERRM);
END;
$$;

-- ============================================================================
-- FUNCIÓN: update_cart_item_quantity (CON PERMISOS CORRECTOS)
-- ============================================================================
CREATE OR REPLACE FUNCTION update_cart_item_quantity(
  p_user_id UUID,
  p_product_id UUID,
  p_size TEXT,
  p_quantity INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cart_id UUID;
BEGIN
  SELECT id INTO v_cart_id FROM shopping_carts WHERE user_id = p_user_id;

  IF v_cart_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'cart_not_found');
  END IF;

  IF p_quantity <= 0 THEN
    DELETE FROM cart_items
    WHERE cart_id = v_cart_id AND product_id = p_product_id AND size = p_size;
  ELSE
    UPDATE cart_items
    SET quantity = p_quantity, updated_at = NOW()
    WHERE cart_id = v_cart_id AND product_id = p_product_id AND size = p_size;
  END IF;

  RETURN json_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'database_error', 'message', SQLERRM);
END;
$$;

-- ============================================================================
-- FUNCIÓN: remove_from_cart (CON PERMISOS CORRECTOS)
-- ============================================================================
CREATE OR REPLACE FUNCTION remove_from_cart(
  p_user_id UUID,
  p_product_id UUID,
  p_size TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cart_id UUID;
BEGIN
  SELECT id INTO v_cart_id FROM shopping_carts WHERE user_id = p_user_id;

  IF v_cart_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'cart_not_found');
  END IF;

  DELETE FROM cart_items
  WHERE cart_id = v_cart_id AND product_id = p_product_id AND size = p_size;

  RETURN json_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'database_error', 'message', SQLERRM);
END;
$$;

-- ============================================================================
-- FUNCIÓN: clear_cart (CON PERMISOS CORRECTOS)
-- ============================================================================
CREATE OR REPLACE FUNCTION clear_cart(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cart_id UUID;
BEGIN
  SELECT id INTO v_cart_id FROM shopping_carts WHERE user_id = p_user_id;

  IF v_cart_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'cart_not_found');
  END IF;

  DELETE FROM cart_items WHERE cart_id = v_cart_id;

  RETURN json_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'database_error', 'message', SQLERRM);
END;
$$;

-- ============================================================================
-- FUNCIÓN: get_cart_with_products (CON PERMISOS CORRECTOS)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_cart_with_products(p_user_id UUID)
RETURNS TABLE (
  cart_id UUID,
  product_id UUID,
  product_name TEXT,
  product_slug TEXT,
  product_price INTEGER,
  product_image TEXT,
  size TEXT,
  quantity INTEGER,
  subtotal INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ci.cart_id,
    p.id,
    p.name,
    p.slug,
    p.price,
    CASE WHEN p.images IS NOT NULL AND array_length(p.images, 1) > 0 THEN p.images[1] ELSE NULL END,
    ci.size,
    ci.quantity,
    (p.price * ci.quantity)
  FROM cart_items ci
  INNER JOIN products p ON p.id = ci.product_id
  INNER JOIN shopping_carts sc ON sc.id = ci.cart_id
  WHERE sc.user_id = p_user_id AND p.is_active = true
  ORDER BY ci.created_at ASC;
END;
$$;

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Funciones del carrito recreadas con permisos correctos';
END $$;
