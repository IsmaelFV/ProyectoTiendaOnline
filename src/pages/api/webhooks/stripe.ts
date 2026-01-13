import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { supabase } from '../../../lib/supabase';

// Inicializar Stripe
const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-12-15.clover',
});

const endpointSecret = import.meta.env.STRIPE_WEBHOOK_SECRET;

export const POST: APIRoute = async ({ request }) => {
  const sig = request.headers.get('stripe-signature');

  if (!sig || !endpointSecret) {
    console.error('Missing signature or webhook secret');
    return new Response('Webhook signature missing', { status: 400 });
  }

  let event: Stripe.Event;

  try {
    // 1. Verificar la firma del webhook (SEGURIDAD CRÍTICA)
    const body = await request.text();
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // 2. Procesar evento según su tipo
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleSuccessfulPayment(session);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.error('Payment failed:', paymentIntent.id);
        // Aquí podrías notificar al usuario por email
        break;
      }

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return new Response(JSON.stringify({ 
      error: 'Webhook processing failed',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// Función para manejar pagos exitosos
async function handleSuccessfulPayment(session: Stripe.Checkout.Session) {
  try {
    console.log('✅ Procesando pago exitoso - Session ID:', session.id);
    
    const { user_id } = session.metadata || {};

    // Obtener line_items de Stripe (contiene los productos comprados)
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
      expand: ['data.price.product']
    });

    if (!lineItems.data || lineItems.data.length === 0) {
      throw new Error('No line items found in session');
    }

    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    // Calcular subtotal desde line_items (Stripe maneja centavos, dividir por 100)
    const subtotalCents = lineItems.data.reduce((sum, item) => {
      return sum + ((item.price?.unit_amount || 0) * (item.quantity || 1));
    }, 0);
    
    const totalCents = session.amount_total || 0;
    const taxCents = session.total_details?.amount_tax || 0;
    const shippingCents = session.total_details?.amount_shipping || 0;

    // 1. Crear el pedido en la base de datos (mapeo correcto según esquema real)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        user_id: user_id && user_id !== 'guest' ? user_id : null,
        shipping_full_name: session.customer_details?.name || 'Cliente',
        shipping_phone: session.customer_details?.phone || '',
        shipping_address_line1: session.customer_details?.address?.line1 || 'Dirección no proporcionada',
        shipping_address_line2: session.customer_details?.address?.line2 || null,
        shipping_city: session.customer_details?.address?.city || 'Ciudad',
        shipping_state: session.customer_details?.address?.state || null,
        shipping_postal_code: session.customer_details?.address?.postal_code || '00000',
        shipping_country: session.customer_details?.address?.country || 'ES',
        subtotal: subtotalCents / 100, // Convertir centavos a euros
        shipping_cost: shippingCents / 100,
        tax: taxCents / 100,
        discount: 0,
        total: totalCents / 100,
        payment_method: 'card',
        payment_status: 'paid',
        payment_id: session.payment_intent as string, // Guardar payment_intent_id aquí
        status: 'pending', // Estado del pedido (pending, processing, shipped, delivered, cancelled)
        customer_notes: null,
        admin_notes: `Stripe Session: ${session.id}`,
      })
      .select()
      .single();

    if (orderError) {
      throw new Error(`Error creating order: ${orderError.message}`);
    }

    console.log(`✅ Order created: ${orderNumber} (ID: ${order.id})`);

    // 2. Procesar line_items de Stripe para crear order_items y actualizar stock
    for (const lineItem of lineItems.data) {
      const productName = lineItem.description || 'Producto';
      const quantity = lineItem.quantity || 1;
      const pricePerUnit = lineItem.price?.unit_amount || 0; // En centavos

      // Buscar producto por nombre para obtener ID y detalles
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('id, slug, sku, images')
        .eq('name', productName)
        .single();

      if (productError || !product) {
        console.error(`❌ Product not found: ${productName}`);
        continue;
      }

      // Insertar order_item
      const { error: itemError } = await supabase
        .from('order_items')
        .insert({
          order_id: order.id,
          product_id: product.id,
          product_name: productName,
          product_slug: product.slug,
          product_sku: product.sku,
          product_image: product.images?.[0] || null,
          size: 'M', // Default - Stripe no nos pasa esta info por ahora
          quantity: quantity,
          price_per_unit: pricePerUnit / 100, // Convertir a euros
          total_price: (pricePerUnit * quantity) / 100,
        });

      if (itemError) {
        console.error(`❌ Error creating order item: ${itemError.message}`);
        continue;
      }

      // Decrementar stock de forma atómica usando la función SQL
      const { error: stockError } = await supabase.rpc('decrement_stock', {
        product_id: product.id,
        quantity: quantity
      });

      if (stockError) {
        console.error(`❌ Error updating stock for product ${product.id}:`, stockError.message);
        // Marcar el pedido para revisión manual
        await supabase
          .from('orders')
          .update({ 
            status: 'processing',
            admin_notes: `Stock update failed: ${stockError.message}` 
          })
          .eq('id', order.id);
      }
    }

    console.log(`✅ Order ${orderNumber} processed successfully with ${lineItems.data.length} items`);

  } catch (error: any) {
    console.error('❌ Error handling successful payment:', error);
    throw error;
  }
}
