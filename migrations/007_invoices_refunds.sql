-- =====================================================
-- Migración 007: Sistema de Facturas y Abonos
-- =====================================================
-- Tabla invoices para facturas de venta y abono
-- Tabla refunds para seguimiento de reembolsos
-- Funciones para cuadre de caja
-- =====================================================

BEGIN;

-- =====================================================
-- 1. TABLA: invoices (Facturas)
-- =====================================================
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  refund_id UUID, -- Se llenará después de crear tabla refunds
  
  -- Tipo de factura
  invoice_type VARCHAR(20) NOT NULL CHECK (invoice_type IN ('sale', 'credit_note')),
  
  -- Datos del cliente
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  customer_address TEXT,
  customer_tax_id VARCHAR(50), -- NIF/CIF para empresas
  
  -- Importes (en céntimos)
  subtotal INTEGER NOT NULL,
  tax_amount INTEGER NOT NULL DEFAULT 0,
  discount_amount INTEGER NOT NULL DEFAULT 0,
  shipping_amount INTEGER NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL, -- Negativo para abonos
  
  -- IVA
  tax_rate DECIMAL(5,2) DEFAULT 21.00,
  
  -- Estado
  status VARCHAR(20) DEFAULT 'issued' CHECK (status IN ('draft', 'issued', 'paid', 'cancelled')),
  
  -- PDF
  pdf_url TEXT,
  pdf_generated_at TIMESTAMPTZ,
  
  -- Notas
  notes TEXT,
  
  -- Timestamps
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_type ON invoices(invoice_type);
CREATE INDEX IF NOT EXISTS idx_invoices_issued_at ON invoices(issued_at);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);

-- =====================================================
-- 2. TABLA: refunds (Reembolsos)
-- =====================================================
CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_number VARCHAR(50) UNIQUE NOT NULL,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  return_id UUID REFERENCES returns(id) ON DELETE SET NULL,
  
  -- Stripe
  stripe_refund_id VARCHAR(255),
  stripe_status VARCHAR(50),
  
  -- Importes (en céntimos)
  original_amount INTEGER NOT NULL,
  refunded_amount INTEGER NOT NULL,
  
  -- Razón
  reason VARCHAR(100),
  notes TEXT,
  
  -- Estado
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'succeeded', 'failed', 'cancelled'
  )),
  
  -- Quién procesó
  processed_by UUID REFERENCES admin_users(id),
  processed_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Añadir FK de invoice a refund
ALTER TABLE invoices ADD CONSTRAINT fk_invoices_refund 
  FOREIGN KEY (refund_id) REFERENCES refunds(id) ON DELETE SET NULL;

-- Índices
CREATE INDEX IF NOT EXISTS idx_refunds_order_id ON refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);
CREATE INDEX IF NOT EXISTS idx_refunds_stripe_id ON refunds(stripe_refund_id);

-- =====================================================
-- 3. SECUENCIAS para números de factura
-- =====================================================
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS refund_number_seq START 1;

-- =====================================================
-- 4. FUNCIÓN: Generar número de factura
-- =====================================================
CREATE OR REPLACE FUNCTION generate_invoice_number(p_type VARCHAR)
RETURNS VARCHAR
LANGUAGE plpgsql
AS $$
DECLARE
  v_prefix VARCHAR;
  v_year VARCHAR;
  v_number INTEGER;
BEGIN
  v_year := TO_CHAR(NOW(), 'YYYY');
  
  IF p_type = 'sale' THEN
    v_prefix := 'FAC';
  ELSE
    v_prefix := 'ABN'; -- Abono
  END IF;
  
  v_number := nextval('invoice_number_seq');
  
  RETURN v_prefix || '-' || v_year || '-' || LPAD(v_number::TEXT, 6, '0');
END;
$$;

-- =====================================================
-- 5. FUNCIÓN: Crear factura automática al pagar
-- =====================================================
CREATE OR REPLACE FUNCTION create_sale_invoice(p_order_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
  v_invoice_id UUID;
  v_invoice_number VARCHAR;
BEGIN
  -- Obtener datos del pedido
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido no encontrado';
  END IF;
  
  -- Verificar que no exista factura
  IF EXISTS (SELECT 1 FROM invoices WHERE order_id = p_order_id AND invoice_type = 'sale') THEN
    RAISE EXCEPTION 'Ya existe una factura para este pedido';
  END IF;
  
  -- Generar número
  v_invoice_number := generate_invoice_number('sale');
  
  -- Crear factura
  INSERT INTO invoices (
    invoice_number,
    order_id,
    invoice_type,
    customer_name,
    customer_email,
    customer_address,
    subtotal,
    tax_amount,
    discount_amount,
    shipping_amount,
    total_amount,
    status,
    issued_at
  ) VALUES (
    v_invoice_number,
    p_order_id,
    'sale',
    v_order.shipping_full_name,
    COALESCE(
      (SELECT email FROM auth.users WHERE id = v_order.user_id),
      'cliente@email.com'
    ),
    v_order.shipping_address_line1 || ', ' || v_order.shipping_city || ' ' || v_order.shipping_postal_code,
    (v_order.subtotal * 100)::INTEGER,
    (v_order.tax * 100)::INTEGER,
    (v_order.discount * 100)::INTEGER,
    (v_order.shipping_cost * 100)::INTEGER,
    (v_order.total * 100)::INTEGER,
    'issued',
    NOW()
  )
  RETURNING id INTO v_invoice_id;
  
  RETURN v_invoice_id;
END;
$$;

-- =====================================================
-- 6. FUNCIÓN: Crear factura de abono
-- =====================================================
CREATE OR REPLACE FUNCTION create_credit_note(
  p_order_id UUID,
  p_refund_id UUID,
  p_amount INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
  v_invoice_id UUID;
  v_invoice_number VARCHAR;
BEGIN
  -- Obtener datos del pedido
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido no encontrado';
  END IF;
  
  -- Generar número de abono
  v_invoice_number := generate_invoice_number('credit_note');
  
  -- Crear factura de abono (importe negativo)
  INSERT INTO invoices (
    invoice_number,
    order_id,
    refund_id,
    invoice_type,
    customer_name,
    customer_email,
    customer_address,
    subtotal,
    tax_amount,
    total_amount,
    status,
    issued_at,
    notes
  ) VALUES (
    v_invoice_number,
    p_order_id,
    p_refund_id,
    'credit_note',
    v_order.shipping_full_name,
    COALESCE(
      (SELECT email FROM auth.users WHERE id = v_order.user_id),
      'cliente@email.com'
    ),
    v_order.shipping_address_line1 || ', ' || v_order.shipping_city,
    -p_amount, -- Negativo
    0,
    -p_amount, -- Negativo
    'issued',
    NOW(),
    'Abono por devolución del pedido ' || v_order.order_number
  )
  RETURNING id INTO v_invoice_id;
  
  RETURN v_invoice_id;
END;
$$;

-- =====================================================
-- 7. FUNCIÓN: Cuadre de caja diario
-- =====================================================
CREATE OR REPLACE FUNCTION get_daily_cash_summary(p_date DATE DEFAULT CURRENT_DATE)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sales INTEGER;
  v_refunds INTEGER;
  v_net INTEGER;
  v_invoice_count INTEGER;
  v_credit_note_count INTEGER;
BEGIN
  -- Total ventas del día
  SELECT COALESCE(SUM(total_amount), 0), COUNT(*)
  INTO v_sales, v_invoice_count
  FROM invoices
  WHERE invoice_type = 'sale'
    AND DATE(issued_at) = p_date
    AND status != 'cancelled';
  
  -- Total abonos del día
  SELECT COALESCE(SUM(ABS(total_amount)), 0), COUNT(*)
  INTO v_refunds, v_credit_note_count
  FROM invoices
  WHERE invoice_type = 'credit_note'
    AND DATE(issued_at) = p_date
    AND status != 'cancelled';
  
  v_net := v_sales - v_refunds;
  
  RETURN json_build_object(
    'date', p_date,
    'total_sales', v_sales,
    'total_refunds', v_refunds,
    'net_amount', v_net,
    'invoice_count', v_invoice_count,
    'credit_note_count', v_credit_note_count
  );
END;
$$;

-- =====================================================
-- 8. FUNCIÓN: Resumen mensual para contabilidad
-- =====================================================
CREATE OR REPLACE FUNCTION get_monthly_summary(
  p_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  p_month INTEGER DEFAULT EXTRACT(MONTH FROM CURRENT_DATE)
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'year', p_year,
    'month', p_month,
    'total_sales', COALESCE(SUM(CASE WHEN invoice_type = 'sale' THEN total_amount ELSE 0 END), 0),
    'total_refunds', COALESCE(SUM(CASE WHEN invoice_type = 'credit_note' THEN ABS(total_amount) ELSE 0 END), 0),
    'net_revenue', COALESCE(SUM(total_amount), 0),
    'total_tax', COALESCE(SUM(CASE WHEN invoice_type = 'sale' THEN tax_amount ELSE 0 END), 0),
    'invoice_count', COUNT(*) FILTER (WHERE invoice_type = 'sale'),
    'credit_note_count', COUNT(*) FILTER (WHERE invoice_type = 'credit_note'),
    'average_order_value', COALESCE(AVG(total_amount) FILTER (WHERE invoice_type = 'sale'), 0)
  )
  INTO v_result
  FROM invoices
  WHERE EXTRACT(YEAR FROM issued_at) = p_year
    AND EXTRACT(MONTH FROM issued_at) = p_month
    AND status != 'cancelled';
  
  RETURN v_result;
END;
$$;

-- =====================================================
-- 9. RLS Policies
-- =====================================================
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

-- Invoices: Lectura pública de las propias
CREATE POLICY invoices_user_select ON invoices FOR SELECT
  USING (
    order_id IN (SELECT id FROM orders WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

-- Invoices: Solo admin puede insertar/actualizar
CREATE POLICY invoices_admin_insert ON invoices FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

CREATE POLICY invoices_admin_update ON invoices FOR UPDATE
  USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

-- Refunds: Similar
CREATE POLICY refunds_user_select ON refunds FOR SELECT
  USING (
    order_id IN (SELECT id FROM orders WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

CREATE POLICY refunds_admin_all ON refunds FOR ALL
  USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

-- =====================================================
-- 10. Trigger: Crear factura automática al pagar
-- =====================================================
CREATE OR REPLACE FUNCTION trigger_create_invoice_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  -- Si el pago cambió a 'paid'
  IF NEW.payment_status = 'paid' AND (OLD.payment_status IS NULL OR OLD.payment_status != 'paid') THEN
    PERFORM create_sale_invoice(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Primero eliminar si existe
DROP TRIGGER IF EXISTS orders_create_invoice ON orders;

CREATE TRIGGER orders_create_invoice
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_create_invoice_on_payment();

COMMIT;
