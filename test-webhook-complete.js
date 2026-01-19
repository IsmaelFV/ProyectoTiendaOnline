// Test completo de webhook con datos simulados
import Stripe from 'stripe';
import { readFileSync } from 'fs';

// Cargar variables de entorno
const env = readFileSync('.env', 'utf-8');
const envVars = {};
env.split('\n').forEach(l => {
  const [k, ...v] = l.split('=');
  if (k && v.length > 0) envVars[k.trim()] = v.join('=').trim();
});

const stripe = new Stripe(envVars.STRIPE_SECRET_KEY);

async function createTestCheckout() {
  try {
    console.log('🛒 Creando checkout session de prueba...\n');

    // 1. Crear un producto de prueba
    const product = await stripe.products.create({
      name: 'Camiseta Test Factura',
      description: 'Producto para probar el sistema de facturas',
    });
    console.log('✅ Producto creado:', product.id);

    // 2. Crear precio para el producto
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: 2999, // 29.99 EUR en centavos
      currency: 'eur',
    });
    console.log('✅ Precio creado:', price.id);

    // 3. Crear checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price: price.id,
          quantity: 2,
        },
      ],
      customer_email: 'ismaelfloresvargas22@gmail.com',
      success_url: 'http://localhost:4321/checkout/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'http://localhost:4321/checkout/cancel',
      metadata: {
        user_id: 'test-user-123'
      },
      shipping_address_collection: {
        allowed_countries: ['ES', 'FR', 'PT'],
      },
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: {
              amount: 500, // 5 EUR
              currency: 'eur',
            },
            display_name: 'Envío estándar',
            delivery_estimate: {
              minimum: {
                unit: 'business_day',
                value: 3,
              },
              maximum: {
                unit: 'business_day',
                value: 5,
              },
            },
          },
        },
      ],
    });

    console.log('✅ Checkout session creada:', session.id);
    console.log('\n📋 URL de pago:', session.url);
    console.log('\n⚠️ IMPORTANTE: Stripe CLI listener debe estar activo para recibir el webhook');
    console.log('   Ejecuta: C:\\Users\\ismae\\.stripe\\stripe.exe listen --forward-to localhost:4321/api/webhooks/stripe\n');
    console.log('🌐 Abre esta URL en tu navegador y completa el pago:');
    console.log('   ' + session.url);
    console.log('\n💳 Usa tarjeta de prueba: 4242 4242 4242 4242');
    console.log('   Fecha: cualquier fecha futura');
    console.log('   CVC: cualquier 3 dígitos');
    console.log('   Código postal: cualquiera\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

createTestCheckout();
