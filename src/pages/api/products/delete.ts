import type { APIRoute } from 'astro';
import { verifyAdminFromCookies, createServerSupabaseClient } from '@lib/auth';

export const DELETE: APIRoute = async ({ request, cookies }) => {
  try {
    // Verificar autenticación admin
    const accessToken = cookies.get('sb-access-token')?.value;
    const refreshToken = cookies.get('sb-refresh-token')?.value;
    const userId = await verifyAdminFromCookies(accessToken, refreshToken);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const supabase = createServerSupabaseClient();

    // Obtener ID del producto
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return new Response(JSON.stringify({ error: 'ID de producto no proporcionado' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verificar que el producto existe
    const { data: existingProduct, error: checkError } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (checkError || !existingProduct) {
      return new Response(JSON.stringify({ error: 'Producto no encontrado' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verificar si hay pedidos relacionados
    const { data: orderItems, error: orderItemsError } = await supabase
      .from('order_items')
      .select('id')
      .eq('product_id', id)
      .limit(1);

    if (orderItemsError) {
      console.error('Error al verificar order_items:', orderItemsError);
      return new Response(JSON.stringify({ error: 'Error al verificar relaciones del producto' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Si hay pedidos relacionados, no permitir eliminación física
    if (orderItems && orderItems.length > 0) {
      return new Response(JSON.stringify({ 
        error: 'No se puede eliminar este producto porque tiene pedidos asociados. Considera reducir el stock a 0 en su lugar.' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Eliminar imagen de Supabase Storage si existe
    if (existingProduct.image_url && existingProduct.image_url.includes('supabase')) {
      try {
        const urlParts = existingProduct.image_url.split('/');
        const filePath = urlParts.slice(-2).join('/'); // products/filename.jpg
        
        await supabase.storage
          .from('product-images')
          .remove([filePath]);
      } catch (storageError) {
        console.warn('Error al eliminar imagen del storage:', storageError);
        // Continuamos con la eliminación del producto aunque falle eliminar la imagen
      }
    }

    // Eliminar producto
    const { error: deleteError } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error al eliminar producto:', deleteError);
      return new Response(JSON.stringify({ error: 'Error al eliminar el producto' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Producto eliminado correctamente'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error en eliminación de producto:', error);
    return new Response(JSON.stringify({ 
      error: 'Error interno del servidor' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
