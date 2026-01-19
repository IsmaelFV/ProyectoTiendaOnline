# =====================================================
# Script para aplicar migraciones de pedidos
# =====================================================
# Aplica las migraciones en el orden correcto
# Requiere que las variables SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
# estén en el archivo .env
# =====================================================

Write-Host "🔧 Aplicando migraciones de pedidos..." -ForegroundColor Cyan
Write-Host ""

# Cargar variables de entorno
if (Test-Path .env) {
    Get-Content .env | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim().Trim('"')
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
    Write-Host "✅ Variables de entorno cargadas" -ForegroundColor Green
} else {
    Write-Host "❌ No se encontró el archivo .env" -ForegroundColor Red
    exit 1
}

$SUPABASE_URL = $env:PUBLIC_SUPABASE_URL
$SERVICE_KEY = $env:SUPABASE_SERVICE_ROLE_KEY

if (-not $SUPABASE_URL -or -not $SERVICE_KEY) {
    Write-Host "❌ Faltan variables: PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY" -ForegroundColor Red
    exit 1
}

# Función para ejecutar SQL
function Invoke-SupabaseSQL {
    param(
        [string]$FilePath,
        [string]$Description
    )
    
    Write-Host ""
    Write-Host "📄 $Description" -ForegroundColor Yellow
    Write-Host "   Archivo: $FilePath" -ForegroundColor Gray
    
    if (-not (Test-Path $FilePath)) {
        Write-Host "   ❌ Archivo no encontrado" -ForegroundColor Red
        return $false
    }
    
    $sqlContent = Get-Content $FilePath -Raw
    
    # Hacer la petición a Supabase
    $apiUrl = "$SUPABASE_URL/rest/v1/rpc/exec_sql"
    
    try {
        $body = @{
            sql = $sqlContent
        } | ConvertTo-Json
        
        $response = Invoke-RestMethod -Uri $apiUrl `
            -Method Post `
            -Headers @{
                "apikey" = $SERVICE_KEY
                "Authorization" = "Bearer $SERVICE_KEY"
                "Content-Type" = "application/json"
            } `
            -Body $body
        
        Write-Host "   ✅ Migración aplicada exitosamente" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "   ❌ Error al aplicar migración:" -ForegroundColor Red
        Write-Host "   $($_.Exception.Message)" -ForegroundColor Red
        
        # Mostrar instrucciones manuales
        Write-Host ""
        Write-Host "   📋 APLICAR MANUALMENTE:" -ForegroundColor Yellow
        Write-Host "   1. Abre Supabase Dashboard > SQL Editor" -ForegroundColor Gray
        Write-Host "   2. Copia y pega el contenido de: $FilePath" -ForegroundColor Gray
        Write-Host "   3. Ejecuta la query" -ForegroundColor Gray
        Write-Host ""
        
        return $false
    }
}

# =====================================================
# Aplicar migraciones en orden
# =====================================================

Write-Host ""
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  ORDEN DE APLICACIÓN DE MIGRACIONES" -ForegroundColor White
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan

$migrations = @(
    @{
        File = "migrations/003_user_orders_policies.sql"
        Description = "Políticas RLS - Permitir ver pedidos propios"
        Priority = "CRÍTICO"
    },
    @{
        File = "migrations/004_fix_order_states.sql"
        Description = "Agregar estado 'confirmed' al schema"
        Priority = "REQUERIDO"
    },
    @{
        File = "migrations/005_cancel_order_function.sql"
        Description = "Función de cancelación atómica"
        Priority = "REQUERIDO"
    }
)

$success = $true

foreach ($migration in $migrations) {
    Write-Host ""
    Write-Host "⚠️  PRIORIDAD: $($migration.Priority)" -ForegroundColor $(if ($migration.Priority -eq "CRÍTICO") { "Red" } else { "Yellow" })
    
    $result = Invoke-SupabaseSQL -FilePath $migration.File -Description $migration.Description
    
    if (-not $result) {
        $success = $false
    }
    
    Start-Sleep -Seconds 1
}

# =====================================================
# Resumen final
# =====================================================

Write-Host ""
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan

if ($success) {
    Write-Host "✅ TODAS LAS MIGRACIONES APLICADAS" -ForegroundColor Green
    Write-Host ""
    Write-Host "🎯 Próximos pasos:" -ForegroundColor Yellow
    Write-Host "   1. Reinicia el servidor dev si está corriendo" -ForegroundColor Gray
    Write-Host "   2. Ve a /perfil/mis-pedidos" -ForegroundColor Gray
    Write-Host "   3. Deberías ver tus pedidos listados" -ForegroundColor Gray
    Write-Host "   4. Los pedidos 'Confirmados' tendrán botón 'Cancelar pedido'" -ForegroundColor Gray
} else {
    Write-Host "⚠️  ALGUNAS MIGRACIONES FALLARON" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "📋 APLICAR MANUALMENTE en Supabase SQL Editor:" -ForegroundColor Yellow
    foreach ($migration in $migrations) {
        Write-Host "   - $($migration.File)" -ForegroundColor Gray
    }
}

Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
