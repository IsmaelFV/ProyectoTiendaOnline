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
  image?: string; // URL de la imagen del producto
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
 * Descarga una imagen y la convierte a base64 para jsPDF
 */
async function fetchImageAsBase64(url: string): Promise<{ data: string; format: string } | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    
    const contentType = response.headers.get('content-type') || '';
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    
    let format = 'JPEG';
    if (contentType.includes('png')) format = 'PNG';
    else if (contentType.includes('webp')) format = 'PNG'; // jsPDF no soporta webp nativo, skip
    
    // jsPDF solo soporta JPEG y PNG de forma fiable
    if (!contentType.includes('jpeg') && !contentType.includes('jpg') && !contentType.includes('png')) {
      return null;
    }
    
    return { data: `data:${contentType};base64,${base64}`, format };
  } catch {
    return null;
  }
}

/**
 * Genera factura en PDF y retorna como base64
 */
export async function generateInvoicePDF(data: InvoiceData): Promise<string> {
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
  
  // Pre-cargar imágenes de productos
  const imageCache: Map<string, { data: string; format: string }> = new Map();
  await Promise.all(
    data.items.map(async (item) => {
      if (item.image) {
        const img = await fetchImageAsBase64(item.image);
        if (img) imageCache.set(item.image, img);
      }
    })
  );

  const hasImages = imageCache.size > 0;
  const imgColWidth = hasImages ? 18 : 0; // ancho columna imagen
  const productColStart = 25 + imgColWidth;

  doc.setFillColor(249, 250, 251);
  doc.rect(20, yPos, pageWidth - 40, 8, 'F');
  
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  if (hasImages) {
    doc.text('', 25, yPos + 5); // columna imagen (sin header)
  }
  doc.text('Producto', productColStart, yPos + 5);
  doc.text('Cant.', pageWidth - 90, yPos + 5);
  doc.text('Precio', pageWidth - 65, yPos + 5);
  doc.text('Total', pageWidth - 25, yPos + 5, { align: 'right' });
  
  yPos += 12;

  // Items
  doc.setFontSize(9);
  doc.setTextColor(55, 65, 81);
  
  data.items.forEach((item) => {
    // Verificar si necesitamos nueva página
    if (yPos > 245) {
      doc.addPage();
      yPos = 20;
    }
    
    const rowHeight = hasImages ? 16 : 8;
    
    // Dibujar imagen si existe
    if (item.image && imageCache.has(item.image)) {
      const img = imageCache.get(item.image)!;
      try {
        doc.addImage(img.data, img.format, 25, yPos - 4, 14, 14);
      } catch {
        // Si falla la imagen, continuar sin ella
      }
    }
    
    const productName = doc.splitTextToSize(item.name, hasImages ? 72 : 90);
    const textYOffset = hasImages ? Math.max(0, (14 - productName.length * 5) / 2) : 0;
    doc.text(productName, productColStart, yPos + textYOffset);
    doc.text(item.quantity.toString(), pageWidth - 90, yPos + textYOffset);
    doc.text(formatCurrency(item.price), pageWidth - 65, yPos + textYOffset);
    doc.text(formatCurrency(item.total), pageWidth - 25, yPos + textYOffset, { align: 'right' });
    
    yPos += Math.max(rowHeight, productName.length * 5 + 3);
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
