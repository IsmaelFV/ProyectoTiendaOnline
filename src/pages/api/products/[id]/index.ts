import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const PUT: APIRoute = async ({ request, cookies, params }) => {
  try {
    // Verificar autenticación
    const accessToken = cookies.get('sb-access-token')?.value;
    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verificar que es admin
    const { data: { user } } = await supabase.auth.getUser(accessToken);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Usuario no válido' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', user.id);

    if (!adminUser || adminUser.length === 0) {
      return new Response(JSON.stringify({ error: 'No tienes permisos de administrador' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Obtener ID del producto
    const { id } = params;
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

    // Obtener datos del formulario
    const formData = await request.formData();
    const name = formData.get('name')?.toString();
    const description = formData.get('description')?.toString();
    const price = formData.get('price')?.toString();
    const stock = formData.get('stock')?.toString();
    const category_id = formData.get('category_id')?.toString();
    const gender_id = formData.get('gender_id')?.toString();
    let image_url = formData.get('image_url')?.toString() || existingProduct.image_url;
    const imageFile = formData.get('image');

    // Validaciones
    if (!name || !description || !price || !stock || !category_id || !gender_id) {
      return new Response(JSON.stringify({ error: 'Todos los campos son requeridos' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const priceNum = parseFloat(price);
    const stockNum = parseInt(stock);

    if (isNaN(priceNum) || priceNum < 0) {
      return new Response(JSON.stringify({ error: 'Precio inválido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (isNaN(stockNum) || stockNum < 0) {
      return new Response(JSON.stringify({ error: 'Stock inválido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Manejar imagen si se subió un archivo
    if (imageFile && imageFile instanceof File && imageFile.size > 0) {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `products/${fileName}`;

      // Subir imagen a Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, imageFile, {
          contentType: imageFile.type,
          upsert: false
        });

      if (uploadError) {
        console.error('Error al subir imagen:', uploadError);
        return new Response(JSON.stringify({ error: 'Error al subir la imagen' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Obtener URL pública
      const { data: urlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      image_url = urlData.publicUrl;

      // Opcional: eliminar la imagen antigua si existe y es de Supabase
      if (existingProduct.image_url && existingProduct.image_url.includes('supabase')) {
        const oldPath = existingProduct.image_url.split('/').slice(-2).join('/');
        await supabase.storage
          .from('product-images')
          .remove([oldPath]);
      }
    }

    // Crear slug del nombre
    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Actualizar producto
    const { data: updatedProduct, error: updateError } = await supabase
      .from('products')
      .update({
        name,
        slug,
        description,
        price: Math.round(priceNum * 100), // Convertir a centavos
        stock: stockNum, // ✅ CORREGIDO: Ahora sí se actualiza el stock
        image_url,
        category_id,
        gender_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error al actualizar producto:', updateError);
      return new Response(JSON.stringify({ error: 'Error al actualizar el producto' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      product: updatedProduct 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error en actualización de producto:', error);
    return new Response(JSON.stringify({ 
      error: 'Error interno del servidor' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
