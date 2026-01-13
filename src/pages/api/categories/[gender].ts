/**
 * ============================================================================
 * API: Categorías por Género
 * ============================================================================
 * GET /api/categories/:gender
 * Devuelve la estructura de categorías jerárquica para un género
 * ============================================================================
 */

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const GET: APIRoute = async ({ params }) => {
  try {
    const { gender } = params;
    
    if (!gender || !['mujer', 'hombre', 'unisex'].includes(gender)) {
      return new Response(
        JSON.stringify({ error: 'Género inválido. Valores permitidos: mujer, hombre, unisex' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Obtener ID del género
    const { data: genderData, error: genderError } = await supabase
      .from('genders')
      .select('id')
      .eq('slug', gender)
      .single();
    
    if (genderError || !genderData) {
      return new Response(
        JSON.stringify({ error: 'Género no encontrado' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Obtener todas las categorías del género
    const { data: categories, error: categoriesError } = await supabase
      .from('categories')
      .select('*')
      .eq('gender_id', genderData.id)
      .eq('is_active', true)
      .order('level', { ascending: true })
      .order('display_order', { ascending: true });
    
    if (categoriesError) {
      console.error('Error obteniendo categorías:', categoriesError);
      return new Response(
        JSON.stringify({ error: 'Error al obtener categorías' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({ 
        gender,
        categories: categories || []
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600' // Cachear 1 hora
        }
      }
    );
    
  } catch (error) {
    console.error('Error en /api/categories/:gender:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Error interno del servidor',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
