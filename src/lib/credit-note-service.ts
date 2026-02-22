/**
 * ============================================================================
 * Servicio de Facturas de Abono (Rectificativas)
 * ============================================================================
 * Centraliza la lógica de generación, persistencia y envío de facturas de abono.
 * Usado por refund.ts y manage.ts para evitar duplicación de código.
 * ============================================================================
 */

import { generateCreditNotePDF } from './credit-note-pdf';
import { sendCreditNoteEmail } from './brevo';
import crypto from 'node:crypto';

export interface CreditNoteOptions {
  /** Supabase client con service_role (ya instanciado) */
  supabase: any;
  /** Datos del pedido (con order_items si se quieren incluir items) */
  order: any;
  /** Items del pedido (array de order_items) */
  orderItems: any[] | null;
  /** ID del reembolso en Stripe */
  stripeRefundId: string | null;
  /** Motivo de la rectificación */
  reason: string;
  /** ID de la devolución (opcional, solo en flujo de returns) */
  returnId?: string;
  /** Prefijo para logs: '[REFUND]' o '[RETURNS]' */
  logPrefix?: string;
}

/**
 * Genera, persiste y envía una factura de abono (rectificativa).
 * Devuelve el número de factura generado, o '' si falló.
 * NUNCA lanza excepción — los errores se loguean pero no bloquean el flujo principal.
 */
export async function createAndSendCreditNote(opts: CreditNoteOptions): Promise<string> {
  const {
    supabase,
    order,
    orderItems,
    stripeRefundId,
    reason,
    returnId,
    logPrefix = '[CREDIT-NOTE]',
  } = opts;

  let creditNoteNumber = '';

  try {
    // 1. Generar número secuencial vía RPC
    const { data: cnNum, error: cnNumErr } = await supabase
      .rpc('generate_invoice_number', { invoice_type: 'credit_note' });

    creditNoteNumber = cnNumErr
      ? `AB-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
      : cnNum;

    // 2. Preparar items para el PDF
    const creditItems = (orderItems || []).map((item: any) => ({
      name: item.product_name || 'Producto',
      quantity: item.quantity,
      price: Math.round(item.price * 100),
      total: Math.round(item.subtotal * 100),
    }));

    // 3. Obtener email del cliente — columna directa de orders (fiable)
    const customerEmail = order.customer_email || '';

    // 4. Generar PDF
    const pdfBase64 = await generateCreditNotePDF({
      creditNoteNumber,
      originalInvoiceRef: order.order_number,
      issueDate: new Date().toISOString(),
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

    // 5. Persistir en tabla invoices
    const invoiceRecord: Record<string, any> = {
      invoice_number: creditNoteNumber,
      type: 'credit_note',
      order_id: order.id,
      customer_name: order.shipping_full_name,
      customer_email: customerEmail,
      subtotal: -Math.round(order.subtotal * 100),
      shipping: -Math.round(order.shipping_cost * 100),
      tax: -Math.round(order.tax * 100),
      total: -Math.round(order.total * 100),
      reason,
      stripe_refund_id: stripeRefundId,
      pdf_generated: true,
    };

    if (returnId) {
      invoiceRecord.return_id = returnId;
    }

    await supabase.from('invoices').insert(invoiceRecord);

    // 6. Enviar email con PDF adjunto
    if (customerEmail) {
      await sendCreditNoteEmail({
        to: customerEmail,
        customerName: order.shipping_full_name,
        creditNoteNumber,
        originalOrderNumber: order.order_number,
        refundAmount: Math.round(order.total * 100),
        pdfBase64,
      });
      console.log(`${logPrefix} Factura de abono ${creditNoteNumber} enviada a ${customerEmail}`);
    }

    console.log(`${logPrefix} Factura de abono ${creditNoteNumber} generada para pedido ${order.order_number}`);
  } catch (creditNoteErr: any) {
    console.error(`${logPrefix} Error generando factura de abono:`, creditNoteErr.message);
  }

  return creditNoteNumber;
}
