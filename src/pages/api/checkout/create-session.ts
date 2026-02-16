import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { supabase } from '../../../lib/supabase';
import { createServerSupabaseClient } from '../../../lib/auth';

// Inicializar Stripe con la clave secreta (server-side)
const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-12-15.clover',
});

// Helper para crear cupón de Stripe dinámicamente
async function createStripeCoupon(discountAmountCents: number, totalAmountCents: number): Promise<string> {
  const coupon = await stripe.coupons.create({
    amount_off: discountAmountCents,
    currency: 'eur',
    duration: 'once',
    name: `Descuento -${(discountAmountCents / 100).toFixed(2)}€`
  });
  return coupon.id;
}

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // 1. Verificar autenticación del usuario (OPCIONAL - permite checkout como invitado)
    const accessToken = cookies.get('sb-access-token')?.value;
    let user = null;
    
    if (accessToken) {
      const { data } = await supabase.auth.getUser(accessToken);
      user = data.user;
    }

    // 2. Obtener los items del carrito desde el request
    const body = await request.json();
    const { items, discountCode } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'El carrito está vacío' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 3. Validar stock y precios en Supabase (ÚNICA FUENTE DE VERDAD)
    const productIds = items.map((item: any) => item.id);
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, slug, sku, price, stock, stock_by_size, images')
      .in('id', productIds);

    if (productsError || !products) {
      console.error('Error al validar productos:', productsError);
      return new Response(JSON.stringify({ 
        error: 'Error al validar productos',
        details: productsError?.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 4. Crear un mapa de productos para validación
    const productMap = new Map(products.map(p => [p.id, p]));

    // 5. VALIDAR STOCK (lectura directa — el decrement atómico se hace en el webhook con FOR UPDATE)
    const supabaseAdmin = createServerSupabaseClient();

    for (const item of items) {
      const product = productMap.get(item.id);
      
      if (!product) {
        return new Response(JSON.stringify({ 
          error: `Producto no encontrado: ${item.id}` 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Validar stock real (lectura directa de la BD)
      const itemSize = item.size || 'Única';

      // Leer stock FRESCO directamente de la BD (no del cache de la query anterior en caso de bfcache)
      let availableStock = 0;
      try {
        const { data: freshProduct, error: freshError } = await supabase
          .from('products')
          .select('stock, stock_by_size')
          .eq('id', item.id)
          .single();

        if (freshError || !freshProduct) {
          console.error(`[CHECKOUT] Error leyendo stock fresco de ${product.name}:`, freshError);
          availableStock = product.stock || 0;
        } else {
          // Usar stock_by_size si existe para esta talla
          if (freshProduct.stock_by_size && typeof freshProduct.stock_by_size === 'object') {
            const sizeStock = freshProduct.stock_by_size as Record<string, number>;
            if (itemSize in sizeStock) {
              availableStock = sizeStock[itemSize] || 0;
            } else {
              // La talla no existe en stock_by_size, usar stock global
              availableStock = freshProduct.stock || 0;
            }
          } else {
            availableStock = freshProduct.stock || 0;
          }
        }
      } catch (e) {
        console.warn('[CHECKOUT] Error en lectura fresca, usando datos de query:', e);
        availableStock = product.stock || 0;
      }

      // Log ultradetallado para diagnóstico
      const freshStockBySize = freshProduct?.stock_by_size || product.stock_by_size;
      console.log(`[CHECKOUT] ======= VALIDACIÓN STOCK =======`);
      console.log(`[CHECKOUT] Producto: "${product.name}" (${item.id})`);
      console.log(`[CHECKOUT] Talla solicitada: "${itemSize}"`);
      console.log(`[CHECKOUT] Stock disponible para talla "${itemSize}": ${availableStock}`);
      console.log(`[CHECKOUT] Cantidad pedida: ${item.quantity}`);
      console.log(`[CHECKOUT] stock_by_size COMPLETO: ${JSON.stringify(freshStockBySize)}`);
      console.log(`[CHECKOUT] stock global: ${freshProduct?.stock || product.stock}`);
      console.log(`[CHECKOUT] Resultado: ${availableStock >= item.quantity ? 'OK ✅' : 'INSUFICIENTE ❌'}`);
      console.log(`[CHECKOUT] ============================`);

      if (availableStock < item.quantity) {
        // Construir mensaje con info detallada de stock por talla
        const allSizesInfo = freshStockBySize && typeof freshStockBySize === 'object'
          ? Object.entries(freshStockBySize as Record<string, number>)
              .map(([s, qty]) => `${s}: ${qty} uds`)
              .join(', ')
          : 'no disponible';
        
        console.warn(`[CHECKOUT] STOCK INSUFICIENTE: ${product.name} talla=${itemSize} disponible=${availableStock} pedido=${item.quantity} (desglose: ${allSizesInfo})`);
        return new Response(JSON.stringify({ 
          error: `Stock insuficiente para "${product.name}" en talla ${itemSize}. Esa talla solo tiene ${availableStock} unidades (pediste ${item.quantity}). Stock por talla: ${allSizesInfo}`,
          available: availableStock,
          requested: item.quantity,
          stockBySize: freshStockBySize
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // 6. Validar y calcular total en el servidor
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
    const orderItems: any[] = [];
    let totalAmount = 0;

    for (const item of items) {
      const product = productMap.get(item.id)!;

      // Usar precio de Supabase (no del cliente)
      const unitPrice = product.price;
      const itemTotal = unitPrice * item.quantity;
      totalAmount += itemTotal;

      // Preparar line items para Stripe
      const imageUrl = product.images && Array.isArray(product.images) && product.images.length > 0 
        ? product.images[0] 
        : null;
      
      lineItems.push({
        price_data: {
          currency: 'eur',
          product_data: {
            name: product.name,
            images: imageUrl ? [imageUrl] : [],
          },
          unit_amount: unitPrice, // Ya está en centavos
        },
        quantity: item.quantity,
      });

      // Guardar para crear el pedido después
      orderItems.push({
        product_id: product.id,
        product_name: product.name,
        product_slug: product.slug,
        product_sku: product.sku || null,
        product_image: imageUrl,
        size: item.size || 'M', // Default si no se especifica
        quantity: item.quantity,
        unit_price: unitPrice,
        total: itemTotal
      });
    }

    // 6.5. Validar y aplicar código de descuento si existe
    let discountAmount = 0;
    let discountData: any = null;

    if (discountCode && discountCode.trim()) {
      const supabaseAdmin = createServerSupabaseClient();
      try {
        const { data: validationResult, error: discountError } = await supabaseAdmin.rpc('validate_discount_code', {
          p_code: discountCode.trim(),
          p_cart_total: totalAmount / 100, // Convertir a euros
          p_user_id: user?.id || null
        });

        if (discountError) {
          console.warn('[CHECKOUT] Error validating discount code:', discountError.message);
          // Continuar sin descuento en vez de fallar
        } else {
          const validation = validationResult as { valid: boolean; message: string; discount_amount?: number; code?: string };

          if (!validation.valid) {
            return new Response(JSON.stringify({ 
              error: validation.message 
            }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          // Aplicar descuento
          discountAmount = Math.round((validation.discount_amount || 0) * 100); // Convertir a centavos
          discountData = validation;
          console.log(`[CHECKOUT] Descuento aplicado: ${discountCode} (-${discountAmount / 100}EUR)`);
        }
      } catch (rpcErr: any) {
        console.warn('[CHECKOUT] validate_discount_code no disponible:', rpcErr.message);
        // Continuar sin descuento
      }
    }

    // Calcular total final
    const finalTotalAmount = totalAmount - discountAmount;

    // 7. Crear sesion de Stripe Checkout
    // Obtener URL base de forma robusta (proxy-safe)
    const origin = request.headers.get('origin') 
      || request.headers.get('x-forwarded-proto') && request.headers.get('x-forwarded-host') 
        ? `${request.headers.get('x-forwarded-proto') || 'https'}://${request.headers.get('x-forwarded-host')}`
        : null;
    const referer = request.headers.get('referer');
    const baseUrl = origin 
      || (referer ? new URL(referer).origin : null) 
      || import.meta.env.PUBLIC_SITE_URL 
      || 'http://localhost:4321';

    console.log(`[CHECKOUT] Base URL para Stripe: ${baseUrl}`);

    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: lineItems,
      success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/checkout/cancel`,
      customer_email: user?.email,
      client_reference_id: user?.id || `guest_${Date.now()}`,
      metadata: {
        user_id: user?.id || 'guest',
        user_email: user?.email || '',
        total_amount: totalAmount.toString(),
        discount_code: discountCode || '',
        discount_amount: discountAmount.toString(),
        // Info de tallas por item para decrement_stock en webhook
        order_items_sizes: JSON.stringify(
          items.map((item: any) => ({ id: item.id, size: item.size || 'Única', qty: item.quantity }))
        ),
      },
      shipping_address_collection: {
        allowed_countries: ['ES', 'FR', 'DE', 'IT', 'PT', 'US'],
      },
      expires_at: Math.floor(Date.now() / 1000) + (3 * 60 * 60), // 3 horas (Stripe: mín 30 min, máx 24 hrs)
    };

    // Aplicar descuento en Stripe si existe
    if (discountAmount > 0) {
      sessionConfig.discounts = [{
        coupon: await createStripeCoupon(discountAmount, totalAmount)
      }];
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    // 8. Retornar URL de checkout de Stripe
    return new Response(JSON.stringify({ 
      url: session.url,
      sessionId: session.id
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error en checkout:', error);
    return new Response(JSON.stringify({ 
      error: 'Error al procesar el pago',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
