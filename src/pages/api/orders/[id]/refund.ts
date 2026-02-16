import type { APIRoute } from 'astro';
import { supabase } from '@lib/supabase';
import Stripe from 'stripe';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-12-15.clover',
});

export const POST: APIRoute = async ({ params, request }) => {
  try {
    const { id } = params;
    
    if (!id) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Order ID required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Obtener el pedido
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Order not found' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verificar que el pedido esté pagado
    if (order.payment_status !== 'paid') {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Solo se pueden reembolsar pedidos pagados' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verificar que no esté ya reembolsado
    if (order.status === 'refunded' || order.payment_status === 'refunded') {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Este pedido ya está reembolsado' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verificar que tenga payment_id de Stripe
    if (!order.payment_id) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'No se encontró información de pago de Stripe' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 1. Procesar reembolso en Stripe
    let refund;
    try {
      refund = await stripe.refunds.create({
        payment_intent: order.payment_id,
        reason: 'requested_by_customer',
      });
      
      console.log(`[REFUND] Refund created in Stripe: ${refund.id}`);
    } catch (stripeError: any) {
      console.error('Error creating refund in Stripe:', stripeError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Error en Stripe: ${stripeError.message}` 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Obtener items del pedido para recuperar stock
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', id);

    if (itemsError) {
      console.error('Error fetching order items:', itemsError);
      // Continuar de todas formas, ya se procesó el reembolso
    }

    // 3. Recuperar stock de cada producto (RPC con fallback directo)
    if (orderItems && orderItems.length > 0) {
      for (const item of orderItems) {
        let restored = false;

        // Intento 1: RPC increment_stock (con soporte de talla)
        try {
          const { error: stockError } = await supabase.rpc('increment_stock', {
            product_id: item.product_id,
            quantity: item.quantity,
            p_size: item.size || null
          });

          if (!stockError) {
            restored = true;
            console.log(`[REFUND] Stock incrementado (RPC) para producto ${item.product_id} talla ${item.size || 'Única'}: +${item.quantity}`);
          } else {
            console.warn(`[REFUND] RPC increment_stock falló para ${item.product_id}:`, stockError.message);
          }
        } catch (error) {
          console.warn('[REFUND] RPC increment_stock no disponible:', error);
        }

        // Intento 2: Fallback directo UPDATE (stock + stock_by_size)
        if (!restored) {
          try {
            const { data: prod } = await supabase
              .from('products')
              .select('stock, stock_by_size')
              .eq('id', item.product_id)
              .single();

            if (prod) {
              const newStock = (prod.stock || 0) + item.quantity;
              const updateData: any = {
                stock: newStock,
                updated_at: new Date().toISOString()
              };

              // Restaurar stock_by_size también
              const itemSize = item.size || 'Única';
              if (prod.stock_by_size && typeof prod.stock_by_size === 'object') {
                const sizeStock = prod.stock_by_size as Record<string, number>;
                sizeStock[itemSize] = (sizeStock[itemSize] || 0) + item.quantity;
                updateData.stock_by_size = sizeStock;
              }

              const { error: updateErr } = await supabase
                .from('products')
                .update(updateData)
                .eq('id', item.product_id);

              if (!updateErr) {
                restored = true;
                console.log(`[REFUND] Stock restaurado (fallback directo): ${item.product_id} talla ${itemSize} +${item.quantity}`);
              } else {
                console.error(`[REFUND] Fallback UPDATE falló para ${item.product_id}:`, updateErr);
              }
            }
          } catch (fallbackErr) {
            console.error(`[REFUND] Error en fallback stock ${item.product_id}:`, fallbackErr);
          }
        }
      }
    }

    // 4. Actualizar estado del pedido
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'refunded',
        payment_status: 'refunded',
        admin_notes: order.admin_notes 
          ? `${order.admin_notes}\n\nReembolso procesado: ${refund.id} (${new Date().toLocaleString('es-ES')})`
          : `Reembolso procesado: ${refund.id} (${new Date().toLocaleString('es-ES')})`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating order:', updateError);
      // El reembolso ya se procesó en Stripe, así que es mejor avisar
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Reembolso procesado en Stripe pero error actualizando base de datos',
        warning: 'El dinero fue reembolsado pero el estado del pedido no se actualizó correctamente'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`[REFUND] Order ${order.order_number} refunded successfully`);

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Reembolso procesado correctamente',
      refund: {
        id: refund.id,
        amount: refund.amount / 100,
        status: refund.status
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error in refund endpoint:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'Error procesando reembolso'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
