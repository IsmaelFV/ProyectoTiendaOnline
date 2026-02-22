/**
 * ============================================================================
 * VERIFY ORDER - Fallback si el webhook de Stripe no procesa el pedido
 * ============================================================================
 * La pagina de exito llama a este endpoint para verificar que el pedido
 * fue creado. Si el webhook no lo creo (por cualquier razon), este endpoint
 * lo crea como fallback garantizando que ningun pedido se pierde.
 */

import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { generateInvoicePDF } from '../../../lib/invoice-pdf';
import { sendInvoiceEmail } from '../../../lib/brevo';

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

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-12-15.clover',
});

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const { sessionId } = await request.json();

    if (!sessionId || typeof sessionId !== 'string') {
      return new Response(JSON.stringify({ error: 'sessionId requerido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validar formato de sessionId para prevenir PostgREST injection
    if (!/^cs_(test|live)_[a-zA-Z0-9]+$/.test(sessionId)) {
      return new Response(JSON.stringify({ error: 'sessionId inválido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`[VERIFY-ORDER] Verificando sesion: ${sessionId}`);

    // 1. Verificar en Stripe que la sesion es valida y fue pagada
    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['line_items', 'line_items.data.price.product']
      });
    } catch (stripeErr: any) {
      console.error('[VERIFY-ORDER] Error retrieving session:', stripeErr.message);
      return new Response(JSON.stringify({ error: 'Sesion no encontrada' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Solo procesar sesiones pagadas
    if (session.payment_status !== 'paid') {
      console.log(`[VERIFY-ORDER] Sesion ${sessionId} no esta pagada: ${session.payment_status}`);
      return new Response(JSON.stringify({ 
        status: 'pending',
        message: 'Pago aun no completado' 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verificar identidad: si la sesión tiene user_id, comprobar que el caller es ese usuario
    const sessionUserId = session.metadata?.user_id;
    if (sessionUserId && sessionUserId !== 'guest') {
      const accessToken = cookies.get('sb-access-token')?.value;
      if (!accessToken) {
        return new Response(JSON.stringify({ error: 'Autenticación requerida' }), {
          status: 401, headers: { 'Content-Type': 'application/json' }
        });
      }
      const { data: authData } = await supabaseAdmin.auth.getUser(accessToken);
      if (!authData.user || authData.user.id !== sessionUserId) {
        return new Response(JSON.stringify({ error: 'No autorizado' }), {
          status: 403, headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // 2. Verificar si ya existe un pedido para esta sesion (el webhook ya lo creo)
    const { data: existingOrder } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, status')
      .or(`payment_id.eq.${session.payment_intent},admin_notes.ilike.%${sessionId}%`)
      .maybeSingle();

    if (existingOrder) {
      console.log(`[VERIFY-ORDER] Pedido ya existe: ${existingOrder.order_number}`);
      return new Response(JSON.stringify({ 
        status: 'exists',
        orderNumber: existingOrder.order_number,
        orderId: existingOrder.id
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 3. EL PEDIDO NO EXISTE - Crearlo como fallback
    console.log('[VERIFY-ORDER] Pedido NO encontrado, creando como fallback...');

    // Re-check atómico por payment_id para reducir race condition de pedidos duplicados
    const { data: doubleCheck } = await supabaseAdmin
      .from('orders')
      .select('id, order_number')
      .eq('payment_id', session.payment_intent as string)
      .maybeSingle();

    if (doubleCheck) {
      console.log(`[VERIFY-ORDER] Pedido encontrado en re-check: ${doubleCheck.order_number}`);
      return new Response(JSON.stringify({
        status: 'exists',
        orderNumber: doubleCheck.order_number,
        orderId: doubleCheck.id
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { user_id, discount_code } = session.metadata || {};

    // Parsear info de tallas
    let orderItemsSizes: Array<{ id: string; size: string; qty: number }> = [];
    try {
      if (session.metadata?.order_items_sizes) {
        orderItemsSizes = JSON.parse(session.metadata.order_items_sizes);
      }
    } catch (e) {
      console.warn('[VERIFY-ORDER] Error parsing order_items_sizes:', e);
    }

    // Obtener line_items
    const lineItems = session.line_items?.data || [];
    
    if (lineItems.length === 0) {
      // Si no se expandieron, obtenerlos manualmente
      const fetchedItems = await stripe.checkout.sessions.listLineItems(sessionId, {
        expand: ['data.price.product']
      });
      lineItems.push(...fetchedItems.data);
    }

    if (lineItems.length === 0) {
      console.error('[VERIFY-ORDER] No line items found');
      return new Response(JSON.stringify({ error: 'No se encontraron productos' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Calcular totales
    const subtotalCents = lineItems.reduce((sum, item) => {
      return sum + ((item.price?.unit_amount || 0) * (item.quantity || 1));
    }, 0);
    
    const totalCents = session.amount_total || 0;
    const taxCents = session.total_details?.amount_tax || 0;
    const shippingCents = session.total_details?.amount_shipping || 0;
    const discountCents = session.total_details?.amount_discount || 0;

    // Crear pedido
    // Generar order_number desde codigo (por si el trigger no existe en la BD)
    const yearNow = new Date().getFullYear();
    const rndSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    const fallbackOrderNum = `ORD-${yearNow}-${Date.now().toString().slice(-6)}-${rndSuffix}`;

    const orderData = {
      order_number: fallbackOrderNum,
      user_id: (user_id && user_id !== 'guest') ? user_id : null,
      shipping_full_name: session.customer_details?.name || 'Cliente',
      shipping_phone: session.customer_details?.phone || '',
      shipping_address_line1: session.customer_details?.address?.line1 || 'Direccion no proporcionada',
      shipping_address_line2: session.customer_details?.address?.line2 || null,
      shipping_city: session.customer_details?.address?.city || 'Ciudad',
      shipping_state: session.customer_details?.address?.state || '',
      shipping_postal_code: session.customer_details?.address?.postal_code || '00000',
      shipping_country: session.customer_details?.address?.country || 'ES',
      subtotal: subtotalCents / 100,
      shipping_cost: shippingCents / 100,
      tax: taxCents / 100,
      discount: discountCents / 100,
      total: totalCents / 100,
      payment_method: 'card',
      payment_status: 'paid',
      payment_id: session.payment_intent as string,
      status: 'confirmed',
      customer_notes: discount_code ? `Codigo aplicado: ${discount_code}` : null,
      admin_notes: `[FALLBACK] Stripe Session: ${session.id} | Email: ${session.customer_details?.email || session.customer_email}`,
    };

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert(orderData)
      .select()
      .single();

    if (orderError) {
      console.error('[VERIFY-ORDER] Error creating order:', orderError);
      return new Response(JSON.stringify({ error: 'Error creando pedido' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`[VERIFY-ORDER] Pedido creado: ${order.order_number} (ID: ${order.id})`);

    // 4. Crear order_items y decrementar stock
    const verifyProductImages: Map<string, string> = new Map();
    for (const lineItem of lineItems) {
      const productName = lineItem.description || 'Producto';
      const quantity = lineItem.quantity || 1;
      const pricePerUnit = lineItem.price?.unit_amount || 0;

      const { data: product } = await supabaseAdmin
        .from('products')
        .select('id, slug, sku, images, stock, stock_by_size')
        .eq('name', productName)
        .maybeSingle();

      if (product?.id) {
        const productImage = product.images?.[0] || null;
        if (productImage) {
          verifyProductImages.set(productName, productImage);
        }
        const itemSizeInfo = orderItemsSizes.find(oi => oi.id === product.id);
        const itemSize = itemSizeInfo?.size || 'Unica';

        // Crear order_item
        await supabaseAdmin
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

        // Decrementar stock atómicamente (evita race condition)
        // Intento 1: RPC atómica
        let stockUpdated = false;
        try {
          const { error: rpcErr } = await supabaseAdmin.rpc('atomic_decrement_stock', {
            p_product_id: product.id,
            p_quantity: quantity,
            p_size: itemSize
          });
          if (!rpcErr) stockUpdated = true;
        } catch (_) { /* RPC no disponible */ }

        // Intento 2: Fallback con validate_and_decrement_stock
        if (!stockUpdated) {
          try {
            const { data: result, error: rpcErr2 } = await supabaseAdmin.rpc('validate_and_decrement_stock', {
              p_items: [{ product_id: product.id, size: itemSize, quantity }]
            }) as { data: any; error: any };
            if (!rpcErr2 && result?.success) stockUpdated = true;
          } catch (_) { /* RPC no disponible */ }
        }

        // Si RPC falló, registrar para revisión manual (no usar fallback no-atómico que causa drift de stock)
        if (!stockUpdated) {
          console.error(`[VERIFY-ORDER][CRITICAL] Stock decrement RPC failed for product ${product.id} size ${itemSize} qty ${quantity} — requires manual stock adjustment`);
        }

        console.log(`[VERIFY-ORDER] Stock procesado: ${product.id} (stockUpdated: ${stockUpdated})`);
      } else {
        console.warn(`[VERIFY-ORDER] Producto "${productName}" no encontrado en BD`);
      }
    }

    // 5. Enviar email de factura
    try {
      const customerEmail = session.customer_details?.email || session.customer_email;
      const customerName = session.customer_details?.name || 'Cliente';

      if (customerEmail) {
        const invoiceItems = lineItems.map(item => ({
          name: item.description || 'Producto',
          quantity: item.quantity || 1,
          price: item.price?.unit_amount || 0,
          total: (item.price?.unit_amount || 0) * (item.quantity || 1),
          image: verifyProductImages.get(item.description || '') || undefined
        }));

        const shippingAddress = session.customer_details?.address 
          ? `${session.customer_details.address.line1 || ''}${session.customer_details.address.line2 ? ', ' + session.customer_details.address.line2 : ''}, ${session.customer_details.address.city || ''}, ${session.customer_details.address.postal_code || ''}, ${session.customer_details.address.country || ''}`
          : 'Direccion no proporcionada';

        const pdfBase64 = await generateInvoicePDF({
          orderNumber: order.order_number,
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

        await sendInvoiceEmail({
          to: customerEmail,
          customerName,
          orderNumber: order.order_number,
          pdfBase64,
          items: invoiceItems
        });

        console.log(`[VERIFY-ORDER] Factura enviada a ${customerEmail}`);
      }
    } catch (emailError: any) {
      console.error('[VERIFY-ORDER] Error enviando factura:', emailError.message);
    }

    return new Response(JSON.stringify({ 
      status: 'created',
      orderNumber: order.order_number,
      orderId: order.id,
      message: 'Pedido creado correctamente (fallback)'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[VERIFY-ORDER] Error general:', error);
    return new Response(JSON.stringify({ 
      error: 'Error verificando pedido'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
