import type { APIRoute } from 'astro';
import { createServerSupabaseClient } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';

// POST /api/wishlist/toggle  — Añadir o quitar un producto de favoritos
export const POST: APIRoute = async ({ request, cookies }) => {
  const headers = { 'Content-Type': 'application/json' };
  const serverSupabase = createServerSupabaseClient();

  try {
    // 1. Verificar autenticación
    const accessToken = cookies.get('sb-access-token')?.value;
    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'Debes iniciar sesión' }), { status: 401, headers });
    }

    const { data: { user } } = await supabase.auth.getUser(accessToken);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Sesión no válida' }), { status: 401, headers });
    }

    // 2. Leer body
    const body = await request.json();
    const productId = body.productId;

    if (!productId) {
      return new Response(JSON.stringify({ error: 'productId requerido' }), { status: 400, headers });
    }

    // 3. Comprobar si ya está en favoritos
    const { data: existing } = await serverSupabase
      .from('wishlist_items')
      .select('id')
      .eq('user_id', user.id)
      .eq('product_id', productId)
      .maybeSingle();

    if (existing) {
      // Ya está → eliminarlo
      const { error } = await serverSupabase
        .from('wishlist_items')
        .delete()
        .eq('id', existing.id);

      if (error) {
        console.error('[Wishlist] Error removing:', error);
        return new Response(JSON.stringify({ error: 'Error al eliminar de favoritos' }), { status: 500, headers });
      }

      return new Response(JSON.stringify({ action: 'removed', inWishlist: false }), { status: 200, headers });
    } else {
      // No está → añadirlo
      const { error } = await serverSupabase
        .from('wishlist_items')
        .insert({ user_id: user.id, product_id: productId });

      if (error) {
        console.error('[Wishlist] Error adding:', error);
        return new Response(JSON.stringify({ error: 'Error al añadir a favoritos' }), { status: 500, headers });
      }

      return new Response(JSON.stringify({ action: 'added', inWishlist: true }), { status: 200, headers });
    }
  } catch (err) {
    console.error('[Wishlist] Unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Error interno' }), { status: 500, headers });
  }
};
