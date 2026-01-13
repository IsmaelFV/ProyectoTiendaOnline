/**
 * ============================================================================
 * API: Búsqueda de Productos
 * ============================================================================
 * GET /api/search
 * 
 * Query params:
 * - q: string (query de búsqueda)
 * - gender: string (slug)
 * - category: string (slug)
 * - minPrice: number (céntimos)
 * - maxPrice: number (céntimos)
 * - colors: string (slugs separados por coma)
 * - sizes: string (tallas separadas por coma)
 * - inStock: boolean
 * - new: boolean
 * - sale: boolean
 * - sortBy: string
 * - page: number
 * - limit: number
 * ============================================================================
 */

import type { APIRoute } from 'astro';
import { searchProducts } from '../../../lib/search';
import type { SearchFilters } from '../../../lib/search';

export const GET: APIRoute = async ({ url }) => {
  try {
    const params = url.searchParams;
    
    // Construir filtros desde query params
    const filters: SearchFilters = {};
    
    if (params.get('q')) filters.query = params.get('q')!;
    if (params.get('gender')) filters.gender = params.get('gender')!;
    if (params.get('category')) filters.category = params.get('category')!;
    
    if (params.get('minPrice')) {
      filters.minPrice = parseInt(params.get('minPrice')!);
    }
    
    if (params.get('maxPrice')) {
      filters.maxPrice = parseInt(params.get('maxPrice')!);
    }
    
    if (params.get('colors')) {
      filters.colors = params.get('colors')!.split(',').map(c => c.trim());
    }
    
    if (params.get('sizes')) {
      filters.sizes = params.get('sizes')!.split(',').map(s => s.trim());
    }
    
    if (params.get('inStock') === 'true') filters.inStock = true;
    if (params.get('new') === 'true') filters.isNew = true;
    if (params.get('sale') === 'true') filters.onSale = true;
    
    if (params.get('sortBy')) {
      filters.sortBy = params.get('sortBy') as any;
    }
    
    const page = params.get('page') ? parseInt(params.get('page')!) : 1;
    const limit = params.get('limit') ? parseInt(params.get('limit')!) : 24;
    
    // Validación
    if (page < 1) {
      return new Response(
        JSON.stringify({ error: 'Page debe ser mayor a 0' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    if (limit < 1 || limit > 100) {
      return new Response(
        JSON.stringify({ error: 'Limit debe estar entre 1 y 100' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Ejecutar búsqueda
    const result = await searchProducts(filters, page, limit);
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60' // Cachear 1 minuto
      }
    });
    
  } catch (error) {
    console.error('Error en /api/search:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Error en la búsqueda',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
