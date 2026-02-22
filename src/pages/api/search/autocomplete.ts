/**
 * ============================================================================
 * API: Autocompletado de Búsqueda
 * ============================================================================
 * GET /api/search/autocomplete?q=camis
 * 
 * Devuelve sugerencias instantáneas para la barra de búsqueda
 * ============================================================================
 */

import type { APIRoute } from 'astro';
import { autocompleteSearch } from '../../../lib/search';

export const GET: APIRoute = async ({ url }) => {
  try {
    const query = url.searchParams.get('q');
    
    if (!query || query.length < 2) {
      return new Response(
        JSON.stringify({ suggestions: [] }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    const limit = Math.min(20, Math.max(1, parseInt(url.searchParams.get('limit') || '5') || 5));
    
    const suggestions = await autocompleteSearch(query, limit);
    
    return new Response(
      JSON.stringify({ suggestions }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300' // Cachear 5 minutos
        }
      }
    );
    
  } catch (error) {
    console.error('Error en /api/search/autocomplete:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Error en el autocompletado',
        suggestions: []
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
