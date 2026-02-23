import type { APIRoute } from 'astro';
import { createServerSupabaseClient } from '@lib/auth';
import { sendContactEmailToAdmins } from '@lib/brevo';
import { RateLimiter, getClientIP } from '@lib/rate-limit';

// ── Rate limiting para formulario de contacto ────────────────────
const contactLimiter = new RateLimiter({ maxAttempts: 3, windowMs: 10 * 60_000 });

// Asuntos válidos (whitelist)
const VALID_SUBJECTS: Record<string, string> = {
  pedido: 'Consulta sobre pedido',
  producto: 'Información de producto',
  devolucion: 'Devoluciones y cambios',
  talla: 'Consulta de tallas',
  envio: 'Información de envío',
  otro: 'Consulta general',
};

export const POST: APIRoute = async ({ request }) => {
  try {
    // ── Rate limiting por IP ─────────────────────────────────────────
    const clientIP = getClientIP(request);
    if (!contactLimiter.check(clientIP)) {
      console.warn(`[Contact] Rate limit exceeded for IP: ${clientIP}`);
      return new Response(JSON.stringify({
        success: false,
        error: 'Has enviado demasiados mensajes. Inténtalo de nuevo en unos minutos.',
      }), { status: 429, headers: { 'Content-Type': 'application/json' } });
    }

    // ── Parsear y validar body ───────────────────────────────────────
    const body = await request.json();
    const { name, email, subject, message } = body;

    if (!name || !email || !subject || !message) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Todos los campos son obligatorios' 
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Validar que los inputs sean strings y truncar longitudes
    if (typeof name !== 'string' || typeof email !== 'string' ||
        typeof subject !== 'string' || typeof message !== 'string') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Datos de formulario inválidos',
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const trimmedName = name.trim().slice(0, 200);
    const trimmedEmail = email.trim().slice(0, 254);
    const trimmedMessage = message.trim();

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'El formato del email no es válido' 
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Validar longitud del mensaje
    if (trimmedMessage.length < 10) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'El mensaje debe tener al menos 10 caracteres' 
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (trimmedMessage.length > 5000) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'El mensaje no puede superar los 5000 caracteres' 
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Validar asunto contra whitelist (P2 — no aceptar valores arbitrarios)
    if (!VALID_SUBJECTS[subject]) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Selecciona un asunto válido',
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const subjectText = VALID_SUBJECTS[subject];

    // ── Obtener emails de administradores ────────────────────────────
    const supabase = createServerSupabaseClient();
    const { data: admins, error: adminsError } = await supabase
      .from('admin_users')
      .select('email, full_name');

    if (adminsError || !admins || admins.length === 0) {
      console.error('[Contact] Error obteniendo admins:', adminsError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'No se pudo procesar tu mensaje. Inténtalo más tarde.' 
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const adminEmails = admins.map((a: any) => a.email).filter(Boolean);

    if (adminEmails.length === 0) {
      console.error('[Contact] No hay emails de admin disponibles');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'No se pudo procesar tu mensaje. Inténtalo más tarde.' 
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    // ── Enviar email (valores sanitizados) ───────────────────────────
    await sendContactEmailToAdmins({
      adminEmails,
      customerName: trimmedName,
      customerEmail: trimmedEmail,
      subject: subjectText,
      message: trimmedMessage,
    });

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Tu mensaje ha sido enviado correctamente. Te responderemos lo antes posible.' 
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('[Contact] Error procesando formulario:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Error al enviar el mensaje. Inténtalo de nuevo.' 
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
