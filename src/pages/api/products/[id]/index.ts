import type { APIRoute } from 'astro';
import { createServerSupabaseClient, verifyAdminFromCookies } from '../../../../lib/auth';
import { notifyWishlistSale } from '../../../../lib/wishlist-notifications';

// ============================================================================
// PATCH: Edición rápida de campos individuales (toggles, nombre, precio, color)
// ============================================================================
export const PATCH: APIRoute = async ({ request, cookies, params }) => {
  try {
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

    const supabase = createServerSupabaseClient();
    const { id } = params;
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!id || !UUID_RE.test(id)) {
      return new Response(JSON.stringify({ error: 'ID de producto inválido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();

    // Solo permitir campos específicos para edición rápida
    const allowedFields = ['is_active', 'is_new', 'is_sustainable', 'name', 'price', 'color', 'images'];
    const updateData: Record<string, any> = {};

    for (const field of allowedFields) {
      if (field in body) {
        if (field === 'price') {
          const price = parseFloat(body.price);
          if (isNaN(price) || price < 0) {
            return new Response(JSON.stringify({ error: 'Precio inválido' }), {
              status: 400, headers: { 'Content-Type': 'application/json' }
            });
          }
          updateData.price = Math.round(price * 100);
        } else if (field === 'name') {
          const name = body.name?.trim();
          if (!name || name.length < 2) {
            return new Response(JSON.stringify({ error: 'Nombre inválido' }), {
              status: 400, headers: { 'Content-Type': 'application/json' }
            });
          }
          updateData.name = name;
          updateData.slug = name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        } else if (field === 'images') {
          if (!Array.isArray(body.images) || body.images.length === 0) {
            return new Response(JSON.stringify({ error: 'Debe haber al menos una imagen' }), {
              status: 400, headers: { 'Content-Type': 'application/json' }
            });
          }
          updateData.images = body.images.filter((url: string) => {
            try {
              const parsed = new URL(url);
              return parsed.protocol === 'https:' || parsed.protocol === 'http:';
            } catch { return false; }
          });
          if (updateData.images.length === 0) {
            return new Response(JSON.stringify({ error: 'Ninguna URL de imagen es válida' }), {
              status: 400, headers: { 'Content-Type': 'application/json' }
            });
          }
        } else {
          updateData[field] = body[field];
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      return new Response(JSON.stringify({ error: 'No se proporcionaron campos válidos' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    updateData.updated_at = new Date().toISOString();

    const { data: updated, error: updateError } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error en PATCH producto:', updateError);
      return new Response(JSON.stringify({ error: 'Error al actualizar el producto' }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true, product: updated }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error en PATCH producto:', error);
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
};

// ============================================================================
// PUT: Edición completa del producto (formulario completo)
// ============================================================================

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
    const UUID_RE_PUT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!id || !UUID_RE_PUT.test(id)) {
      return new Response(JSON.stringify({ error: 'ID de producto inválido' }), {
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
    const stockBySizeString = formData.get('stock_by_size')?.toString();
    const isOnSale = formData.get('is_on_sale') === 'on';
    const discountPercentageInput = formData.get('discount_percentage')?.toString();
    const featured = formData.get('featured') === 'on';
    const isSustainable = formData.get('is_sustainable') === 'on';
    const color = formData.get('color')?.toString()?.trim() || null;

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

    // Procesar stock por talla
    let stockBySize: Record<string, number> = existingProduct.stock_by_size || {};
    if (stockBySizeString) {
      try {
        stockBySize = JSON.parse(stockBySizeString);
      } catch {
        stockBySize = existingProduct.stock_by_size || {};
      }
    }
    
    // Recalcular stock total como suma de stock por talla
    const totalStock = Object.values(stockBySize).reduce((sum: number, v: any) => sum + (parseInt(v) || 0), 0);

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
        stock: totalStock,
        stock_by_size: stockBySize,
        images,
        sizes,
        size_measurements: sizeMeasurements,
        category_id,
        gender_id,
        featured,
        is_sustainable: isSustainable,
        color: color,
        colors: color ? [color] : [],
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
