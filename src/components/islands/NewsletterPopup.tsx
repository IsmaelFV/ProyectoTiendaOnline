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

  useEffect(() => {
    // Verificar si ya se mostró el popup
    const hasSeenPopup = localStorage.getItem('newsletter_popup_seen');
    const hasSubscribed = localStorage.getItem('newsletter_subscribed');
    
    if (!hasSeenPopup && !hasSubscribed) {
      // Mostrar después de 5 segundos
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

    // Validación email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Por favor, introduce un email válido');
      setIsSubmitting(false);
      return;
    }

    try {
      // Aquí podrías enviar a tu backend o servicio de newsletter (Brevo, Mailchimp, etc.)
      const response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, promoCode })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al suscribirse');
      }

      localStorage.setItem('newsletter_subscribed', 'true');
      setShowSuccess(true);
    } catch (err: any) {
      // Si el endpoint no existe, simular éxito para demo
      console.warn('Newsletter endpoint no disponible, simulando éxito');
      localStorage.setItem('newsletter_subscribed', 'true');
      setShowSuccess(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(promoCode);
    alert('¡Código copiado al portapapeles!');
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden relative">
          {/* Botón cerrar */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10"
            aria-label="Cerrar"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {!showSuccess ? (
            <div className="flex flex-col md:flex-row">
              {/* Imagen lateral */}
              <div className="hidden md:block md:w-2/5 bg-gradient-to-br from-brand-navy to-brand-charcoal p-8 text-white">
                <div className="h-full flex flex-col justify-center">
                  <span className="text-6xl font-bold">{discountPercentage}%</span>
                  <span className="text-2xl font-light mt-2">DESCUENTO</span>
                  <div className="mt-6 pt-6 border-t border-white/20">
                    <p className="text-sm text-white/80">
                      En tu primera compra suscribiéndote a nuestra newsletter
                    </p>
                  </div>
                </div>
              </div>

              {/* Contenido */}
              <div className="p-8 md:w-3/5">
                <div className="md:hidden text-center mb-6">
                  <span className="inline-block bg-brand-gold text-brand-navy px-4 py-2 rounded-full font-bold text-lg">
                    {discountPercentage}% DESCUENTO
                  </span>
                </div>

                <h3 className="text-2xl font-serif font-bold text-brand-navy mb-2">
                  ¡Bienvenido/a a FashionMarket!
                </h3>
                <p className="text-gray-600 mb-6">
                  Suscríbete a nuestra newsletter y obtén un <strong>{discountPercentage}% de descuento</strong> en tu primera compra.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Tu email"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy focus:border-transparent"
                      required
                    />
                    {error && (
                      <p className="text-red-600 text-sm mt-1">{error}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`w-full bg-brand-navy text-white py-3 rounded-lg font-medium transition-colors ${
                      isSubmitting ? 'opacity-75 cursor-not-allowed' : 'hover:bg-brand-charcoal'
                    }`}
                  >
                    {isSubmitting ? 'Suscribiendo...' : 'Obtener mi descuento'}
                  </button>
                </form>

                <p className="text-xs text-gray-500 mt-4 text-center">
                  Al suscribirte, aceptas recibir emails promocionales. Puedes darte de baja en cualquier momento.
                </p>

                <button
                  onClick={handleClose}
                  className="w-full mt-4 text-gray-500 text-sm hover:text-gray-700"
                >
                  No, gracias
                </button>
              </div>
            </div>
          ) : (
            /* Vista de éxito */
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <h3 className="text-2xl font-serif font-bold text-brand-navy mb-2">
                ¡Gracias por suscribirte!
              </h3>
              <p className="text-gray-600 mb-6">
                Aquí tienes tu código de descuento exclusivo:
              </p>

              <div className="bg-gray-100 rounded-xl p-6 mb-6">
                <p className="text-sm text-gray-500 mb-2">Tu código:</p>
                <div className="flex items-center justify-center gap-3">
                  <span className="text-3xl font-bold text-brand-navy tracking-wider">
                    {promoCode}
                  </span>
                  <button
                    onClick={copyCode}
                    className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                    title="Copiar código"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
                <p className="text-sm text-green-600 font-medium mt-2">
                  {discountPercentage}% de descuento en tu primera compra
                </p>
              </div>

              <a
                href="/productos"
                className="inline-block bg-brand-navy text-white px-8 py-3 rounded-lg font-medium hover:bg-brand-charcoal transition-colors"
              >
                Empezar a comprar →
              </a>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
