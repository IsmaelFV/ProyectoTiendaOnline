import type { APIRoute } from 'astro';
import { createServerSupabaseClient } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';

// GET /api/wishlist/check?productIds=id1,id2,id3
// Devuelve qué productos de la lista están en favoritos del usuario
export const GET: APIRoute = async ({ url, cookies }) => {
  const headers = { 'Content-Type': 'application/json' };
  const serverSupabase = createServerSupabaseClient();

  try {
    const accessToken = cookies.get('sb-access-token')?.value;
    if (!accessToken) {
      return new Response(JSON.stringify({ ids: [] }), { status: 200, headers });
    }

    const { data: { user } } = await supabase.auth.getUser(accessToken);
    if (!user) {
      return new Response(JSON.stringify({ ids: [] }), { status: 200, headers });
    }

    const productIdsParam = url.searchParams.get('productIds');
    if (!productIdsParam) {
      return new Response(JSON.stringify({ ids: [] }), { status: 200, headers });
    }

    const productIds = productIdsParam.split(',').filter(Boolean);

    const { data, error } = await serverSupabase
      .from('wishlist_items')
      .select('product_id')
      .eq('user_id', user.id)
      .in('product_id', productIds);

    if (error) {
      console.error('[Wishlist Check] Error:', error);
      return new Response(JSON.stringify({ ids: [] }), { status: 200, headers });
    }

    const ids = data?.map(item => item.product_id) || [];
    return new Response(JSON.stringify({ ids }), { status: 200, headers });
  } catch (err) {
    console.error('[Wishlist Check] Unexpected error:', err);
    return new Response(JSON.stringify({ ids: [] }), { status: 200, headers });
  }
};
