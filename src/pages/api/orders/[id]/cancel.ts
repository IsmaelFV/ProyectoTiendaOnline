import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

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

export const POST: APIRoute = async ({ params, request }) => {
  try {
    const orderId = params.id;

    if (!orderId) {
      return new Response(JSON.stringify({ error: 'Order ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verificar que el pedido existe y está en estado cancelable
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (fetchError || !order) {
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Solo se pueden cancelar pedidos en estado 'confirmed' o 'processing'
    if (!['confirmed', 'processing', 'pending'].includes(order.status)) {
      return new Response(JSON.stringify({ 
        error: 'Order cannot be cancelled',
        message: 'Solo se pueden cancelar pedidos confirmados o en proceso' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Actualizar el estado del pedido a 'cancelled'
    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (updateError) {
      throw new Error(`Error updating order: ${updateError.message}`);
    }

    // TODO: Restaurar el stock de los productos
    // TODO: Procesar reembolso en Stripe si el pago ya se procesó

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Pedido cancelado correctamente'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error cancelling order:', error);
    return new Response(JSON.stringify({ 
      error: 'Error cancelling order',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
