/**
 * API Admin: Gestionar Devoluciones
 * POST /api/admin/returns/manage
 * 
 * Acciones: receive (marcar recibido → reembolso automático), reject, expire_check
 */

import type { APIRoute } from 'astro';
import { createServerSupabaseClient, verifyAdminFromCookies } from '../../../../lib/auth';
import Stripe from 'stripe';
import { createAndSendCreditNote } from '../../../../lib/credit-note-service';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-12-15.clover',
});

export const POST: APIRoute = async ({ request, cookies }) => {
  const json = (body: any, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  try {
    // Verificar admin
    const accessToken = cookies.get('sb-access-token')?.value;
    const refreshToken = cookies.get('sb-refresh-token')?.value;
    const adminId = await verifyAdminFromCookies(accessToken, refreshToken);

    if (!adminId) {
      return json({ success: false, message: 'No autorizado' }, 401);
    }

    const supabase = createServerSupabaseClient();
    const { action, returnId, notes } = await request.json();

    if (!returnId || !action) {
      return json({ success: false, message: 'Faltan parámetros' }, 400);
    }

    // Obtener la devolución con el pedido asociado
    const { data: returnData, error: retError } = await supabase
      .from('returns')
      .select('*, orders(*)')
      .eq('id', returnId)
      .single();

    if (retError || !returnData) {
      return json({ success: false, message: 'Devolución no encontrada' }, 404);
    }

    switch (action) {
      // ========== MARCAR COMO RECIBIDO → REEMBOLSAR ========== 
      case 'receive': {
        if (!['pending', 'approved'].includes(returnData.status)) {
          return json({ success: false, message: 'Solo se pueden recibir devoluciones pendientes o aprobadas' }, 400);
        }

        const order = returnData.orders;
        if (!order) {
          return json({ success: false, message: 'Pedido asociado no encontrado' }, 400);
        }

        // Procesar reembolso en Stripe
        let stripeRefundId: string | null = null;
        if (order.payment_id && order.payment_status === 'paid') {
          try {
            const refund = await stripe.refunds.create({
              payment_intent: order.payment_id,
              reason: 'requested_by_customer',
            });
            stripeRefundId = refund.id;
            console.log(`[RETURNS] Reembolso Stripe (devolucion): ${refund.id}`);
          } catch (stripeErr: any) {
            console.error('[RETURNS] Stripe refund error:', stripeErr.message);
            return json({ success: false, message: 'Error al procesar el reembolso en la pasarela de pago' }, 500);
          }
        }

        // Restaurar stock
        const { data: orderItems } = await supabase
          .from('order_items')
          .select('*')
          .eq('order_id', order.id);

        if (orderItems?.length) {
          for (const item of orderItems) {
            try {
              await supabase.rpc('increment_stock', {
                product_id: item.product_id,
                quantity: item.quantity,
                p_size: item.size || null
              });
            } catch (err) {
              console.error(`Error stock ${item.product_id}:`, err);
            }
          }
        }

        // Actualizar devolución
        await supabase
          .from('returns')
          .update({
            status: 'refunded',
            received_at: new Date().toISOString(),
            refunded_at: new Date().toISOString(),
            stripe_refund_id: stripeRefundId,
            admin_notes: `${returnData.admin_notes || ''}\n[ADMIN] Producto recibido y reembolso procesado. ${stripeRefundId ? `Stripe: ${stripeRefundId}` : ''}. (${new Date().toLocaleString('es-ES')})`.trim(),
            updated_at: new Date().toISOString()
          })
          .eq('id', returnId);

        // Actualizar pedido
        await supabase
          .from('orders')
          .update({
            status: 'refunded',
            payment_status: stripeRefundId ? 'refunded' : order.payment_status,
            admin_notes: `${order.admin_notes || ''}\n[ADMIN] Devolución recibida y reembolsada. ${stripeRefundId || ''}. (${new Date().toLocaleString('es-ES')})`.trim(),
            updated_at: new Date().toISOString()
          })
          .eq('id', order.id);

        // Generar y enviar Factura de Abono (Rectificativa)
        const creditNoteNumber = await createAndSendCreditNote({
          supabase,
          order,
          orderItems,
          stripeRefundId,
          reason: returnData.reason || 'Devolución de producto',
          returnId,
          logPrefix: '[RETURNS]',
        });

        return json({ 
          success: true, 
          message: 'Producto recibido y reembolso procesado correctamente',
          refundId: stripeRefundId,
          creditNote: creditNoteNumber || null
        });
      }

      // ========== RECHAZAR DEVOLUCIÓN ========== 
      case 'reject': {
        if (returnData.status !== 'pending') {
          return json({ success: false, message: 'Solo se pueden rechazar devoluciones pendientes' }, 400);
        }

        await supabase
          .from('returns')
          .update({
            status: 'rejected',
            admin_notes: `${returnData.admin_notes || ''}\n[ADMIN] Devolución rechazada. Motivo: ${notes || 'Sin especificar'}. (${new Date().toLocaleString('es-ES')})`.trim(),
            updated_at: new Date().toISOString()
          })
          .eq('id', returnId);

        // Restaurar estado del pedido
        const prevStatus = returnData.orders?.status === 'return_requested' 
          ? 'delivered' : returnData.orders?.status;
        await supabase
          .from('orders')
          .update({ 
            status: prevStatus || 'delivered',
            updated_at: new Date().toISOString()
          })
          .eq('id', returnData.order_id);

        return json({ success: true, message: 'Devolución rechazada' });
      }

      // ========== VERIFICAR EXPIRACIÓN ========== 
      case 'expire_check': {
        // Llamar a la función SQL que expira devoluciones vencidas
        await supabase.rpc('expire_overdue_returns');
        return json({ success: true, message: 'Verificación de expiración completada' });
      }

      default:
        return json({ success: false, message: 'Acción no válida' }, 400);
    }

  } catch (error: any) {
    console.error('[ADMIN RETURNS] Error:', error);
    return json({ success: false, message: 'Error interno del servidor' }, 500);
  }
};
