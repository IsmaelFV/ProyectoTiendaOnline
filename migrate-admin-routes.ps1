# ============================================================================
# Script de Actualización Automática - Admin a Internal-Admin
# ============================================================================
# Este script actualiza TODAS las referencias de /admin a /internal-admin
# ============================================================================

Write-Host "🔄 Iniciando migración de rutas /admin a /internal-admin..." -ForegroundColor Cyan
Write-Host ""

# Ruta base del proyecto
$projectPath = "c:\Users\ismae\Documents\ProyectoTiendaOnline"

# 1. Crear backup
Write-Host "📦 Creando backup del directorio src..." -ForegroundColor Yellow
$backupPath = "$projectPath\src.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item -Path "$projectPath\src" -Destination $backupPath -Recurse -Force
Write-Host "✅ Backup creado en: $backupPath" -ForegroundColor Green
Write-Host ""

# 2. Actualizar archivos .astro, .ts, .tsx
Write-Host "🔧 Actualizando referencias en archivos..." -ForegroundColor Yellow

$patterns = @(
    @{ Old = '"/admin/'; New = '"/internal-admin/' },
    @{ Old = "'/admin/"; New = "'/internal-admin/" },
    @{ Old = '`/admin/'; New = '`/internal-admin/' },
    @{ Old = 'href="/admin"'; New = 'href="/internal-admin"' },
    @{ Old = "href='/admin'"; New = "href='/internal-admin'" }
)

$files = Get-ChildItem -Path "$projectPath\src" -Recurse -Include *.astro,*.ts,*.tsx
$totalFiles = $files.Count
$updatedFiles = 0

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $originalContent = $content
    
    foreach ($pattern in $patterns) {
        $content = $content -replace [regex]::Escape($pattern.Old), $pattern.New
    }
    
    if ($content -ne $originalContent) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        $updatedFiles++
        Write-Host "  ✓ $($file.Name)" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "✅ Archivos actualizados: $updatedFiles de $totalFiles" -ForegroundColor Green
Write-Host ""

# 3. Crear robots.txt si no existe
Write-Host "📄 Verificando robots.txt..." -ForegroundColor Yellow
$robotsPath = "$projectPath\public\robots.txt"

if (-Not (Test-Path $robotsPath)) {
    $robotsContent = @"
# FashionMarket - Robots.txt
User-agent: *
Disallow: /internal-admin/
Disallow: /api/

# Permitir todo lo demás
Allow: /
Allow: /productos/
Allow: /categoria/

# Sitemap (agregar cuando esté disponible)
# Sitemap: https://tudominio.com/sitemap.xml
"@
    
    Set-Content -Path $robotsPath -Value $robotsContent
    Write-Host "✅ robots.txt creado" -ForegroundColor Green
} else {
    Write-Host "⚠️  robots.txt ya existe, verificar manualmente" -ForegroundColor Yellow
}
Write-Host ""

# 4. Actualizar README.md
Write-Host "📝 Actualizando README.md..." -ForegroundColor Yellow
$readmePath = "$projectPath\README.md"

if (Test-Path $readmePath) {
    $readme = Get-Content $readmePath -Raw
    $readme = $readme -replace '/admin/', '/internal-admin/'
    $readme = $readme -replace 'localhost:4321/admin', 'localhost:4321/internal-admin'
    Set-Content -Path $readmePath -Value $readme -NoNewline
    Write-Host "✅ README.md actualizado" -ForegroundColor Green
} else {
    Write-Host "⚠️  README.md no encontrado" -ForegroundColor Yellow
}
Write-Host ""

# 5. Resumen
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "✅ MIGRACIÓN COMPLETADA" -ForegroundColor Green
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📊 Resumen:" -ForegroundColor White
Write-Host "  - Archivos actualizados: $updatedFiles" -ForegroundColor White
Write-Host "  - Backup creado en: $backupPath" -ForegroundColor White
Write-Host "  - robots.txt: $(if (Test-Path $robotsPath) { 'OK' } else { 'Creado' })" -ForegroundColor White
Write-Host ""
Write-Host "🧪 Próximos pasos:" -ForegroundColor Yellow
Write-Host "  1. Ejecutar: npm run dev" -ForegroundColor White
Write-Host "  2. Probar: http://localhost:4321/internal-admin/login" -ForegroundColor White
Write-Host "  3. Verificar que /admin devuelve 404" -ForegroundColor White
Write-Host "  4. Crear usuario admin en Supabase y agregar a admin_users" -ForegroundColor White
Write-Host ""
Write-Host "📚 Documentación:" -ForegroundColor Yellow
Write-Host "  - ARQUITECTURA_SEGURIDAD_TOTAL.md" -ForegroundColor White
Write-Host "  - MIGRACION_SEGURIDAD.md" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  Si algo falla, restaurar desde: $backupPath" -ForegroundColor Yellow
Write-Host ""
