import type { APIRoute } from 'astro';
import { supabase } from '@lib/supabase';

// GET - Obtener estado de ofertas flash
export const GET: APIRoute = async ({ cookies }) => {
  try {
    // Verificar autenticación
    const accessToken = cookies.get('sb-access-token')?.value;
    if (!accessToken) {
      return new Response(
        JSON.stringify({ enabled: true }), // Valor por defecto público
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Obtener configuración de la base de datos
    const { data, error } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'flash_offers_enabled')
      .single();

    if (error) {
      // Si no existe, devolver habilitado por defecto
      return new Response(
        JSON.stringify({ enabled: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ enabled: data.value === 'true' || data.value === true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error getting flash offers setting:', error);
    return new Response(
      JSON.stringify({ enabled: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// POST - Actualizar estado de ofertas flash
export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Verificar autenticación admin
    const accessToken = cookies.get('sb-access-token')?.value;
    if (!accessToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'No autenticado' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verificar que es admin
    const { data: { user } } = await supabase.auth.getUser(accessToken);
    if (!user) {
      return new Response(
        JSON.stringify({ success: false, error: 'No autenticado' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { data: adminCheck } = await supabase
      .from('admin_users')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!adminCheck) {
      return new Response(
        JSON.stringify({ success: false, error: 'No autorizado' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json();
    const { enabled } = body;

    // Upsert la configuración
    const { error } = await supabase
      .from('site_settings')
      .upsert({
        key: 'flash_offers_enabled',
        value: String(enabled),
        updated_at: new Date().toISOString(),
        updated_by: user.id
      }, {
        onConflict: 'key'
      });

    if (error) {
      console.error('Error updating flash offers setting:', error);
      return new Response(
        JSON.stringify({ success: false, error: 'Error al actualizar' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, enabled }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Flash offers toggle error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Error interno' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
