import { supabase } from '../lib/supabase';
import { customAlert } from '../lib/notifications';

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

  form.addEventListener('submit', (event) => {
    const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    const email = (form.querySelector<HTMLInputElement>('#email')?.value || '').trim();
    const password = form.querySelector<HTMLInputElement>('#password')?.value || '';

    // Validacion basica en cliente — si falla, no enviar
    if (!email || !password) {
      event.preventDefault();
      customAlert('Por favor ingresa email y contrasena', 'warning');
      return;
    }

    // Mostrar estado de carga y dejar que el form se envie al servidor
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Iniciando sesion...';
    }

    // El form se envia normalmente a /api/auth/login (server-side)
    // El servidor setea las cookies HttpOnly y redirige a /admin o /
    console.log('[LOGIN] Enviando formulario al servidor...');
  });
}

if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', setupLogin);
}
