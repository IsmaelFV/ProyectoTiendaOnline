/**
 * ============================================================================
 * Rate Limiting — utilidad reutilizable para endpoints API
 * ============================================================================
 * Implementa rate limiting en memoria por IP con auto-purga.
 * Cada instancia mantiene su propio Map de intentos.
 */

export interface RateLimiterConfig {
  /** Máx intentos permitidos por ventana */
  maxAttempts: number;
  /** Ventana de tiempo en milisegundos */
  windowMs: number;
  /** Umbral para auto-purga de entradas expiradas (default 500) */
  purgeThreshold?: number;
}

export class RateLimiter {
  private attempts = new Map<string, { count: number; firstAttempt: number }>();
  private maxAttempts: number;
  private windowMs: number;
  private purgeThreshold: number;

  constructor(config: RateLimiterConfig) {
    this.maxAttempts = config.maxAttempts;
    this.windowMs = config.windowMs;
    this.purgeThreshold = config.purgeThreshold ?? 500;
  }

  /**
   * Verifica si una IP ha excedido el rate limit.
   * @returns true si la petición está PERMITIDA, false si excede el límite.
   */
  check(ip: string): boolean {
    const now = Date.now();
    const entry = this.attempts.get(ip);

    if (entry) {
      if (now - entry.firstAttempt > this.windowMs) {
        // Ventana expirada — reiniciar
        this.attempts.set(ip, { count: 1, firstAttempt: now });
      } else if (entry.count >= this.maxAttempts) {
        return false; // Límite excedido
      } else {
        entry.count++;
      }
    } else {
      this.attempts.set(ip, { count: 1, firstAttempt: now });
    }

    // Auto-purga para evitar memory leaks
    if (this.attempts.size > this.purgeThreshold) {
      for (const [key, data] of this.attempts) {
        if (now - data.firstAttempt > this.windowMs) this.attempts.delete(key);
      }
    }

    return true;
  }
}

/**
 * Extrae la IP del cliente de los headers de la request.
 */
export function getClientIP(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
}
