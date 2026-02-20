import { supabase } from '../lib/supabase';
import { customAlert } from '../lib/notifications';

/**
 * Setear cookie de forma robusta para funcionar detras de reverse proxy (Coolify)
 */
function setAuthCookie(name: string, value: string, maxAge: number) {
  // En produccion con HTTPS, usar Secure
  const isSecure = window.location.protocol === 'https:';
  const parts = [
    `${name}=${value}`,
    'Path=/',
    `Max-Age=${maxAge}`,
    'SameSite=Lax',
  ];
  if (isSecure) {
    parts.push('Secure');
  }
  document.cookie = parts.join('; ');
}

/**
 * Limpiar cookies de autenticacion
 */
function clearAuthCookies() {
  const isSecure = window.location.protocol === 'https:';
  const securePart = isSecure ? '; Secure' : '';
  document.cookie = `sb-access-token=; Path=/; Max-Age=0; SameSite=Lax${securePart}`;
  document.cookie = `sb-refresh-token=; Path=/; Max-Age=0; SameSite=Lax${securePart}`;
}

// Separa la logica en un script empaquetado para que los imports funcionen en el navegador
function setupLogin() {
  const form = document.querySelector<HTMLFormElement>('#login-form');
  const googleBtn = document.querySelector<HTMLButtonElement>('#google-login-btn');
  
  if (!form) return;

  // Google OAuth
  googleBtn?.addEventListener('click', async () => {
    console.log('[LOGIN PAGE] Iniciando Google OAuth...');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      }
    });
    
    if (error) {
      customAlert('Error al iniciar sesion con Google: ' + error.message, 'error');
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    const email = (form.querySelector<HTMLInputElement>('#email')?.value || '').trim();
    const password = form.querySelector<HTMLInputElement>('#password')?.value || '';

    if (!email || !password) {
      customAlert('Por favor ingresa email y contrasena', 'warning');
      return;
    }

    // Deshabilitar boton durante el login
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Iniciando sesion...';
    }

    try {
      console.log('[LOGIN PAGE] Enviando login...', email);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      console.log('[LOGIN PAGE] Resultado login:', { user: data?.user?.email, error: error?.message });

      if (error) {
        customAlert(error.message || 'Error al iniciar sesion', 'error');
        return;
      }

      if (!data?.session) {
        customAlert('No se pudo crear la sesion. Intenta de nuevo.', 'error');
        return;
      }

      // Guardar tokens en cookies para SSR
      const accessToken = data.session.access_token;
      const refreshToken = data.session.refresh_token;
      const maxAge = 60 * 60 * 24 * 7; // 7 dias
      
      if (accessToken) {
        setAuthCookie('sb-access-token', accessToken, maxAge);
      }
      if (refreshToken) {
        setAuthCookie('sb-refresh-token', refreshToken, maxAge);
      }

      console.log('[LOGIN PAGE] Cookies seteadas correctamente');

      // Verificar si el usuario es admin mediante API server-side
      let isAdmin = false;
      try {
        const userId = data.user?.id;
        if (userId) {
          console.log('[LOGIN PAGE] Verificando admin para userId:', userId);
          const res = await fetch('/api/auth/check-admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
          });
          if (res.ok) {
            const result = await res.json();
            console.log('[LOGIN PAGE] Resultado check-admin:', result);
            isAdmin = !!result.isAdmin;
          }
        }
      } catch (adminCheckErr) {
        console.warn('[LOGIN PAGE] Error verificando admin (no critico):', adminCheckErr);
      }

      if (isAdmin) {
        console.log('[LOGIN PAGE] Usuario es ADMIN, redirigiendo a /admin');
        window.location.href = '/admin';
      } else {
        console.log('[LOGIN PAGE] Usuario normal, redirigiendo a /');
        window.location.href = '/';
      }
    } catch (err) {
      console.error('[LOGIN PAGE] Error inesperado:', err);
      customAlert('Error inesperado. Por favor intenta de nuevo.', 'error');
    } finally {
      // Restaurar boton
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Iniciar sesion';
      }
    }
  });
}

if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', setupLogin);
}
