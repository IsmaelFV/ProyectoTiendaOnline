import type { APIRoute } from 'astro';
import { verifyAdminFromCookies, createServerSupabaseClient } from '@lib/auth';
import Stripe from 'stripe';
import { createAndSendCreditNote } from '../../../../lib/credit-note-service';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-12-15.clover',
});

export const POST: APIRoute = async ({ params, request, cookies }) => {
  try {
    // Verificar autenticación admin
    const accessToken = cookies.get('sb-access-token')?.value;
    const refreshToken = cookies.get('sb-refresh-token')?.value;
    const userId = await verifyAdminFromCookies(accessToken, refreshToken);
    if (!userId) {
      return new Response(JSON.stringify({ success: false, error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const supabase = createServerSupabaseClient();
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

    // Obtener el pedido con lock optimista: marcarlo como 'refunding' atómicamente
    // para prevenir doble reembolso por peticiones concurrentes
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .update({ status: 'refunding', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('payment_status', 'paid')
      .not('status', 'in', '(refunded,refunding)')
      .select('*')
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Pedido no encontrado, ya reembolsado, o no está pagado' 
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
        error: 'Error al procesar el reembolso en la pasarela de pago' 
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

        // Si RPC falló, registrar para revisión manual (no usar fallback no-atómico que causa drift de stock)
        if (!restored) {
          console.error(`[REFUND][CRITICAL] Stock increment RPC failed for product ${item.product_id} size ${item.size || 'Única'} qty ${item.quantity} — requires manual stock adjustment`);
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
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Reembolso procesado en Stripe pero error actualizando base de datos',
        warning: 'El dinero fue reembolsado pero el estado del pedido no se actualizó correctamente'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 5. Generar y enviar Factura de Abono (Rectificativa)
    const creditNoteNumber = await createAndSendCreditNote({
      supabase,
      order,
      orderItems,
      stripeRefundId: refund.id,
      reason: 'Reembolso completo del pedido solicitado por el administrador',
      logPrefix: '[REFUND]',
    });

    console.log(`[REFUND] Order ${order.order_number} refunded successfully`);

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Reembolso procesado correctamente',
      refund: {
        id: refund.id,
        amount: refund.amount / 100,
        status: refund.status
      },
      creditNote: creditNoteNumber || null
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error in refund endpoint:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Error procesando reembolso'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
