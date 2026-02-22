/**
 * API Endpoint: Solicitar Devolución / Reembolso (FASE 2 — después de 2 horas)
 * POST /api/orders/return
 * 
 * Crea una solicitud de devolución con:
 * - Razón seleccionada (predefinidas + "otro" con texto libre)
 * - Descripción detallada
 * - Plazo de 1 semana para devolver el producto
 * - Instrucciones de devolución al cliente
 * 
 * El reembolso se procesa cuando la tienda recibe el producto.
 * Si pasa 1 semana sin recibir el producto, se cancela la devolución.
 */

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const VALID_REASONS = [
  'defective',       // Producto defectuoso
  'wrong_item',      // Me llegó un producto incorrecto
  'wrong_size',      // Talla incorrecta
  'not_as_described', // No es como se describía
  'changed_mind',    // He cambiado de opinión
  'better_price',    // Encontré un precio mejor
  'too_late',        // Llegó demasiado tarde
  'other'            // Otro (requiere descripción)
];

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

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

    const body = await request.json();
    const { orderId, reason, description } = body;

    // 2. Validaciones
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!orderId || typeof orderId !== 'string' || !UUID_RE.test(orderId)) {
      return json({ success: false, message: 'ID de pedido inválido' }, 400);
    }
    if (typeof description === 'string' && description.length > 2000) {
      return json({ success: false, message: 'La descripción es demasiado larga' }, 400);
    }
    if (!reason || !VALID_REASONS.includes(reason)) {
      return json({ success: false, message: 'Motivo de devolución inválido' }, 400);
    }
    if (reason === 'other' && (!description || description.trim().length < 10)) {
      return json({ success: false, message: 'Por favor describe el motivo con al menos 10 caracteres' }, 400);
    }

    // 3. Obtener pedido
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', orderId)
      .eq('user_id', user.id)
      .single();

    if (orderError || !order) {
      return json({ success: false, message: 'Pedido no encontrado' }, 404);
    }

    // 4. Verificar estado del pedido
    if (['cancelled', 'refunded', 'return_requested'].includes(order.status)) {
      return json({ success: false, message: 'Este pedido ya tiene una solicitud de devolución o está cancelado' }, 400);
    }

    // Solo se puede devolver si está confirmado, en proceso, enviado o entregado
    if (!['confirmed', 'processing', 'shipped', 'delivered'].includes(order.status)) {
      return json({ success: false, message: 'Este pedido no es elegible para devolución' }, 400);
    }

    // Verificar que no hay ya una devolución activa
    const { data: existingReturn } = await supabase
      .from('returns')
      .select('id, status')
      .eq('order_id', orderId)
      .in('status', ['pending', 'approved', 'received'])
      .maybeSingle();

    if (existingReturn) {
      return json({ success: false, message: 'Ya existe una solicitud de devolución activa para este pedido' }, 400);
    }

    // 5. Calcular deadline (1 semana desde ahora)
    const returnDeadline = new Date(Date.now() + SEVEN_DAYS_MS);

    // 6. Preparar items para la devolución
    const returnItems = order.order_items?.map((item: any) => ({
      order_item_id: item.id,
      product_id: item.product_id,
      product_name: item.product_name,
      size: item.size,
      quantity: item.quantity,
      refund_amount: item.subtotal
    })) || [];

    // 7. Crear la solicitud de devolución
    const { data: newReturn, error: returnError } = await supabase
      .from('returns')
      .insert({
        order_id: orderId,
        user_id: user.id,
        type: 'return',
        status: 'pending',
        reason,
        reason_details: reason === 'other' ? (description || '').trim() : null,
        description: (description || '').trim() || null,
        items: returnItems,
        refund_amount: order.total,
        return_deadline: returnDeadline.toISOString(),
        customer_email: order.customer_email || user.email,
        requested_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (returnError) {
      console.error('Error creating return:', returnError);
      return json({ success: false, message: 'Error al crear la solicitud de devolución' }, 500);
    }

    // 8. Actualizar estado del pedido
    await supabase
      .from('orders')
      .update({ 
        status: 'return_requested',
        admin_notes: `${order.admin_notes || ''}\n[SISTEMA] Solicitud de devolución: ${newReturn.return_number}. Motivo: ${reason}. Plazo: ${returnDeadline.toLocaleDateString('es-ES')}. (${new Date().toLocaleString('es-ES')})`.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    console.log(`[RETURN] Devolucion ${newReturn.return_number} creada para pedido ${order.order_number}. Plazo: ${returnDeadline.toLocaleDateString('es-ES')}`);

    // 9. Responder con las instrucciones
    return json({ 
      success: true,
      returnId: newReturn.id,
      returnNumber: newReturn.return_number,
      deadline: returnDeadline.toISOString(),
      message: 'Solicitud de devolución registrada correctamente',
      instructions: {
        title: 'Instrucciones para la devolución',
        steps: [
          'Empaqueta el producto en su embalaje original o en un paquete adecuado.',
          'Incluye una nota con tu número de devolución dentro del paquete.',
          'Asegúrate de que el producto esté en las mismas condiciones en que lo recibiste (sin usar, con etiquetas).',
          'Envía el paquete a la dirección que aparece a continuación.',
          'Conserva el comprobante de envío y el número de seguimiento.'
        ],
        address: 'FashionMarket — Devoluciones\nCalle Ejemplo, 123\n28001 Madrid, España',
        deadline: returnDeadline.toLocaleDateString('es-ES', { 
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' 
        }),
        warning: 'Si no recibimos el producto antes del plazo indicado, la solicitud de devolución será cancelada automáticamente.'
      }
    });

  } catch (error: any) {
    console.error('[RETURN REQUEST] Error:', error);
    return json({ success: false, message: 'Error inesperado' }, 500);
  }
};
