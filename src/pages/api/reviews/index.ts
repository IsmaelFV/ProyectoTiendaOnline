import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../../../lib/supabase';
import { createServerSupabaseClient } from '../../../lib/auth';

interface ReviewRow {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  created_at: string;
  updated_at?: string;
}

/**
 * Crea un cliente Supabase autenticado con el token del usuario.
 * Necesario para que las operaciones respeten RLS (auth.uid() = user_id).
 */
function createAuthenticatedClient(accessToken: string) {
  return createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    }
  );
}

// GET: Obtener reseñas de un producto
export const GET: APIRoute = async ({ url }) => {
  try {
    const productId = url.searchParams.get('product_id');
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!productId || !UUID_RE.test(productId)) {
      return new Response(JSON.stringify({ error: 'product_id inválido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: reviews, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    // Obtener nombres de usuarios desde auth (service role)
    const userNames: Record<string, string> = {};
    const uniqueUserIds = [...new Set(((reviews ?? []) as ReviewRow[]).map((r) => r.user_id))];
    
    if (uniqueUserIds.length > 0) {
      try {
        const adminClient = createServerSupabaseClient();
        const userResults = await Promise.all(
          uniqueUserIds.map(uid =>
            adminClient.auth.admin.getUserById(uid)
              .then(({ data: { user } }) => ({ uid, user }))
              .catch(() => ({ uid, user: null }))
          )
        );
        for (const { uid, user } of userResults) {
          if (user) {
            const name = user.user_metadata?.full_name 
              || user.user_metadata?.name 
              || user.email?.split('@')[0] 
              || 'Anónimo';
            userNames[uid] = name;
          }
        }
      } catch (err) {
        console.error('[REVIEWS] Failed to fetch user names:', err);
      }
    }

    // Enriquecer reviews con user_name
    const enrichedReviews = ((reviews ?? []) as ReviewRow[]).map((r) => ({
      ...r,
      user_name: userNames[r.user_id] || 'Anónimo',
    }));

    // Calcular estadísticas
    const total = enrichedReviews.length;
    const avgRating = total > 0
      ? enrichedReviews.reduce((sum, r) => sum + r.rating, 0) / total
      : 0;
    const distribution = [0, 0, 0, 0, 0]; // 1-5 estrellas
    enrichedReviews.forEach((r) => { distribution[r.rating - 1]++; });

    return new Response(JSON.stringify({
      reviews: enrichedReviews,
      stats: {
        total,
        average: Math.round(avgRating * 10) / 10,
        distribution,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error al obtener reseñas:', error);
    return new Response(JSON.stringify({ error: 'Error al obtener reseñas' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// POST: Crear o actualizar reseña
export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const accessToken = cookies.get('sb-access-token')?.value;
    const refreshToken = cookies.get('sb-refresh-token')?.value;

    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'Debes iniciar sesión para dejar una reseña' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verificar usuario con el cliente público
    let userId: string | null = null;
    let validToken = accessToken;

    const { data: { user } } = await supabase.auth.getUser(accessToken);
    if (user) {
      userId = user.id;
    } else if (refreshToken) {
      const { data: refreshed } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
      if (refreshed?.session && refreshed?.user) {
        userId = refreshed.user.id;
        validToken = refreshed.session.access_token;
        // Actualizar cookies con el nuevo token
        cookies.set('sb-access-token', refreshed.session.access_token, {
          path: '/', httpOnly: true, secure: import.meta.env.PROD, sameSite: 'lax', maxAge: 60 * 60 * 24 * 7,
        });
        cookies.set('sb-refresh-token', refreshed.session.refresh_token, {
          path: '/', httpOnly: true, secure: import.meta.env.PROD, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30,
        });
      }
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Sesión no válida' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { product_id, rating, title, comment } = body;

    const UUID_RE_POST = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const numericRating = Number(rating);
    if (!product_id || typeof product_id !== 'string' || !UUID_RE_POST.test(product_id) || !Number.isFinite(numericRating)) {
      return new Response(JSON.stringify({ error: 'product_id y rating numérico son requeridos' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (numericRating < 1 || numericRating > 5) {
      return new Response(JSON.stringify({ error: 'La valoración debe ser entre 1 y 5' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Usar cliente autenticado para que RLS permita la operación
    const authClient = createAuthenticatedClient(validToken);

    // Upsert: crear o actualizar si ya existe
    const { data: review, error } = await authClient
      .from('reviews')
      .upsert({
        product_id,
        user_id: userId,
        rating: Math.round(numericRating),
        title: title?.trim().substring(0, 150) || null,
        comment: comment?.trim().substring(0, 2000) || null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'product_id,user_id',
      })
      .select()
      .single();

    if (error) {
      console.error('[Reviews] Error:', error);
      return new Response(JSON.stringify({ error: 'Error al guardar la reseña' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, review }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error al crear/actualizar reseña:', error);
    return new Response(JSON.stringify({ error: 'Error al procesar la reseña' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// DELETE: Eliminar reseña propia
export const DELETE: APIRoute = async ({ request, cookies }) => {
  try {
    const accessToken = cookies.get('sb-access-token')?.value;
    const refreshToken = cookies.get('sb-refresh-token')?.value;

    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let userId: string | null = null;
    let validToken = accessToken;

    const { data: { user } } = await supabase.auth.getUser(accessToken);
    if (user) {
      userId = user.id;
    } else if (refreshToken) {
      const { data: refreshed } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
      if (refreshed?.session && refreshed?.user) {
        userId = refreshed.user.id;
        validToken = refreshed.session.access_token;
        cookies.set('sb-access-token', refreshed.session.access_token, {
          path: '/', httpOnly: true, secure: import.meta.env.PROD, sameSite: 'lax', maxAge: 60 * 60 * 24 * 7,
        });
        cookies.set('sb-refresh-token', refreshed.session.refresh_token, {
          path: '/', httpOnly: true, secure: import.meta.env.PROD, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30,
        });
      }
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Sesión no válida' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { review_id } = body;
    const UUID_RE_DEL = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!review_id || typeof review_id !== 'string' || !UUID_RE_DEL.test(review_id)) {
      return new Response(JSON.stringify({ error: 'review_id inválido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Usar cliente autenticado para que RLS permita la operación
    const authClient = createAuthenticatedClient(validToken);

    const { error } = await authClient
      .from('reviews')
      .delete()
      .eq('id', review_id)
      .eq('user_id', userId);

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error al eliminar reseña:', error);
    return new Response(JSON.stringify({ error: 'Error al eliminar la reseña' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
