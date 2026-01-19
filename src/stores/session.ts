/**
 * ============================================================================
 * Session Store
 * ============================================================================
 * PROPÓSITO: Sincronizar estado de autenticación con Supabase
 * - Una única fuente de verdad para la sesión del usuario
 * - Reactivo: otros stores pueden escuchar cambios
 * - Maneja login/logout/refresh automáticamente
 * ============================================================================
 */

import { atom, computed } from 'nanostores';
import { supabase } from '@lib/supabase';
import type { User, Session as SupabaseSession } from '@supabase/supabase-js';

// ============================================================================
// TIPOS
// ============================================================================
export interface SessionState {
  user: User | null;
  session: SupabaseSession | null;
  isLoading: boolean;
  error: string | null;
}

// ============================================================================
// STORES
// ============================================================================
export const sessionState = atom<SessionState>({
  user: null,
  session: null,
  isLoading: true,
  error: null,
});

// Store derivado: solo el usuario actual
export const currentUser = computed(sessionState, (state) => state.user);

// Store derivado: verificar si hay sesión activa
export const isAuthenticated = computed(sessionState, (state) => !!state.user);

// Store derivado: user ID para usar en carrito
export const currentUserId = computed(currentUser, (user) => user?.id || null);

// ============================================================================
// INICIALIZACIÓN: Sincronizar sesión desde Supabase
// ============================================================================
let isInitialized = false;

export async function initializeSession() {
  if (isInitialized) {
    console.log('🔐 [SESSION] Ya inicializado, skipping...');
    return;
  }

  if (typeof window === 'undefined') {
    console.log('🔐 [SESSION] SSR - skipping client-side initialization');
    return;
  }

  isInitialized = true;
  console.log('🔐 [SESSION] Inicializando session store...');

  try {
    // CRÍTICO: Supabase es la ÚNICA fuente de verdad
    // Siempre validar con Supabase, nunca confiar solo en localStorage
    console.log('🔐 [SESSION] Consultando sesión desde Supabase...');
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.warn('🔐 [SESSION] getSession() error:', error);
    }
    
    const liveSession = data?.session || null;
    const liveUser = liveSession?.user || null;

    if (liveUser) {
      console.log('🔐 [SESSION] ✅ Sesión válida desde Supabase:', liveUser.email);
      sessionState.set({
        user: liveUser,
        session: liveSession,
        isLoading: false,
        error: null,
      });
    } else {
      console.log('🔐 [SESSION] ❌ No hay sesión válida en Supabase');
      
      // Limpiar artefactos de sesión anterior: claves sb-user-* e sb-*-auth-token
      // Esto previene que un hard refresh lea sesiones antiguas/expiradas
      if (typeof window !== 'undefined') {
        const toRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('sb-') || key === 'last_cart_owner')) {
            toRemove.push(key);
          }
        }
        toRemove.forEach((k) => {
          localStorage.removeItem(k);
          console.log('🔐 [SESSION] Limpiado:', k);
        });
        
        // Notificar al carrito que se limpió
        window.dispatchEvent(new CustomEvent('lastCartOwnerCleared'));
      }
      
      sessionState.set({
        user: null,
        session: null,
        isLoading: false,
        error: null,
      });
    }
  } catch (error) {
    console.error('🔐 [SESSION] Error en inicialización:', error);
    sessionState.set({
      user: null,
      session: null,
      isLoading: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    });
  }

  // Registrar listener para cambios de autenticación
  registerAuthListener();
}

// ============================================================================
// AUTH STATE CHANGE LISTENER
// ============================================================================
function registerAuthListener() {
  console.log('🔐 [SESSION] Registrando listener de cambios de autenticación...');

  supabase.auth.onAuthStateChange((event, session) => {
    console.log('🔐 [SESSION] Auth state change:', event);
    console.log('🔐 [SESSION] Usuario:', session?.user?.email || 'null');

    const user = session?.user || null;

    switch (event) {
      case 'SIGNED_IN':
        console.log('🔐 [SESSION] ✅ Usuario SIGNED IN:', user?.email);
        sessionState.set({
          user,
          session,
          isLoading: false,
          error: null,
        });
        break;

      case 'SIGNED_OUT':
        console.log('🔐 [SESSION] ✅ Usuario SIGNED OUT - limpiando estado');
        
        // Limpiar localStorage completamente
        if (typeof window !== 'undefined') {
          const toRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('sb-') || key === 'last_cart_owner')) {
              toRemove.push(key);
            }
          }
          toRemove.forEach((k) => {
            localStorage.removeItem(k);
            console.log('🔐 [SESSION] Limpiado en SIGNED_OUT:', k);
          });
          
          // Notificar al carrito
          window.dispatchEvent(new CustomEvent('lastCartOwnerCleared'));
        }
        
        sessionState.set({
          user: null,
          session: null,
          isLoading: false,
          error: null,
        });
        console.log('🔐 [SESSION] ✅ Estado limpiado a null');
        break;

      case 'USER_UPDATED':
        console.log('🔐 [SESSION] ℹ️ Usuario UPDATED');
        sessionState.set({
          user,
          session,
          isLoading: false,
          error: null,
        });
        break;

      case 'TOKEN_REFRESHED':
        console.log('🔐 [SESSION] 🔄 TOKEN REFRESHED');
        sessionState.set({
          user,
          session,
          isLoading: false,
          error: null,
        });
        break;

      case 'INITIAL_SESSION':
        console.log('🔐 [SESSION] ℹ️ INITIAL_SESSION detectado');
        if (user) {
          console.log('🔐 [SESSION] Usuario en sesión inicial:', user.email);
          sessionState.set({
            user,
            session,
            isLoading: false,
            error: null,
          });
        } else {
          // CRÍTICO: Verificar si hay sesión en localStorage antes de limpiar
          const projectRef = import.meta.env.PUBLIC_SUPABASE_URL
            ? new URL(import.meta.env.PUBLIC_SUPABASE_URL).host.split('.')[0]
            : '';
          const storageKey = projectRef ? `sb-${projectRef}-auth-token` : '';
          const hasStoredSession = storageKey && typeof window !== 'undefined' 
            ? !!localStorage.getItem(storageKey) 
            : false;
          
          if (!hasStoredSession) {
            console.log('🔐 [SESSION] No hay usuario ni sesión almacenada');
            // Solo limpiar si NO hay sesión en localStorage
            if (typeof window !== 'undefined') {
              localStorage.removeItem('last_cart_owner');
              console.log('🔐 [SESSION] last_cart_owner limpiado en INITIAL_SESSION');
            }
          } else {
            console.log('🔐 [SESSION] Sesión encontrada en localStorage - esperando carga completa');
          }
          
          sessionState.set({
            user: null,
            session: null,
            isLoading: false,
            error: null,
          });
        }
        break;

      default:
        console.log('🔐 [SESSION] Evento desconocido:', event);
    }
  });

  console.log('🔐 [SESSION] ✅ Listener registrado');
}

// ============================================================================
// FUNCIONES PÚBLICAS
// ============================================================================

/**
 * Invalidar y reiniciar sesión (útil después de logout)
 */
export async function refreshSession() {
  console.log('🔐 [SESSION] Refrescando sesión...');
  sessionState.set({ ...sessionState.get(), isLoading: true });
  await initializeSession();
}

/**
 * Obtener estado actual de la sesión (para debugging)
 */
export function getSessionSnapshot() {
  return sessionState.get();
}
