import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../../../lib/supabase';

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
    if (!productId) {
      return new Response(JSON.stringify({ error: 'product_id es requerido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: reviews, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Calcular estadísticas
    const total = reviews?.length || 0;
    const avgRating = total > 0
      ? reviews!.reduce((sum: number, r: any) => sum + r.rating, 0) / total
      : 0;
    const distribution = [0, 0, 0, 0, 0]; // 1-5 estrellas
    reviews?.forEach((r: any) => { distribution[r.rating - 1]++; });

    return new Response(JSON.stringify({
      reviews: reviews || [],
      stats: {
        total,
        average: Math.round(avgRating * 10) / 10,
        distribution,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Error al obtener reseñas' }), {
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

    if (!product_id || !rating) {
      return new Response(JSON.stringify({ error: 'product_id y rating son requeridos' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (rating < 1 || rating > 5) {
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
        rating: Math.round(rating),
        title: title?.trim().substring(0, 150) || null,
        comment: comment?.trim() || null,
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
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Error interno' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// DELETE: Eliminar reseña propia
export const DELETE: APIRoute = async ({ request, cookies }) => {
  try {
    const accessToken = cookies.get('sb-access-token')?.value;
    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: { user } } = await supabase.auth.getUser(accessToken);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Sesión no válida' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { review_id } = body;

    if (!review_id) {
      return new Response(JSON.stringify({ error: 'review_id es requerido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Usar cliente autenticado para que RLS permita la operación
    const authClient = createAuthenticatedClient(accessToken);

    const { error } = await authClient
      .from('reviews')
      .delete()
      .eq('id', review_id)
      .eq('user_id', user.id);

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Error al eliminar' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
