/**
 * ============================================================================
 * API: Listado paginado de productos
 * ============================================================================
 * GET /api/products/list?page=2&limit=24&gender_id=xxx&category_ids=id1,id2&is_on_sale=true&is_new=true
 * 
 * Devuelve productos con paginación para el botón "Cargar más"
 * ============================================================================
 */

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_LIMIT = 100;
const MAX_CATEGORY_IDS = 50;

export const GET: APIRoute = async ({ url }) => {
  try {
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1') || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(url.searchParams.get('limit') || '24') || 24));
    const genderId = url.searchParams.get('gender_id');
    const categoryIds = url.searchParams.get('category_ids');
    const isOnSale = url.searchParams.get('is_on_sale');
    const isNew = url.searchParams.get('is_new');

    if (!genderId || !UUID_RE.test(genderId)) {
      return new Response(JSON.stringify({ error: 'gender_id inválido o ausente' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const offset = (page - 1) * limit;

    // Construir query base
    let query = supabase
      .from('products')
      .select(`
        id, name, slug, price, sale_price, stock, images, is_on_sale, is_new, featured, is_active,
        category:categories!products_category_id_fkey(name, slug)
      `, { count: 'exact' })
      .eq('gender_id', genderId)
      .eq('is_active', true);

    // Filtros condicionales
    if (isOnSale === 'true') {
      query = query.eq('is_on_sale', true);
    }

    if (isNew === 'true') {
      query = query.eq('is_new', true);
    }

    if (categoryIds) {
      const ids = categoryIds.split(',').filter(id => UUID_RE.test(id)).slice(0, MAX_CATEGORY_IDS);
      if (ids.length > 0) {
        query = query.in('category_id', ids);
      }
    }

    // Ordenamiento (mantener consistente con las páginas)
    if (isOnSale === 'true') {
      query = query.order('sale_price', { ascending: true });
    } else {
      query = query.order('featured', { ascending: false });
    }
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: products, error, count } = await query;

    if (error) {
      console.error('Error fetching products:', error);
      return new Response(JSON.stringify({ error: 'Error al obtener productos' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const totalCount = count || 0;
    const hasMore = offset + limit < totalCount;

    return new Response(JSON.stringify({
      products: products || [],
      pagination: {
        page,
        limit,
        total: totalCount,
        hasMore,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('API products/list error:', err);
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
