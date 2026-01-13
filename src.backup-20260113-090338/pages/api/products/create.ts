/**
 * ============================================================================
 * API: Crear Producto
 * ============================================================================
 * SEGURIDAD:
 * 1. Verifica autenticación de admin
 * 2. Verifica permisos de creación
 * 3. Valida y sanitiza datos de entrada
 * 4. Convierte precio correctamente (€ → céntimos)
 * 5. Usa service_role key para bypass RLS
 * 6. Registra acción en audit_logs
 * ============================================================================
 */

import type { APIRoute } from 'astro';
import { 
  checkAdminPermission, 
  createServerSupabaseClient, 
  logAdminAction,
  getRequestMetadata,
  AdminRole,
  AUTH_ERRORS 
} from '../../../lib/auth';
import { slugify } from '../../../lib/utils';

export const POST: APIRoute = async ({ request, cookies, redirect, locals }) => {
  // ============================================================================
  // 1. VERIFICAR AUTENTICACIÓN
  // ============================================================================
  if (!locals.admin) {
    console.error('[API] Attempt to create product without admin session');
    return new Response(
      JSON.stringify({ error: AUTH_ERRORS.NOT_ADMIN }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ============================================================================
  // 2. VERIFICAR PERMISOS
  // ============================================================================
  const permissionCheck = await checkAdminPermission(
    locals.admin.id,
    AdminRole.EDITOR // Editors y superiores pueden crear productos
  );

  if (!permissionCheck.allowed) {
    console.error(`[API] Permission denied for user ${locals.admin.email}: ${permissionCheck.reason}`);
    return new Response(
      JSON.stringify({ error: permissionCheck.reason }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

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

  // Validación de campos requeridos
  if (!name || !priceInput || !stockInput || !category_id || !sizesString) {
    console.warn('[API] Missing required fields in product creation');
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
  // 7. PROCESAR Y VALIDAR IMÁGENES
  // ============================================================================
  const ALLOWED_IMAGE_DOMAINS = [
    import.meta.env.PUBLIC_SUPABASE_URL + '/storage/',
    'https://images.unsplash.com/', // Para desarrollo/demos
  ];

  const images = imagesString
    ? imagesString
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean)
        .filter(url => {
          // Validar que las URLs son de dominios permitidos
          return ALLOWED_IMAGE_DOMAINS.some(domain => url.startsWith(domain));
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
  // 9. INSERTAR PRODUCTO EN LA BASE DE DATOS
  // ============================================================================
  // Usar service_role client para bypass RLS
  const supabase = createServerSupabaseClient();

  const productData = {
    name,
    slug,
    description: description || null,
    price: priceInCents,
    stock,
    category_id,
    sizes,
    images,
    featured,
    sku: sku || null,
    is_active: true,
    created_by: locals.admin.id,
    updated_by: locals.admin.id,
  };

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

  // ============================================================================
  // 10. REGISTRAR ACCIÓN EN AUDIT LOG
  // ============================================================================
  const metadata = getRequestMetadata(request);
  
  await logAdminAction({
    adminUserId: locals.admin.id,
    action: 'CREATE',
    tableName: 'products',
    recordId: product.id,
    newValues: productData,
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent,
  });

  console.info(`[API] Product created successfully by ${locals.admin.email}: ${product.id}`);

  // ============================================================================
  // 11. REDIRIGIR CON ÉXITO
  // ============================================================================
  return redirect(`/admin/productos?success=created&id=${product.id}`);
};
