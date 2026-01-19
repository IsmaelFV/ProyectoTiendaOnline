import { supabase } from '../lib/supabase';

// Separa la lógica en un script empaquetado para que los imports funcionen en el navegador
function setupLogin() {
  const form = document.querySelector<HTMLFormElement>('#login-form');
  if (!form) return;

  supabase.auth.onAuthStateChange((event, session) => {
    console.log('🔐 [LOGIN PAGE] onAuthStateChange:', event, 'user:', session?.user?.email || null);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = (form.querySelector<HTMLInputElement>('#email')?.value || '').trim();
    const password = form.querySelector<HTMLInputElement>('#password')?.value || '';

    if (!email || !password) {
      alert('Por favor ingresa email y contraseña');
      return;
    }

    console.log('🔐 [LOGIN PAGE] Enviando login...', email);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    console.log('🔐 [LOGIN PAGE] Resultado login:', { data, error });

    if (error) {
      alert(error.message || 'Error al iniciar sesión');
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    console.log('🔐 [LOGIN PAGE] Session tras login:', sessionData);

    // Copiar tokens a cookies para que las páginas SSR (perfil/pedidos) puedan leerlos
    const accessToken = sessionData.session?.access_token;
    const refreshToken = sessionData.session?.refresh_token;
    const maxAge = 60 * 60 * 24 * 7; // 7 días
    if (accessToken) {
      document.cookie = `sb-access-token=${accessToken}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
    }
    if (refreshToken) {
      document.cookie = `sb-refresh-token=${refreshToken}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
    }

    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-')) keys.push(key);
    }
    console.log('🔐 [LOGIN PAGE] Claves sb-* tras login:', keys);

    window.location.href = '/';
  });
}

if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', setupLogin);
}
