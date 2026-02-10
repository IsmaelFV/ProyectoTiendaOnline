-- =====================================================
-- MIGRACIÓN 009: Configuración del Sitio
-- Tabla para almacenar configuraciones del sistema
-- =====================================================

-- Tabla de configuraciones
CREATE TABLE IF NOT EXISTS site_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key VARCHAR(100) NOT NULL UNIQUE,
  value TEXT,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice principal
CREATE INDEX IF NOT EXISTS idx_site_settings_key ON site_settings(key);

-- RLS
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- Los admins pueden gestionar todas las configuraciones
CREATE POLICY "Admins can manage site settings"
  ON site_settings
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT user_id FROM admin_users
    )
  );

-- Lectura pública de ciertas configuraciones
CREATE POLICY "Public can read public settings"
  ON site_settings
  FOR SELECT
  USING (
    key IN ('flash_offers_enabled', 'maintenance_mode', 'promo_banner_text', 'store_name')
  );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_site_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS site_settings_updated_at ON site_settings;
CREATE TRIGGER site_settings_updated_at
  BEFORE UPDATE ON site_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_site_settings_timestamp();

-- Insertar configuraciones iniciales
INSERT INTO site_settings (key, value, description) VALUES
  ('flash_offers_enabled', 'true', 'Habilitar/deshabilitar ofertas flash globalmente'),
  ('store_name', 'FashionStore', 'Nombre de la tienda'),
  ('maintenance_mode', 'false', 'Modo mantenimiento del sitio'),
  ('promo_banner_text', '', 'Texto del banner promocional en el header'),
  ('shipping_free_threshold', '50', 'Umbral para envío gratis (€)'),
  ('newsletter_promo_code', 'BIENVENIDO10', 'Código promocional para newsletter'),
  ('newsletter_discount', '10', 'Porcentaje de descuento newsletter')
ON CONFLICT (key) DO NOTHING;

-- Comentarios
COMMENT ON TABLE site_settings IS 'Configuraciones globales del sitio';
COMMENT ON COLUMN site_settings.key IS 'Clave única de la configuración';
COMMENT ON COLUMN site_settings.value IS 'Valor de la configuración (texto)';
