import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { supabase } from '../../../lib/supabase';
import { createServerSupabaseClient } from '../../../lib/auth';

// Inicializar Stripe con la clave secreta (server-side)
const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-12-15.clover',
});

// Helper para crear cupón de Stripe dinámicamente
async function createStripeCoupon(discountAmountCents: number, totalAmountCents: number): Promise<string> {
  const coupon = await stripe.coupons.create({
    amount_off: discountAmountCents,
    currency: 'eur',
    duration: 'once',
    name: `Descuento -${(discountAmountCents / 100).toFixed(2)}€`
  });
  return coupon.id;
}

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // 1. Verificar autenticación del usuario (OPCIONAL - permite checkout como invitado)
    const accessToken = cookies.get('sb-access-token')?.value;
    let user = null;
    
    if (accessToken) {
      const { data } = await supabase.auth.getUser(accessToken);
      user = data.user;
    }

    // 2. Obtener los items del carrito desde el request
    const body = await request.json();
    const { items, discountCode } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'El carrito está vacío' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 3. Validar stock y precios en Supabase (ÚNICA FUENTE DE VERDAD)
    const productIds = items.map((item: any) => item.id);
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, slug, sku, price, stock, stock_by_size, images')
      .in('id', productIds);

    if (productsError || !products) {
      console.error('Error al validar productos:', productsError);
      return new Response(JSON.stringify({ 
        error: 'Error al validar productos',
        details: productsError?.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 4. Crear un mapa de productos para validación
    const productMap = new Map(products.map(p => [p.id, p]));

    // 5. RESERVAR STOCK de forma atómica (OPCIONAL - si las funciones existen)
    const supabaseAdmin = createServerSupabaseClient();
    const reservationIds: string[] = [];
    const tempSessionId = `temp_${Date.now()}_${user?.id || 'guest'}`;
    let reservationSystemAvailable = true;

    for (const item of items) {
      const product = productMap.get(item.id);
      
      if (!product) {
        return new Response(JSON.stringify({ 
          error: `Producto no encontrado: ${item.id}` 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Validar stock básico (sin RPC, lectura directa)
      const itemSize = item.size || 'Única';
      let availableStock = product.stock || 0;
      
      if (product.stock_by_size && typeof product.stock_by_size === 'object') {
        const sizeStock = product.stock_by_size as Record<string, number>;
        if (itemSize in sizeStock) {
          availableStock = sizeStock[itemSize] || 0;
        }
      }

      if (availableStock < item.quantity) {
        return new Response(JSON.stringify({ 
          error: `Stock insuficiente para "${product.name}" (talla ${itemSize}). Solo quedan ${availableStock} unidades disponibles.`,
          available: availableStock,
          requested: item.quantity
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Intentar reserva atómica (si la función existe)
      if (reservationSystemAvailable) {
        try {
          const { data: reservation, error: reservationError } = await supabaseAdmin.rpc('reserve_stock', {
            p_product_id: item.id,
            p_quantity: item.quantity,
            p_session_id: tempSessionId,
            p_user_id: user?.id || null,
            p_size: item.size || null
          }) as { data: any; error: any };

          if (reservationError) {
            console.warn('[CHECKOUT] reserve_stock no disponible:', reservationError.message);
            reservationSystemAvailable = false;
          } else if (!reservation?.success) {
            // Stock insuficiente según la reserva
            if (reservationIds.length > 0) {
              try {
                await supabaseAdmin.rpc('cancel_reservation', {
                  p_session_id: tempSessionId,
                  p_reason: 'reservation_failed'
                });
              } catch (e) { /* ignorar */ }
            }
            return new Response(JSON.stringify({ 
              error: `Stock insuficiente para "${product.name}" (talla ${item.size || 'Única'}). Solo quedan ${reservation.available} unidades disponibles.`,
              available: reservation?.available || 0,
              requested: item.quantity
            }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          } else {
            reservationIds.push(reservation.reservation_id);
          }
        } catch (rpcErr: any) {
          console.warn('[CHECKOUT] Sistema de reservas no disponible:', rpcErr.message);
          reservationSystemAvailable = false;
        }
      }
    }

    // 6. Validar y calcular total en el servidor
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
    const orderItems: any[] = [];
    let totalAmount = 0;

    for (const item of items) {
      const product = productMap.get(item.id)!;

      // Usar precio de Supabase (no del cliente)
      const unitPrice = product.price;
      const itemTotal = unitPrice * item.quantity;
      totalAmount += itemTotal;

      // Preparar line items para Stripe
      const imageUrl = product.images && Array.isArray(product.images) && product.images.length > 0 
        ? product.images[0] 
        : null;
      
      lineItems.push({
        price_data: {
          currency: 'eur',
          product_data: {
            name: product.name,
            images: imageUrl ? [imageUrl] : [],
          },
          unit_amount: unitPrice, // Ya está en centavos
        },
        quantity: item.quantity,
      });

      // Guardar para crear el pedido después
      orderItems.push({
        product_id: product.id,
        product_name: product.name,
        product_slug: product.slug,
        product_sku: product.sku || null,
        product_image: imageUrl,
        size: item.size || 'M', // Default si no se especifica
        quantity: item.quantity,
        unit_price: unitPrice,
        total: itemTotal
      });
    }

    // 6.5. Validar y aplicar código de descuento si existe
    let discountAmount = 0;
    let discountData: any = null;

    if (discountCode && discountCode.trim()) {
      const supabaseAdmin = createServerSupabaseClient();
      try {
        const { data: validationResult, error: discountError } = await supabaseAdmin.rpc('validate_discount_code', {
          p_code: discountCode.trim(),
          p_cart_total: totalAmount / 100, // Convertir a euros
          p_user_id: user?.id || null
        });

        if (discountError) {
          console.warn('[CHECKOUT] Error validating discount code:', discountError.message);
          // Continuar sin descuento en vez de fallar
        } else {
          const validation = validationResult as { valid: boolean; message: string; discount_amount?: number; code?: string };

          if (!validation.valid) {
            // Cancelar reservas si el codigo no es valido
            if (reservationIds.length > 0) {
              try {
                await supabaseAdmin.rpc('cancel_reservation', {
                  p_session_id: tempSessionId,
                  p_reason: 'invalid_discount_code'
                });
              } catch (e) { /* ignorar */ }
            }
            return new Response(JSON.stringify({ 
              error: validation.message 
            }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          // Aplicar descuento
          discountAmount = Math.round((validation.discount_amount || 0) * 100); // Convertir a centavos
          discountData = validation;
          console.log(`[CHECKOUT] Descuento aplicado: ${discountCode} (-${discountAmount / 100}EUR)`);
        }
      } catch (rpcErr: any) {
        console.warn('[CHECKOUT] validate_discount_code no disponible:', rpcErr.message);
        // Continuar sin descuento
      }
    }

    // Calcular total final
    const finalTotalAmount = totalAmount - discountAmount;

    // 7. Crear sesión de Stripe Checkout
    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: lineItems,
      success_url: `${request.headers.get('origin')}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${request.headers.get('origin')}/checkout/cancel`,
      customer_email: user?.email,
      client_reference_id: user?.id || `guest_${Date.now()}`,
      metadata: {
        user_id: user?.id || 'guest',
        user_email: user?.email || '',
        total_amount: totalAmount.toString(),
        temp_session_id: tempSessionId, // Para actualizar reservas después
        reservation_ids: JSON.stringify(reservationIds), // IDs de reservas
        discount_code: discountCode || '',
        discount_amount: discountAmount.toString(),
        // Info de tallas por item para decrement_stock en webhook
        order_items_sizes: JSON.stringify(
          items.map((item: any) => ({ id: item.id, size: item.size || 'Única', qty: item.quantity }))
        ),
      },
      shipping_address_collection: {
        allowed_countries: ['ES', 'FR', 'DE', 'IT', 'PT', 'US'],
      },
      expires_at: Math.floor(Date.now() / 1000) + (3 * 60 * 60), // 3 horas (Stripe: mín 30 min, máx 24 hrs)
    };

    // Aplicar descuento en Stripe si existe
    if (discountAmount > 0) {
      sessionConfig.discounts = [{
        coupon: await createStripeCoupon(discountAmount, totalAmount)
      }];
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    // 8. Actualizar reservas con el session_id real de Stripe (si se usaron reservas)
    if (reservationIds.length > 0) {
      try {
        const { error: updateError } = await supabaseAdmin
          .from('stock_reservations')
          .update({ session_id: session.id })
          .eq('session_id', tempSessionId);

        if (updateError) {
          console.warn('[CHECKOUT] Error actualizando session_id de reservas:', updateError.message);
        }
      } catch (e: any) {
        console.warn('[CHECKOUT] Tabla stock_reservations no existe o error:', e.message);
      }
    }

    // 9. Retornar URL de checkout de Stripe
    return new Response(JSON.stringify({ 
      url: session.url,
      sessionId: session.id,
      reservations: reservationIds.length // Info para debugging
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error en checkout:', error);
    return new Response(JSON.stringify({ 
      error: 'Error al procesar el pago',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
