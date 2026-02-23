/**
 * ============================================================================
 * Servicio de Notas de Abono (Facturas Rectificativas)
 * ============================================================================
 * Genera, persiste y envía por email las facturas de abono cuando se procesa
 * una cancelación o devolución con reembolso.
 * ============================================================================
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { generateCreditNotePDF } from './credit-note-pdf';
import { getBrevoClient, escapeHtml } from './brevo';
import * as brevo from '@getbrevo/brevo';

interface CreditNoteParams {
  supabase: SupabaseClient;
  order: any;
  orderItems: any[] | null;
  stripeRefundId: string;
  reason: string;
  logPrefix?: string;
}

/**
 * Genera el siguiente número secuencial de abono: ABON-2026-000001
 */
async function getNextCreditNoteNumber(supabase: SupabaseClient): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `ABON-${year}-`;

  // Buscar el último abono del año actual
  const { data } = await supabase
    .from('invoices')
    .select('invoice_number')
    .eq('type', 'credit_note')
    .like('invoice_number', `${prefix}%`)
    .order('invoice_number', { ascending: false })
    .limit(1);

  let nextSeq = 1;
  if (data && data.length > 0) {
    const lastNum = data[0].invoice_number;
    const seqPart = lastNum.replace(prefix, '');
    const parsed = parseInt(seqPart, 10);
    if (!isNaN(parsed)) nextSeq = parsed + 1;
  }

  return `${prefix}${String(nextSeq).padStart(6, '0')}`;
}

/**
 * Genera, persiste y envía una nota de abono (factura rectificativa).
 * Retorna el número de abono o null si falla.
 */
export async function createAndSendCreditNote({
  supabase,
  order,
  orderItems,
  stripeRefundId,
  reason,
  logPrefix = '[CREDIT-NOTE]',
}: CreditNoteParams): Promise<string | null> {
  try {
    // 1. Obtener datos del cliente
    const customerEmail = order.customer_email || '';
    const customerName = order.shipping_full_name || order.customer_name || 'Cliente';

    if (!customerEmail) {
      console.warn(`${logPrefix} No se puede enviar abono: email no disponible`);
    }

    // 2. Generar número secuencial
    const creditNoteNumber = await getNextCreditNoteNumber(supabase);
    console.log(`${logPrefix} Generando abono ${creditNoteNumber} para pedido ${order.order_number}`);

    // 3. Preparar items para el PDF
    const items = (orderItems || []).map((item: any) => ({
      name: item.product_name || item.name || 'Producto',
      quantity: item.quantity || 1,
      price: item.unit_price || item.price || 0,
      total: (item.unit_price || item.price || 0) * (item.quantity || 1),
    }));

    // 4. Calcular totales (en céntimos)
    const subtotal = items.reduce((sum: number, i: any) => sum + i.total, 0);
    const shipping = order.shipping_cost || 0;
    const total = order.total || (subtotal + shipping);
    const tax = Math.round(total * 21 / 121); // IVA incluido al 21%

    // 5. Generar PDF
    const pdfBase64 = await generateCreditNotePDF({
      creditNoteNumber,
      originalInvoiceRef: order.order_number || order.id,
      issueDate: new Date().toISOString(),
      customerName,
      customerEmail,
      reason,
      items,
      subtotal,
      shipping,
      tax,
      total,
      refundMethod: `Stripe - Reembolso ${stripeRefundId}`,
    });

    // 6. Persistir en BD (tabla invoices: customer_name, customer_email, subtotal, shipping, tax, total, reason, stripe_refund_id)
    try {
      const { error: insertErr } = await supabase.from('invoices').insert({
        invoice_number: creditNoteNumber,
        type: 'credit_note',
        order_id: order.id,
        customer_name: customerName,
        customer_email: customerEmail || 'no-email@placeholder.com',
        subtotal: subtotal,
        shipping: shipping,
        tax: tax,
        total: -Math.abs(total), // Negativo para abonos
        reason: reason,
        stripe_refund_id: stripeRefundId,
      });
      if (insertErr) {
        console.warn(`${logPrefix} Error al persistir abono en BD:`, insertErr.message);
      }
    } catch (dbErr: any) {
      console.warn(`${logPrefix} Excepción al persistir abono:`, dbErr.message);
    }

    // 7. Enviar email con PDF adjunto
    if (customerEmail) {
      try {
        const apiInstance = getBrevoClient();
        const sendSmtpEmail = new brevo.SendSmtpEmail();

        const safeName = escapeHtml(customerName);
        const safeOrderNumber = escapeHtml(order.order_number || '');
        const safeCreditNote = escapeHtml(creditNoteNumber);

        sendSmtpEmail.subject = `Nota de abono ${creditNoteNumber} - Fashion Store`;
        sendSmtpEmail.sender = {
          name: 'Fashion Store',
          email: import.meta.env.EMAIL_FROM,
        };
        sendSmtpEmail.to = [{ email: customerEmail, name: customerName }];
        sendSmtpEmail.attachment = [{
          content: pdfBase64,
          name: `Abono_${creditNoteNumber}.pdf`,
        }];

        sendSmtpEmail.htmlContent = `
          <!DOCTYPE html>
          <html>
          <head><meta charset="UTF-8"></head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #991b1b 0%, #dc2626 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="margin: 0; font-size: 22px;">Nota de Abono</h1>
                <p style="margin: 8px 0 0; opacity: 0.9;">Factura rectificativa</p>
              </div>
              <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
                <p>Hola <strong>${safeName}</strong>,</p>
                <p>Te informamos de que se ha procesado el reembolso correspondiente a tu pedido <strong>${safeOrderNumber}</strong>.</p>
                <p>Adjuntamos la nota de abono <strong>${safeCreditNote}</strong> en formato PDF.</p>
                <div style="background: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #dc2626;">
                  <p style="margin: 0;"><strong>Motivo:</strong> ${escapeHtml(reason)}</p>
                  <p style="margin: 8px 0 0;"><strong>Importe reembolsado:</strong> ${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(total / 100)}</p>
                </div>
                <p>El reembolso se reflejará en tu cuenta en un plazo de 3 a 5 días laborables.</p>
                <p>Si tienes alguna pregunta, no dudes en contactarnos.</p>
              </div>
              <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px;">
                <p>Fashion Store - Moda de calidad para ti</p>
              </div>
            </div>
          </body>
          </html>
        `;

        await apiInstance.sendTransacEmail(sendSmtpEmail);
        console.log(`${logPrefix} Abono ${creditNoteNumber} enviado a ${customerEmail}`);
      } catch (emailErr: any) {
        console.error(`${logPrefix} Error al enviar email de abono:`, emailErr.message);
        // No lanzar — el abono ya está generado y persistido
      }
    }

    return creditNoteNumber;
  } catch (error: any) {
    console.error(`${logPrefix} Error al generar abono:`, error.message);
    return null;
  }
}
