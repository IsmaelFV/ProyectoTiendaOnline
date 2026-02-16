/**
 * ============================================================================
 * Generador de Facturas en PDF
 * ============================================================================
 * Genera facturas profesionales en formato PDF usando jsPDF
 */

import { jsPDF } from 'jspdf';

interface InvoiceItem {
  name: string;
  quantity: number;
  price: number; // en centavos
  total: number; // en centavos
}

interface InvoiceData {
  orderNumber: string;
  orderDate: string;
  customerName: string;
  customerEmail: string;
  shippingAddress: string;
  items: InvoiceItem[];
  subtotal: number; // en centavos
  shipping: number; // en centavos
  tax: number; // en centavos
  total: number; // en centavos
}

/**
 * Formatea cantidad en centavos a euros
 */
function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR'
  }).format(cents / 100);
}

/**
 * Genera factura en PDF y retorna como base64
 */
export function generateInvoicePDF(data: InvoiceData): string {
  const doc = new jsPDF();
  
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  // ============================================================================
  // HEADER - Logo y título
  // ============================================================================
  doc.setFontSize(24);
  doc.setTextColor(30, 58, 138); // brand-navy
  doc.text('Fashion Store', 20, yPos);
  
  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  doc.text('Moda de calidad para ti', 20, yPos + 7);
  
  // Número de factura
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text('FACTURA', pageWidth - 20, yPos, { align: 'right' });
  
  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  doc.text(data.orderNumber, pageWidth - 20, yPos + 7, { align: 'right' });
  
  yPos += 20;

  // Línea separadora
  doc.setDrawColor(229, 231, 235);
  doc.line(20, yPos, pageWidth - 20, yPos);
  yPos += 10;

  // ============================================================================
  // INFORMACIÓN DEL CLIENTE
  // ============================================================================
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text('Facturado a:', 20, yPos);
  
  yPos += 6;
  doc.setFontSize(10);
  doc.setTextColor(55, 65, 81);
  doc.text(data.customerName, 20, yPos);
  
  yPos += 5;
  doc.text(data.customerEmail, 20, yPos);
  
  yPos += 5;
  doc.setTextColor(107, 114, 128);
  const addressLines = doc.splitTextToSize(data.shippingAddress, 80);
  doc.text(addressLines, 20, yPos);
  
  // Fecha
  const dateY = yPos - 11;
  doc.setTextColor(0, 0, 0);
  doc.text('Fecha:', pageWidth - 70, dateY);
  doc.setTextColor(55, 65, 81);
  doc.text(new Date(data.orderDate).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }), pageWidth - 20, dateY, { align: 'right' });

  yPos += addressLines.length * 5 + 10;

  // ============================================================================
  // TABLA DE PRODUCTOS
  // ============================================================================
  doc.setFillColor(249, 250, 251);
  doc.rect(20, yPos, pageWidth - 40, 8, 'F');
  
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text('Producto', 25, yPos + 5);
  doc.text('Cant.', pageWidth - 90, yPos + 5);
  doc.text('Precio', pageWidth - 65, yPos + 5);
  doc.text('Total', pageWidth - 25, yPos + 5, { align: 'right' });
  
  yPos += 12;

  // Items
  doc.setFontSize(9);
  doc.setTextColor(55, 65, 81);
  
  data.items.forEach((item) => {
    // Verificar si necesitamos nueva página
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    
    const productName = doc.splitTextToSize(item.name, 90);
    doc.text(productName, 25, yPos);
    doc.text(item.quantity.toString(), pageWidth - 90, yPos);
    doc.text(formatCurrency(item.price), pageWidth - 65, yPos);
    doc.text(formatCurrency(item.total), pageWidth - 25, yPos, { align: 'right' });
    
    yPos += productName.length * 5 + 3;
  });

  yPos += 5;

  // Línea separadora
  doc.setDrawColor(229, 231, 235);
  doc.line(20, yPos, pageWidth - 20, yPos);
  yPos += 10;

  // ============================================================================
  // TOTALES
  // ============================================================================
  const totalsX = pageWidth - 70;
  
  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  
  // Subtotal
  doc.text('Subtotal:', totalsX, yPos);
  doc.text(formatCurrency(data.subtotal), pageWidth - 25, yPos, { align: 'right' });
  yPos += 6;
  
  // Envío
  doc.text('Envío:', totalsX, yPos);
  doc.text(formatCurrency(data.shipping), pageWidth - 25, yPos, { align: 'right' });
  yPos += 6;
  
  // IVA
  doc.text('IVA (21%):', totalsX, yPos);
  doc.text(formatCurrency(data.tax), pageWidth - 25, yPos, { align: 'right' });
  yPos += 10;
  
  // Total
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text('TOTAL:', totalsX, yPos);
  doc.text(formatCurrency(data.total), pageWidth - 25, yPos, { align: 'right' });
  
  // ============================================================================
  // FOOTER
  // ============================================================================
  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175);
  const footerY = doc.internal.pageSize.getHeight() - 20;
  doc.text(
    'Fashion Store | www.fashionstore.com | info@fashionstore.com',
    pageWidth / 2,
    footerY,
    { align: 'center' }
  );
  doc.text(
    'Gracias por tu compra',
    pageWidth / 2,
    footerY + 4,
    { align: 'center' }
  );

  // Generar PDF como base64
  return doc.output('datauristring').split(',')[1];
}
