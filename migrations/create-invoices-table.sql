-- ============================================================================
-- Migración: Tabla de Facturas y Facturas de Abono (Rectificativas)
-- Fecha: 2026-02-22
-- Propósito: Persistir facturas de venta y facturas de abono para cuadrar caja
-- ============================================================================

-- 0. Limpiar tabla previa si existe (de 007_invoices_refunds u otra migración)
DROP TABLE IF EXISTS invoices CASCADE;

-- 1. Tabla de facturas
CREATE TABLE invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('sale', 'credit_note')),
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  return_id UUID,
  original_invoice_id UUID,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  subtotal INTEGER NOT NULL,
  shipping INTEGER NOT NULL DEFAULT 0,
  tax INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  reason TEXT,
  stripe_refund_id TEXT,
  pdf_generated BOOLEAN DEFAULT false,
  issued_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Índices
CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_return_id ON invoices(return_id);
CREATE INDEX IF NOT EXISTS idx_invoices_type ON invoices(type);
CREATE INDEX IF NOT EXISTS idx_invoices_issued_at ON invoices(issued_at);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);

-- 3. Función para generar números de factura secuenciales
CREATE OR REPLACE FUNCTION generate_invoice_number(invoice_type TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  prefix TEXT;
  year_str TEXT;
  next_num INTEGER;
  result TEXT;
BEGIN
  IF invoice_type = 'sale' THEN
    prefix := 'FAC';
  ELSIF invoice_type = 'credit_note' THEN
    prefix := 'AB';
  ELSE
    RAISE EXCEPTION 'Tipo de factura inválido: %', invoice_type;
  END IF;
  
  year_str := EXTRACT(YEAR FROM now())::TEXT;
  
  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(invoice_number, '-', 3) AS INTEGER)
  ), 0) + 1
  INTO next_num
  FROM invoices
  WHERE type = invoice_type
    AND invoice_number LIKE prefix || '-' || year_str || '-%';
  
  result := prefix || '-' || year_str || '-' || LPAD(next_num::TEXT, 6, '0');
  RETURN result;
END;
$$;

-- 4. RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_service_role_all" ON invoices
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "invoices_customer_select" ON invoices
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.id = invoices.order_id 
      AND orders.user_id = auth.uid()
    )
  );

COMMENT ON TABLE invoices IS 'Registro de facturas de venta y facturas de abono (rectificativas)';
COMMENT ON COLUMN invoices.type IS 'sale = factura venta, credit_note = factura abono/rectificativa';
COMMENT ON COLUMN invoices.total IS 'Importe total en céntimos. Positivo para ventas, NEGATIVO para abonos';
