/**
 * Script simplificado para verificar el estado de la base de datos
 * y las notificaciones de wishlist
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Cargar .env
const envContent = readFileSync('.env', 'utf-8');
const envVars = Object.fromEntries(
  envContent.split('\n')
    .filter(line => line && !line.startsWith('#'))
    .map(line => {
      const idx = line.indexOf('=');
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
    })
);

const SUPABASE_URL = envVars.PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Faltan credenciales de Supabase');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

console.log('\n🔍 VERIFICACIÓN DEL SISTEMA\n');
console.log('='.repeat(60));

async function verificar() {
  // 1. Verificar productos
  console.log('\n📦 1. PRODUCTOS EN LA BASE DE DATOS:\n');
  const { data: products, error: prodError } = await supabase
    .from('products')
    .select('id, name, slug, price, is_on_sale, stock')
    .limit(5);

  if (prodError) {
    console.error('❌ Error:', prodError.message);
    return;
  }

  if (!products || products.length === 0) {
    console.log('❌ No hay productos en la base de datos');
    return;
  }

  console.log(`✅ Encontrados ${products.length} productos:`);
  products.forEach((p, i) => {
    const saleTag = p.is_on_sale ? '🔥 OFERTA' : '⚪';
    console.log(`   ${i + 1}. ${p.name}`);
    console.log(`      ID: ${p.id}`);
    console.log(`      Precio: ${(p.price / 100).toFixed(2)}€ ${saleTag}`);
    console.log(`      Stock: ${p.stock || 0} uds\n`);
  });

  // 2. Verificar tabla wishlist_items
  console.log('\n❤️  2. ITEMS EN WISHLIST:\n');
  const { data: wishlistItems, error: wishError } = await supabase
    .from('wishlist_items')
    .select('id, user_id, product_id, created_at')
    .limit(10);

  if (wishError) {
    console.error('❌ Error:', wishError.message);
    console.log('\n⚠️  La tabla wishlist_items puede no existir.');
    console.log('Ejecuta: setup-wishlist.sql en Supabase\n');
    return;
  }

  if (!wishlistItems || wishlistItems.length === 0) {
    console.log('⚠️  No hay productos en ninguna wishlist');
    console.log('\n💡 Para hacer la prueba:');
    console.log('   1. Inicia sesión en la app');
    console.log('   2. Ve a un producto');
    console.log('   3. Haz clic en el corazón ❤️\n');
    return;
  }

  console.log(`✅ Encontrados ${wishlistItems.length} items en wishlists:\n`);

  // 3. Obtener detalles de cada item
  for (const item of wishlistItems) {
    // Obtener email del usuario
    const { data: userData } = await supabase.auth.admin.getUserById(item.user_id);
    const userEmail = userData?.user?.email || 'Email no disponible';

    // Obtener nombre del producto
    const { data: productData } = await supabase
      .from('products')
      .select('name')
      .eq('id', item.product_id)
      .single();

    const productName = productData?.name || 'Producto no encontrado';

    console.log(`   👤 ${userEmail}`);
    console.log(`      → tiene en favoritos: "${productName}"`);
    console.log(`      → product_id: ${item.product_id}\n`);
  }

  // 4. Verificar configuración de Brevo
  console.log('\n📧 3. CONFIGURACIÓN DE BREVO:\n');
  if (envVars.BREVO_API_KEY && envVars.BREVO_API_KEY !== 'your-api-key-here') {
    console.log('✅ BREVO_API_KEY configurada');
  } else {
    console.log('❌ BREVO_API_KEY NO configurada');
  }

  if (envVars.EMAIL_FROM && envVars.EMAIL_FROM !== 'your-email@example.com') {
    console.log(`✅ EMAIL_FROM configurado: ${envVars.EMAIL_FROM}`);
  } else {
    console.log('❌ EMAIL_FROM NO configurado');
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n');
}

verificar().catch(console.error);
