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
  // Generar filas de productos para el email
  const itemsHtml = items && items.length > 0 
    ? items.map(item => `
        <tr>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb;">
            ${item.image 
              ? `<img src="${item.image}" alt="${item.name}" width="50" height="50" style="border-radius: 6px; object-fit: cover; display: block;" />`
              : `<div style="width: 50px; height: 50px; background: #f3f4f6; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #9ca3af; font-size: 20px;">📦</div>`
            }
          </td>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: middle;">
            <strong style="color: #1f2937;">${item.name}</strong><br>
            <span style="color: #6b7280; font-size: 13px;">Cantidad: ${item.quantity}</span>
          </td>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; vertical-align: middle; white-space: nowrap;">
            <strong style="color: #1f2937;">${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(item.price / 100)}</strong>
          </td>
        </tr>
      `).join('')
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
          <p>Hola <strong>${customerName}</strong>,</p>
          
          <p>Gracias por realizar su compra en <strong>Fashion Store</strong>. Tu pedido <strong>${orderNumber}</strong> ha sido procesado correctamente.</p>
          
          <p>Adjuntamos tu factura en formato PDF.</p>
          
          ${productsSection}
          
          <div style="background: white; padding: 20px; border-radius: 6px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Detalles del pedido:</h3>
            <ul style="list-style: none; padding: 0;">
              <li><strong>Número de pedido:</strong> ${orderNumber}</li>
              <li><strong>Email:</strong> ${to}</li>
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
