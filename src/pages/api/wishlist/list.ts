import type { APIRoute } from 'astro';
import { createServerSupabaseClient } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';

// GET /api/wishlist/list — Devuelve todos los productos favoritos del usuario
export const GET: APIRoute = async ({ cookies }) => {
  const headers = { 'Content-Type': 'application/json' };
  const serverSupabase = createServerSupabaseClient();

  try {
    const accessToken = cookies.get('sb-access-token')?.value;
    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'Debes iniciar sesión' }), { status: 401, headers });
    }

    const { data: { user } } = await supabase.auth.getUser(accessToken);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Sesión no válida' }), { status: 401, headers });
    }

    // Obtener wishlist con datos del producto joinados
    const { data, error } = await serverSupabase
      .from('wishlist_items')
      .select(`
        id,
        created_at,
        product_id,
        products:product_id (
          id, name, slug, price, sale_price, is_on_sale, images, stock, is_active,
          category:category_id ( name )
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error('[Wishlist List] Error:', error);
      return new Response(JSON.stringify({ error: 'Error al obtener favoritos' }), { status: 500, headers });
    }

    return new Response(JSON.stringify({ items: data || [] }), { status: 200, headers });
  } catch (err) {
    console.error('[Wishlist List] Unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Error interno' }), { status: 500, headers });
  }
};
