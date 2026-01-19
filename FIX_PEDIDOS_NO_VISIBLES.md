# 🚨 FIX URGENTE: Pedidos No Visibles

## Problema
Los pedidos que hace el cliente no aparecen en `/perfil/mis-pedidos`

## Causa
Las políticas RLS (Row Level Security) están bloqueando el acceso. Solo el `service_role` puede leer pedidos, pero la página usa el `anon key` con el usuario autenticado.

---

## ⚡ Solución Rápida

### Opción 1: Script Automático (Recomendado)
```powershell
# Desde la raíz del proyecto:
.\aplicar-migraciones-pedidos.ps1
```

### Opción 2: Manual en Supabase

1. **Abre Supabase Dashboard** → SQL Editor
2. **Aplica EN ORDEN** los siguientes archivos:

#### ✅ Paso 1: Políticas RLS (CRÍTICO)
📁 `migrations/003_user_orders_policies.sql`
```sql
-- Copia y pega TODO el contenido del archivo
-- Esto permite que los usuarios vean sus propios pedidos
```

#### ✅ Paso 2: Arreglar Estados
📁 `migrations/004_fix_order_states.sql`
```sql
-- Agrega 'confirmed' al CHECK constraint
```

#### ✅ Paso 3: Función de Cancelación
📁 `migrations/005_cancel_order_function.sql`
```sql
-- Crea la función cancel_order_and_restore_stock()
```

---

## 🧪 Verificar que Funciona

1. **Reinicia el servidor dev** (si está corriendo)
   ```powershell
   # Ctrl+C y luego:
   npm run dev
   ```

2. **Inicia sesión** en la aplicación

3. **Ve a "Mis Pedidos"** → `/perfil/mis-pedidos`

4. **Deberías ver**:
   - ✅ Lista de todos tus pedidos
   - ✅ Botón "Cancelar pedido" en pedidos confirmados
   - ✅ Detalles completos de cada pedido

---

## 🔍 Si Aún No Aparecen

### Verificar que las políticas se aplicaron:
```sql
-- En Supabase SQL Editor:
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('orders', 'order_items');
```

**Deberías ver**:
- `Users can view their own orders`
- `Users can view items of their orders`
- `Service role can manage orders`

### Verificar que hay pedidos:
```sql
-- Reemplaza USER_ID con tu ID de usuario
SELECT id, order_number, status, total, created_at 
FROM orders 
WHERE user_id = 'TU_USER_ID'
ORDER BY created_at DESC;
```

---

## 📝 Qué Hacen las Migraciones

### 003_user_orders_policies.sql
- ✅ Permite SELECT de pedidos propios (`user_id = auth.uid()`)
- ✅ Permite UPDATE de pedidos propios (para cancelación)
- ✅ Permite ver `order_items` de pedidos propios

### 004_fix_order_states.sql
- ✅ Agrega `'confirmed'` al CHECK constraint
- ✅ El webhook usa este estado al crear pedidos

### 005_cancel_order_function.sql
- ✅ Función atómica de cancelación
- ✅ Restaura stock automáticamente
- ✅ Solo permite cancelar si estado = 'confirmed' o 'processing'

---

## ⚠️ IMPORTANTE

**NO aplicar migrations fuera de orden**. La 003 es CRÍTICA y debe ir primero, o los usuarios no podrán ver sus pedidos.

---

## 🆘 Si Nada Funciona

1. Verifica que estás usando el usuario correcto (el mismo que hizo la compra)
2. Revisa la consola del navegador (F12) para ver errores
3. Verifica los logs de Supabase Dashboard → Logs
4. Contacta con el desarrollador mostrando:
   - Console logs del navegador
   - Error de Supabase (si hay)
   - Tu user_id: se puede ver en `localStorage` → clave `sb-*-auth-token`
