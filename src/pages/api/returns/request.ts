import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // ── Autenticación via cookie ──────────────────────────────────────
    const accessToken = cookies.get('sb-access-token')?.value;
    if (!accessToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'No autenticado' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verificar token y obtener usuario
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token inválido o expirado' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json();
    const { orderId, reason } = body;

    if (!orderId || !reason) {
      return new Response(
        JSON.stringify({ success: false, error: 'Faltan datos requeridos' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validación de tipos y longitud
    if (typeof orderId !== 'string' || typeof reason !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'Datos con formato inválido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // UUID v4 format check para orderId + límite de razón
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(orderId) || reason.length > 1000) {
      return new Response(
        JSON.stringify({ success: false, error: 'Datos con formato inválido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verificar que el pedido existe, pertenece al usuario, y es elegible
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('user_id', user.id)
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
    const { data: existingReturn } = await supabaseAdmin
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
    const { data: newReturn, error: returnError } = await supabaseAdmin
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
    await supabaseAdmin
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
