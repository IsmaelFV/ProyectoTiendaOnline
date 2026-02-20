import type { APIRoute } from 'astro';
import { createServerSupabaseClient } from '@lib/auth';
import { sendContactEmailToAdmins } from '@lib/brevo';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { name, email, subject, message } = body;

    // Validar campos obligatorios
    if (!name || !email || !subject || !message) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Todos los campos son obligatorios' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validar formato de email básico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'El formato del email no es válido' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validar longitud del mensaje
    if (message.length < 10) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'El mensaje debe tener al menos 10 caracteres' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (message.length > 5000) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'El mensaje no puede superar los 5000 caracteres' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Obtener emails de todos los administradores activos
    const supabase = createServerSupabaseClient();
    const { data: admins, error: adminsError } = await supabase
      .from('admin_users')
      .select('email, full_name')
      .eq('is_active', true);

    if (adminsError || !admins || admins.length === 0) {
      console.error('[Contact] Error obteniendo admins:', adminsError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'No se pudo procesar tu mensaje. Inténtalo más tarde.' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const adminEmails = admins.map((a: any) => a.email).filter(Boolean);

    if (adminEmails.length === 0) {
      console.error('[Contact] No hay emails de admin disponibles');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'No se pudo procesar tu mensaje. Inténtalo más tarde.' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Mapear asuntos a texto legible
    const subjectLabels: Record<string, string> = {
      pedido: 'Consulta sobre pedido',
      producto: 'Información de producto',
      devolucion: 'Devoluciones y cambios',
      talla: 'Consulta de tallas',
      envio: 'Información de envío',
      otro: 'Consulta general',
    };

    const subjectText = subjectLabels[subject] || subject;

    // Enviar email a todos los administradores
    await sendContactEmailToAdmins({
      adminEmails,
      customerName: name.trim(),
      customerEmail: email.trim(),
      subject: subjectText,
      message: message.trim(),
    });

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Tu mensaje ha sido enviado correctamente. Te responderemos lo antes posible.' 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[Contact] Error procesando formulario:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Error al enviar el mensaje. Inténtalo de nuevo.' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
