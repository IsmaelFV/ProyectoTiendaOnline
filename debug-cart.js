// ============================================================================
// SCRIPT DE DEPURACIÓN: Verificar estado del carrito
// ============================================================================
// Ejecutar en la consola del navegador (F12 → Console)
// Pegar TODO este código y presionar Enter
// ============================================================================

console.log('🔍 DIAGNÓSTICO DE CARRITO - INICIO');
console.log('='.repeat(60));

// 1. Verificar sesión de Supabase
console.log('\n1️⃣ VERIFICANDO SESIÓN...');
const { createClient } = window.supabase || {};
if (!createClient) {
  console.error('❌ Supabase no está cargado en window');
} else {
  const supabase = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY
  );
  
  const session = await supabase.auth.getSession();
  if (session.data.session) {
    console.log('✅ Usuario autenticado:', session.data.session.user.email);
    console.log('   User ID:', session.data.session.user.id);
  } else {
    console.log('⚠️  Usuario NO autenticado (invitado)');
  }
}

// 2. Verificar localStorage
console.log('\n2️⃣ VERIFICANDO LOCALSTORAGE...');
const localStorageKeys = Object.keys(localStorage).filter(k => k.includes('cart'));
console.log('Keys relacionadas con cart:', localStorageKeys);
localStorageKeys.forEach(key => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '{}');
    console.log(`   ${key}:`, value);
  } catch {
    console.log(`   ${key}: (no parseable)`);
  }
});

// 3. Verificar stores de nanostores
console.log('\n3️⃣ VERIFICANDO STORES...');
// Necesitas importar los stores primero
// En la página, ejecuta:
// import { cartItems } from '@stores/cart';
// import { currentUserId } from '@stores/session';

console.log('Para verificar los stores, ejecuta esto en tu código:');
console.log(`
import { cartItems } from '@stores/cart';
import { currentUserId } from '@stores/session';
console.log('cartItems:', cartItems.get());
console.log('currentUserId:', currentUserId.get());
`);

// 4. Verificar funciones SQL en Supabase
console.log('\n4️⃣ VERIFICANDO FUNCIONES SQL...');
console.log('Ejecuta esto en Supabase SQL Editor:');
console.log(`
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name LIKE '%cart%';
`);

// 5. Test manual de función add_to_cart
console.log('\n5️⃣ TEST MANUAL (si estás autenticado)...');
console.log('Ejecuta esto en Supabase SQL Editor (reemplaza USER_ID y PRODUCT_ID):');
console.log(`
SELECT add_to_cart(
  'tu-user-id-aqui'::uuid,
  'algun-product-id'::uuid,
  'M',
  1
);
`);

console.log('\n' + '='.repeat(60));
console.log('🔍 DIAGNÓSTICO COMPLETO');
console.log('Copia los resultados y envíalos para análisis');
