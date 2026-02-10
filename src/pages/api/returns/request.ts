import type { APIRoute } from 'astro';
import { supabase } from '@lib/supabase';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const { orderId, reason } = body;

    if (!orderId || !reason) {
      return new Response(
        JSON.stringify({ success: false, error: 'Faltan datos requeridos' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verificar que el pedido existe y es elegible para devolución
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ success: false, error: 'Pedido no encontrado' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verificar que el pedido fue entregado
    if (order.status !== 'delivered') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Solo se pueden devolver pedidos ya entregados' 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verificar que está dentro del plazo de devolución (14 días)
    const deliveredDate = new Date(order.updated_at);
    const daysSinceDelivery = Math.floor(
      (Date.now() - deliveredDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceDelivery > 14) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'El plazo de devolución de 14 días ha expirado' 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verificar que no hay ya una devolución en proceso
    const { data: existingReturn } = await supabase
      .from('returns')
      .select('id, status')
      .eq('order_id', orderId)
      .in('status', ['pending', 'approved', 'received'])
      .single();

    if (existingReturn) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Ya existe una solicitud de devolución para este pedido' 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Crear la solicitud de devolución
    const { data: newReturn, error: returnError } = await supabase
      .from('returns')
      .insert({
        order_id: orderId,
        customer_email: order.customer_email,
        reason,
        status: 'pending',
        refund_amount: order.total,
        requested_at: new Date().toISOString()
      })
      .select()
      .single();

    if (returnError) {
      console.error('Error creating return:', returnError);
      return new Response(
        JSON.stringify({ success: false, error: 'Error al crear la solicitud' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Actualizar el estado del pedido
    await supabase
      .from('orders')
      .update({ 
        status: 'return_requested',
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    // TODO: Enviar email de confirmación al cliente

    return new Response(
      JSON.stringify({ 
        success: true, 
        returnId: newReturn.id,
        message: 'Solicitud de devolución registrada correctamente' 
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Return request error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Error interno del servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
