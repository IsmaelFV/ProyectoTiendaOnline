import type { APIRoute } from 'astro';
import { createServerSupabaseClient, verifyAdminFromCookies } from '../../../../lib/auth';
import { notifyWishlistSale } from '../../../../lib/wishlist-notifications';

export const PUT: APIRoute = async ({ request, cookies, params }) => {
  try {
    // Verificar autenticación de admin
    const accessToken = cookies.get('sb-access-token')?.value;
    const refreshToken = cookies.get('sb-refresh-token')?.value;

    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userId = await verifyAdminFromCookies(accessToken, refreshToken);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'No tienes permisos de administrador' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Usar service_role para operaciones de admin
    const supabase = createServerSupabaseClient();

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
    const imagesString = formData.get('images')?.toString();
    const sizesString = formData.get('sizes')?.toString();
    const sizeMeasurementsString = formData.get('size_measurements')?.toString();
    const isOnSale = formData.get('is_on_sale') === 'on';
    const discountPercentageInput = formData.get('discount_percentage')?.toString();

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

    // Procesar imágenes desde el textarea (una URL por línea)
    const images = imagesString
      ? imagesString
          .split('\n')
          .map((s: string) => s.trim())
          .filter(Boolean)
          .filter((url: string) => {
            try {
              const parsed = new URL(url);
              return parsed.protocol === 'https:' || parsed.protocol === 'http:';
            } catch {
              return false;
            }
          })
      : existingProduct.images || [];

    if (images.length === 0) {
      return new Response(JSON.stringify({ error: 'Debes agregar al menos una imagen válida' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Crear slug del nombre
    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Calcular precio de oferta si aplica
    const priceInCents = Math.round(priceNum * 100);
    let salePriceInCents: number | null = null;
    if (isOnSale && discountPercentageInput) {
      const discountPercentage = parseInt(discountPercentageInput);
      if (!isNaN(discountPercentage) && discountPercentage > 0 && discountPercentage < 100) {
        salePriceInCents = Math.round(priceInCents * (1 - discountPercentage / 100));
      }
    }

    // Procesar tallas
    const sizes = sizesString
      ? sizesString.split(',').map((s: string) => s.trim()).filter(Boolean)
      : existingProduct.sizes || [];

    // Procesar medidas de tallas
    let sizeMeasurements = existingProduct.size_measurements || null;
    if (sizeMeasurementsString && sizeMeasurementsString.trim() !== '') {
      try {
        const parsed = JSON.parse(sizeMeasurementsString);
        sizeMeasurements = Object.keys(parsed).length > 0 ? parsed : null;
      } catch {
        sizeMeasurements = existingProduct.size_measurements || null;
      }
    } else if (sizeMeasurementsString === '') {
      sizeMeasurements = null;
    }

    // Actualizar producto
    const { data: updatedProduct, error: updateError } = await supabase
      .from('products')
      .update({
        name,
        slug,
        description,
        price: priceInCents,
        stock: stockNum,
        images,
        sizes,
        size_measurements: sizeMeasurements,
        category_id,
        gender_id,
        is_on_sale: isOnSale && salePriceInCents !== null,
        sale_price: salePriceInCents,
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

    // Notificar wishlist si se acaba de activar una oferta (no estaba en oferta antes)
    if (isOnSale && salePriceInCents !== null && !existingProduct.is_on_sale) {
      const discountPct = discountPercentageInput ? parseInt(discountPercentageInput) : 0;
      notifyWishlistSale({
        productId: id,
        productName: name,
        productSlug: slug,
        productImage: images[0],
        originalPrice: priceInCents,
        salePrice: salePriceInCents,
        discountPercentage: discountPct,
      }).catch(err => console.error('[Product Edit] Error notificando wishlist:', err));
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
