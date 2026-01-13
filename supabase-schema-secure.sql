-- ============================================================================
-- FashionMarket - SECURE Database Schema
-- ============================================================================
-- FECHA: 12 de enero de 2026
-- PROPÓSITO: Schema de producción con seguridad real para e-commerce
-- 
-- CAMBIOS CLAVE vs schema anterior:
-- 1. Sistema de roles de administrador separado de clientes
-- 2. RLS policies que REALMENTE verifican permisos
-- 3. Auditoría completa de acciones administrativas
-- 4. Tablas para pedidos y gestión de pagos (preparado para Stripe)
-- 5. Validaciones a nivel de base de datos
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- TABLA: admin_users
-- PROPÓSITO: Separar administradores de usuarios finales (clientes)
-- SEGURIDAD: Solo usuarios en esta tabla pueden acceder al panel admin
-- ============================================================================
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin', 'editor', 'viewer')),
  full_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES admin_users(id),
  last_login_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para optimizar consultas de autenticación
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON admin_users(is_active);

COMMENT ON TABLE admin_users IS 'Usuarios con acceso al panel de administración. Roles: super_admin (todo), admin (gestión), editor (productos), viewer (solo lectura)';
COMMENT ON COLUMN admin_users.role IS 'super_admin: acceso total | admin: gestión completa | editor: solo productos/categorías | viewer: solo lectura';

-- ============================================================================
-- TABLA: categories
-- Sin cambios en estructura, pero RLS policies actualizadas
-- ============================================================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active);
CREATE INDEX IF NOT EXISTS idx_categories_order ON categories(display_order);

-- ============================================================================
-- TABLA: products
-- MEJORAS: Validación más estricta, campos adicionales para SEO y gestión
-- ============================================================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  price INTEGER NOT NULL CHECK (price >= 0), -- Precio en céntimos (ej: 8900 = €89.00)
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  images TEXT[] DEFAULT '{}',
  sizes TEXT[] DEFAULT '{}',
  featured BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sku TEXT UNIQUE, -- Código de producto único
  weight_grams INTEGER, -- Para cálculo de envío
  meta_title TEXT, -- SEO
  meta_description TEXT, -- SEO
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES admin_users(id),
  updated_by UUID REFERENCES admin_users(id)
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(featured);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);

-- Constraint: Al menos una imagen
CREATE OR REPLACE FUNCTION check_product_has_images()
RETURNS TRIGGER AS $$
BEGIN
  IF array_length(NEW.images, 1) IS NULL OR array_length(NEW.images, 1) = 0 THEN
    RAISE EXCEPTION 'Un producto debe tener al menos una imagen';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger desactivado por defecto (puedes activarlo en producción)
-- DROP TRIGGER IF EXISTS ensure_product_images ON products;
-- CREATE TRIGGER ensure_product_images
--   BEFORE INSERT OR UPDATE ON products
--   FOR EACH ROW
--   EXECUTE FUNCTION check_product_has_images();

-- ============================================================================
-- TABLA: orders
-- PROPÓSITO: Gestión de pedidos de clientes
-- ============================================================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT UNIQUE NOT NULL, -- Número de pedido visible (ej: ORD-2026-00001)
  
  -- Información del cliente
  customer_email TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  
  -- Dirección de envío
  shipping_address_line1 TEXT NOT NULL,
  shipping_address_line2 TEXT,
  shipping_city TEXT NOT NULL,
  shipping_state TEXT,
  shipping_postal_code TEXT NOT NULL,
  shipping_country TEXT NOT NULL DEFAULT 'ES',
  
  -- Montos en céntimos
  subtotal_amount INTEGER NOT NULL CHECK (subtotal_amount >= 0),
  shipping_amount INTEGER NOT NULL DEFAULT 0 CHECK (shipping_amount >= 0),
  tax_amount INTEGER NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount INTEGER NOT NULL CHECK (total_amount >= 0),
  
  -- Estado del pedido
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'paid', 'shipped', 'delivered', 'cancelled', 'refunded')
  ),
  
  -- Integración con Stripe
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_checkout_session_id TEXT UNIQUE,
  payment_method TEXT, -- 'card', 'paypal', etc.
  
  -- Metadata
  notes TEXT, -- Notas del cliente
  admin_notes TEXT, -- Notas internas
  ip_address INET, -- Para detección de fraude
  user_agent TEXT, -- Para análisis
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  paid_at TIMESTAMP WITH TIME ZONE,
  shipped_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_stripe_payment ON orders(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- Función para generar número de pedido automático
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  year TEXT := TO_CHAR(NOW(), 'YYYY');
  sequence_num TEXT;
  order_count INTEGER;
BEGIN
  -- Contar pedidos del año actual
  SELECT COUNT(*) + 1 INTO order_count
  FROM orders
  WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
  
  -- Formatear con ceros a la izquierda
  sequence_num := LPAD(order_count::TEXT, 5, '0');
  
  RETURN 'ORD-' || year || '-' || sequence_num;
END;
$$ LANGUAGE plpgsql;

-- Trigger para auto-generar order_number
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
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
-- TABLA: order_items
-- PROPÓSITO: Líneas de pedido (productos dentro de cada pedido)
-- IMPORTANTE: Guardamos precio histórico, no referencia al precio actual
-- ============================================================================
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  
  -- Información del producto en el momento de la compra
  product_name TEXT NOT NULL,
  product_slug TEXT NOT NULL,
  product_sku TEXT,
  product_image TEXT, -- Primera imagen
  
  -- Detalles de la compra
  size TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price_per_unit INTEGER NOT NULL CHECK (price_per_unit >= 0), -- Precio unitario histórico
  total_price INTEGER NOT NULL CHECK (total_price >= 0), -- quantity * price_per_unit
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

-- Trigger para calcular total_price automáticamente
CREATE OR REPLACE FUNCTION calculate_order_item_total()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total_price := NEW.quantity * NEW.price_per_unit;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_order_item_total ON order_items;
CREATE TRIGGER trigger_calculate_order_item_total
  BEFORE INSERT OR UPDATE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION calculate_order_item_total();

-- ============================================================================
-- TABLA: audit_logs
-- PROPÓSITO: Auditoría completa de acciones administrativas
-- USO: Saber quién cambió qué, cuándo y desde dónde
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', etc.
  table_name TEXT NOT NULL, -- 'products', 'categories', 'orders', etc.
  record_id UUID, -- ID del registro afectado
  old_values JSONB, -- Valores anteriores (solo en UPDATE/DELETE)
  new_values JSONB, -- Valores nuevos (solo en INSERT/UPDATE)
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_user ON audit_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record ON audit_logs(record_id);

COMMENT ON TABLE audit_logs IS 'Registro de auditoría de todas las acciones administrativas. Crítico para compliance y seguridad.';

-- ============================================================================
-- FUNCIONES AUXILIARES
-- ============================================================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar a todas las tablas que tienen updated_at
DROP TRIGGER IF EXISTS update_admin_users_updated_at ON admin_users;
CREATE TRIGGER update_admin_users_updated_at
  BEFORE UPDATE ON admin_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_categories_updated_at ON categories;
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES - LA PARTE MÁS CRÍTICA
-- ============================================================================
-- PRINCIPIO: El frontend NUNCA debe tener acceso directo a operaciones de escritura
-- Solo lectura pública. Las escrituras van por APIs protegidas con service_role key.
-- ============================================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- POLICIES: admin_users
-- Solo service_role puede gestionar admins (desde APIs protegidas)
-- ============================================================================
CREATE POLICY "Service role can manage admin users"
  ON admin_users FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Los admins pueden ver su propia información
CREATE POLICY "Admins can view their own info"
  ON admin_users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- ============================================================================
-- POLICIES: categories
-- Público: lectura
-- Solo service_role: escritura (desde APIs que verifican admin)
-- ============================================================================
CREATE POLICY "Anyone can view active categories"
  ON categories FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Service role can manage categories"
  ON categories FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- POLICIES: products
-- Público: lectura de productos activos
-- Solo service_role: escritura (desde APIs que verifican admin)
-- ============================================================================
CREATE POLICY "Anyone can view active products"
  ON products FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Para el admin, permitir ver todos los productos (incluso inactivos)
-- Esto se hace desde la API usando service_role, no desde RLS

CREATE POLICY "Service role can manage products"
  ON products FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- POLICIES: orders
-- Clientes autenticados: solo sus propios pedidos
-- Service role: todos los pedidos (para APIs de admin y checkout)
-- ============================================================================
CREATE POLICY "Service role can manage orders"
  ON orders FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Si implementas auth de clientes, permite ver sus pedidos:
-- CREATE POLICY "Customers can view their own orders"
--   ON orders FOR SELECT
--   TO authenticated
--   USING (customer_email = auth.jwt()->>'email');

-- ============================================================================
-- POLICIES: order_items
-- Acceso a través de orders (cascada)
-- ============================================================================
CREATE POLICY "Service role can manage order items"
  ON order_items FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- POLICIES: audit_logs
-- Solo lectura para service_role (los logs nunca se deben modificar)
-- ============================================================================
CREATE POLICY "Service role can view audit logs"
  ON audit_logs FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Service role can insert audit logs"
  ON audit_logs FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Los logs NUNCA se pueden actualizar o eliminar
-- (esto previene manipulación de auditoría)

-- ============================================================================
-- DATOS INICIALES
-- ============================================================================

-- Insertar categorías de ejemplo
INSERT INTO categories (name, slug, description, display_order) VALUES
  ('Camisas', 'camisas', 'Camisas elegantes para cualquier ocasión', 1),
  ('Pantalones', 'pantalones', 'Pantalones de corte perfecto', 2),
  ('Trajes', 'trajes', 'Trajes a medida y confeccionados', 3),
  ('Accesorios', 'accesorios', 'Complementos para el look perfecto', 4)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- IMPORTANTE: CREAR TU PRIMER ADMIN
-- ============================================================================
-- DESPUÉS de crear un usuario en Supabase Auth (Dashboard > Authentication),
-- ejecuta este INSERT reemplazando el UUID por el ID del usuario creado:
-- 
-- INSERT INTO admin_users (id, email, role, full_name, is_active)
-- VALUES (
--   'uuid-del-usuario-aqui',  -- Copiar desde auth.users
--   'admin@fashionmarket.com',
--   'super_admin',
--   'Administrador Principal',
--   true
-- );
-- 
-- NUNCA uses el mismo usuario para clientes y admins.
-- Los admins están en admin_users, los clientes solo en auth.users.
-- ============================================================================

-- ============================================================================
-- FUNCIONES HELPER PARA VERIFICAR PERMISOS (OPCIONAL)
-- Puedes llamar estas funciones desde tus APIs
-- ============================================================================

-- Verificar si un usuario es admin activo
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM admin_users 
    WHERE id = user_id 
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Obtener rol de un admin
CREATE OR REPLACE FUNCTION get_admin_role(user_id UUID)
RETURNS TEXT AS $$
DECLARE
  admin_role TEXT;
BEGIN
  SELECT role INTO admin_role
  FROM admin_users
  WHERE id = user_id
  AND is_active = true;
  
  RETURN admin_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verificar si un admin tiene permiso para una acción
CREATE OR REPLACE FUNCTION can_admin_perform_action(
  user_id UUID,
  required_role TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM admin_users
  WHERE id = user_id
  AND is_active = true;
  
  IF user_role IS NULL THEN
    RETURN false;
  END IF;
  
  -- super_admin puede hacer todo
  IF user_role = 'super_admin' THEN
    RETURN true;
  END IF;
  
  -- Verificar permisos específicos
  RETURN user_role = required_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- VISTAS ÚTILES PARA EL ADMIN
-- ============================================================================

-- Vista de productos con información de categoría
CREATE OR REPLACE VIEW products_with_category AS
SELECT 
  p.*,
  c.name as category_name,
  c.slug as category_slug
FROM products p
LEFT JOIN categories c ON p.category_id = c.id;

-- Vista de pedidos con totales
CREATE OR REPLACE VIEW orders_summary AS
SELECT 
  o.id,
  o.order_number,
  o.customer_email,
  o.customer_name,
  o.total_amount,
  o.status,
  o.created_at,
  COUNT(oi.id) as items_count,
  SUM(oi.quantity) as total_items
FROM orders o
LEFT JOIN order_items oi ON o.id = oi.order_id
GROUP BY o.id;

-- ============================================================================
-- ÍNDICES ADICIONALES PARA PERFORMANCE
-- ============================================================================

-- Para búsquedas de productos (si implementas search)
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin (name gin_trgm_ops);

-- Para consultas de pedidos por fecha
CREATE INDEX IF NOT EXISTS idx_orders_date_range ON orders(created_at, status);

-- ============================================================================
-- FIN DEL SCHEMA SEGURO
-- ============================================================================
-- PRÓXIMOS PASOS:
-- 1. Ejecuta este schema en tu Supabase SQL Editor
-- 2. Crea tu primer admin en Supabase Auth Dashboard
-- 3. Inserta el admin en la tabla admin_users
-- 4. Actualiza las APIs para usar service_role key en operaciones de escritura
-- 5. Implementa verificación de admin en middleware y APIs
-- ============================================================================
