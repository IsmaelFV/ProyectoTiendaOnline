// ============================================================================
// TEST: Verificar conexión directa a Supabase
// ============================================================================
// Ejecuta: node test-supabase.js
// ============================================================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qquzifirnqodldyhbelv.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxdXppZmlybnFvZGxkeWhiZWx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4NTU2NTksImV4cCI6MjA4MzQzMTY1OX0.UvkrWFNt1emb2S-5-J2pfgpTjNI_ngTblJy6Xm9IHtQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('🔍 TEST DE CONEXIÓN A SUPABASE\n');
console.log('=====================================\n');

// Test 1: Verificar productos
console.log('1️⃣ Consultando productos...');
const { data: products, error: productsError } = await supabase
  .from('products')
  .select('*')
  .limit(5);

if (productsError) {
  console.error('❌ ERROR al consultar productos:', productsError);
} else {
  console.log(`✅ Productos encontrados: ${products?.length || 0}`);
  if (products && products.length > 0) {
    console.log('   Primer producto:', products[0].name);
  }
}

console.log('\n');

// Test 2: Verificar productos destacados
console.log('2️⃣ Consultando productos destacados...');
const { data: featured, error: featuredError } = await supabase
  .from('products')
  .select('*')
  .eq('featured', true)
  .limit(5);

if (featuredError) {
  console.error('❌ ERROR al consultar destacados:', featuredError);
} else {
  console.log(`✅ Productos destacados: ${featured?.length || 0}`);
  if (featured && featured.length > 0) {
    featured.forEach(p => console.log(`   - ${p.name} (featured: ${p.featured})`));
  }
}

console.log('\n');

// Test 3: Verificar géneros
console.log('3️⃣ Consultando géneros...');
const { data: genders, error: gendersError } = await supabase
  .from('genders')
  .select('*');

if (gendersError) {
  console.error('❌ ERROR al consultar géneros:', gendersError);
} else {
  console.log(`✅ Géneros encontrados: ${genders?.length || 0}`);
  if (genders && genders.length > 0) {
    genders.forEach(g => console.log(`   - ${g.name} (${g.slug})`));
  }
}

console.log('\n');

// Test 4: Verificar categorías
console.log('4️⃣ Consultando categorías...');
const { data: categories, error: categoriesError } = await supabase
  .from('categories')
  .select('*')
  .limit(10);

if (categoriesError) {
  console.error('❌ ERROR al consultar categorías:', categoriesError);
} else {
  console.log(`✅ Categorías encontradas: ${categories?.length || 0}`);
}

console.log('\n=====================================');
console.log('\n💡 RESULTADO:');

if (!productsError && products && products.length > 0) {
  console.log('✅ La conexión a Supabase funciona correctamente');
  console.log('✅ Los productos están accesibles');
  console.log('⚠️ Si no aparecen en la web, el problema está en el código frontend');
} else {
  console.log('❌ Hay un problema con las políticas RLS de Supabase');
  console.log('📋 Ejecuta el script: politicas-seguridad-correctas.sql');
}
