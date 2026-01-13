# Script de diagnostico de base de datos

Write-Host ""
Write-Host "DIAGNOSTICO DE BASE DE DATOS" -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan
Write-Host ""

Write-Host "PASO 1: Verificar base de datos" -ForegroundColor Yellow
Write-Host ""
Write-Host "Ve a: https://supabase.com/dashboard/project/qquzifirnqodldyhbelv/editor" -ForegroundColor White
Write-Host ""

Write-Host "PASO 2: Ejecuta el archivo diagnostico-productos.sql" -ForegroundColor Yellow
Write-Host "   Abrelo, copia su contenido y ejecutalo en el SQL Editor" -ForegroundColor White
Write-Host ""

Write-Host "---------------------------------------------------" -ForegroundColor Gray
Write-Host ""

Write-Host "RESULTADO ESPERADO:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Deberias ver estas tablas:" -ForegroundColor White
Write-Host "  - categories" -ForegroundColor Green
Write-Host "  - colors" -ForegroundColor Green
Write-Host "  - genders" -ForegroundColor Green
Write-Host "  - product_categories" -ForegroundColor Green
Write-Host "  - products" -ForegroundColor Green
Write-Host ""
Write-Host "Y el total_productos deberia ser mayor a 0" -ForegroundColor Green
Write-Host ""

Write-Host "---------------------------------------------------" -ForegroundColor Gray
Write-Host ""

Write-Host "SI FALTAN TABLAS:" -ForegroundColor Red
Write-Host ""
Write-Host "1. Ejecuta primero: supabase-migration-search.sql" -ForegroundColor Yellow
Write-Host "   (Crea las tablas necesarias)" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Luego ejecuta: productos-prueba.sql" -ForegroundColor Yellow
Write-Host "   (Inserta 8 productos de prueba)" -ForegroundColor Gray
Write-Host ""

Write-Host "---------------------------------------------------" -ForegroundColor Gray
Write-Host ""

Write-Host "ARCHIVOS SQL EN TU PROYECTO:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  1. diagnostico-productos.sql     - Script de diagnostico completo" -ForegroundColor White
Write-Host "  2. supabase-migration-search.sql - Migracion de tablas (PRIMERO)" -ForegroundColor White
Write-Host "  3. productos-prueba.sql          - Insertar productos (SEGUNDO)" -ForegroundColor White
Write-Host ""

Write-Host "Presiona Enter para continuar..." -ForegroundColor Gray
Read-Host
