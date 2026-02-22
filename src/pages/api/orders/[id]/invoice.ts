import type { APIRoute } from 'astro';
import { verifyAdminFromCookies, createServerSupabaseClient } from '@lib/auth';
import { supabase as anonSupabase } from '@lib/supabase';
import { generateInvoicePDF } from '../../../../lib/invoice-pdf';

export const GET: APIRoute = async ({ params, request, cookies }) => {
  try {
    const orderId = params.id;

    if (!orderId) {
      return new Response(JSON.stringify({ error: 'Order ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verificar autenticación: admin o propietario del pedido
    const accessToken = cookies.get('sb-access-token')?.value;
    const refreshToken = cookies.get('sb-refresh-token')?.value;

    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Intentar verificar como admin
    const adminUserId = await verifyAdminFromCookies(accessToken, refreshToken);
    let isAuthorized = !!adminUserId;

    // Si no es admin, verificar si el usuario es el propietario del pedido
    if (!isAuthorized) {
      const { data: { user } } = await anonSupabase.auth.getUser(accessToken);
      if (user) {
        const supabaseAdmin = createServerSupabaseClient();
        const { data: ownerCheck } = await supabaseAdmin
          .from('orders')
          .select('id')
          .eq('id', orderId)
          .eq('user_id', user.id)
          .single();
        isAuthorized = !!ownerCheck;
      }
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: 'No autorizado para esta factura' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const supabaseAdmin = createServerSupabaseClient();

    // Obtener el pedido con sus items
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        order_items (*)
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Preparar datos para la factura
    const invoiceItems = order.order_items.map((item: any) => ({
      name: item.product_name,
      quantity: item.quantity,
      price: Math.round(item.price * 100), // Convertir a céntimos
      total: Math.round(item.subtotal * 100),
      image: item.product_image || undefined
    }));

    const shippingAddress = `${order.shipping_address_line1}${order.shipping_address_line2 ? ', ' + order.shipping_address_line2 : ''}, ${order.shipping_city}, ${order.shipping_postal_code}, ${order.shipping_country}`;

    // Generar PDF
    const pdfBase64 = await generateInvoicePDF({
      orderNumber: order.order_number,
      orderDate: order.created_at,
      customerName: order.shipping_full_name,
      customerEmail: order.admin_notes?.match(/Email: ([^\|]+)/)?.[1] || 'cliente@example.com',
      shippingAddress,
      items: invoiceItems,
      subtotal: Math.round(order.subtotal * 100),
      shipping: Math.round(order.shipping_cost * 100),
      tax: Math.round(order.tax * 100),
      total: Math.round(order.total * 100)
    });

    // Convertir base64 a buffer
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Factura-${order.order_number}.pdf"`,
        'Content-Length': pdfBuffer.length.toString()
      }
    });

  } catch (error: any) {
    console.error('Error generating invoice:', error);
    return new Response(JSON.stringify({ 
      error: 'Error al generar la factura'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
