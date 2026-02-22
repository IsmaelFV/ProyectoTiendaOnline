/**
 * ============================================================================
 * Brevo Email Client
 * ============================================================================
 * Cliente para enviar emails transaccionales usando Brevo (Sendinblue)
 */

import * as brevo from '@getbrevo/brevo';

// Inicializar cliente de Brevo
export function getBrevoClient() {
  const apiInstance = new brevo.TransactionalEmailsApi();
  apiInstance.setApiKey(
    brevo.TransactionalEmailsApiApiKeys.apiKey,
    import.meta.env.BREVO_API_KEY
  );
  return apiInstance;
}

/** Escapa caracteres peligrosos para interpolación en HTML */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Enviar email simple
 */
export async function sendEmail({
  to,
  subject,
  htmlContent,
  textContent,
}: {
  to: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
}) {
  const apiInstance = getBrevoClient();

  const sendSmtpEmail = new brevo.SendSmtpEmail();
  sendSmtpEmail.subject = subject;
  sendSmtpEmail.htmlContent = htmlContent;
  sendSmtpEmail.sender = {
    name: 'Fashion Store',
    email: import.meta.env.EMAIL_FROM,
  };
  sendSmtpEmail.to = [{ email: to }];
  
  if (textContent) {
    sendSmtpEmail.textContent = textContent;
  }

  try {
    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('[EMAIL] Email enviado correctamente:', data);
    return { success: true, data };
  } catch (error: any) {
    console.error('[EMAIL] Error al enviar email:', error);
    throw error;
  }
}

/**
 * Enviar factura por email con PDF adjunto y detalle de productos
 */
export async function sendInvoiceEmail({
  to,
  customerName,
  orderNumber,
  pdfBase64,
  items,
}: {
  to: string;
  customerName: string;
  orderNumber: string;
  pdfBase64: string;
  items?: Array<{ name: string; quantity: number; price: number; image?: string }>;
}) {
  const apiInstance = getBrevoClient();

  const sendSmtpEmail = new brevo.SendSmtpEmail();
  sendSmtpEmail.subject = `Factura de tu pedido ${orderNumber} - Fashion Store`;

  // Versiones escapadas para contextos HTML
  const safeCustomerName = escapeHtml(customerName);
  const safeOrderNumber = escapeHtml(orderNumber);
  const safeTo = escapeHtml(to);

  // Generar filas de productos para el email
  const itemsHtml = items && items.length > 0 
    ? items.map(item => {
        const safeName = escapeHtml(item.name);
        return `
        <tr>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb;">
            ${item.image 
              ? `<img src="${escapeHtml(item.image)}" alt="${safeName}" width="50" height="50" style="border-radius: 6px; object-fit: cover; display: block;" />`
              : `<div style="width: 50px; height: 50px; background: #f3f4f6; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #9ca3af; font-size: 20px;">📦</div>`
            }
          </td>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: middle;">
            <strong style="color: #1f2937;">${safeName}</strong><br>
            <span style="color: #6b7280; font-size: 13px;">Cantidad: ${item.quantity}</span>
          </td>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; vertical-align: middle; white-space: nowrap;">
            <strong style="color: #1f2937;">${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(item.price / 100)}</strong>
          </td>
        </tr>
      `;
      }).join('')
    : '';

  const productsSection = itemsHtml 
    ? `
      <div style="background: white; padding: 20px; border-radius: 6px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #1f2937;">Productos de tu pedido:</h3>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
          ${itemsHtml}
        </table>
      </div>
    `
    : '';

  sendSmtpEmail.htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #d97706; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">Pedido Confirmado</h1>
        </div>
        <div class="content">
          <p>Hola <strong>${safeCustomerName}</strong>,</p>
          
          <p>Gracias por realizar su compra en <strong>Fashion Store</strong>. Tu pedido <strong>${safeOrderNumber}</strong> ha sido procesado correctamente.</p>
          
          <p>Adjuntamos tu factura en formato PDF.</p>
          
          ${productsSection}
          
          <div style="background: white; padding: 20px; border-radius: 6px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Detalles del pedido:</h3>
            <ul style="list-style: none; padding: 0;">
              <li><strong>Número de pedido:</strong> ${safeOrderNumber}</li>
              <li><strong>Email:</strong> ${safeTo}</li>
            </ul>
          </div>
          
          <p>Recibirás una notificación cuando tu pedido sea enviado.</p>
          
          <p>Si tienes alguna pregunta, no dudes en contactarnos.</p>
          
          <p>¡Gracias por confiar en nosotros!</p>
        </div>
        <div class="footer">
          <p>Fashion Store - Moda de calidad para ti</p>
          <p>Este es un email automático, por favor no respondas.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  sendSmtpEmail.sender = {
    name: 'Fashion Store',
    email: import.meta.env.EMAIL_FROM,
  };
  
  sendSmtpEmail.to = [{ email: to, name: customerName }];
  
  // Adjuntar PDF
  sendSmtpEmail.attachment = [{
    content: pdfBase64,
    name: `Factura_${orderNumber}.pdf`,
  }];

  try {
    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log(`[EMAIL] Factura enviada a ${to}:`, data);
    return { success: true, data };
  } catch (error: any) {
    console.error('[EMAIL] Error al enviar factura:', error);
    throw error;
  }
}

/**
 * Enviar factura de abono (rectificativa) por email con PDF adjunto
 */
export async function sendCreditNoteEmail({
  to,
  customerName,
  creditNoteNumber,
  originalOrderNumber,
  refundAmount,
  pdfBase64,
}: {
  to: string;
  customerName: string;
  creditNoteNumber: string;
  originalOrderNumber: string;
  refundAmount: number; // en centavos
  pdfBase64: string;
}) {
  const apiInstance = getBrevoClient();
  const sendSmtpEmail = new brevo.SendSmtpEmail();

  const safeCustomerName = escapeHtml(customerName);
  const safeCreditNoteNumber = escapeHtml(creditNoteNumber);
  const safeOriginalOrder = escapeHtml(originalOrderNumber);
  const formattedAmount = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(refundAmount / 100);

  sendSmtpEmail.subject = `Factura de Abono ${creditNoteNumber} — Devolución pedido ${originalOrderNumber}`;

  sendSmtpEmail.htmlContent = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #991b1b 0%, #dc2626 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 22px;">Factura de Abono</h1>
          <p style="margin: 8px 0 0; opacity: 0.9;">Factura rectificativa</p>
        </div>
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
          <p>Hola <strong>${safeCustomerName}</strong>,</p>
          <p>Se ha emitido una factura de abono correspondiente a la devolución de tu pedido <strong>${safeOriginalOrder}</strong>.</p>
          <div style="background: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #dc2626;">
            <p style="margin: 0;"><strong>Nº Factura de Abono:</strong> ${safeCreditNoteNumber}</p>
            <p style="margin: 8px 0 0;"><strong>Pedido original:</strong> ${safeOriginalOrder}</p>
            <p style="margin: 8px 0 0;"><strong>Importe reembolsado:</strong> <span style="color: #dc2626; font-weight: bold;">${formattedAmount}</span></p>
          </div>
          <p>El reembolso se ha procesado a tu método de pago original. Puede tardar entre 5-10 días hábiles en reflejarse.</p>
          <p>Adjuntamos la factura rectificativa en PDF para tu contabilidad.</p>
          <p>Si tienes alguna pregunta, no dudes en contactarnos.</p>
        </div>
        <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px;">
          <p>Fashion Store - Moda de calidad para ti</p>
        </div>
      </div>
    </body>
    </html>
  `;

  sendSmtpEmail.sender = {
    name: 'Fashion Store',
    email: import.meta.env.EMAIL_FROM,
  };
  sendSmtpEmail.to = [{ email: to, name: customerName }];
  sendSmtpEmail.attachment = [{
    content: pdfBase64,
    name: `Abono_${creditNoteNumber}.pdf`,
  }];

  try {
    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log(`[EMAIL] Factura de abono enviada a ${to}:`, data);
    return { success: true, data };
  } catch (error: any) {
    console.error('[EMAIL] Error al enviar factura de abono:', error);
    throw error;
  }
}

/**
 * Enviar email de contacto a todos los administradores
 */
export async function sendContactEmailToAdmins({
  adminEmails,
  customerName,
  customerEmail,
  subject,
  message,
}: {
  adminEmails: string[];
  customerName: string;
  customerEmail: string;
  subject: string;
  message: string;
}) {
  const apiInstance = getBrevoClient();

  const sendSmtpEmail = new brevo.SendSmtpEmail();
  sendSmtpEmail.subject = `[Contacto] ${subject} — de ${customerName}`;
  sendSmtpEmail.sender = {
    name: 'Fashion Store - Contacto',
    email: import.meta.env.EMAIL_FROM,
  };
  sendSmtpEmail.replyTo = {
    name: customerName,
    email: customerEmail,
  };
  sendSmtpEmail.to = adminEmails.map(email => ({ email }));

  // Versiones escapadas solo para interpolación en cuerpo HTML
  const safeName = escapeHtml(customerName);
  const safeEmail = escapeHtml(customerEmail);
  const safeSubject = escapeHtml(subject);
  const escapedMessage = escapeHtml(message).replace(/\n/g, '<br>');

  sendSmtpEmail.htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background: #f3f4f6; }
      </style>
    </head>
    <body>
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #111827 0%, #1f2937 100%); padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="margin: 0; color: #d4af37; font-size: 22px; font-weight: 700;">Nuevo Mensaje de Contacto</h1>
          <p style="margin: 8px 0 0; color: #9ca3af; font-size: 14px;">Se ha recibido una consulta desde la web</p>
        </div>
        
        <div style="background: white; padding: 32px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px 12px; background: #f9fafb; border-radius: 8px 8px 0 0; border-bottom: 1px solid #e5e7eb;">
                <strong style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Asunto</strong><br>
                <span style="color: #111827; font-size: 15px; font-weight: 600;">${safeSubject}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; background: #f9fafb; border-bottom: 1px solid #e5e7eb;">
                <strong style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Nombre</strong><br>
                <span style="color: #111827; font-size: 15px;">${safeName}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; background: #f9fafb; border-radius: 0 0 8px 8px;">
                <strong style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Email del cliente</strong><br>
                <a href="mailto:${encodeURIComponent(customerEmail)}" style="color: #2563eb; font-size: 15px; text-decoration: none;">${safeEmail}</a>
              </td>
            </tr>
          </table>
          
          <div style="background: #fafbfc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <strong style="color: #374151; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 10px;">Mensaje</strong>
            <div style="color: #1f2937; font-size: 15px; line-height: 1.7;">
              ${escapedMessage}
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 24px;">
            <a href="mailto:${encodeURIComponent(customerEmail)}?subject=Re: ${encodeURIComponent(subject)}" 
               style="display: inline-block; background: #d4af37; color: #111827; padding: 12px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
              Responder al cliente
            </a>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;">
          <p>Este mensaje fue enviado desde el formulario de contacto de Fashion Store</p>
        </div>
      </div>
    </body>
    </html>
  `;

  sendSmtpEmail.textContent = `
Nuevo mensaje de contacto - Fashion Store

Asunto: ${subject}
Nombre: ${customerName}
Email: ${customerEmail}

Mensaje:
${message}

---
Responder a: ${customerEmail}
  `.trim();

  try {
    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log(`[EMAIL] Email de contacto enviado a ${adminEmails.length} admins`);
    return { success: true, data };
  } catch (error: any) {
    console.error('[EMAIL] Error al enviar email de contacto:', error);
    throw error;
  }
}
