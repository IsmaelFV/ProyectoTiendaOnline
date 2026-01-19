// ============================================================================
// SCRIPT DE DIAGNÓSTICO: Verificar aislamiento del carrito
// ============================================================================
// Ejecutar: node test-cart-isolation.js

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

// Leer variables de entorno del archivo .env
const envContent = fs.readFileSync('.env', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length) {
    envVars[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
  }
});

const supabase = createClient(
  envVars.PUBLIC_SUPABASE_URL,
  envVars.PUBLIC_SUPABASE_ANON_KEY
);

async function testCartIsolation() {
  console.log('🧪 INICIANDO DIAGNÓSTICO DE AISLAMIENTO DE CARRITO\n');

  // 1. Verificar tablas existen
  console.log('1️⃣  Verificando estructura de tablas...');
  const { data: carts, error: cartsError } = await supabase
    .from('shopping_carts')
    .select('*')
    .limit(1);
  
  if (cartsError) {
    console.error('❌ Error accediendo a shopping_carts:', cartsError.message);
    return;
  }
  console.log('✅ Tabla shopping_carts accesible\n');

  // 2. Verificar funciones existen
  console.log('2️⃣  Verificando funciones RPC...');
  const testUserId = '00000000-0000-0000-0000-000000000000'; // UUID de prueba
  
  const { data: rpcTest, error: rpcError } = await supabase
    .rpc('get_cart_with_products', { p_user_id: testUserId });
  
  if (rpcError) {
    console.error('❌ Error llamando a get_cart_with_products:', rpcError.message);
    return;
  }
  console.log('✅ Función get_cart_with_products funciona\n');

  // 3. Verificar carritos existentes
  console.log('3️⃣  Carritos actuales en la base de datos:');
  const { data: allCarts, error: allCartsError } = await supabase
    .from('shopping_carts')
    .select(`
      id,
      user_id,
      created_at,
      cart_items (
        product_id,
        size,
        quantity
      )
    `)
    .order('created_at', { ascending: false });

  if (allCartsError) {
    console.error('❌ Error:', allCartsError.message);
    return;
  }

  if (allCarts.length === 0) {
    console.log('   📭 No hay carritos en la base de datos');
  } else {
    allCarts.forEach((cart, index) => {
      console.log(`\n   Carrito ${index + 1}:`);
      console.log(`   - ID: ${cart.id}`);
      console.log(`   - User ID: ${cart.user_id}`);
      console.log(`   - Items: ${cart.cart_items?.length || 0}`);
      if (cart.cart_items && cart.cart_items.length > 0) {
        cart.cart_items.forEach(item => {
          console.log(`     • Producto: ${item.product_id} | Talla: ${item.size} | Cantidad: ${item.quantity}`);
        });
      }
    });
  }

  // 4. Verificar políticas RLS
  console.log('\n\n4️⃣  Verificando políticas RLS...');
  const { data: policies, error: policiesError } = await supabase
    .rpc('exec_sql', { 
      query: `
        SELECT schemaname, tablename, policyname, permissive, roles, cmd
        FROM pg_policies 
        WHERE tablename IN ('shopping_carts', 'cart_items')
        ORDER BY tablename, policyname;
      ` 
    });

  if (policiesError) {
    console.log('   ⚠️  No se pudo verificar RLS (puede ser normal si no tienes permisos)');
    console.log('   Ejecuta esta query en Supabase SQL Editor:');
    console.log(`
      SELECT tablename, policyname
      FROM pg_policies 
      WHERE tablename IN ('shopping_carts', 'cart_items')
      ORDER BY tablename, policyname;
    `);
  } else {
    console.log('✅ Políticas RLS configuradas');
  }

  console.log('\n\n✅ DIAGNÓSTICO COMPLETADO\n');
  console.log('📋 PRÓXIMOS PASOS:');
  console.log('   1. Verifica que cada usuario tiene su propio user_id único');
  console.log('   2. Confirma que los items están asociados al cart_id correcto');
  console.log('   3. Prueba agregar un producto desde el navegador y vuelve a ejecutar este script\n');
}

testCartIsolation().catch(console.error);
