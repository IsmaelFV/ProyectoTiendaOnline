# ============================================================================
# Script de Actualizacion Automatica - Admin a Internal-Admin
# ============================================================================

Write-Host "[INFO] Iniciando migracion de rutas /admin a /internal-admin..." -ForegroundColor Cyan

$projectPath = "c:\Users\ismae\Documents\ProyectoTiendaOnline"

# 1. Crear backup
Write-Host "[BACKUP] Creando backup del directorio src..." -ForegroundColor Yellow
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupPath = "$projectPath\src.backup-$timestamp"
Copy-Item -Path "$projectPath\src" -Destination $backupPath -Recurse -Force
Write-Host "[OK] Backup creado en: $backupPath" -ForegroundColor Green

# 2. Actualizar archivos
Write-Host "[UPDATE] Actualizando referencias en archivos..." -ForegroundColor Yellow

$files = Get-ChildItem -Path "$projectPath\src" -Recurse -Include *.astro,*.ts,*.tsx
$updatedFiles = 0

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $originalContent = $content
    
    $content = $content -replace '"/admin/', '"/internal-admin/'
    $content = $content -replace "''/admin/", "''/internal-admin/"
    $content = $content -replace 'href="/admin"', 'href="/internal-admin"'
    
    if ($content -ne $originalContent) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        $updatedFiles++
        Write-Host "[OK] $($file.Name)" -ForegroundColor Green
    }
}

Write-Host "[RESULT] Archivos actualizados: $updatedFiles" -ForegroundColor Green

# 3. Crear robots.txt
Write-Host "[ROBOTS] Verificando robots.txt..." -ForegroundColor Yellow
$robotsPath = "$projectPath\public\robots.txt"

if (-Not (Test-Path $robotsPath)) {
    $robotsContent = "User-agent: *`r`nDisallow: /internal-admin/`r`nDisallow: /api/`r`n`r`nAllow: /`r`nAllow: /productos/`r`nAllow: /categoria/"
    Set-Content -Path $robotsPath -Value $robotsContent
    Write-Host "[OK] robots.txt creado" -ForegroundColor Green
} else {
    Write-Host "[SKIP] robots.txt ya existe" -ForegroundColor Yellow
}

# 4. Actualizar README
Write-Host "[README] Actualizando README.md..." -ForegroundColor Yellow
$readmePath = "$projectPath\README.md"

if (Test-Path $readmePath) {
    $readme = Get-Content $readmePath -Raw
    $readme = $readme -replace '/admin/', '/internal-admin/'
    Set-Content -Path $readmePath -Value $readme -NoNewline
    Write-Host "[OK] README.md actualizado" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " MIGRACION COMPLETADA" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Archivos actualizados: $updatedFiles" -ForegroundColor White
Write-Host "Backup: $backupPath" -ForegroundColor White
Write-Host ""
Write-Host "Proximos pasos:" -ForegroundColor Yellow
Write-Host "1. npm run dev" -ForegroundColor White
Write-Host "2. Probar: http://localhost:4321/internal-admin/login" -ForegroundColor White
