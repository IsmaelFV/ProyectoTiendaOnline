/**
 * ============================================================================
 * Generador de Facturas de Abono (Rectificativas) en PDF
 * ============================================================================
 * Genera facturas rectificativas con importes negativos usando jsPDF.
 * Se emiten al procesar devoluciones/reembolsos para cuadrar caja.
 * Ref. legal: Art. 15 del RD 1619/2012 (Reglamento de facturación)
 * ============================================================================
 */

import { jsPDF } from 'jspdf';

export interface CreditNoteItem {
  name: string;
  quantity: number;
  price: number; // en centavos (positivo — se mostrará como negativo)
  total: number; // en centavos (positivo — se mostrará como negativo)
}

export interface CreditNoteData {
  creditNoteNumber: string;     // Ej: "AB-2026-000001"
  originalInvoiceRef: string;   // Nº del pedido original
  issueDate: string;            // Fecha de emisión
  customerName: string;
  customerEmail: string;
  reason: string;               // Motivo de la devolución
  items: CreditNoteItem[];
  subtotal: number;   // en centavos (positivo)
  shipping: number;   // en centavos (positivo)
  tax: number;        // en centavos (positivo)
  total: number;      // en centavos (positivo — se mostrará como negativo)
  refundMethod: string; // Ej: "Stripe - Tarjeta original"
}

/**
 * Formatea cantidad en centavos a euros (con signo negativo)
 */
function formatNegativeCurrency(cents: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    signDisplay: 'always'
  }).format(-(cents / 100));
}

/**
 * Genera factura de abono (rectificativa) en PDF y retorna como base64
 */
export async function generateCreditNotePDF(data: CreditNoteData): Promise<string> {
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  // ========== HEADER ==========
  doc.setFontSize(24);
  doc.setTextColor(30, 58, 138);
  doc.text('Fashion Store', 20, yPos);

  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  doc.text('Moda de calidad para ti', 20, yPos + 7);

  // Título en rojo
  doc.setFontSize(14);
  doc.setTextColor(185, 28, 28);
  doc.text('FACTURA RECTIFICATIVA', pageWidth - 20, yPos, { align: 'right' });

  doc.setFontSize(9);
  doc.setTextColor(185, 28, 28);
  doc.text('(Factura de Abono)', pageWidth - 20, yPos + 6, { align: 'right' });

  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  doc.text(data.creditNoteNumber, pageWidth - 20, yPos + 13, { align: 'right' });

  yPos += 25;

  // Línea roja separadora
  doc.setDrawColor(185, 28, 28);
  doc.setLineWidth(0.5);
  doc.line(20, yPos, pageWidth - 20, yPos);
  doc.setLineWidth(0.2);
  yPos += 10;

  // ========== DATOS CLIENTE + REFERENCIA ==========
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text('Facturado a:', 20, yPos);

  yPos += 6;
  doc.setFontSize(10);
  doc.setTextColor(55, 65, 81);
  doc.text(data.customerName, 20, yPos);
  yPos += 5;
  doc.text(data.customerEmail, 20, yPos);

  // Columna derecha
  const refY = yPos - 11;
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.text('Fecha emisión:', pageWidth - 80, refY);
  doc.setTextColor(55, 65, 81);
  doc.text(new Date(data.issueDate).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'long', year: 'numeric'
  }), pageWidth - 20, refY, { align: 'right' });

  doc.setTextColor(107, 114, 128);
  doc.text('Pedido original:', pageWidth - 80, refY + 6);
  doc.setTextColor(55, 65, 81);
  doc.text(data.originalInvoiceRef, pageWidth - 20, refY + 6, { align: 'right' });

  yPos += 10;

  // ========== MOTIVO ==========
  doc.setFillColor(254, 242, 242);
  doc.roundedRect(20, yPos, pageWidth - 40, 16, 3, 3, 'F');
  doc.setFontSize(9);
  doc.setTextColor(185, 28, 28);
  doc.text('Motivo de la rectificación:', 25, yPos + 6);
  doc.setTextColor(55, 65, 81);
  const reasonLines = doc.splitTextToSize(data.reason, pageWidth - 60);
  doc.text(reasonLines, 25, yPos + 11);

  yPos += 22;

  // ========== TABLA PRODUCTOS ==========
  doc.setFillColor(254, 226, 226);
  doc.rect(20, yPos, pageWidth - 40, 8, 'F');

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text('Producto', 25, yPos + 5);
  doc.text('Cant.', pageWidth - 90, yPos + 5);
  doc.text('Precio ud.', pageWidth - 65, yPos + 5);
  doc.text('Total', pageWidth - 25, yPos + 5, { align: 'right' });

  yPos += 12;
  doc.setFontSize(9);

  data.items.forEach((item) => {
    if (yPos > 245) {
      doc.addPage();
      yPos = 20;
    }

    doc.setTextColor(55, 65, 81);
    const productName = doc.splitTextToSize(item.name, 90);
    doc.text(productName, 25, yPos);
    doc.text(item.quantity.toString(), pageWidth - 90, yPos);

    doc.setTextColor(185, 28, 28);
    doc.text(formatNegativeCurrency(item.price), pageWidth - 65, yPos);
    doc.text(formatNegativeCurrency(item.total), pageWidth - 25, yPos, { align: 'right' });

    yPos += Math.max(8, productName.length * 5 + 3);
  });

  yPos += 5;
  doc.setDrawColor(229, 231, 235);
  doc.line(20, yPos, pageWidth - 20, yPos);
  yPos += 10;

  // ========== TOTALES ==========
  const totalsX = pageWidth - 80;

  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  doc.text('Subtotal:', totalsX, yPos);
  doc.setTextColor(185, 28, 28);
  doc.text(formatNegativeCurrency(data.subtotal), pageWidth - 25, yPos, { align: 'right' });
  yPos += 6;

  doc.setTextColor(107, 114, 128);
  doc.text('Envío:', totalsX, yPos);
  doc.setTextColor(185, 28, 28);
  doc.text(formatNegativeCurrency(data.shipping), pageWidth - 25, yPos, { align: 'right' });
  yPos += 6;

  doc.setTextColor(107, 114, 128);
  doc.text('IVA (21%):', totalsX, yPos);
  doc.setTextColor(185, 28, 28);
  doc.text(formatNegativeCurrency(data.tax), pageWidth - 25, yPos, { align: 'right' });
  yPos += 10;

  // Total abono destacado
  doc.setFillColor(254, 226, 226);
  doc.roundedRect(totalsX - 5, yPos - 5, pageWidth - totalsX + 5 - 15, 12, 2, 2, 'F');
  doc.setFontSize(12);
  doc.setTextColor(185, 28, 28);
  doc.text('TOTAL ABONO:', totalsX, yPos + 3);
  doc.text(formatNegativeCurrency(data.total), pageWidth - 25, yPos + 3, { align: 'right' });

  yPos += 20;

  // ========== MÉTODO REEMBOLSO ==========
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.text('Método de reembolso:', 20, yPos);
  doc.setTextColor(55, 65, 81);
  doc.text(data.refundMethod, 70, yPos);

  // ========== NOTA LEGAL ==========
  yPos += 15;
  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175);
  const legalText = 'Esta factura rectificativa anula parcial o totalmente la factura original referenciada. Emitida conforme al Art. 15 del RD 1619/2012 por el que se aprueba el Reglamento de facturación.';
  const legalLines = doc.splitTextToSize(legalText, pageWidth - 40);
  doc.text(legalLines, 20, yPos);

  // ========== FOOTER ==========
  const footerY = doc.internal.pageSize.getHeight() - 20;
  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175);
  doc.text('Fashion Store · contacto@fashionstore.es', pageWidth / 2, footerY, { align: 'center' });
  doc.text(`Generado: ${new Date().toLocaleDateString('es-ES')}`, pageWidth / 2, footerY + 5, { align: 'center' });

  // Retornar como base64
  const pdfOutput = doc.output('arraybuffer');
  return Buffer.from(pdfOutput).toString('base64');
}
