/**
 * ============================================================================
 * Logger centralizado
 * ============================================================================
 * PROPÓSITO: Reemplazar los if (import.meta.env.DEV) console.log(...) dispersos.
 * - En DEV: imprime todos los niveles
 * - En PROD: solo imprime error (warn silenciado para no ensuciar)
 * ============================================================================
 */

const isDev = import.meta.env.DEV;

export const logger = {
  /** Solo en DEV – información de depuración verbose */
  debug(...args: unknown[]) {
    if (isDev) console.log(...args);
  },

  /** Solo en DEV – información operativa */
  info(...args: unknown[]) {
    if (isDev) console.info(...args);
  },

  /** Solo en DEV – advertencias no críticas */
  warn(...args: unknown[]) {
    if (isDev) console.warn(...args);
  },

  /** Siempre – errores que necesitan atención */
  error(...args: unknown[]) {
    console.error(...args);
  },
};
