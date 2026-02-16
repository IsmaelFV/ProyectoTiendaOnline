import type { APIRoute } from 'astro';
import { createServerSupabaseClient, verifyAdminFromCookies } from '../../../lib/auth';

// Crear nuevo código de descuento
export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const accessToken = cookies.get('sb-access-token')?.value;
    const refreshToken = cookies.get('sb-refresh-token')?.value;

    const userId = await verifyAdminFromCookies(accessToken, refreshToken);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createServerSupabaseClient();
    const body = await request.json();
    const {
      code,
      description,
      discount_type,
      discount_value,
      valid_from,
      valid_until,
      max_uses,
      min_purchase_amount,
      is_active,
    } = body;

    if (!code || !discount_type || !discount_value) {
      return new Response(JSON.stringify({ error: 'Código, tipo y valor de descuento son obligatorios' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const discountVal = parseFloat(discount_value);
    if (isNaN(discountVal) || discountVal <= 0) {
      return new Response(JSON.stringify({ error: 'Valor de descuento inválido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (discount_type === 'percentage' && discountVal > 100) {
      return new Response(JSON.stringify({ error: 'El porcentaje no puede superar 100%' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const insertData: Record<string, any> = {
      code: code.toUpperCase().trim(),
      description: description || null,
      discount_type,
      discount_value: discountVal,
      is_active: is_active !== false,
    };

    if (valid_from) insertData.valid_from = valid_from;
    if (valid_until) insertData.valid_until = valid_until;
    if (max_uses) insertData.max_uses = parseInt(max_uses);
    if (min_purchase_amount) insertData.min_purchase_amount = parseFloat(min_purchase_amount);

    const { data, error } = await supabase
      .from('discount_codes')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error creando código:', error);
      if (error.code === '23505') {
        return new Response(JSON.stringify({ error: 'Ya existe un código con ese nombre' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'Error al crear el código' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, data }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error en creación de código:', error);
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// Actualizar código de descuento
export const PUT: APIRoute = async ({ request, cookies }) => {
  try {
    const accessToken = cookies.get('sb-access-token')?.value;
    const refreshToken = cookies.get('sb-refresh-token')?.value;

    const userId = await verifyAdminFromCookies(accessToken, refreshToken);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createServerSupabaseClient();
    const body = await request.json();
    const { id, ...updateFields } = body;

    if (!id) {
      return new Response(JSON.stringify({ error: 'ID del código requerido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };

    if (updateFields.code !== undefined) updateData.code = updateFields.code.toUpperCase().trim();
    if (updateFields.description !== undefined) updateData.description = updateFields.description;
    if (updateFields.discount_type !== undefined) updateData.discount_type = updateFields.discount_type;
    if (updateFields.discount_value !== undefined) updateData.discount_value = parseFloat(updateFields.discount_value);
    if (updateFields.valid_from !== undefined) updateData.valid_from = updateFields.valid_from || null;
    if (updateFields.valid_until !== undefined) updateData.valid_until = updateFields.valid_until || null;
    if (updateFields.max_uses !== undefined) updateData.max_uses = updateFields.max_uses ? parseInt(updateFields.max_uses) : null;
    if (updateFields.min_purchase_amount !== undefined) updateData.min_purchase_amount = parseFloat(updateFields.min_purchase_amount) || 0;
    if (updateFields.is_active !== undefined) updateData.is_active = updateFields.is_active;

    const { error } = await supabase
      .from('discount_codes')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error('Error actualizando código:', error);
      if (error.code === '23505') {
        return new Response(JSON.stringify({ error: 'Ya existe un código con ese nombre' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'Error al actualizar el código' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error en actualización de código:', error);
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// Eliminar código de descuento
export const DELETE: APIRoute = async ({ request, cookies }) => {
  try {
    const accessToken = cookies.get('sb-access-token')?.value;
    const refreshToken = cookies.get('sb-refresh-token')?.value;

    const userId = await verifyAdminFromCookies(accessToken, refreshToken);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createServerSupabaseClient();
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return new Response(JSON.stringify({ error: 'ID del código requerido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { error } = await supabase
      .from('discount_codes')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error eliminando código:', error);
      return new Response(JSON.stringify({ error: 'Error al eliminar el código' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error en eliminación de código:', error);
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
