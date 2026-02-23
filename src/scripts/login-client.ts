import { supabase } from '../lib/supabase';
import { customAlert } from '../lib/notifications';

/**
 * Login híbrido:
 * 1. signInWithPassword() client-side → el SDK de Supabase guarda la sesión
 *    en localStorage → session.ts y cart.ts la detectan
 * 2. POST a /api/auth/set-session con los tokens → el servidor guarda
 *    cookies HttpOnly para SSR (admin pages, etc.)
 * 3. El servidor responde con { isAdmin } → redirigimos al sitio correcto
 */
function setupLogin() {
  const form = document.querySelector<HTMLFormElement>('#login-form');
  const googleBtn = document.querySelector<HTMLButtonElement>('#google-login-btn');

  if (!form) return;

  // Google OAuth (sigue igual - redirige a /auth/callback)
  googleBtn?.addEventListener('click', async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      customAlert('Error al iniciar sesion con Google: ' + error.message, 'error');
    }
  });

  // Interceptar envío del formulario
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    const emailInput = form.querySelector<HTMLInputElement>('#email');
    const passwordInput = form.querySelector<HTMLInputElement>('#password');
    const email = (emailInput?.value || '').trim();
    const password = passwordInput?.value || '';

    // Validación básica
    if (!email || !password) {
      customAlert('Por favor ingresa email y contraseña', 'warning');
      return;
    }

    // Mostrar spinner
    const originalText = submitBtn?.textContent || 'Iniciar sesión';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Iniciando sesión...';
    }

    try {
      // PASO 1: Autenticar con Supabase client-side
      // Esto guarda la sesión en localStorage → session.ts y cart.ts la detectan
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        let msg = 'Email o contraseña incorrectos';
        if (error.message.includes('Email not confirmed')) {
          msg = 'Por favor confirma tu email antes de iniciar sesión';
        }
        customAlert(msg, 'error');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
        return;
      }

      if (!data.session) {
        customAlert('No se pudo crear la sesión', 'error');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
        return;
      }

      // PASO 2: Enviar tokens al servidor para guardar cookies HttpOnly
      // y verificar si es admin
      const resp = await fetch('/api/auth/set-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        }),
      });

      const result = await resp.json();

      // PASO 3: Redirigir
      if (result.isAdmin) {
        window.location.href = '/admin';
      } else {
        window.location.href = '/';
      }

    } catch (err) {
      console.error('[LOGIN] Error inesperado:', err);
      customAlert('Error al iniciar sesión. Inténtalo de nuevo.', 'error');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  });
}

if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', setupLogin);
}
