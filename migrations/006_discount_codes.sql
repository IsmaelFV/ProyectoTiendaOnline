-- =====================================================
-- Migración 006: Sistema de Códigos de Descuento
-- =====================================================
-- Tabla para gestionar códigos promocionales
-- Función para validar y aplicar descuentos
-- =====================================================

BEGIN;

-- =====================================================
-- 1. Crear tabla discount_codes
-- =====================================================
CREATE TABLE IF NOT EXISTS discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value DECIMAL(10, 2) NOT NULL CHECK (discount_value > 0),
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  max_uses INTEGER CHECK (max_uses > 0),
  uses_count INTEGER NOT NULL DEFAULT 0,
  min_purchase_amount DECIMAL(10, 2) DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON discount_codes(code);
CREATE INDEX IF NOT EXISTS idx_discount_codes_active ON discount_codes(is_active) WHERE is_active = true;

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_discount_codes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER discount_codes_updated_at
  BEFORE UPDATE ON discount_codes
  FOR EACH ROW
  EXECUTE FUNCTION update_discount_codes_updated_at();

-- =====================================================
-- 2. Función de validación de código de descuento
-- =====================================================
CREATE OR REPLACE FUNCTION validate_discount_code(
  p_code TEXT,
  p_cart_total DECIMAL,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_discount RECORD;
  v_discount_amount DECIMAL;
  v_final_total DECIMAL;
BEGIN
  -- Buscar el código (case insensitive)
  SELECT * INTO v_discount
  FROM discount_codes
  WHERE UPPER(code) = UPPER(p_code)
  AND is_active = true;

  -- 1. Verificar que el código existe
  IF NOT FOUND THEN
    RETURN json_build_object(
      'valid', false,
      'message', 'Código de descuento no válido'
    );
  END IF;

  -- 2. Verificar que el código está dentro del periodo de validez
  IF v_discount.valid_from > NOW() THEN
    RETURN json_build_object(
      'valid', false,
      'message', 'Este código aún no está disponible'
    );
  END IF;

  IF v_discount.valid_until IS NOT NULL AND v_discount.valid_until < NOW() THEN
    RETURN json_build_object(
      'valid', false,
      'message', 'Este código ha expirado'
    );
  END IF;

  -- 3. Verificar límite de usos
  IF v_discount.max_uses IS NOT NULL AND v_discount.uses_count >= v_discount.max_uses THEN
    RETURN json_build_object(
      'valid', false,
      'message', 'Este código ha alcanzado el límite de usos'
    );
  END IF;

  -- 4. Verificar mínimo de compra
  IF p_cart_total < v_discount.min_purchase_amount THEN
    RETURN json_build_object(
      'valid', false,
      'message', format('Compra mínima de %s€ requerida para este código', v_discount.min_purchase_amount)
    );
  END IF;

  -- 5. Calcular descuento
  IF v_discount.discount_type = 'percentage' THEN
    v_discount_amount := ROUND((p_cart_total * v_discount.discount_value / 100), 2);
  ELSE -- 'fixed'
    v_discount_amount := v_discount.discount_value;
  END IF;

  -- Asegurar que el descuento no sea mayor al total
  IF v_discount_amount > p_cart_total THEN
    v_discount_amount := p_cart_total;
  END IF;

  v_final_total := p_cart_total - v_discount_amount;

  -- 6. Retornar éxito con detalles
  RETURN json_build_object(
    'valid', true,
    'code', v_discount.code,
    'discount_type', v_discount.discount_type,
    'discount_value', v_discount.discount_value,
    'discount_amount', v_discount_amount,
    'original_total', p_cart_total,
    'final_total', v_final_total,
    'message', format('Código aplicado: -%s€', v_discount_amount)
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'valid', false,
      'message', 'Error al validar código de descuento'
    );
END;
$$;

COMMENT ON FUNCTION validate_discount_code IS 
'Valida un código de descuento y calcula el monto a descontar. No incrementa uses_count (eso se hace al confirmar pago).';

-- =====================================================
-- 3. Función para incrementar contador de usos
-- =====================================================
CREATE OR REPLACE FUNCTION increment_discount_usage(p_code TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE discount_codes
  SET uses_count = uses_count + 1
  WHERE UPPER(code) = UPPER(p_code)
  AND is_active = true;
END;
$$;

COMMENT ON FUNCTION increment_discount_usage IS 
'Incrementa el contador de usos de un código de descuento. Llamar solo después de pago confirmado.';

-- =====================================================
-- 4. Permisos RLS
-- =====================================================
-- Habilitar RLS en la tabla
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;

-- Política: Todos pueden leer códigos activos (para validación)
CREATE POLICY "Anyone can view active discount codes"
  ON discount_codes FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Política: Solo service_role puede modificar
CREATE POLICY "Service role can manage discount codes"
  ON discount_codes FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Permisos para funciones
GRANT EXECUTE ON FUNCTION validate_discount_code TO anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_discount_usage TO service_role;

-- =====================================================
-- 5. Insertar códigos de ejemplo (opcional)
-- =====================================================
INSERT INTO discount_codes (code, description, discount_type, discount_value, max_uses, min_purchase_amount)
VALUES 
  ('BIENVENIDA10', 'Descuento de bienvenida', 'percentage', 10, 100, 20),
  ('PRIMERACOMPRA', 'Primera compra', 'fixed', 5, NULL, 30),
  ('VERANO2026', 'Promoción de verano', 'percentage', 15, 500, 50)
ON CONFLICT (code) DO NOTHING;

COMMIT;

-- =====================================================
-- Notas:
-- - Los códigos son case-insensitive
-- - validate_discount_code NO incrementa uses_count (solo valida)
-- - increment_discount_usage se llama desde el webhook tras pago exitoso
-- - Los códigos expiran automáticamente por fecha
-- - RLS permite que cualquiera valide códigos pero solo admins los gestionan
-- =====================================================
