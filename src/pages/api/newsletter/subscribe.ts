import type { APIRoute } from 'astro';
import { supabase } from '@lib/supabase';

// ── Rate limiting para newsletter ─────────────────────────────────────────────
const NL_RATE_LIMIT = 5;
const NL_RATE_WINDOW = 10 * 60_000; // 10 minutos
const nlAttempts = new Map<string, { count: number; firstAttempt: number }>();

export const POST: APIRoute = async ({ request }) => {
  try {
    // Rate limiting por IP
    const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';
    const now = Date.now();
    const attempts = nlAttempts.get(clientIP);
    if (attempts) {
      if (now - attempts.firstAttempt > NL_RATE_WINDOW) {
        nlAttempts.set(clientIP, { count: 1, firstAttempt: now });
      } else if (attempts.count >= NL_RATE_LIMIT) {
        return new Response(
          JSON.stringify({ success: false, error: 'Demasiados intentos. Espera unos minutos.' }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        );
      } else {
        attempts.count++;
      }
    } else {
      nlAttempts.set(clientIP, { count: 1, firstAttempt: now });
    }
    if (nlAttempts.size > 500) {
      for (const [ip, d] of nlAttempts) {
        if (now - d.firstAttempt > NL_RATE_WINDOW) nlAttempts.delete(ip);
      }
    }

    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'Email requerido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Formato de email inválido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verificar si ya está suscrito
    const { data: existing } = await supabase
      .from('newsletter_subscribers')
      .select('id, status')
      .eq('email', email.toLowerCase())
      .single();

    if (existing) {
      if (existing.status === 'unsubscribed') {
        // Reactivar suscripción
        await supabase
          .from('newsletter_subscribers')
          .update({ 
            status: 'active', 
            resubscribed_at: new Date().toISOString() 
          })
          .eq('id', existing.id);

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: '¡Bienvenido de nuevo! Tu suscripción ha sido reactivada.' 
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Ya estás suscrito a nuestra newsletter.' 
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Crear nueva suscripción
    const { error } = await supabase
      .from('newsletter_subscribers')
      .insert({
        email: email.toLowerCase(),
        status: 'active',
        source: 'popup',
        subscribed_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error subscribing to newsletter:', error);
      
      // Si la tabla no existe, crear respuesta genérica exitosa
      if (error.code === '42P01') {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: '¡Gracias por suscribirte! Recibirás nuestras novedades pronto.' 
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: 'Error al procesar la suscripción' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: '¡Gracias por suscribirte! Recibirás nuestras novedades pronto.' 
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Newsletter subscription error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Error interno del servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
