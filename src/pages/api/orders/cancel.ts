/**
 * API Endpoint: Cancelar Pedido (FASE 1 — dentro de 2 horas)
 * POST /api/orders/cancel
 * 
 * Si el pedido fue realizado hace menos de 2 horas → cancelación directa + reembolso Stripe.
 * Si han pasado más de 2 horas → informa al cliente de usar el flujo de devolución.
 * Requiere autenticación Bearer.
 */

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { createAndSendCreditNote } from '../../../lib/credit-note-service';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-12-15.clover',
});

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

export const POST: APIRoute = async ({ request }) => {
  const json = (body: any, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  try {
    // 1. Autenticación
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ success: false, message: 'No autenticado' }, 401);
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      return json({ success: false, message: 'Token inválido o expirado' }, 401);
    }

    const { orderId } = await request.json();
    if (!orderId) {
      return json({ success: false, message: 'ID de pedido requerido' }, 400);
    }

    // Validar formato UUID
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (typeof orderId !== 'string' || !UUID_RE.test(orderId)) {
      return json({ success: false, message: 'ID de pedido inválido' }, 400);
    }

    // 2. Obtener pedido (verificar propiedad)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('user_id', user.id)
      .single();

    if (orderError || !order) {
      return json({ success: false, message: 'Pedido no encontrado' }, 404);
    }

    // 3. Verificaciones de estado
    if (['cancelled', 'refunded'].includes(order.status)) {
      return json({ success: false, message: 'Este pedido ya ha sido cancelado o reembolsado' }, 400);
    }
    if (['shipped', 'delivered'].includes(order.status)) {
      return json({ success: false, message: 'No se puede cancelar un pedido ya enviado o entregado' }, 400);
    }

    // 4. Comprobar ventana de 2 horas
    const timeSinceOrder = Date.now() - new Date(order.created_at).getTime();

    if (timeSinceOrder >= TWO_HOURS_MS) {
      return json({ 
        success: false, 
        type: 'requires_return',
        message: 'Han pasado más de 2 horas desde tu compra. Para solicitar un reembolso, usa la opción "Solicitar Devolución".',
        hoursElapsed: Math.floor(timeSinceOrder / (1000 * 60 * 60))
      }, 400);
    }

    // === CANCELACIÓN DIRECTA (< 2h) ===

    // a) Reembolso Stripe
    let stripeRefundId: string | null = null;
    if (order.payment_id && order.payment_status === 'paid') {
      try {
        const refund = await stripe.refunds.create({
          payment_intent: order.payment_id,
          reason: 'requested_by_customer',
        });
        stripeRefundId = refund.id;
        console.log(`[CANCEL] Stripe refund: ${refund.id} (${refund.amount / 100}€)`);
      } catch (stripeErr: any) {
        console.error('[CANCEL] Stripe refund error:', stripeErr.message);
        return json({ success: false, message: 'Error al procesar el reembolso. Inténtalo de nuevo.' }, 500);
      }
    }

    // b) Restaurar stock
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId);

    let restoredItems = 0;
    if (orderItems?.length) {
      for (const item of orderItems) {
        let restored = false;

        // Intento 1: RPC increment_stock (con soporte de talla)
        try {
          const { error: rpcError } = await supabase.rpc('increment_stock', {
            product_id: item.product_id,
            quantity: item.quantity,
            p_size: item.size || null
          });
          if (!rpcError) {
            restored = true;
          } else {
            console.warn(`[CANCEL] RPC increment_stock falló para ${item.product_id}:`, rpcError.message);
          }
        } catch (err) {
          console.warn(`[CANCEL] RPC increment_stock no disponible para ${item.product_id}:`, err);
        }

        // Si RPC falló, registrar para revisión manual (no usar fallback no-atómico que causa drift de stock)
        if (!restored) {
          console.error(`[CANCEL][CRITICAL] Stock increment RPC failed for product ${item.product_id} size ${item.size || 'Única'} qty ${item.quantity} — requires manual stock adjustment`);
        }

        if (restored) restoredItems++;
      }
    }

    // c) Actualizar pedido
    await supabase
      .from('orders')
      .update({
        status: 'cancelled',
        payment_status: stripeRefundId ? 'refunded' : order.payment_status,
        admin_notes: `${order.admin_notes || ''}\n[SISTEMA] Cancelación automática (< 2h). ${stripeRefundId ? `Reembolso Stripe: ${stripeRefundId}` : 'Sin pago que reembolsar'}. Stock restaurado: ${restoredItems} items. (${new Date().toLocaleString('es-ES')})`.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    // d) Registrar cancelación en tabla returns (para trazabilidad)
    try {
      await supabase.from('returns').insert({
        order_id: orderId,
        user_id: user.id,
        type: 'cancellation',
        status: 'refunded',
        reason: 'Cancelación del pedido por el cliente (dentro del plazo de 2 horas)',
        refund_amount: order.total,
        stripe_refund_id: stripeRefundId || null,
        customer_email: order.customer_email || user.email || '',
      });
    } catch (retErr: any) {
      // No bloquear la cancelación si falla el registro en returns
      console.warn('[CANCEL] Error al registrar en returns:', retErr.message);
    }

    // e) Generar y enviar Factura de Abono (Rectificativa)
    let creditNoteNumber: string | null = null;
    if (stripeRefundId) {
      // Asegurar que el email del cliente está disponible (fallback a user.email)
      const orderForCreditNote = {
        ...order,
        customer_email: order.customer_email || user.email || '',
      };
      creditNoteNumber = await createAndSendCreditNote({
        supabase,
        order: orderForCreditNote,
        orderItems: orderItems || null,
        stripeRefundId,
        reason: 'Cancelación del pedido por el cliente (dentro del plazo de 2 horas)',
        logPrefix: '[CANCEL]',
      });
    }

    console.log(`[CANCEL] Pedido ${order.order_number} cancelado (<2h). User: ${user.id}. Stock: ${restoredItems} items.`);

    return json({ 
      success: true, 
      type: 'cancellation',
      message: 'Pedido cancelado correctamente. El reembolso se ha procesado y recibirás el dinero en 3-5 días laborables.',
      refundId: stripeRefundId,
      creditNote: creditNoteNumber || null,
      restored_items: restoredItems
    });

  } catch (error: any) {
    console.error('[CANCEL ORDER] Error:', error);
    return json({ success: false, message: 'Error inesperado al procesar la cancelación' }, 500);
  }
};
