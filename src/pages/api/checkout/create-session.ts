import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { supabase } from '../../../lib/supabase';

// Inicializar Stripe con la clave secreta (server-side)
const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-01-27.acacia',
});

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
    const { items } = body;

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
      .select('id, name, slug, sku, price, stock, images')
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

    // 5. Validar stock y calcular total en el servidor
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
    const orderItems: any[] = [];
    let totalAmount = 0;

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

      // Validar stock
      if (product.stock < item.quantity) {
        return new Response(JSON.stringify({ 
          error: `Stock insuficiente para ${product.name}. Disponible: ${product.stock}` 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

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

    // 6. Crear sesión de Stripe Checkout
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: lineItems,
      success_url: `${request.headers.get('origin')}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${request.headers.get('origin')}/checkout/cancel`,
      customer_email: user?.email,
      client_reference_id: user?.id || `guest_${Date.now()}`,
      metadata: {
        user_id: user?.id || 'guest',
        user_email: user?.email || '',
        total_amount: totalAmount.toString(),
      },
      shipping_address_collection: {
        allowed_countries: ['ES', 'FR', 'DE', 'IT', 'PT', 'US'],
      },
    });

    // 7. Retornar URL de checkout de Stripe
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
