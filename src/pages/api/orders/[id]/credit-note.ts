import type { APIRoute } from 'astro';
import { verifyAdminFromCookies, createServerSupabaseClient } from '@lib/auth';
import { supabase as anonSupabase } from '@lib/supabase';
import { generateCreditNotePDF } from '../../../../lib/credit-note-pdf';

export const GET: APIRoute = async ({ params, cookies }) => {
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

    const supabaseAdmin = createServerSupabaseClient();

    const adminUserId = await verifyAdminFromCookies(accessToken, refreshToken);
    let isAuthorized = !!adminUserId;

    if (!isAuthorized) {
      const { data: { user } } = await anonSupabase.auth.getUser(accessToken);
      if (user) {
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
      return new Response(JSON.stringify({ error: 'No autorizado para esta factura de abono' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Obtener pedido reembolsado
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*, order_items (*)')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: 'Pedido no encontrado' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (order.status !== 'refunded') {
      return new Response(JSON.stringify({ error: 'Este pedido no ha sido reembolsado' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Buscar factura de abono existente
    const { data: invoice } = await supabaseAdmin
      .from('invoices')
      .select('invoice_number, reason')
      .eq('order_id', orderId)
      .eq('type', 'credit_note')
      .order('issued_at', { ascending: false })
      .limit(1)
      .single();

    const creditNoteNumber = invoice?.invoice_number || `AB-${new Date().getFullYear()}-${orderId.slice(0, 8).toUpperCase()}`;
    const reason = invoice?.reason || 'Reembolso del pedido';

    const creditItems = order.order_items.map((item: any) => ({
      name: item.product_name,
      quantity: item.quantity,
      price: Math.round(item.price * 100),
      total: Math.round(item.subtotal * 100),
    }));

    const customerEmail = order.customer_email || '';

    const pdfBase64 = await generateCreditNotePDF({
      creditNoteNumber,
      originalInvoiceRef: order.order_number,
      issueDate: order.updated_at || new Date().toISOString(),
      customerName: order.shipping_full_name,
      customerEmail,
      reason,
      items: creditItems,
      subtotal: Math.round(order.subtotal * 100),
      shipping: Math.round(order.shipping_cost * 100),
      tax: Math.round(order.tax * 100),
      total: Math.round(order.total * 100),
      refundMethod: 'Stripe — Devolución a método de pago original',
    });

    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Abono-${order.order_number}.pdf"`,
        'Content-Length': pdfBuffer.length.toString()
      }
    });

  } catch (error: any) {
    console.error('Error generating credit note:', error);
    return new Response(JSON.stringify({
      error: 'Error generando factura de abono',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
