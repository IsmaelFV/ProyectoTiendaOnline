import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { generateInvoicePDF } from '../../../lib/invoice-pdf';
import { sendInvoiceEmail } from '../../../lib/brevo';

// Cliente de Supabase con SERVICE ROLE para bypasear RLS (solo para webhooks server-side)
const supabaseAdmin = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

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

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleExpiredSession(session);
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
    console.log('[WEBHOOK] Procesando pago exitoso - Session ID:', session.id);
    console.log('[WEBHOOK] Session metadata:', session.metadata);
    console.log('[WEBHOOK] Customer details:', session.customer_details);
    
    const { user_id, discount_code } = session.metadata || {};

    // Parsear info de tallas por item desde metadata
    let orderItemsSizes: Array<{ id: string; size: string; qty: number }> = [];
    try {
      if (session.metadata?.order_items_sizes) {
        orderItemsSizes = JSON.parse(session.metadata.order_items_sizes);
      }
    } catch (e) {
      console.warn('[WEBHOOK] Error parsing order_items_sizes metadata:', e);
    }

    // PASO 0: Confirmar reservas de stock (si el sistema de reservas está activo)
    try {
      console.log('[WEBHOOK] Intentando confirmar reservas de stock...');
      const { data: confirmResult, error: confirmError } = await supabaseAdmin.rpc('confirm_reservation', {
        p_session_id: session.id,
        p_order_id: null
      }) as { data: any; error: any };

      if (confirmError) {
        console.warn('[WEBHOOK] confirm_reservation no disponible o falló:', confirmError.message);
      } else if (confirmResult?.success) {
        console.log(`[WEBHOOK] Reservas confirmadas: ${confirmResult.confirmed} items`);
      } else {
        console.warn('[WEBHOOK] No se encontraron reservas para confirmar (normal si no se usa reservas)');
      }
    } catch (reserveErr: any) {
      console.warn('[WEBHOOK] Sistema de reservas no disponible:', reserveErr.message);
      // No es crítico, continuar con la creación del pedido
    }

    // Obtener line_items de Stripe (contiene los productos comprados)
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
      expand: ['data.price.product']
    });

    console.log('[WEBHOOK] Line items:', lineItems.data.length);

    if (!lineItems.data || lineItems.data.length === 0) {
      throw new Error('No line items found in session');
    }

    // Calcular subtotal desde line_items (Stripe maneja centavos, dividir por 100)
    const subtotalCents = lineItems.data.reduce((sum, item) => {
      return sum + ((item.price?.unit_amount || 0) * (item.quantity || 1));
    }, 0);
    
    const totalCents = session.amount_total || 0;
    const taxCents = session.total_details?.amount_tax || 0;
    const shippingCents = session.total_details?.amount_shipping || 0;
    const discountCents = session.total_details?.amount_discount || 0;

    console.log('[WEBHOOK] Amounts - Subtotal:', subtotalCents, 'Total:', totalCents, 'Tax:', taxCents, 'Shipping:', shippingCents, 'Discount:', discountCents);

    // 1. Crear el pedido en la base de datos
    console.log('[WEBHOOK] Creando pedido en BD...');

    // Generar order_number desde codigo (por si el trigger no existe en la BD)
    const now = new Date();
    const year = now.getFullYear();
    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    const fallbackOrderNumber = `ORD-${year}-${Date.now().toString().slice(-6)}-${randomSuffix}`;
    
    const orderData = {
      order_number: fallbackOrderNumber,
      user_id: (user_id && user_id !== 'guest') ? user_id : null,
      shipping_full_name: session.customer_details?.name || 'Cliente',
      shipping_phone: session.customer_details?.phone || '',
      shipping_address_line1: session.customer_details?.address?.line1 || 'Dirección no proporcionada',
      shipping_address_line2: session.customer_details?.address?.line2 || null,
      shipping_city: session.customer_details?.address?.city || 'Ciudad',
      shipping_state: session.customer_details?.address?.state || '',
      shipping_postal_code: session.customer_details?.address?.postal_code || '00000',
      shipping_country: session.customer_details?.address?.country || 'España',
      subtotal: subtotalCents / 100,
      shipping_cost: shippingCents / 100,
      tax: taxCents / 100,
      discount: discountCents / 100,
      total: totalCents / 100,
      payment_method: 'card',
      payment_status: 'paid',
      payment_id: session.payment_intent as string,
      status: 'confirmed',
      customer_notes: discount_code ? `Código aplicado: ${discount_code}` : null,
      admin_notes: `Stripe Session: ${session.id} | Email: ${session.customer_details?.email || session.customer_email}`,
    };

    console.log('[WEBHOOK] Order data:', JSON.stringify(orderData, null, 2));

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert(orderData)
      .select()
      .single();

    if (orderError) {
      console.error('[WEBHOOK] Error creating order:', orderError);
      throw new Error(`Error creating order: ${orderError.message}`);
    }

    const orderNumber = order.order_number;
    console.log(`[WEBHOOK] Order created: ${orderNumber} (ID: ${order.id})`);

    // 1.5. Incrementar contador de usos del codigo de descuento si se uso
    if (discount_code && discountCents > 0) {
      try {
        console.log(`[WEBHOOK] Incrementando uso del codigo: ${discount_code}`);
        const { error: discountError } = await supabaseAdmin.rpc('increment_discount_usage', {
          p_code: discount_code
        });
        
        if (discountError) {
          console.warn('[WEBHOOK] Error al incrementar uso del codigo:', discountError.message);
        } else {
          console.log(`[WEBHOOK] Codigo ${discount_code} registrado como usado`);
        }
      } catch (rpcErr: any) {
        console.warn('[WEBHOOK] increment_discount_usage no disponible:', rpcErr.message);
      }
    }

    // 2. Procesar line_items de Stripe para crear order_items y actualizar stock
    // Primero crear los order_items y recopilar info para decrement atómico
    const stockDecrementItems: Array<{ product_id: string; size: string; quantity: number }> = [];
    const productImagesMap: Map<string, string> = new Map(); // productName → imageUrl

    for (const lineItem of lineItems.data) {
      const productName = lineItem.description || 'Producto';
      const quantity = lineItem.quantity || 1;
      const pricePerUnit = lineItem.price?.unit_amount || 0; // En centavos

      // Buscar producto por nombre para obtener ID y detalles
      const { data: product, error: productError } = await supabaseAdmin
        .from('products')
        .select('id, slug, sku, images, stock')
        .eq('name', productName)
        .maybeSingle();

      if (productError) {
        console.error(`[WEBHOOK] Error querying product: ${productError.message}`);
      }

      // Solo crear order_item si encontramos el producto (product_id es requerido)
      if (product?.id) {
        // Guardar imagen para la factura
        const productImage = product.images?.[0] || null;
        if (productImage) {
          productImagesMap.set(productName, productImage);
        }
        // Buscar la talla de este item desde los metadata
        const itemSizeInfo = orderItemsSizes.find(oi => oi.id === product.id);
        const itemSize = itemSizeInfo?.size || 'Única';

        const { error: itemError } = await supabaseAdmin
          .from('order_items')
          .insert({
            order_id: order.id,
            product_id: product.id,
            product_name: productName,
            product_slug: product.slug,
            product_image: product.images?.[0] || null,
            size: itemSize,
            color: null,
            price: pricePerUnit / 100,
            quantity: quantity,
            subtotal: (pricePerUnit * quantity) / 100,
          });

        if (itemError) {
          console.error(`[WEBHOOK] Error creating order item: ${itemError.message}`);
          continue;
        }

        // Acumular para decrement atómico
        stockDecrementItems.push({
          product_id: product.id,
          size: itemSize,
          quantity: quantity
        });
      } else {
        console.warn(`[WEBHOOK] Product "${productName}" not found in database, skipping order item (product_id required)`);
        // Para productos de prueba que no existen, marcar pedido como pendiente de revisión
        await supabaseAdmin
          .from('orders')
          .update({ 
            status: 'processing',
            admin_notes: `Product "${productName}" not found in database, manual review needed` 
          })
          .eq('id', order.id);
      }
    }

    // DECREMENT STOCK: Intentar RPC atómico, con fallback a UPDATE directo
    if (stockDecrementItems.length > 0) {
      console.log(`[WEBHOOK] Decrementando stock para ${stockDecrementItems.length} items...`);
      
      let stockSuccess = false;

      // Intento 1: RPC atómico (si la función existe en Supabase)
      try {
        const { data: stockResult, error: stockError } = await supabaseAdmin.rpc('validate_and_decrement_stock', {
          p_items: stockDecrementItems
        }) as { data: any; error: any };

        if (!stockError && stockResult?.success) {
          console.log(`[WEBHOOK] Stock decrementado (RPC): ${stockResult.items_processed} items`);
          stockSuccess = true;
        } else {
          console.warn(`[WEBHOOK] RPC falló: ${stockResult?.message || stockError?.message}`);
        }
      } catch (rpcErr: any) {
        console.warn(`[WEBHOOK] RPC no disponible: ${rpcErr.message}`);
      }

      // Intento 2: Fallback - UPDATE directo producto por producto
      if (!stockSuccess) {
        console.log('[WEBHOOK] Usando fallback: UPDATE directo de stock...');
        for (const item of stockDecrementItems) {
          try {
            // Leer stock actual
            const { data: prod, error: readErr } = await supabaseAdmin
              .from('products')
              .select('stock, stock_by_size')
              .eq('id', item.product_id)
              .single();

            if (readErr || !prod) {
              console.error(`[WEBHOOK] No se pudo leer producto ${item.product_id}:`, readErr);
              continue;
            }

            const newStock = Math.max(0, (prod.stock || 0) - item.quantity);
            
            // Actualizar stock_by_size si existe
            let updateData: any = { 
              stock: newStock,
              updated_at: new Date().toISOString()
            };
            
            if (prod.stock_by_size && typeof prod.stock_by_size === 'object') {
              const sizeStock = prod.stock_by_size as Record<string, number>;
              if (item.size in sizeStock) {
                sizeStock[item.size] = Math.max(0, (sizeStock[item.size] || 0) - item.quantity);
                updateData.stock_by_size = sizeStock;
              }
            }

            const { error: updateErr } = await supabaseAdmin
              .from('products')
              .update(updateData)
              .eq('id', item.product_id);

            if (updateErr) {
              console.error(`[WEBHOOK] Error actualizando stock de ${item.product_id}:`, updateErr);
            } else {
              console.log(`[WEBHOOK] Stock actualizado (fallback): ${item.product_id} -> ${newStock}`);
              stockSuccess = true;
            }
          } catch (itemErr: any) {
            console.error(`[WEBHOOK] Error en fallback stock ${item.product_id}:`, itemErr.message);
          }
        }
      }

      if (!stockSuccess) {
        // Marcar pedido para revision manual
        await supabaseAdmin
          .from('orders')
          .update({ 
            admin_notes: `ATENCION: Stock no se pudo decrementar. Revisar manualmente.`
          })
          .eq('id', order.id);
      }
    }

    console.log(`[WEBHOOK] Order ${orderNumber} processed successfully with ${lineItems.data.length} items`);

    // 3. Enviar factura automáticamente por email
    try {
      console.log(`[WEBHOOK] Generando y enviando factura para pedido ${orderNumber}...`);
      
      const customerEmail = session.customer_details?.email || session.customer_email;
      const customerName = session.customer_details?.name || 'Cliente';

      if (!customerEmail) {
        console.warn('[WEBHOOK] No se pudo enviar factura: email no disponible');
        return;
      }

      // Preparar datos para la factura
      const invoiceItems = lineItems.data.map(item => ({
        name: item.description || 'Producto',
        quantity: item.quantity || 1,
        price: item.price?.unit_amount || 0,
        total: (item.price?.unit_amount || 0) * (item.quantity || 1),
        image: productImagesMap.get(item.description || '') || undefined
      }));

      const shippingAddress = session.customer_details?.address 
        ? `${session.customer_details.address.line1 || ''}${session.customer_details.address.line2 ? ', ' + session.customer_details.address.line2 : ''}, ${session.customer_details.address.city || ''}, ${session.customer_details.address.postal_code || ''}, ${session.customer_details.address.country || ''}`
        : 'Dirección no proporcionada';

      // Generar PDF
      const pdfBase64 = await generateInvoicePDF({
        orderNumber,
        orderDate: new Date().toISOString(),
        customerName,
        customerEmail,
        shippingAddress,
        items: invoiceItems,
        subtotal: subtotalCents,
        shipping: shippingCents,
        tax: taxCents,
        total: totalCents
      });

      // Enviar email con PDF adjunto
      await sendInvoiceEmail({
        to: customerEmail,
        customerName,
        orderNumber,
        pdfBase64,
        items: invoiceItems
      });

      console.log(`[WEBHOOK] Factura enviada correctamente a ${customerEmail}`);

    } catch (emailError: any) {
      console.error('[WEBHOOK] Error al enviar factura:', emailError.message);
      // No lanzamos error para no fallar todo el webhook
      // La factura se puede enviar manualmente después
    }

  } catch (error: any) {
    console.error('[WEBHOOK] Error handling successful payment:', error);
    throw error;
  }
}

// ============================================================================
// Función para manejar sesiones expiradas
// ============================================================================
async function handleExpiredSession(session: Stripe.Checkout.Session) {
  try {
    console.log('[WEBHOOK] Procesando sesion expirada - Session ID:', session.id);

    // Cancelar reservas de stock asociadas (si el sistema de reservas esta activo)
    try {
      const { data: cancelResult, error: cancelError } = await supabaseAdmin.rpc('cancel_reservation', {
        p_session_id: session.id,
        p_reason: 'checkout_expired'
      }) as { data: any; error: any };

      if (cancelError) {
        console.warn('[WEBHOOK] cancel_reservation no disponible o fallo:', cancelError.message);
      } else if (cancelResult?.success) {
        console.log(`[WEBHOOK] Reservas canceladas: ${cancelResult.cancelled} items liberados`);
      } else {
        console.warn('[WEBHOOK] No se encontraron reservas para cancelar (posiblemente ya expiradas o no se usa reservas)');
      }
    } catch (rpcErr: any) {
      console.warn('[WEBHOOK] Sistema de reservas no disponible para cancelacion:', rpcErr.message);
    }

  } catch (error: any) {
    console.error('[WEBHOOK] Error al procesar sesion expirada:', error);
    // No relanzar, no es critico
  }
}

