import type { APIRoute } from 'astro';
import { createServerSupabaseClient, verifyAdminFromCookies } from '../../../lib/auth';
import { notifyWishlistSale } from '../../../lib/wishlist-notifications';

export const PUT: APIRoute = async ({ request, cookies }) => {
  try {
    const accessToken = cookies.get('sb-access-token')?.value;
    const refreshToken = cookies.get('sb-refresh-token')?.value;

    const userId = await verifyAdminFromCookies(accessToken, refreshToken);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createServerSupabaseClient();
    const body = await request.json();
    const { product_id, discount_percentage } = body;

    if (!product_id || !discount_percentage) {
      return new Response(JSON.stringify({ error: 'Faltan campos requeridos' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const discountPct = parseInt(discount_percentage);
    if (isNaN(discountPct) || discountPct < 1 || discountPct > 99) {
      return new Response(JSON.stringify({ error: 'Porcentaje debe estar entre 1 y 99' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Obtener datos del producto
    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('price, name, slug, images, is_on_sale')
      .eq('id', product_id)
      .single();

    if (fetchError || !product) {
      return new Response(JSON.stringify({ error: 'Producto no encontrado' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const salePriceInCents = Math.round(product.price * (1 - discountPct / 100));

    const { error: updateError } = await supabase
      .from('products')
      .update({
        is_on_sale: true,
        sale_price: salePriceInCents,
        updated_at: new Date().toISOString(),
      })
      .eq('id', product_id);

    if (updateError) {
      console.error('Error actualizando oferta:', updateError);
      return new Response(JSON.stringify({ error: 'Error al actualizar la oferta' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Notificar a usuarios que tienen este producto en favoritos (async, no bloquea)
    if (!product.is_on_sale) {
      // Solo notificar si el producto NO estaba ya en oferta (evita spam al cambiar %)
      notifyWishlistSale({
        productId: product_id,
        productName: product.name,
        productSlug: product.slug,
        productImage: product.images?.[0],
        originalPrice: product.price,
        salePrice: salePriceInCents,
        discountPercentage: discountPct,
      }).catch(err => console.error('[Offers] Error notificando wishlist:', err));
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error en actualización de oferta:', error);
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const DELETE: APIRoute = async ({ request, cookies }) => {
  try {
    const accessToken = cookies.get('sb-access-token')?.value;
    const refreshToken = cookies.get('sb-refresh-token')?.value;

    const userId = await verifyAdminFromCookies(accessToken, refreshToken);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createServerSupabaseClient();
    const body = await request.json();
    const { product_id } = body;

    if (!product_id) {
      return new Response(JSON.stringify({ error: 'Falta el ID del producto' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { error: updateError } = await supabase
      .from('products')
      .update({
        is_on_sale: false,
        sale_price: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', product_id);

    if (updateError) {
      console.error('Error eliminando oferta:', updateError);
      return new Response(JSON.stringify({ error: 'Error al eliminar la oferta' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error en eliminación de oferta:', error);
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
