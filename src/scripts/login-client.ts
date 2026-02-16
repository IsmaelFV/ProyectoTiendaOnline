import { supabase } from '../lib/supabase';
import { customAlert } from '../lib/notifications';

// Separa la lógica en un script empaquetado para que los imports funcionen en el navegador
function setupLogin() {
  const form = document.querySelector<HTMLFormElement>('#login-form');
  const googleBtn = document.querySelector<HTMLButtonElement>('#google-login-btn');
  
  if (!form) return;

  supabase.auth.onAuthStateChange((event, session) => {
    console.log('🔐 [LOGIN PAGE] onAuthStateChange:', event, 'user:', session?.user?.email || null);
  });

  // Google OAuth
  googleBtn?.addEventListener('click', async () => {
    console.log('🔐 [LOGIN PAGE] Iniciando Google OAuth...');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      }
    });
    
    if (error) {
      customAlert('Error al iniciar sesión con Google: ' + error.message, 'error');
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = (form.querySelector<HTMLInputElement>('#email')?.value || '').trim();
    const password = form.querySelector<HTMLInputElement>('#password')?.value || '';

    if (!email || !password) {
      customAlert('Por favor ingresa email y contraseña', 'warning');
      return;
    }

    console.log('🔐 [LOGIN PAGE] Enviando login...', email);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    console.log('🔐 [LOGIN PAGE] Resultado login:', { data, error });

    if (error) {
      customAlert(error.message || 'Error al iniciar sesión', 'error');
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    console.log('🔐 [LOGIN PAGE] Session tras login:', sessionData);

    // Copiar tokens a cookies para que las páginas SSR (perfil/pedidos) puedan leerlos
    const accessToken = sessionData.session?.access_token;
    const refreshToken = sessionData.session?.refresh_token;
    const maxAge = 60 * 60 * 24 * 7; // 7 días
    const isSecure = window.location.protocol === 'https:';
    const securePart = isSecure ? '; Secure' : '';
    if (accessToken) {
      document.cookie = `sb-access-token=${accessToken}; Path=/; Max-Age=${maxAge}; SameSite=Lax${securePart}`;
    }
    if (refreshToken) {
      document.cookie = `sb-refresh-token=${refreshToken}; Path=/; Max-Age=${maxAge}; SameSite=Lax${securePart}`;
    }

    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-')) keys.push(key);
    }
    console.log('🔐 [LOGIN PAGE] Claves sb-* tras login:', keys);

    // Verificar si el usuario es admin mediante API server-side (evita RLS)
    try {
      const userId = data.user?.id;
      if (userId) {
        console.log('🔐 [LOGIN PAGE] Verificando admin para userId:', userId);
        const res = await fetch('/api/auth/check-admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });
        const result = await res.json();
        console.log('🔐 [LOGIN PAGE] Resultado check-admin:', result);
        const isAdmin = result.isAdmin;

        if (isAdmin) {
          console.log('🔐 [LOGIN PAGE] Usuario es ADMIN, redirigiendo a /admin');
          window.location.href = '/admin';
          return;
        }
      }
    } catch (adminCheckErr) {
      console.warn('🔐 [LOGIN PAGE] Error verificando admin (no crítico):', adminCheckErr);
    }

    window.location.href = '/';
  });
}

if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', setupLogin);
}
