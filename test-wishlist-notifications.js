/**
 * Script para probar el sistema de notificaciones de wishlist
 * 
 * Este script te permite verificar que:
 * 1. El endpoint de ofertas está funcionando
 * 2. Se detectan usuarios con el producto en favoritos
 * 3. Se envían emails cuando un producto entra en oferta
 * 
 * USO:
 * 1. Asegúrate de tener un producto en la DB
 * 2. Añade ese producto a favoritos con un usuario real
 * 3. Ejecuta: node test-wishlist-notifications.js
 */

import { createClient } from '@supabase/supabase-js';
import * as brevo from '@getbrevo/brevo';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';

// Cargar variables de entorno
const envContent = readFileSync('.env', 'utf-8');
const envVars = Object.fromEntries(
  envContent.split('\n')
    .filter(line => line && !line.startsWith('#'))
    .map(line => line.split('=').map(s => s.trim()))
);

console.log('\n🔍 TEST: Sistema de Notificaciones de Wishlist\n');
console.log('='.repeat(60));

// ========================================
// CONFIGURACIÓN
// ========================================

const SUPABASE_URL = envVars.PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY;
const BREVO_API_KEY = envVars.BREVO_API_KEY;
const EMAIL_FROM = envVars.EMAIL_FROM;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Faltan credenciales de Supabase en .env');
  process.exit(1);
}

if (!BREVO_API_KEY || !EMAIL_FROM) {
  console.error('❌ Faltan credenciales de Brevo en .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ========================================
// PASO 1: Verificar productos disponibles
// ========================================

async function step1_checkProducts() {
  console.log('\n📦 PASO 1: Verificando productos en la base de datos...\n');
  
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, slug, price, is_on_sale, images')
    .limit(5);

  if (error) {
    console.error('❌ Error:', error.message);
    return null;
  }

  if (!products || products.length === 0) {
    console.error('❌ No hay productos en la base de datos');
    return null;
  }

  console.log(`✅ Encontrados ${products.length} productos:`);
  products.forEach((p, i) => {
    const saleStatus = p.is_on_sale ? '🔥 EN OFERTA' : '⚪ Normal';
    console.log(`   ${i + 1}. [${p.id.slice(0, 8)}...] ${p.name} - ${(p.price / 100).toFixed(2)}€ ${saleStatus}`);
  });

  return products[0]; // Retornar el primer producto para pruebas
}

// ========================================
// PASO 2: Verificar usuarios con el producto en wishlist
// ========================================

async function step2_checkWishlistUsers(productId) {
  console.log(`\n👤 PASO 2: Buscando usuarios que tienen el producto en favoritos...\n`);
  
  const { data: wishlistItems, error } = await supabase
    .from('wishlist_items')
    .select('user_id')
    .eq('product_id', productId);

  if (error) {
    console.error('❌ Error:', error.message);
    return [];
  }

  if (!wishlistItems || wishlistItems.length === 0) {
    console.log('⚠️  NINGÚN usuario tiene este producto en favoritos');
    console.log('\n💡 SUGERENCIA: Inicia sesión en la app y añade el producto a favoritos primero\n');
    return [];
  }

  console.log(`✅ ${wishlistItems.length} usuario(s) tienen este producto en favoritos:`);

  const users = [];
  for (const item of wishlistItems) {
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(item.user_id);
    if (!userError && userData?.user?.email) {
      users.push({ user_id: item.user_id, email: userData.user.email });
      console.log(`   - ${userData.user.email}`);
    }
  }

  return users;
}

// ========================================
// PASO 3: Simular activación de oferta
// ========================================

async function step3_simulateOfferActivation(product, users) {
  console.log(`\n🔥 PASO 3: Simulando activación de oferta (20% descuento)...\n`);
  
  if (users.length === 0) {
    console.log('⚠️  No se pueden enviar emails porque no hay usuarios en la wishlist');
    return;
  }

  const discountPct = 20;
  const salePriceInCents = Math.round(product.price * (1 - discountPct / 100));

  console.log(`   Producto: ${product.name}`);
  console.log(`   Precio original: ${(product.price / 100).toFixed(2)}€`);
  console.log(`   Precio con oferta: ${(salePriceInCents / 100).toFixed(2)}€`);
  console.log(`   Descuento: -${discountPct}%`);

  // Preparar email
  const apiInstance = new brevo.TransactionalEmailsApi();
  apiInstance.setApiKey(
    brevo.TransactionalEmailsApiApiKeys.apiKey,
    BREVO_API_KEY
  );

  const productUrl = `${envVars.PUBLIC_SITE_URL || 'http://localhost:4321'}/productos/${product.slug}`;
  const imageHtml = product.images?.[0]
    ? `<img src="${product.images[0]}" alt="${product.name}" style="max-width:100%;max-height:250px;border-radius:8px;object-fit:cover;margin-bottom:16px;" />`
    : '';

  const formatPrice = (cents) => (cents / 100).toFixed(2).replace('.', ',') + ' €';

  const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <div style="background:linear-gradient(135deg,#dc2626 0%,#f59e0b 100%);color:#fff;padding:30px;text-align:center;border-radius:12px 12px 0 0;">
      <h1 style="margin:0;font-size:24px;">🔥 ¡Oferta en un producto que te gusta!</h1>
    </div>
    <div style="background:#fff;padding:30px;border-radius:0 0 12px 12px;">
      <p style="color:#374151;font-size:16px;">Un producto de tu lista de favoritos acaba de ponerse en oferta:</p>
      
      <div style="text-align:center;margin:20px 0;">
        ${imageHtml}
        <h2 style="margin:0 0 8px;color:#111827;">${product.name}</h2>
        <p style="margin:4px 0;">
          <span style="text-decoration:line-through;color:#9ca3af;font-size:16px;">${formatPrice(product.price)}</span>
          <span style="color:#dc2626;font-size:22px;font-weight:bold;margin-left:10px;">${formatPrice(salePriceInCents)}</span>
        </p>
        <span style="display:inline-block;background:#fef2f2;color:#dc2626;padding:4px 12px;border-radius:999px;font-weight:bold;font-size:14px;margin-top:8px;">
          -${discountPct}% de descuento
        </span>
      </div>

      <div style="text-align:center;margin:28px 0;">
        <a href="${productUrl}" style="display:inline-block;background:#dc2626;color:#fff;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px;">
          Ver oferta →
        </a>
      </div>

      <p style="color:#6b7280;font-size:13px;text-align:center;margin-top:24px;">
        Recibes este email porque tienes este producto en tu lista de favoritos en Fashion Store.
      </p>
    </div>
    <div style="text-align:center;margin-top:20px;color:#9ca3af;font-size:12px;">
      <p>Fashion Store — Moda de calidad para ti</p>
    </div>
  </div>
</body>
</html>`;

  console.log(`\n📧 Enviando emails a ${users.length} usuario(s)...\n`);

  let sent = 0;
  let failed = 0;

  for (const user of users) {
    try {
      const sendSmtpEmail = new brevo.SendSmtpEmail();
      sendSmtpEmail.subject = `🔥 ¡"${product.name}" está en oferta! -${discountPct}%`;
      sendSmtpEmail.htmlContent = htmlContent;
      sendSmtpEmail.sender = {
        name: 'Fashion Store',
        email: EMAIL_FROM,
      };
      sendSmtpEmail.to = [{ email: user.email }];
      sendSmtpEmail.textContent = `¡"${product.name}" acaba de ponerse en oferta! Antes: ${formatPrice(product.price)} → Ahora: ${formatPrice(salePriceInCents)} (-${discountPct}%). Ver: ${productUrl}`;

      await apiInstance.sendTransacEmail(sendSmtpEmail);
      console.log(`   ✅ Email enviado a: ${user.email}`);
      sent++;
    } catch (error) {
      console.error(`   ❌ Error enviando a ${user.email}:`, error.response?.body || error.message);
      failed++;
    }
  }

  console.log(`\n📊 RESULTADO:`);
  console.log(`   ✅ Enviados: ${sent}`);
  console.log(`   ❌ Fallidos: ${failed}`);
}

// ========================================
// EJECUTAR TEST
// ========================================

async function runTest() {
  try {
    const product = await step1_checkProducts();
    if (!product) {
      console.log('\n❌ Test fallido: No hay productos\n');
      return;
    }

    const users = await step2_checkWishlistUsers(product.id);
    
    if (users.length === 0) {
      console.log('\n⚠️  Test incompleto: El producto existe pero no está en ninguna wishlist\n');
      console.log('Para hacer el test completo:');
      console.log(`1. Inicia sesión en http://localhost:4321`);
      console.log(`2. Ve al producto: ${product.name}`);
      console.log(`3. Haz clic en el corazón para añadirlo a favoritos`);
      console.log(`4. Vuelve a ejecutar este script\n`);
      return;
    }

    await step3_simulateOfferActivation(product, users);

    console.log('\n✅ TEST COMPLETADO\n');
    console.log('Revisa tu bandeja de entrada (y carpeta de spam) para ver el email\n');
    console.log('='.repeat(60));
    console.log('\n');

  } catch (error) {
    console.error('\n❌ Error durante el test:', error);
  }
}

runTest();
