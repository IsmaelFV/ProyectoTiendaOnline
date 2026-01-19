/**
 * API Endpoint: Cancelar Pedido
 * POST /api/orders/cancel
 * 
 * Cancela un pedido y restaura el stock automáticamente.
 * Solo permite cancelar pedidos en estado 'confirmed' o 'processing'.
 * Requiere autenticación.
 */

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const POST: APIRoute = async ({ request }) => {
  try {
    // 1. Verificar autenticación
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'No autenticado. Debes iniciar sesión.' 
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verificar el token con Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Token inválido o expirado' 
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Obtener el ID del pedido del body
    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'ID de pedido requerido' 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Llamar a la función SQL atómica cancel_order_and_restore_stock
    // Esta función maneja TODAS las validaciones y restauración de stock
    const { data, error } = await supabase.rpc('cancel_order_and_restore_stock', {
      p_order_id: orderId,
      p_user_id: user.id
    });

    if (error) {
      console.error('[CANCEL ORDER] Error calling RPC:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Error al cancelar el pedido. Intenta de nuevo.' 
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. La función retorna JSON con {success, message, restored_items}
    const result = data as { success: boolean; message: string; restored_items?: number };

    if (!result.success) {
      // Casos: pedido no encontrado, sin permisos, estado inválido
      return new Response(
        JSON.stringify(result),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 5. Éxito
    console.log(`[CANCEL ORDER] Pedido ${orderId} cancelado por usuario ${user.id}. Stock restaurado: ${result.restored_items} items`);
    
    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[CANCEL ORDER] Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: 'Error inesperado al procesar la cancelación' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
