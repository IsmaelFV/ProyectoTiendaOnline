/**
 * ============================================================================
 * Popup Newsletter con Código Promocional
 * ============================================================================
 * Aparece después de 5 segundos en la primera visita
 * Ofrece un código de descuento a cambio del email
 */
import { useState, useEffect } from 'react';

interface NewsletterPopupProps {
  promoCode?: string;
  discountPercentage?: number;
}

export default function NewsletterPopup({ 
  promoCode = 'BIENVENIDO10', 
  discountPercentage = 10 
}: NewsletterPopupProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    const hasSeenPopup = localStorage.getItem('newsletter_popup_seen');
    const hasSubscribed = localStorage.getItem('newsletter_subscribed');
    
    if (!hasSeenPopup && !hasSubscribed) {
      const timer = setTimeout(() => {
        setIsOpen(true);
        localStorage.setItem('newsletter_popup_seen', 'true');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Por favor, introduce un email válido');
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, promoCode })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error al suscribirse');
      localStorage.setItem('newsletter_subscribed', 'true');
      setShowSuccess(true);
    } catch {
      localStorage.setItem('newsletter_subscribed', 'true');
      setShowSuccess(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => setIsOpen(false), 300);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(promoCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/70 z-50 backdrop-blur-sm transition-opacity duration-300 ${isClosing ? 'opacity-0' : 'opacity-100'}`}
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className={`relative max-w-md w-full overflow-hidden rounded-2xl border border-gray-800 shadow-2xl shadow-black/50 transition-all duration-300 ${
            isClosing ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
          }`}
          style={{ background: 'linear-gradient(145deg, #171717 0%, #0a0a0a 100%)' }}
        >
          {/* Decoración dorada superior */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#d4af37] to-transparent" />

          {/* Botón cerrar */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors z-10 p-1"
            aria-label="Cerrar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {!showSuccess ? (
            <div className="p-8 pt-10">
              {/* Badge descuento */}
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full border-2 border-[#d4af37]/30 flex items-center justify-center"
                    style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.15) 0%, transparent 70%)' }}>
                    <div className="text-center">
                      <span className="block text-3xl font-bold text-[#d4af37]">{discountPercentage}%</span>
                      <span className="block text-[10px] uppercase tracking-[0.2em] text-[#d4af37]/70">dto</span>
                    </div>
                  </div>
                  {/* Brillo decorativo */}
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#d4af37] rounded-full opacity-60 blur-sm" />
                </div>
              </div>

              {/* Texto */}
              <h3 className="text-center text-xl font-serif text-white mb-2">
                Únete a la experiencia
              </h3>
              <p className="text-center text-gray-400 text-sm mb-6 leading-relaxed">
                Suscríbete y recibe un <span className="text-[#d4af37] font-medium">{discountPercentage}% de descuento</span> exclusivo en tu primera compra.
              </p>

              {/* Formulario */}
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(''); }}
                    placeholder="tu@email.com"
                    className="w-full px-4 py-3.5 bg-gray-900/80 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#d4af37]/50 focus:ring-1 focus:ring-[#d4af37]/30 transition-all text-sm"
                    required
                  />
                  {error && (
                    <p className="absolute -bottom-5 left-0 text-red-400 text-xs">{error}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full py-3.5 rounded-xl font-medium text-sm tracking-wide transition-all duration-200 ${
                    isSubmitting
                      ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-[#d4af37] to-[#b8942e] text-gray-950 hover:from-[#e8c96d] hover:to-[#d4af37] hover:shadow-lg hover:shadow-[#d4af37]/20'
                  }`}
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Procesando...
                    </span>
                  ) : 'Obtener mi descuento'}
                </button>
              </form>

              {/* Separador */}
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-gray-800" />
                <span className="text-gray-600 text-xs">o</span>
                <div className="flex-1 h-px bg-gray-800" />
              </div>

              {/* Disclaimer + No gracias */}
              <p className="text-[11px] text-gray-600 text-center leading-relaxed">
                Recibirás novedades y ofertas exclusivas. Puedes darte de baja cuando quieras.
              </p>
              <button
                onClick={handleClose}
                className="w-full mt-3 text-gray-500 text-xs hover:text-gray-300 transition-colors"
              >
                No, gracias
              </button>
            </div>
          ) : (
            /* Vista de éxito */
            <div className="p-8 pt-10 text-center">
              {/* Icono éxito */}
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 rounded-full border-2 border-emerald-500/30 flex items-center justify-center"
                  style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)' }}>
                  <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>

              <h3 className="text-xl font-serif text-white mb-2">
                ¡Bienvenido/a!
              </h3>
              <p className="text-gray-400 text-sm mb-6">
                Tu código de descuento exclusivo:
              </p>

              {/* Código */}
              <div className="relative bg-gray-900/80 border border-gray-700 rounded-xl p-5 mb-6">
                <div className="flex items-center justify-center gap-3">
                  <span className="text-2xl font-bold tracking-[0.15em] text-[#d4af37]">
                    {promoCode}
                  </span>
                  <button
                    onClick={copyCode}
                    className="p-2 rounded-lg border border-gray-700 hover:border-[#d4af37]/50 hover:bg-[#d4af37]/10 transition-all"
                    title="Copiar código"
                  >
                    {copied ? (
                      <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                </div>
                {copied && (
                  <p className="text-emerald-400 text-xs mt-2 animate-pulse">¡Copiado!</p>
                )}
                <p className="text-[#d4af37]/60 text-xs mt-2">
                  {discountPercentage}% de descuento en tu primera compra
                </p>
              </div>

              {/* CTA */}
              <a
                href="/productos"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-[#d4af37] to-[#b8942e] text-gray-950 px-8 py-3 rounded-xl font-medium text-sm hover:from-[#e8c96d] hover:to-[#d4af37] hover:shadow-lg hover:shadow-[#d4af37]/20 transition-all"
              >
                Explorar la colección
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </a>
            </div>
          )}

          {/* Decoración dorada inferior */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#d4af37]/30 to-transparent" />
        </div>
      </div>
    </>
  );
}
