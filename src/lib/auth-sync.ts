/**
 * ============================================================================
 * Auth Sync Script
 * ============================================================================
 * PROPÓSITO: Inicializar el SessionStore ANTES de que cualquier componente
 * intente usar la autenticación.
 * 
 * EJECUCIÓN: Se importa en PublicLayout.astro como script
 * TIMING: Debe ejecutarse PRIMERO antes de hidratación de componentes
 * ============================================================================
 */

import { initializeSession } from '@stores/session';
import { initializeCart as initCart } from '@stores/cart';

(async function() {
  if (typeof window !== 'undefined') {
    console.log('🔐 [AUTH-SYNC] Inicializando SessionStore...');

    // CRÍTICO: Inicializar SessionStore PRIMERO
    await initializeSession();
    
    console.log('🔐 [AUTH-SYNC] ✅ SessionStore inicializado');
    console.log('🔐 [AUTH-SYNC] Inicializando CartStore...');
    
    // Esperar un tick para permitir que las suscripciones se registren
    await new Promise((resolve) => setTimeout(resolve, 50));
    
    // Ahora inicializar el carrito
    await initCart();
    
    console.log('🔐 [AUTH-SYNC] ✅ CartStore inicializado');
    console.log('🔐 [AUTH-SYNC] ========== INICIALIZACIÓN COMPLETADA ==========');
  }
})();
