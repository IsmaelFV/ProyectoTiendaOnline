-- FashionMarket Database Schema
-- Execute this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Categories Table
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products Table
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  price INTEGER NOT NULL CHECK (price >= 0), -- Price in cents
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  images TEXT[] DEFAULT '{}', -- Array of image URLs from Supabase Storage
  sizes TEXT[] DEFAULT '{}', -- Available sizes: S, M, L, XL, XXL
  featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_featured ON products(featured);
CREATE INDEX idx_categories_slug ON categories(slug);

-- Row Level Security (RLS) Policies

-- Enable RLS on both tables
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Public read access for categories
CREATE POLICY "Public can view categories"
  ON categories FOR SELECT
  TO anon, authenticated
  USING (true);

-- Public read access for products
CREATE POLICY "Public can view products"
  ON products FOR SELECT
  TO anon, authenticated
  USING (true);

-- Admin/Service role can do everything on categories
CREATE POLICY "Service role can manage categories"
  ON categories FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Admin/Service role can do everything on products
CREATE POLICY "Service role can manage products"
  ON products FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users (admins) can manage categories
CREATE POLICY "Authenticated users can manage categories"
  ON categories FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Authenticated users (admins) can manage products
CREATE POLICY "Authenticated users can manage products"
  ON products FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-update updated_at
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert sample categories
INSERT INTO categories (name, slug, description) VALUES
  ('Camisas', 'camisas', 'Camisas elegantes para cualquier ocasión'),
  ('Pantalones', 'pantalones', 'Pantalones de corte perfecto'),
  ('Trajes', 'trajes', 'Trajes a medida y confeccionados');

-- Insert sample products (optional - for testing)
INSERT INTO products (name, slug, description, price, stock, category_id, sizes, featured) VALUES
  (
    'Camisa Oxford Blanca',
    'camisa-oxford-blanca',
    'Camisa Oxford de algodón 100% egipcio. Corte slim fit con cuello abotonado.',
    8900, -- €89.00
    25,
    (SELECT id FROM categories WHERE slug = 'camisas'),
    ARRAY['S', 'M', 'L', 'XL', 'XXL'],
    true
  ),
  (
    'Pantalón Chino Azul Marino',
    'pantalon-chino-azul-marino',
    'Pantalón chino de algodón premium con acabado satinado. Corte regular.',
    7900, -- €79.00
    30,
    (SELECT id FROM categories WHERE slug = 'pantalones'),
    ARRAY['30', '32', '34', '36', '38'],
    true
  ),
  (
    'Traje Dos Piezas Gris Carbón',
    'traje-dos-piezas-gris-carbon',
    'Traje de lana virgen italiana. Incluye chaqueta y pantalón. Corte moderno.',
    49900, -- €499.00
    10,
    (SELECT id FROM categories WHERE slug = 'trajes'),
    ARRAY['46', '48', '50', '52', '54'],
    true
  );
