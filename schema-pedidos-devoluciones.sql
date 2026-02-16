-- ============================================================================
-- ESQUEMA COMPLETO PARA SISTEMA DE PEDIDOS Y DEVOLUCIONES
-- ============================================================================
-- Incluye: pedidos, items, direcciones, devoluciones, mensajes
-- ============================================================================

-- ============================================================================
-- ELIMINAR TABLAS ANTIGUAS SI EXISTEN
-- ============================================================================
DROP TABLE IF EXISTS return_messages CASCADE;
DROP TABLE IF EXISTS returns CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS customer_addresses CASCADE;
DROP TABLE IF EXISTS admin_users CASCADE;

-- ============================================================================
-- TABLA: admin_users (prerequisito para políticas RLS)
-- ============================================================================
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);

-- ============================================================================
-- TABLA: customer_addresses (Direcciones de clientes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS customer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  address_line1 VARCHAR(255) NOT NULL,
  address_line2 VARCHAR(255),
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  postal_code VARCHAR(20) NOT NULL,
  country VARCHAR(100) DEFAULT 'España',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLA: orders (Pedidos)
-- ============================================================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(50) UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Información de envío
  shipping_address_id UUID REFERENCES customer_addresses(id),
  shipping_full_name VARCHAR(255) NOT NULL,
  shipping_phone VARCHAR(20) NOT NULL,
  shipping_address_line1 VARCHAR(255) NOT NULL,
  shipping_address_line2 VARCHAR(255),
  shipping_city VARCHAR(100) NOT NULL,
  shipping_state VARCHAR(100) NOT NULL,
  shipping_postal_code VARCHAR(20) NOT NULL,
  shipping_country VARCHAR(100) DEFAULT 'España',
  
  -- Información de facturación (si es diferente)
  billing_address_id UUID REFERENCES customer_addresses(id),
  billing_full_name VARCHAR(255),
  billing_address_line1 VARCHAR(255),
  billing_city VARCHAR(100),
  billing_postal_code VARCHAR(20),
  
  -- Estado del pedido
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
    'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'
  )),
  
  -- Importes
  subtotal DECIMAL(10, 2) NOT NULL,
  shipping_cost DECIMAL(10, 2) DEFAULT 0,
  tax DECIMAL(10, 2) DEFAULT 0,
  discount DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL,
  
  -- Pago
  payment_method VARCHAR(50) NOT NULL,
  payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN (
    'pending', 'paid', 'failed', 'refunded'
  )),
  payment_id VARCHAR(255),
  
  -- Envío
  shipping_method VARCHAR(50),
  tracking_number VARCHAR(100),
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  
  -- Notas
  customer_notes TEXT,
  admin_notes TEXT,
  
  -- Fechas
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Índices
  CONSTRAINT valid_total CHECK (total >= 0)
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

-- ============================================================================
-- TABLA: order_items (Items de pedidos)
-- ============================================================================
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  
  -- Información del producto (snapshot en el momento de la compra)
  product_name VARCHAR(255) NOT NULL,
  product_slug VARCHAR(255),
  product_image VARCHAR(500),
  
  -- Variante seleccionada
  size VARCHAR(10),
  color VARCHAR(50),
  
  -- Precio y cantidad
  price DECIMAL(10, 2) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  subtotal DECIMAL(10, 2) NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- ============================================================================
-- TABLA: returns (Devoluciones)
-- ============================================================================
CREATE TABLE IF NOT EXISTS returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number VARCHAR(50) UNIQUE NOT NULL,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Estado de la devolución
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'rejected', 'received', 'refunded', 'cancelled'
  )),
  
  -- Razón de la devolución
  reason VARCHAR(50) NOT NULL CHECK (reason IN (
    'defective', 'wrong_item', 'wrong_size', 'not_as_described', 'changed_mind', 'other'
  )),
  reason_details TEXT,
  
  -- Items a devolver
  items JSONB NOT NULL, -- Array de {order_item_id, product_name, quantity, refund_amount}
  
  -- Importes
  refund_amount DECIMAL(10, 2) NOT NULL,
  refund_shipping BOOLEAN DEFAULT false,
  
  -- Imágenes de prueba (si aplica)
  images TEXT[], -- URLs de imágenes subidas por el cliente
  
  -- Procesamiento
  approved_by UUID REFERENCES admin_users(id),
  approved_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  
  -- Notas
  admin_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_returns_order_id ON returns(order_id);
CREATE INDEX IF NOT EXISTS idx_returns_user_id ON returns(user_id);
CREATE INDEX IF NOT EXISTS idx_returns_status ON returns(status);
CREATE INDEX IF NOT EXISTS idx_returns_return_number ON returns(return_number);

-- ============================================================================
-- TABLA: return_messages (Mensajes de devoluciones)
-- ============================================================================
CREATE TABLE IF NOT EXISTS return_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID REFERENCES returns(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('customer', 'admin')),
  message TEXT NOT NULL,
  attachments TEXT[], -- URLs de archivos adjuntos
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_return_messages_return_id ON return_messages(return_id);
CREATE INDEX IF NOT EXISTS idx_return_messages_sender_id ON return_messages(sender_id);

-- ============================================================================
-- FUNCIÓN: Generar número de pedido
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  exists_check BOOLEAN;
BEGIN
  LOOP
    -- Formato: ORD-YYYYMMDD-XXXX
    new_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                  LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    
    -- Verificar si existe
    SELECT EXISTS(SELECT 1 FROM orders WHERE order_number = new_number) INTO exists_check;
    
    EXIT WHEN NOT exists_check;
  END LOOP;
  
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCIÓN: Generar número de devolución
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_return_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  exists_check BOOLEAN;
BEGIN
  LOOP
    -- Formato: RET-YYYYMMDD-XXXX
    new_number := 'RET-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                  LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    
    SELECT EXISTS(SELECT 1 FROM returns WHERE return_number = new_number) INTO exists_check;
    
    EXIT WHEN NOT exists_check;
  END LOOP;
  
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER: Auto-generar order_number
-- ============================================================================
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_order_number ON orders;
CREATE TRIGGER trigger_set_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_number();

-- ============================================================================
-- TRIGGER: Auto-generar return_number
-- ============================================================================
CREATE OR REPLACE FUNCTION set_return_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.return_number IS NULL OR NEW.return_number = '' THEN
    NEW.return_number := generate_return_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_return_number ON returns;
CREATE TRIGGER trigger_set_return_number
  BEFORE INSERT ON returns
  FOR EACH ROW
  EXECUTE FUNCTION set_return_number();

-- ============================================================================
-- POLÍTICAS RLS: customer_addresses
-- ============================================================================
ALTER TABLE customer_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own addresses" ON customer_addresses;
CREATE POLICY "Users can manage their own addresses"
ON customer_addresses FOR ALL
TO authenticated
USING (auth.uid() = customer_addresses.user_id)
WITH CHECK (auth.uid() = customer_addresses.user_id);

DROP POLICY IF EXISTS "Admins can view all addresses" ON customer_addresses;
CREATE POLICY "Admins can view all addresses"
ON customer_addresses FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
);

-- ============================================================================
-- POLÍTICAS RLS: orders
-- ============================================================================
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own orders" ON orders;
CREATE POLICY "Users can view their own orders"
ON orders FOR SELECT
TO authenticated
USING (auth.uid() = orders.user_id);

DROP POLICY IF EXISTS "Users can create orders" ON orders;
CREATE POLICY "Users can create orders"
ON orders FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = orders.user_id);

DROP POLICY IF EXISTS "Admins can manage all orders" ON orders;
CREATE POLICY "Admins can manage all orders"
ON orders FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
);

-- ============================================================================
-- POLÍTICAS RLS: order_items
-- ============================================================================
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their order items" ON order_items;
CREATE POLICY "Users can view their order items"
ON order_items FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can create order items" ON order_items;
CREATE POLICY "Users can create order items"
ON order_items FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Admins can manage all order items" ON order_items;
CREATE POLICY "Admins can manage all order items"
ON order_items FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
);

-- ============================================================================
-- POLÍTICAS RLS: returns
-- ============================================================================
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own returns" ON returns;
CREATE POLICY "Users can manage their own returns"
ON returns FOR ALL
TO authenticated
USING (auth.uid() = returns.user_id)
WITH CHECK (auth.uid() = returns.user_id);

DROP POLICY IF EXISTS "Admins can manage all returns" ON returns;
CREATE POLICY "Admins can manage all returns"
ON returns FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
);

-- ============================================================================
-- POLÍTICAS RLS: return_messages
-- ============================================================================
ALTER TABLE return_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view messages for their returns" ON return_messages;
CREATE POLICY "Users can view messages for their returns"
ON return_messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM returns 
    WHERE returns.id = return_messages.return_id 
    AND returns.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can send messages for their returns" ON return_messages;
CREATE POLICY "Users can send messages for their returns"
ON return_messages FOR INSERT
TO authenticated
WITH CHECK (
  return_messages.sender_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM returns 
    WHERE returns.id = return_messages.return_id 
    AND returns.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins can manage all messages" ON return_messages;
CREATE POLICY "Admins can manage all messages"
ON return_messages FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
);

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================
SELECT 'ESQUEMA DE PEDIDOS Y DEVOLUCIONES CREADO' as resultado;

-- Ver todas las tablas creadas
SELECT table_name, 
       (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as columnas
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_name IN ('customer_addresses', 'orders', 'order_items', 'returns', 'return_messages')
ORDER BY table_name;
