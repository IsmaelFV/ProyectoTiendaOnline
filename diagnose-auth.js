// DIAGNÓSTICO DE AUTENTICACIÓN
// Ejecutar: node diagnose-auth.js

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables de entorno no configuradas');
  console.log('PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.log('PUBLIC_SUPABASE_ANON_KEY:', supabaseKey ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('\n🔍 DIAGNÓSTICO DE AUTENTICACIÓN\n');

// Verificar usuarios en auth.users
const { data: users, error: usersError } = await supabase.auth.admin.listUsers();

if (usersError) {
  console.log('⚠️  No se puede acceder a admin API (normal para anon key)');
  console.log('Usando query a tabla profiles...\n');
  
  // Alternativamente, verificar tabla profiles
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, email, created_at')
    .limit(5);
  
  if (profilesError) {
    console.error('❌ Error al obtener profiles:', profilesError.message);
  } else {
    console.log('✅ Usuarios en la base de datos:');
    profiles.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.email}`);
      console.log(`      ID: ${p.id}`);
      console.log(`      Creado: ${p.created_at}\n`);
    });
  }
} else {
  console.log('✅ Usuarios registrados:');
  users.users.forEach((user, i) => {
    console.log(`   ${i + 1}. ${user.email}`);
    console.log(`      ID: ${user.id}`);
    console.log(`      Último login: ${user.last_sign_in_at}\n`);
  });
}

console.log('\n📋 INSTRUCCIONES:');
console.log('1. Abre la consola del navegador (F12)');
console.log('2. Ve a la pestaña "Application" > "Local Storage"');
console.log('3. Busca las keys que empiezan con "sb-"');
console.log('4. Copia aquí el contenido de la key "sb-*-auth-token"');
console.log('\nO ejecuta en consola: localStorage.getItem("sb-" + Object.keys(localStorage).find(k => k.includes("auth-token")).split("sb-")[1])');
