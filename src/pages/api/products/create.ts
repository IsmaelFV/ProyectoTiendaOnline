import type { APIRoute } from 'astro';
import { createServerSupabaseClient, verifyAdminFromCookies } from '../../../lib/auth';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function generateSKU(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `SKU-${code}`;
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  // ============================================================================
  // 1. VERIFICAR AUTENTICACIÓN Y PERMISOS DE ADMIN
  // ============================================================================
  const accessToken = cookies.get('sb-access-token')?.value;
  const refreshToken = cookies.get('sb-refresh-token')?.value;

  console.info('[Create Product] Auth check - accessToken:', !!accessToken, 'refreshToken:', !!refreshToken);

  const userId = await verifyAdminFromCookies(accessToken, refreshToken);
  if (!userId) {
    console.error('[Create Product] Admin verification failed');
    return redirect('/auth/login');
  }

  console.info('[Create Product] Admin verified:', userId);

  // Usar service_role para todas las operaciones de DB
  const supabase = createServerSupabaseClient();

  // ============================================================================
  // 3. OBTENER Y VALIDAR DATOS DEL FORMULARIO
  // ============================================================================
  const formData = await request.formData();
  
  const name = formData.get('name')?.toString()?.trim();
  const description = formData.get('description')?.toString()?.trim();
  const priceInput = formData.get('price')?.toString();
  const stockInput = formData.get('stock')?.toString();
  const category_id = formData.get('category_id')?.toString();
  const sizesString = formData.get('sizes')?.toString();
  const imagesString = formData.get('images')?.toString();
  const featured = formData.get('featured') === 'on';
  const sku = formData.get('sku')?.toString()?.trim();
  const isOnSale = formData.get('is_on_sale') === 'on';
  const discountPercentageInput = formData.get('discount_percentage')?.toString();

  console.info('[Create Product] Form data received:', {
    name: name || '(empty)',
    price: priceInput || '(empty)',
    stock: stockInput || '(empty)',
    category_id: category_id || '(empty)',
    sizes: sizesString || '(empty)',
    images: imagesString ? `${imagesString.split('\n').length} images` : '(empty)',
    featured,
    sku: sku || '(auto)',
    isOnSale,
  });

  // Validación de campos requeridos
  if (!name || !priceInput || !stockInput || !category_id || !sizesString) {
    console.warn('[Create Product] Missing required fields:', {
      name: !name, price: !priceInput, stock: !stockInput, 
      category_id: !category_id, sizes: !sizesString
    });
    return redirect('/admin/productos/nuevo?error=missing_fields');
  }

  // Validación de nombre
  if (name.length < 3 || name.length > 200) {
    return redirect('/admin/productos/nuevo?error=invalid_name');
  }

  // ============================================================================
  // 4. CONVERSIÓN Y VALIDACIÓN DE PRECIO (CRÍTICO)
  // ============================================================================
  // IMPORTANTE: Convertir de euros a céntimos EN EL SERVIDOR
  // Nunca confiar en conversiones del cliente
  const priceInEuros = parseFloat(priceInput);
  
  if (isNaN(priceInEuros) || priceInEuros < 0) {
    console.error(`[API] Invalid price value: ${priceInput}`);
    return redirect('/admin/productos/nuevo?error=invalid_price');
  }

  // Convertir a céntimos y redondear
  const priceInCents = Math.round(priceInEuros * 100);

  // Validación de límites de precio
  if (priceInCents > 100000000) { // Límite: €1,000,000
    return redirect('/admin/productos/nuevo?error=price_too_high');
  }

  // ============================================================================
  // 5. VALIDACIÓN DE STOCK
  // ============================================================================
  const stock = parseInt(stockInput);
  
  if (isNaN(stock) || stock < 0 || stock > 999999) {
    console.error(`[API] Invalid stock value: ${stockInput}`);
    return redirect('/admin/productos/nuevo?error=invalid_stock');
  }

  // ============================================================================
  // 6. PROCESAR TALLAS
  // ============================================================================
  const sizes = sizesString
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);

  if (sizes.length === 0) {
    return redirect('/admin/productos/nuevo?error=no_sizes');
  }

  // ============================================================================
  // 6a. PROCESAR STOCK POR TALLA
  // ============================================================================
  const stockBySizeString = formData.get('stock_by_size')?.toString();
  let stockBySize: Record<string, number> = {};
  
  if (stockBySizeString) {
    try {
      stockBySize = JSON.parse(stockBySizeString);
    } catch {
      // Si no se puede parsear, distribuir equitativamente
      stockBySize = {};
    }
  }
  
  // Si no se proporcionó stock_by_size, distribuir el stock global equitativamente
  if (Object.keys(stockBySize).length === 0) {
    const perSize = Math.floor(stock / sizes.length);
    const remainder = stock % sizes.length;
    sizes.forEach((size, i) => {
      stockBySize[size] = perSize + (i === 0 ? remainder : 0);
    });
  }
  
  // Recalcular stock total como suma de todas las tallas
  const totalStock = Object.values(stockBySize).reduce((sum, v) => sum + v, 0);

  // ============================================================================
  // 6b. PROCESAR MEDIDAS DE TALLAS
  // ============================================================================
  const sizeMeasurementsString = formData.get('size_measurements')?.toString();
  let sizeMeasurements: Record<string, any> = {};
  if (sizeMeasurementsString) {
    try {
      sizeMeasurements = JSON.parse(sizeMeasurementsString);
    } catch {
      sizeMeasurements = {};
    }
  }

  // ============================================================================
  // 7. PROCESAR Y VALIDAR IMÁGENES
  // ============================================================================
  const images = imagesString
    ? imagesString
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean)
        .filter(url => {
          try {
            const parsed = new URL(url);
            return parsed.protocol === 'https:' || parsed.protocol === 'http:';
          } catch {
            return false;
          }
        })
    : [];

  if (images.length === 0) {
    return redirect('/admin/productos/nuevo?error=no_images');
  }

  // ============================================================================
  // 8. GENERAR SLUG ÚNICO
  // ============================================================================
  const slug = slugify(name);

  // ============================================================================
  // 9. CALCULAR PRECIO DE OFERTA SI APLICA
  // ============================================================================
  let salePriceInCents: number | null = null;
  if (isOnSale && discountPercentageInput) {
    const discountPercentage = parseInt(discountPercentageInput);
    if (!isNaN(discountPercentage) && discountPercentage > 0 && discountPercentage < 100) {
      salePriceInCents = Math.round(priceInCents * (1 - discountPercentage / 100));
    }
  }

  // ============================================================================
  // 10. INSERTAR PRODUCTO EN LA BASE DE DATOS
  // ============================================================================
  const productData = {
    name,
    slug,
    description: description || null,
    price: priceInCents,
    stock: totalStock,
    stock_by_size: stockBySize,
    category_id,
    sizes,
    size_measurements: Object.keys(sizeMeasurements).length > 0 ? sizeMeasurements : null,
    images,
    featured,
    sku: sku || generateSKU(),
    is_active: true,
    is_on_sale: isOnSale && salePriceInCents !== null,
    sale_price: salePriceInCents,
  };

  console.info('[Create Product] Inserting product:', JSON.stringify({
    ...productData,
    images: `[${productData.images.length} images]`,
  }));

  const { data: product, error } = await supabase
    .from('products')
    .insert(productData)
    .select()
    .single();

  if (error) {
    console.error('[API] Error creating product:', error);
    
    // Errores específicos
    if (error.code === '23505') { // Unique violation
      if (error.message.includes('slug')) {
        return redirect('/admin/productos/nuevo?error=slug_exists');
      }
      if (error.message.includes('sku')) {
        return redirect('/admin/productos/nuevo?error=sku_exists');
      }
    }
    
    return redirect('/admin/productos/nuevo?error=create_failed');
  }

  console.info(`[API] Product created successfully: ${product.id}`);

  // ============================================================================
  // 11. REDIRIGIR CON ÉXITO
  // ============================================================================
  return redirect(`/admin/productos?success=created&id=${product.id}`);
};
