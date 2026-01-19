-- ============================================================================
-- MIGRACIÓN: CARRITO PERSISTENTE POR USUARIO
-- ============================================================================
-- FECHA: 16 de enero de 2026
-- PRIORIDAD: CRÍTICA - Seguridad y privacidad
-- PROPÓSITO: Implementar carrito persistente en base de datos separado por usuario
--            Solución al problema: localStorage comparte carrito entre cuentas
-- ============================================================================

-- ============================================================================
-- TABLA: shopping_carts
-- PROPÓSITO: Un carrito por usuario autenticado
-- ============================================================================
CREATE TABLE IF NOT EXISTS shopping_carts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_carts_user ON shopping_carts(user_id);

COMMENT ON TABLE shopping_carts IS 'Carrito de compras persistente por usuario. Un usuario = un carrito.';

-- ============================================================================
-- TABLA: cart_items
-- PROPÓSITO: Items dentro del carrito de cada usuario
-- ============================================================================
CREATE TABLE IF NOT EXISTS cart_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cart_id UUID NOT NULL REFERENCES shopping_carts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraint: Un producto + talla solo puede estar una vez en el carrito
  UNIQUE(cart_id, product_id, size)
);

CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product ON cart_items(product_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_product ON cart_items(cart_id, product_id);

COMMENT ON TABLE cart_items IS 'Items del carrito. Combinación única de producto+talla por carrito.';
COMMENT ON COLUMN cart_items.size IS 'Talla seleccionada (S, M, L, XL, XXL, etc.)';

-- ============================================================================
-- TRIGGER: Auto-actualizar updated_at en shopping_carts
-- ============================================================================
CREATE OR REPLACE FUNCTION update_cart_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo actualizar si es INSERT o UPDATE (no DELETE)
  IF TG_OP = 'DELETE' THEN
    UPDATE shopping_carts
    SET updated_at = NOW()
    WHERE id = OLD.cart_id;
    RETURN OLD;
  ELSE
    UPDATE shopping_carts
    SET updated_at = NOW()
    WHERE id = NEW.cart_id;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_cart_on_item_change ON cart_items;
CREATE TRIGGER trigger_update_cart_on_item_change
  AFTER INSERT OR UPDATE OR DELETE ON cart_items
  FOR EACH ROW
  EXECUTE FUNCTION update_cart_timestamp();

-- ============================================================================
-- RLS POLICIES: Seguridad para que cada usuario vea solo su carrito
-- ============================================================================

-- Habilitar RLS
ALTER TABLE shopping_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

-- Policy: Usuarios solo ven su propio carrito
DROP POLICY IF EXISTS "Users can view own cart" ON shopping_carts;
CREATE POLICY "Users can view own cart"
  ON shopping_carts
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own cart" ON shopping_carts;
CREATE POLICY "Users can insert own cart"
  ON shopping_carts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own cart" ON shopping_carts;
CREATE POLICY "Users can update own cart"
  ON shopping_carts
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own cart" ON shopping_carts;
CREATE POLICY "Users can delete own cart"
  ON shopping_carts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Policy: Usuarios solo ven items de su carrito
DROP POLICY IF EXISTS "Users can view own cart items" ON cart_items;
CREATE POLICY "Users can view own cart items"
  ON cart_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM shopping_carts
      WHERE shopping_carts.id = cart_items.cart_id
      AND shopping_carts.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own cart items" ON cart_items;
CREATE POLICY "Users can insert own cart items"
  ON cart_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM shopping_carts
      WHERE shopping_carts.id = cart_items.cart_id
      AND shopping_carts.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own cart items" ON cart_items;
CREATE POLICY "Users can update own cart items"
  ON cart_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM shopping_carts
      WHERE shopping_carts.id = cart_items.cart_id
      AND shopping_carts.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM shopping_carts
      WHERE shopping_carts.id = cart_items.cart_id
      AND shopping_carts.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own cart items" ON cart_items;
CREATE POLICY "Users can delete own cart items"
  ON cart_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM shopping_carts
      WHERE shopping_carts.id = cart_items.cart_id
      AND shopping_carts.user_id = auth.uid()
    )
  );

-- ============================================================================
-- FUNCIÓN: get_or_create_cart
-- PROPÓSITO: Obtener carrito del usuario o crearlo si no existe
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
  -- Intentar obtener carrito existente
  SELECT id INTO v_cart_id
  FROM shopping_carts
  WHERE user_id = p_user_id;

  -- Si no existe, crear uno nuevo
  IF v_cart_id IS NULL THEN
    INSERT INTO shopping_carts (user_id)
    VALUES (p_user_id)
    RETURNING id INTO v_cart_id;
  END IF;

  RETURN v_cart_id;
END;
$$;

COMMENT ON FUNCTION get_or_create_cart IS 'Obtiene el ID del carrito del usuario, creándolo si no existe.';

-- ============================================================================
-- FUNCIÓN: add_to_cart
-- PROPÓSITO: Agregar producto al carrito o incrementar cantidad si ya existe
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
  -- Validar cantidad
  IF p_quantity <= 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'invalid_quantity'
    );
  END IF;

  -- Obtener o crear carrito
  v_cart_id := get_or_create_cart(p_user_id);

  -- Verificar si el item ya existe
  SELECT quantity INTO v_existing_quantity
  FROM cart_items
  WHERE cart_id = v_cart_id
    AND product_id = p_product_id
    AND size = p_size;

  IF FOUND THEN
    -- Incrementar cantidad existente
    UPDATE cart_items
    SET 
      quantity = quantity + p_quantity,
      updated_at = NOW()
    WHERE cart_id = v_cart_id
      AND product_id = p_product_id
      AND size = p_size;
  ELSE
    -- Insertar nuevo item
    INSERT INTO cart_items (cart_id, product_id, size, quantity)
    VALUES (v_cart_id, p_product_id, p_size, p_quantity);
  END IF;

  RETURN json_build_object(
    'success', true,
    'cart_id', v_cart_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'database_error',
      'message', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCIÓN: update_cart_item_quantity
-- PROPÓSITO: Actualizar cantidad de un item (o eliminarlo si quantity = 0)
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
  -- Obtener carrito del usuario
  SELECT id INTO v_cart_id
  FROM shopping_carts
  WHERE user_id = p_user_id;

  IF v_cart_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'cart_not_found'
    );
  END IF;

  -- Si quantity es 0, eliminar el item
  IF p_quantity <= 0 THEN
    DELETE FROM cart_items
    WHERE cart_id = v_cart_id
      AND product_id = p_product_id
      AND size = p_size;
  ELSE
    -- Actualizar cantidad
    UPDATE cart_items
    SET 
      quantity = p_quantity,
      updated_at = NOW()
    WHERE cart_id = v_cart_id
      AND product_id = p_product_id
      AND size = p_size;
  END IF;

  RETURN json_build_object('success', true);

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'database_error',
      'message', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCIÓN: remove_from_cart
-- PROPÓSITO: Eliminar un item del carrito
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
  -- Obtener carrito del usuario
  SELECT id INTO v_cart_id
  FROM shopping_carts
  WHERE user_id = p_user_id;

  IF v_cart_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'cart_not_found'
    );
  END IF;

  -- Eliminar el item
  DELETE FROM cart_items
  WHERE cart_id = v_cart_id
    AND product_id = p_product_id
    AND size = p_size;

  RETURN json_build_object('success', true);

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'database_error',
      'message', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCIÓN: clear_cart
-- PROPÓSITO: Vaciar completamente el carrito del usuario
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
  -- Obtener carrito del usuario
  SELECT id INTO v_cart_id
  FROM shopping_carts
  WHERE user_id = p_user_id;

  IF v_cart_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'cart_not_found'
    );
  END IF;

  -- Eliminar todos los items
  DELETE FROM cart_items
  WHERE cart_id = v_cart_id;

  RETURN json_build_object('success', true);

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'database_error',
      'message', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCIÓN: get_cart_with_products
-- PROPÓSITO: Obtener carrito completo con información de productos
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
    p.id AS product_id,
    p.name AS product_name,
    p.slug AS product_slug,
    p.price AS product_price,
    CASE 
      WHEN p.images IS NOT NULL AND array_length(p.images, 1) > 0 
      THEN p.images[1]
      ELSE NULL
    END AS product_image,
    ci.size,
    ci.quantity,
    (p.price * ci.quantity) AS subtotal
  FROM cart_items ci
  INNER JOIN products p ON p.id = ci.product_id
  INNER JOIN shopping_carts sc ON sc.id = ci.cart_id
  WHERE sc.user_id = p_user_id
    AND p.is_active = true
  ORDER BY ci.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_cart_with_products IS 'Obtiene todos los items del carrito con información completa de productos.';

-- ============================================================================
-- VERIFICACIÓN DE INSTALACIÓN
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Migración 003_persistent_cart completada';
  RAISE NOTICE 'Tablas: shopping_carts, cart_items creadas';
  RAISE NOTICE 'Funciones: add_to_cart, update_cart_item_quantity, remove_from_cart, clear_cart, get_cart_with_products';
  RAISE NOTICE 'RLS: Políticas de seguridad habilitadas (usuarios solo ven su carrito)';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  PRÓXIMOS PASOS:';
  RAISE NOTICE '1. Actualizar src/stores/cart.ts para usar Supabase en usuarios autenticados';
  RAISE NOTICE '2. Implementar migración de carrito localStorage → DB al hacer login';
  RAISE NOTICE '3. Limpiar localStorage al hacer logout';
END $$;
