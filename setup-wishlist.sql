-- ============================================================================
-- FashionMarket - Wishlist / Lista de Deseados
-- ============================================================================
-- FECHA: 12 de febrero de 2026
-- PROPÓSITO: Permitir a cada usuario guardar productos como favoritos.
--            Cada lista es PRIVADA (solo el dueño puede ver/modificar la suya).
-- ============================================================================

-- ============================================================================
-- TABLA: wishlist_items
-- Relación usuario ↔ producto (many-to-many)
-- ============================================================================
CREATE TABLE IF NOT EXISTS wishlist_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Un usuario no puede añadir el mismo producto dos veces
  UNIQUE(user_id, product_id)
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_wishlist_user ON wishlist_items(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_product ON wishlist_items(product_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_created ON wishlist_items(created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- Cada usuario SOLO puede ver y gestionar SUS propios favoritos
-- ============================================================================
ALTER TABLE wishlist_items ENABLE ROW LEVEL SECURITY;

-- Los usuarios autenticados pueden ver SOLO sus favoritos
CREATE POLICY "Users can view own wishlist"
  ON wishlist_items
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Los usuarios autenticados pueden añadir a SUS favoritos
CREATE POLICY "Users can add to own wishlist"
  ON wishlist_items
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Los usuarios autenticados pueden eliminar de SUS favoritos
CREATE POLICY "Users can remove from own wishlist"
  ON wishlist_items
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Acceso total para service_role (panel admin)
CREATE POLICY "Service role full access to wishlist"
  ON wishlist_items
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE wishlist_items IS 'Lista de deseos/favoritos de cada usuario. Privada: cada usuario solo ve la suya.';
