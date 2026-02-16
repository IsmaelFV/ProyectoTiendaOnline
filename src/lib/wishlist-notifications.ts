/**
 * ============================================================================
 * Wishlist Notifications Service
 * ============================================================================
 * Envía emails a los usuarios que tienen un producto en su lista de deseados
 * cuando:
 *   1. El producto entra en oferta (is_on_sale = true)
 *   2. El stock del producto baja de un umbral (LOW_STOCK_THRESHOLD)
 *
 * Usa Brevo (Sendinblue) para el envío y Supabase (service_role) para las
 * consultas, garantizando que no se rompa RLS.
 * ============================================================================
 */

import { createServerSupabaseClient } from './auth';
import { sendEmail } from './brevo';

/** Stock por debajo de este número se considera "bajo" */
const LOW_STOCK_THRESHOLD = 5;

// ─── Helpers ────────────────────────────────────────────────────────────────

interface WishlistUser {
  user_id: string;
  email: string;
}

/**
 * Obtiene los emails de los usuarios que tienen un producto en su wishlist.
 * Usa service_role → no depende de RLS.
 */
async function getWishlistUsersForProduct(productId: string): Promise<WishlistUser[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('wishlist_items')
    .select('user_id')
    .eq('product_id', productId);

  if (error || !data || data.length === 0) {
    return [];
  }

  // Obtener emails de auth.users a través de admin API
  const users: WishlistUser[] = [];

  for (const item of data) {
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(item.user_id);
    if (!userError && userData?.user?.email) {
      users.push({ user_id: item.user_id, email: userData.user.email });
    }
  }

  return users;
}

/**
 * Formatea el precio de centavos a formato legible (ej. 29,99 €)
 */
function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',') + ' €';
}

// ─── Notificación: Producto en oferta ───────────────────────────────────────

interface SaleNotificationData {
  productId: string;
  productName: string;
  productSlug: string;
  productImage?: string;
  originalPrice: number;   // en centavos
  salePrice: number;       // en centavos
  discountPercentage: number;
}

/**
 * Envía un email a cada usuario que tenga el producto en su wishlist
 * avisando de que ahora está en oferta.
 */
export async function notifyWishlistSale(data: SaleNotificationData): Promise<void> {
  try {
    const users = await getWishlistUsersForProduct(data.productId);

    if (users.length === 0) {
      console.log(`[Wishlist Notify] Ningún usuario tiene "${data.productName}" en favoritos, no se envían emails.`);
      return;
    }

    console.log(`[Wishlist Notify] Enviando notificación de oferta de "${data.productName}" a ${users.length} usuario(s)...`);

    const productUrl = `${import.meta.env.PUBLIC_SITE_URL || 'http://localhost:4321'}/productos/${data.productSlug}`;
    const imageHtml = data.productImage
      ? `<img src="${data.productImage}" alt="${data.productName}" style="max-width:100%;max-height:250px;border-radius:8px;object-fit:cover;margin-bottom:16px;" />`
      : '';

    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#dc2626 0%,#f59e0b 100%);color:#fff;padding:30px;text-align:center;border-radius:12px 12px 0 0;">
      <h1 style="margin:0;font-size:24px;">🔥 ¡Oferta en un producto que te gusta!</h1>
    </div>
    <!-- Body -->
    <div style="background:#fff;padding:30px;border-radius:0 0 12px 12px;">
      <p style="color:#374151;font-size:16px;">Un producto de tu lista de favoritos acaba de ponerse en oferta:</p>
      
      <div style="text-align:center;margin:20px 0;">
        ${imageHtml}
        <h2 style="margin:0 0 8px;color:#111827;">${data.productName}</h2>
        <p style="margin:4px 0;">
          <span style="text-decoration:line-through;color:#9ca3af;font-size:16px;">${formatPrice(data.originalPrice)}</span>
          <span style="color:#dc2626;font-size:22px;font-weight:bold;margin-left:10px;">${formatPrice(data.salePrice)}</span>
        </p>
        <span style="display:inline-block;background:#fef2f2;color:#dc2626;padding:4px 12px;border-radius:999px;font-weight:bold;font-size:14px;margin-top:8px;">
          -${data.discountPercentage}% de descuento
        </span>
      </div>

      <div style="text-align:center;margin:28px 0;">
        <a href="${productUrl}" style="display:inline-block;background:#dc2626;color:#fff;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px;">
          Ver oferta →
        </a>
      </div>

      <p style="color:#6b7280;font-size:13px;text-align:center;margin-top:24px;">
        Recibes este email porque tienes este producto en tu lista de favoritos en Fashion Store.
      </p>
    </div>
    <!-- Footer -->
    <div style="text-align:center;margin-top:20px;color:#9ca3af;font-size:12px;">
      <p>Fashion Store — Moda de calidad para ti</p>
    </div>
  </div>
</body>
</html>`;

    const results = await Promise.allSettled(
      users.map(u =>
        sendEmail({
          to: u.email,
          subject: `🔥 ¡"${data.productName}" está en oferta! -${data.discountPercentage}%`,
          htmlContent,
          textContent: `¡"${data.productName}" acaba de ponerse en oferta! Antes: ${formatPrice(data.originalPrice)} → Ahora: ${formatPrice(data.salePrice)} (-${data.discountPercentage}%). Ver: ${productUrl}`,
        })
      )
    );

    const sent = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    console.log(`[Wishlist Notify] Oferta — Enviados: ${sent}, Fallidos: ${failed}`);
  } catch (err) {
    // No lanzamos — las notificaciones no deben romper la operación principal
    console.error('[Wishlist Notify] Error en notifyWishlistSale:', err);
  }
}

// ─── Notificación: Stock bajo ───────────────────────────────────────────────

interface LowStockNotificationData {
  productId: string;
  productName: string;
  productSlug: string;
  productImage?: string;
  currentStock: number;
  price: number;         // en centavos
  salePrice?: number | null;
  isOnSale?: boolean;
}

/**
 * Envía un email a cada usuario que tenga el producto en su wishlist
 * avisando de que queda poco stock. Solo se dispara cuando el stock
 * baja del umbral LOW_STOCK_THRESHOLD.
 */
export async function notifyWishlistLowStock(data: LowStockNotificationData): Promise<void> {
  try {
    const users = await getWishlistUsersForProduct(data.productId);

    if (users.length === 0) {
      console.log(`[Wishlist Notify] Ningún usuario tiene "${data.productName}" en favoritos, no se envían emails de stock bajo.`);
      return;
    }

    console.log(`[Wishlist Notify] Enviando alerta de stock bajo de "${data.productName}" (${data.currentStock} uds.) a ${users.length} usuario(s)...`);

    const productUrl = `${import.meta.env.PUBLIC_SITE_URL || 'http://localhost:4321'}/productos/${data.productSlug}`;
    const imageHtml = data.productImage
      ? `<img src="${data.productImage}" alt="${data.productName}" style="max-width:100%;max-height:250px;border-radius:8px;object-fit:cover;margin-bottom:16px;" />`
      : '';

    const displayPrice = data.isOnSale && data.salePrice
      ? `<span style="text-decoration:line-through;color:#9ca3af;">${formatPrice(data.price)}</span> <span style="color:#dc2626;font-weight:bold;">${formatPrice(data.salePrice)}</span>`
      : `<span style="font-weight:bold;color:#111827;">${formatPrice(data.price)}</span>`;

    const stockWord = data.currentStock === 1 ? 'unidad' : 'unidades';

    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#f59e0b 0%,#ef4444 100%);color:#fff;padding:30px;text-align:center;border-radius:12px 12px 0 0;">
      <h1 style="margin:0;font-size:24px;">⚡ ¡Últimas unidades de un producto que te gusta!</h1>
    </div>
    <!-- Body -->
    <div style="background:#fff;padding:30px;border-radius:0 0 12px 12px;">
      <p style="color:#374151;font-size:16px;">Un producto de tu lista de favoritos se está agotando:</p>
      
      <div style="text-align:center;margin:20px 0;">
        ${imageHtml}
        <h2 style="margin:0 0 8px;color:#111827;">${data.productName}</h2>
        <p style="margin:8px 0;font-size:16px;">${displayPrice}</p>
        <div style="display:inline-block;background:#fef3c7;color:#92400e;padding:8px 16px;border-radius:999px;font-weight:bold;font-size:15px;margin-top:8px;">
          ⚠️ Solo quedan ${data.currentStock} ${stockWord}
        </div>
      </div>

      <div style="text-align:center;margin:28px 0;">
        <a href="${productUrl}" style="display:inline-block;background:#f59e0b;color:#fff;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px;">
          Comprar ahora →
        </a>
      </div>

      <p style="color:#6b7280;font-size:13px;text-align:center;margin-top:24px;">
        Recibes este email porque tienes este producto en tu lista de favoritos en Fashion Store.
      </p>
    </div>
    <!-- Footer -->
    <div style="text-align:center;margin-top:20px;color:#9ca3af;font-size:12px;">
      <p>Fashion Store — Moda de calidad para ti</p>
    </div>
  </div>
</body>
</html>`;

    const results = await Promise.allSettled(
      users.map(u =>
        sendEmail({
          to: u.email,
          subject: `⚡ ¡Quedan solo ${data.currentStock} ${stockWord} de "${data.productName}"!`,
          htmlContent,
          textContent: `¡"${data.productName}" se está agotando! Solo quedan ${data.currentStock} ${stockWord}. No te quedes sin el tuyo: ${productUrl}`,
        })
      )
    );

    const sent = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    console.log(`[Wishlist Notify] Stock bajo — Enviados: ${sent}, Fallidos: ${failed}`);
  } catch (err) {
    console.error('[Wishlist Notify] Error en notifyWishlistLowStock:', err);
  }
}

/**
 * Comprueba si el stock actual ha cruzado por debajo del umbral y, en ese caso,
 * dispara la notificación. Recibe el stock ANTES y DESPUÉS para evitar enviar
 * emails duplicados (solo se envía al cruzar el umbral, no en cada compra).
 */
export async function checkAndNotifyLowStock(
  productId: string,
  stockBefore: number,
  stockAfter: number
): Promise<void> {
  // Solo notificar si el stock CRUZA por debajo del umbral (evita duplicados)
  if (stockBefore > LOW_STOCK_THRESHOLD && stockAfter <= LOW_STOCK_THRESHOLD && stockAfter > 0) {
    const supabase = createServerSupabaseClient();

    const { data: product } = await supabase
      .from('products')
      .select('id, name, slug, images, price, sale_price, is_on_sale')
      .eq('id', productId)
      .single();

    if (product) {
      await notifyWishlistLowStock({
        productId: product.id,
        productName: product.name,
        productSlug: product.slug,
        productImage: product.images?.[0],
        currentStock: stockAfter,
        price: product.price,
        salePrice: product.sale_price,
        isOnSale: product.is_on_sale,
      });
    }
  }
}

export { LOW_STOCK_THRESHOLD };
