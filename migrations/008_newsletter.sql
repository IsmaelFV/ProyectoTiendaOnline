-- =====================================================
-- MIGRACIÓN 008: Newsletter Subscribers
-- Sistema de suscripciones a newsletter
-- =====================================================

-- Tabla de suscriptores
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed', 'bounced')),
  source VARCHAR(50) DEFAULT 'popup', -- popup, footer, checkout, manual
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ,
  resubscribed_at TIMESTAMPTZ,
  promo_code_used VARCHAR(50),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_newsletter_status ON newsletter_subscribers(status);
CREATE INDEX IF NOT EXISTS idx_newsletter_source ON newsletter_subscribers(source);
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribed_at ON newsletter_subscribers(subscribed_at);

-- RLS
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Solo admins pueden ver todos los suscriptores
CREATE POLICY "Admins can manage newsletter subscribers"
  ON newsletter_subscribers
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin'
    )
  );

-- La API puede insertar nuevos suscriptores (anon)
CREATE POLICY "Anyone can subscribe to newsletter"
  ON newsletter_subscribers
  FOR INSERT
  WITH CHECK (true);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_newsletter_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS newsletter_updated_at ON newsletter_subscribers;
CREATE TRIGGER newsletter_updated_at
  BEFORE UPDATE ON newsletter_subscribers
  FOR EACH ROW
  EXECUTE FUNCTION update_newsletter_timestamp();

-- Función para obtener estadísticas del newsletter
CREATE OR REPLACE FUNCTION get_newsletter_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_subscribers', COUNT(*),
    'active', COUNT(*) FILTER (WHERE status = 'active'),
    'unsubscribed', COUNT(*) FILTER (WHERE status = 'unsubscribed'),
    'bounced', COUNT(*) FILTER (WHERE status = 'bounced'),
    'this_week', COUNT(*) FILTER (WHERE subscribed_at >= NOW() - INTERVAL '7 days' AND status = 'active'),
    'this_month', COUNT(*) FILTER (WHERE subscribed_at >= NOW() - INTERVAL '30 days' AND status = 'active'),
    'by_source', (
      SELECT json_object_agg(source, count)
      FROM (
        SELECT source, COUNT(*) as count
        FROM newsletter_subscribers
        WHERE status = 'active'
        GROUP BY source
      ) sources
    )
  ) INTO result
  FROM newsletter_subscribers;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentarios
COMMENT ON TABLE newsletter_subscribers IS 'Suscriptores a la newsletter de la tienda';
COMMENT ON COLUMN newsletter_subscribers.source IS 'Origen de la suscripción: popup, footer, checkout, manual';
COMMENT ON COLUMN newsletter_subscribers.promo_code_used IS 'Código promocional usado al suscribirse';
