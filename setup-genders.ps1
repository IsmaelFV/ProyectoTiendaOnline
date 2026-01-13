# Script para ejecutar migración de genders
# Este script crea la tabla genders necesaria para /mujer y /hombre

Write-Host "🔄 Ejecutando migración de genders..." -ForegroundColor Cyan

# Verificar que existe el archivo de migración
if (-Not (Test-Path "supabase-migration-search.sql")) {
    Write-Host "❌ No se encontró el archivo supabase-migration-search.sql" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📋 Instrucciones:" -ForegroundColor Yellow
Write-Host "1. Abre Supabase Dashboard en tu navegador" -ForegroundColor White
Write-Host "2. Ve a: SQL Editor" -ForegroundColor White
Write-Host "3. Copia el contenido de 'supabase-migration-search.sql'" -ForegroundColor White
Write-Host "4. Pégalo en el editor y presiona 'Run'" -ForegroundColor White
Write-Host ""
Write-Host "O ejecuta solo esta parte para crear genders:" -ForegroundColor Yellow
Write-Host ""
Write-Host "-- Crear tabla genders" -ForegroundColor Green
Write-Host "CREATE TABLE IF NOT EXISTS genders (" -ForegroundColor Gray
Write-Host "  id UUID PRIMARY KEY DEFAULT uuid_generate_v4()," -ForegroundColor Gray
Write-Host "  name TEXT NOT NULL UNIQUE," -ForegroundColor Gray
Write-Host "  slug TEXT NOT NULL UNIQUE," -ForegroundColor Gray
Write-Host "  display_order INTEGER DEFAULT 0," -ForegroundColor Gray
Write-Host "  is_active BOOLEAN DEFAULT true," -ForegroundColor Gray
Write-Host "  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()" -ForegroundColor Gray
Write-Host ");" -ForegroundColor Gray
Write-Host "" -ForegroundColor Gray
Write-Host "-- Insertar datos" -ForegroundColor Green
Write-Host "INSERT INTO genders (name, slug, display_order) VALUES" -ForegroundColor Gray
Write-Host "  ('Mujer', 'mujer', 1)," -ForegroundColor Gray
Write-Host "  ('Hombre', 'hombre', 2)," -ForegroundColor Gray
Write-Host "  ('Unisex', 'unisex', 3)" -ForegroundColor Gray
Write-Host "ON CONFLICT (slug) DO NOTHING;" -ForegroundColor Gray
Write-Host ""

# Copiar el SQL al portapapeles si está disponible
$sqlContent = @"
-- Crear tabla genders
CREATE TABLE IF NOT EXISTS genders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_genders_slug ON genders(slug);
CREATE INDEX IF NOT EXISTS idx_genders_active ON genders(is_active);

-- Insertar datos
INSERT INTO genders (name, slug, display_order) VALUES
  ('Mujer', 'mujer', 1),
  ('Hombre', 'hombre', 2),
  ('Unisex', 'unisex', 3)
ON CONFLICT (slug) DO NOTHING;

-- Habilitar RLS
ALTER TABLE genders ENABLE ROW LEVEL SECURITY;

-- Política: todos pueden leer
CREATE POLICY "Public can view genders"
  ON genders FOR SELECT
  TO anon, authenticated
  USING (true);

-- Política: service role puede gestionar
CREATE POLICY "Service role can manage genders"
  ON genders FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
"@

try {
    Set-Clipboard -Value $sqlContent
    Write-Host "✅ SQL copiado al portapapeles!" -ForegroundColor Green
    Write-Host "   Presiona Ctrl+V en Supabase SQL Editor" -ForegroundColor White
} catch {
    Write-Host "⚠️  No se pudo copiar al portapapeles automáticamente" -ForegroundColor Yellow
    Write-Host "   Copia manualmente el SQL de arriba" -ForegroundColor White
}

Write-Host ""
Write-Host "🔗 Enlace directo: https://supabase.com/dashboard/project/_/sql" -ForegroundColor Cyan
Write-Host ""
