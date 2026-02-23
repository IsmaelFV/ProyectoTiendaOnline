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

    // 2.5 Validar estructura de cada item del carrito
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const item of items) {
      if (!item.id || typeof item.id !== 'string' || !UUID_RE.test(item.id)) {
        return new Response(JSON.stringify({ error: 'ID de producto no válido' }), {
          status: 400, headers: { 'Content-Type': 'application/json' }
        });
      }
      if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
        return new Response(JSON.stringify({ error: 'Cantidad no válida' }), {
          status: 400, headers: { 'Content-Type': 'application/json' }
        });
      }
      if (item.size !== undefined && (typeof item.size !== 'string' || item.size.length > 10)) {
        return new Response(JSON.stringify({ error: 'Talla no válida' }), {
          status: 400, headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Limitar cantidad de items en el carrito
    if (items.length > 50) {
      return new Response(JSON.stringify({ error: 'Demasiados artículos en el carrito' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
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
        error: 'Error al validar productos'
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

      const itemSize = item.size || 'Única';
      const cartQuantity = item.quantity;

      // Leer stock FRESCO directamente de la BD para cada producto
      let availableStock = 0;
      let currentStockBySize: Record<string, number> | null = null;
      let currentStockGlobal = product.stock || 0;

      try {
        const { data: freshProduct, error: freshError } = await supabase
          .from('products')
          .select('stock, stock_by_size')
          .eq('id', item.id)
          .single();

        if (freshError || !freshProduct) {
          console.error(`[CHECKOUT] Error leyendo stock fresco de ${product.name}:`, freshError);
          // Fallback a los datos de la query batch anterior
          currentStockBySize = product.stock_by_size as Record<string, number> | null;
          currentStockGlobal = product.stock || 0;
        } else {
          currentStockBySize = freshProduct.stock_by_size as Record<string, number> | null;
          currentStockGlobal = freshProduct.stock || 0;
        }
      } catch (e) {
        console.warn('[CHECKOUT] Error en lectura fresca, usando datos de query batch:', e);
        currentStockBySize = product.stock_by_size as Record<string, number> | null;
        currentStockGlobal = product.stock || 0;
      }

      // Determinar stock disponible para la talla solicitada
      if (currentStockBySize && typeof currentStockBySize === 'object' && itemSize in currentStockBySize) {
        availableStock = currentStockBySize[itemSize] || 0;
      } else {
        // La talla no existe en stock_by_size → usar stock global
        availableStock = currentStockGlobal;
      }

      // Construir desglose de stock por talla para logs y errores
      const allSizesInfo = currentStockBySize && typeof currentStockBySize === 'object'
        ? Object.entries(currentStockBySize)
            .map(([s, qty]) => `${s}:${qty}`)
            .join(', ')
        : 'sin desglose';

      console.log(`[CHECKOUT] ═══ STOCK CHECK: "${product.name}" ═══`);
      console.log(`[CHECKOUT]   Talla: "${itemSize}" → ${availableStock} disponibles`);
      console.log(`[CHECKOUT]   Pedido: ${cartQuantity} unidades`);
      console.log(`[CHECKOUT]   Stock por talla: { ${allSizesInfo} }`);
      console.log(`[CHECKOUT]   Stock global: ${currentStockGlobal}`);
      console.log(`[CHECKOUT]   Resultado: ${availableStock >= cartQuantity ? '✅ OK' : '❌ INSUFICIENTE'}`);

      if (availableStock < cartQuantity) {
        const errorMsg = `No hay suficiente stock de "${product.name}" en talla ${itemSize}. ` +
          `Stock de talla ${itemSize}: ${availableStock} unidades. ` +
          `Cantidad en tu carrito: ${cartQuantity}. ` +
          `(Stock por talla: ${allSizesInfo.replace(/,/g, ', ')})`;
        
        console.warn(`[CHECKOUT] RECHAZADO: ${errorMsg}`);
        return new Response(JSON.stringify({ 
          error: `No hay suficiente stock de "${product.name}" en talla ${itemSize}`,
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
    // Usar SIEMPRE la URL configurada del sitio (nunca headers del cliente para evitar open redirect)
    // SITE viene de astro.config.mjs (fuente fiable), PUBLIC_SITE_URL es fallback de env vars
    const baseUrl = import.meta.env.SITE 
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
      error: 'Error al procesar el pago'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
