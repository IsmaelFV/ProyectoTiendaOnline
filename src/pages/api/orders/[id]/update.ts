import type { APIRoute } from 'astro';
import { verifyAdminFromCookies, createServerSupabaseClient } from '@lib/auth';

export const POST: APIRoute = async ({ params, request, cookies }) => {
  try {
    // Verificar autenticación admin
    const accessToken = cookies.get('sb-access-token')?.value;
    const refreshToken = cookies.get('sb-refresh-token')?.value;
    const userId = await verifyAdminFromCookies(accessToken, refreshToken);
    if (!userId) {
      return new Response(JSON.stringify({ success: false, error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const supabase = createServerSupabaseClient();
    const { id } = params;
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (!id || !UUID_RE.test(id)) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'ID de pedido inválido' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { status, shipping_method, tracking_number, admin_notes } = body;

    // Validar status contra allowlist
    const VALID_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];
    if (status && !VALID_STATUSES.includes(status)) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Estado inválido: ${status}. Valores permitidos: ${VALID_STATUSES.join(', ')}` 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Preparar datos de actualización
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (status) updateData.status = status;
    if (shipping_method !== undefined) {
      if (typeof shipping_method !== 'string' || shipping_method.length > 200) {
        return new Response(JSON.stringify({ success: false, error: 'shipping_method inválido' }), {
          status: 400, headers: { 'Content-Type': 'application/json' }
        });
      }
      updateData.shipping_method = shipping_method;
    }
    if (tracking_number !== undefined) {
      if (typeof tracking_number !== 'string' || tracking_number.length > 200) {
        return new Response(JSON.stringify({ success: false, error: 'tracking_number inválido' }), {
          status: 400, headers: { 'Content-Type': 'application/json' }
        });
      }
      updateData.tracking_number = tracking_number;
    }
    if (admin_notes !== undefined) {
      if (typeof admin_notes !== 'string' || admin_notes.length > 5000) {
        return new Response(JSON.stringify({ success: false, error: 'admin_notes inválido' }), {
          status: 400, headers: { 'Content-Type': 'application/json' }
        });
      }
      updateData.admin_notes = admin_notes;
    }

    // Actualizar timestamps según el estado
    if (status === 'shipped' && !updateData.shipped_at) {
      updateData.shipped_at = new Date().toISOString();
    }
    if (status === 'delivered' && !updateData.delivered_at) {
      updateData.delivered_at = new Date().toISOString();
    }

    // Actualizar orden
    const { data, error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating order:', error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Error al actualizar el pedido' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      data 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error in update order endpoint:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Error interno del servidor' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
